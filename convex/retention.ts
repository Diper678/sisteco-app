import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// ─────────────────────────────────────────────────────────────────────────────
// Sisteco — Retention Lifecycle Engine
// Cumple Ley 21.719 Art. 14 (deber de suprimir datos obsoletos)
//
// FLUJO:
//   1. scanExpiredLeads (diario 03:00 UTC) — detecta leads sin interaccion
//      por 24+ meses, anonimiza PII y agenda hard-delete en 30 dias.
//   2. hardDeleteExpired (diario 04:00 UTC) — elimina permanentemente los
//      registros que cumplieron el periodo de gracia de 30 dias.
//   3. updateInteraction — llamado cuando hay interaccion real con un lead
//      (apertura email, llamada, reunion). Reinicia el timer respetando
//      techo de 36 meses desde discoveredAt.
//
// CONSTANTES (alineadas con 04-CONTEXT.md decisiones):
//   DEFAULT_RETENTION = 24 meses (sin interaccion)
//   MAX_RETENTION     = 36 meses (techo absoluto desde discoveredAt)
//   GRACE_PERIOD      = 30 dias  (soft-delete → hard-delete)
// ─────────────────────────────────────────────────────────────────────────────

const RETENTION_MS = 24 * 30 * 24 * 60 * 60 * 1000;     // ~24 months (~720 days)
const MAX_RETENTION_MS = 36 * 30 * 24 * 60 * 60 * 1000;  // ~36 months (~1080 days)
const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;         // 30 days grace period
const BATCH_SIZE = 100;

// ─────────────────────────────────────────────────────────────────────────────
// scanExpiredLeads — Anonimiza PII de leads expirados y agenda hard-delete
//
// Ejecutado diariamente a las 03:00 UTC (00:00 Chile).
// Procesa leads cuya fechaExpiracion ya paso y que no estan en estados
// terminales (opt_out, eliminado, anonimizado).
// ─────────────────────────────────────────────────────────────────────────────
export const scanExpiredLeads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Obtener todos los leads con fechaExpiracion en el pasado
    // No se puede combinar multiples condiciones con un solo indice,
    // por lo que consultamos el indice by_fechaExpiracion y filtramos estados.
    const candidatos = await ctx.db
      .query("leads")
      .withIndex("by_fechaExpiracion")
      .filter((q) => q.lt(q.field("fechaExpiracion"), now))
      .take(BATCH_SIZE);

    // Filtrar leads que ya estan en estado terminal
    const expirados = candidatos.filter((lead) =>
      lead.complianceStatus !== "opt_out" &&
      lead.complianceStatus !== "eliminado" &&
      lead.complianceStatus !== "anonimizado"
    );

    let processed = 0;

    for (const lead of expirados) {
      const auditTrail = lead.auditTrail || [];

      await ctx.db.patch(lead._id, {
        // Marcar como expirado y agendar hard-delete
        complianceStatus: "anonimizado",
        softDeletedAt: now,
        hardDeleteScheduledAt: now + GRACE_PERIOD_MS,
        lastUpdatedAt: now,

        // Anonimizar PII — reemplazar datos personales identificables
        contacto: "[EXPIRADO]",
        email: `expired-${lead._id}@retention.local`,
        telefono: undefined,
        linkedinUrl: undefined,

        // Audit trail
        auditTrail: [
          ...auditTrail,
          {
            accion: "Retencion expirada — datos anonimizados automaticamente",
            usuarioId: "system",
            usuarioNombre: "Retention Cron",
            timestamp: now,
          },
        ],
      });

      processed++;
    }

    console.log(`Retention scan: ${processed} leads processed (${now})`);
    return { processed };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// hardDeleteExpired — Eliminacion permanente post-periodo-de-gracia
//
// Ejecutado diariamente a las 04:00 UTC (01:00 Chile), 1 hora despues
// de scanExpiredLeads para garantizar orden de operaciones.
// Elimina permanentemente los leads que:
//   - Tienen complianceStatus opt_out | expirado | anonimizado
//   - Y cuyo hardDeleteScheduledAt ya paso
// ─────────────────────────────────────────────────────────────────────────────
export const hardDeleteExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Buscar leads en estado terminal con hard-delete programado en el pasado
    const paraEliminar = await ctx.db
      .query("leads")
      .withIndex("by_complianceStatus", (q) =>
        q.eq("complianceStatus", "anonimizado")
      )
      .filter((q) =>
        q.and(
          q.neq(q.field("hardDeleteScheduledAt"), undefined),
          q.lt(q.field("hardDeleteScheduledAt"), now)
        )
      )
      .take(BATCH_SIZE);

    // Tambien incluir opt_out expirados
    const optOutExpirados = await ctx.db
      .query("leads")
      .withIndex("by_complianceStatus", (q) =>
        q.eq("complianceStatus", "opt_out")
      )
      .filter((q) =>
        q.and(
          q.neq(q.field("hardDeleteScheduledAt"), undefined),
          q.lt(q.field("hardDeleteScheduledAt"), now)
        )
      )
      .take(BATCH_SIZE);

    // Combinar ambas listas (sin superar BATCH_SIZE total)
    const todos = [...paraEliminar, ...optOutExpirados].slice(0, BATCH_SIZE);

    let deleted = 0;

    for (const lead of todos) {
      await ctx.db.delete(lead._id);
      deleted++;
    }

    console.log(`Hard delete batch: ${deleted} leads permanently deleted (${now})`);
    return { deleted };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// updateInteraction — Reinicia el timer de retencion al registrar interaccion
//
// Llamado cuando hay interaccion real con el lead:
//   - Apertura de email de outreach
//   - Llamada telefonica registrada
//   - Reunion agendada o realizada
//   - Respuesta al cold email
//
// Respeta techo de 36 meses desde discoveredAt — nunca lo supera.
// No extiende leads en estados terminales (opt_out, eliminado, anonimizado).
// ─────────────────────────────────────────────────────────────────────────────
export const updateInteraction = internalMutation({
  args: {
    leadId: v.id("leads"),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);

    // Si el lead no existe, retornar silenciosamente
    if (!lead) return { success: false, motivo: "lead_not_found" };

    // No extender leads en estados terminales
    if (
      lead.complianceStatus === "opt_out" ||
      lead.complianceStatus === "eliminado" ||
      lead.complianceStatus === "anonimizado"
    ) {
      return { success: false, motivo: "estado_terminal" };
    }

    const now = Date.now();

    // Calcular nueva expiracion: ahora + 24 meses, con techo 36 meses desde discoveredAt
    const newExpiry = now + RETENTION_MS;
    const maxExpiry = (lead.discoveredAt || now) + MAX_RETENTION_MS;
    const finalExpiry = Math.min(newExpiry, maxExpiry);

    await ctx.db.patch(args.leadId, {
      ultimaInteraccion: now,
      fechaExpiracion: finalExpiry,
      lastUpdatedAt: now,
    });

    return { success: true, nuevaExpiracion: finalExpiry };
  },
});

// Sisteco Compliance — Opt-out y blacklist global para Ley 21.719
//
// Este modulo maneja el ciclo de vida completo del opt-out:
//   1. Buscar leads por email en TODOS los tenants (cross-tenant por diseno)
//   2. Anonimizar PII en cada lead encontrado (soft delete)
//   3. Agregar email a la blacklist global (persiste despues de hard-delete)
//   4. executeGlobalOptOut orquesta los pasos 1-3
//
// IMPORTANTE: Estas funciones son `internal` — no se exponen al cliente.
// Solo pueden ser llamadas desde HTTP handlers, crons, y otras mutaciones internas.
//
// Ref: CONTEXT.md Area 2 Decision 4 — "Opt-out global instantaneo:
//      blacklist global en Convex, elimina de TODOS los tenants"

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// ── QUERIES ───────────────────────────────────────────────────────────────────

/**
 * findLeadsByEmail — Busca todos los leads con este email en TODOS los tenants.
 * Usa el indice by_email (legacy SAAN v1.0 — sin orgId) para busqueda cross-tenant.
 * Esto es intencional: el opt-out es global por diseno.
 */
export const findLeadsByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("leads")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
  },
});

/**
 * checkBlacklist — Verifica si un email ya esta en la blacklist global.
 * Retorna true si el email esta blacklisted, false en caso contrario.
 * Usar antes de importar leads para evitar re-importacion de opted-out.
 */
export const checkBlacklist = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const entry = await ctx.db
      .query("optOutBlacklist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    return entry !== null;
  },
});

// ── MUTATIONS ─────────────────────────────────────────────────────────────────

/**
 * softDeleteLead — Anonimiza PII de un lead por su ID.
 * Acciones:
 *   - Reemplaza contacto, email, telefono, linkedinUrl con valores anonimos
 *   - Marca complianceStatus: "opt_out"
 *   - Establece optOutAt, softDeletedAt
 *   - Programa hard delete en 30 dias (hardDeleteScheduledAt)
 *   - Cierra el lead como descartado
 *   - Agrega entrada al audit trail por Compliance Bot
 *
 * NOTA: empresa, industria, tamano se mantienen para estadisticas anonimizadas.
 */
export const softDeleteLead = internalMutation({
  args: { leadId: v.id("leads") },
  handler: async (ctx, { leadId }) => {
    const lead = await ctx.db.get(leadId);
    if (!lead) return;

    const now = Date.now();
    const auditTrail = lead.auditTrail || [];

    await ctx.db.patch(leadId, {
      // Anonimizar PII — nunca revertible despues del hard delete
      contacto: "[ELIMINADO]",
      email: `anon-${leadId}@eliminated.local`,
      telefono: undefined,
      linkedinUrl: undefined,
      // Estado de compliance
      complianceStatus: "opt_out",
      optOutAt: now,
      softDeletedAt: now,
      hardDeleteScheduledAt: now + 30 * 24 * 60 * 60 * 1000, // +30 dias gracia
      // Cerrar el lead en el pipeline
      estado: "cerrado",
      subestado: "descartado",
      lastUpdatedAt: now,
      // Audit trail — registrar para trazabilidad regulatoria
      auditTrail: [
        ...auditTrail,
        {
          accion: "Opt-out procesado — datos anonimizados",
          usuarioId: "system",
          usuarioNombre: "Compliance Bot",
          timestamp: now,
        },
      ],
    });
  },
});

/**
 * addToBlacklist — Agrega un email a la blacklist global de opt-out.
 * Si el email ya existe, retorna el _id existente (idempotente).
 * La blacklist persiste incluso despues del hard-delete del lead.
 *
 * NOTA sobre emailHash: En produccion se usaria SHA-256. Sin embargo,
 * las mutations de Convex corren en V8 sin acceso a crypto.subtle.
 * Las internalActions si tienen acceso, pero la blacklist debe insertarse
 * en la misma transaccion de la mutation. Por ahora se almacena el email
 * directamente como "hash" para mantener el contrato del campo emailHash.
 * El indice by_email ya provee lookup eficiente sin exponer PII en URLs.
 */
export const addToBlacklist = internalMutation({
  args: {
    email: v.string(),
    emailHash: v.string(),
    source: v.string(),
    motivo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verificar si ya esta en la blacklist (idempotente)
    const existing = await ctx.db
      .query("optOutBlacklist")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("optOutBlacklist", {
      email: args.email,
      emailHash: args.emailHash,
      optOutAt: Date.now(),
      source: args.source as
        | "email_link"
        | "formulario_web"
        | "arco_solicitud"
        | "manual",
      motivo: args.motivo,
      tenantsNotified: [],
    });
  },
});

/**
 * executeGlobalOptOut — Orquestador principal del opt-out global.
 * Pasos:
 *   1. Agrega email a la blacklist global (inline — sin llamar otra mutation)
 *   2. Busca todos los leads con este email en todos los tenants
 *   3. Anonimiza PII de cada lead encontrado (inline)
 *   4. Retorna { blacklisted, leadsAffected, tenantsAfectados }
 *
 * Es llamado desde:
 *   - /opt-out/confirm (HTTP GET, despues de verificacion por email)
 *   - /unsubscribe (HTTP POST, one-click RFC 8058)
 *   - Potencialmente desde arco supresion verificada
 *
 * NOTA sobre llamadas a otras mutations: Las mutations de Convex NO pueden
 * llamar a otras mutations directamente. La logica se inlinea aqui.
 */
export const executeGlobalOptOut = internalMutation({
  args: {
    email: v.string(),
    motivo: v.optional(v.string()),
  },
  handler: async (ctx, { email, motivo }) => {
    const now = Date.now();

    // ── Paso 1: Agregar a blacklist global (inline) ───────────────────────────
    // Nota: emailHash = email por limitacion del runtime V8 de Convex (sin crypto.subtle)
    // En una internalAction si podriamos hacer SHA-256, pero necesitamos transaccionalidad.
    const existingBlacklist = await ctx.db
      .query("optOutBlacklist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!existingBlacklist) {
      await ctx.db.insert("optOutBlacklist", {
        email: email,
        emailHash: email, // limitacion V8: sin crypto.subtle en mutations
        optOutAt: now,
        source: "formulario_web",
        motivo: motivo,
        tenantsNotified: [],
      });
    }

    // ── Paso 2: Buscar todos los leads con este email (cross-tenant) ──────────
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();

    // ── Paso 3: Anonimizar PII de cada lead encontrado (inline) ──────────────
    const tenantsAfectados: string[] = [];

    for (const lead of leads) {
      // Recolectar orgIds unicos para reporte
      if (lead.orgId && !tenantsAfectados.includes(lead.orgId)) {
        tenantsAfectados.push(lead.orgId);
      }

      // Solo procesar si no esta ya anonimizado
      if (
        lead.complianceStatus === "opt_out" ||
        lead.complianceStatus === "eliminado" ||
        lead.complianceStatus === "anonimizado"
      ) {
        continue;
      }

      const auditTrail = lead.auditTrail || [];

      await ctx.db.patch(lead._id, {
        contacto: "[ELIMINADO]",
        email: `anon-${lead._id}@eliminated.local`,
        telefono: undefined,
        linkedinUrl: undefined,
        complianceStatus: "opt_out",
        optOutAt: now,
        optOutMotivo: motivo,
        softDeletedAt: now,
        hardDeleteScheduledAt: now + 30 * 24 * 60 * 60 * 1000,
        estado: "cerrado",
        subestado: "descartado",
        lastUpdatedAt: now,
        auditTrail: [
          ...auditTrail,
          {
            accion: "Opt-out procesado — datos anonimizados",
            usuarioId: "system",
            usuarioNombre: "Compliance Bot",
            timestamp: now,
          },
        ],
      });
    }

    return {
      blacklisted: true,
      leadsAffected: leads.length,
      tenantsAfectados,
    };
  },
});

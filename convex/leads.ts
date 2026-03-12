import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ─────────────────────────────────────────────────────────────────────────────
// Sisteco Leads — Multi-tenant queries y mutations
//
// CRITICO: TODA funcion extrae orgId desde el JWT (ctx.auth.getUserIdentity())
// NUNCA usar orgId del argumento — el cliente puede falsificarlo.
//
// Patron de aislamiento:
//   const identity = await ctx.auth.getUserIdentity();
//   if (!identity) throw new Error("Unauthenticated");
//   const orgId = identity["org_id"] as string;
//   if (!orgId) throw new Error("No active organization");
// ─────────────────────────────────────────────────────────────────────────────

// ── Helper para extraer orgId del JWT ────────────────────────────────────────
async function getOrgId(ctx: any): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const orgId = identity["org_id"] as string;
  if (!orgId) throw new Error("No active organization. Configure Clerk Organizations.");
  return orgId;
}

// ── QUERIES ───────────────────────────────────────────────────────────────────

/**
 * getLeadsByOrg — Lista todos los leads de la org, ordenados desc, max 200
 * DASH-07: One-shot query, no reactive subscription
 */
export const getLeadsByOrg = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await getOrgId(ctx);
    return await ctx.db
      .query("leads")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(200);
  },
});

/**
 * getLeadsByStatus — Lista leads por estado para la org
 */
export const getLeadsByStatus = query({
  args: {
    estado: v.union(
      v.literal("sin_asignar"),
      v.literal("asignado"),
      v.literal("en_progreso"),
      v.literal("cerrado")
    ),
  },
  handler: async (ctx, args) => {
    const orgId = await getOrgId(ctx);
    return await ctx.db
      .query("leads")
      .withIndex("by_orgId_estado", (q) =>
        q.eq("orgId", orgId).eq("estado", args.estado)
      )
      .order("desc")
      .collect();
  },
});

/**
 * getLeadById — Obtiene un lead individual, verifica que pertenece a la org
 */
export const getLeadById = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    const orgId = await getOrgId(ctx);
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead no encontrado");
    if (lead.orgId !== orgId) throw new Error("Forbidden");
    return lead;
  },
});

/**
 * getLeadsStats — Estadisticas agregadas para el dashboard CEO/VP
 * Cuenta leads por estado, scoreCategory, y metricas temporales
 */
export const getLeadsStats = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await getOrgId(ctx);

    // Obtener todos los leads de la org (max 200)
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();

    const now = Date.now();
    const hace30Dias = now - 30 * 24 * 60 * 60 * 1000;

    // Conteos por estado
    const porEstado = {
      sin_asignar: 0,
      asignado: 0,
      en_progreso: 0,
      cerrado: 0,
    };

    // Conteos por scoreCategory
    const porScore = {
      HOT: 0,
      WARM: 0,
      NURTURE: 0,
      SKIP: 0,
    };

    let nuevosUltimos30Dias = 0;
    let cerradosGanados = 0;

    for (const lead of leads) {
      // Por estado
      if (lead.estado && lead.estado in porEstado) {
        porEstado[lead.estado as keyof typeof porEstado]++;
      }
      // Por score
      if (lead.scoreCategory && lead.scoreCategory in porScore) {
        porScore[lead.scoreCategory as keyof typeof porScore]++;
      }
      // Nuevos en ultimos 30 dias
      if (lead.discoveredAt >= hace30Dias) {
        nuevosUltimos30Dias++;
      }
      // Ganados para tasa de conversion
      if (lead.estado === "cerrado" && lead.subestado === "ganado") {
        cerradosGanados++;
      }
    }

    const totalLeads = leads.length;
    const tasaConversion = totalLeads > 0
      ? Math.round((cerradosGanados / totalLeads) * 1000) / 10
      : 0;

    return {
      total: totalLeads,
      porEstado,
      porScore,
      nuevosUltimos30Dias,
      cerradosGanados,
      tasaConversion,
    };
  },
});

// ── MUTATIONS ─────────────────────────────────────────────────────────────────

/**
 * updateLeadStatus — Cambia el estado de un lead, actualiza audit trail
 */
export const updateLeadStatus = mutation({
  args: {
    leadId: v.id("leads"),
    nuevoEstado: v.union(
      v.literal("sin_asignar"),
      v.literal("asignado"),
      v.literal("en_progreso"),
      v.literal("cerrado")
    ),
    subestado: v.optional(v.union(
      v.literal("ganado"),
      v.literal("perdido"),
      v.literal("descartado")
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const orgId = identity["org_id"] as string;
    if (!orgId) throw new Error("No active organization");

    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead no encontrado");
    if (lead.orgId !== orgId) throw new Error("Forbidden");

    const estadoAnterior = lead.estado || "sin_asignar";
    const auditTrail = lead.auditTrail || [];

    await ctx.db.patch(args.leadId, {
      estado: args.nuevoEstado,
      subestado: args.subestado,
      lastUpdatedAt: Date.now(),
      auditTrail: [
        ...auditTrail,
        {
          accion: `Estado cambiado: ${estadoAnterior} → ${args.nuevoEstado}${args.subestado ? ` (${args.subestado})` : ""}`,
          usuarioId: identity.subject,
          usuarioNombre: identity.name || "Usuario",
          timestamp: Date.now(),
        },
      ],
    });

    return { success: true };
  },
});

/**
 * assignLead — Asigna un lead a un SDR, cambia estado a "asignado"
 */
export const assignLead = mutation({
  args: {
    leadId: v.id("leads"),
    sdrUserId: v.string(),
    sdrNombre: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const orgId = identity["org_id"] as string;
    if (!orgId) throw new Error("No active organization");

    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead no encontrado");
    if (lead.orgId !== orgId) throw new Error("Forbidden");

    const auditTrail = lead.auditTrail || [];

    await ctx.db.patch(args.leadId, {
      asignadoA: args.sdrUserId,
      asignadoNombre: args.sdrNombre,
      estado: "asignado",
      lastUpdatedAt: Date.now(),
      auditTrail: [
        ...auditTrail,
        {
          accion: `Lead asignado a ${args.sdrNombre}`,
          usuarioId: identity.subject,
          usuarioNombre: identity.name || "Usuario",
          timestamp: Date.now(),
        },
      ],
    });

    return { success: true };
  },
});

/**
 * bulkAssignLeads — Asigna multiples leads a un SDR en una sola operacion
 */
export const bulkAssignLeads = mutation({
  args: {
    leadIds: v.array(v.id("leads")),
    sdrUserId: v.string(),
    sdrNombre: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const orgId = identity["org_id"] as string;
    if (!orgId) throw new Error("No active organization");

    let asignados = 0;
    const now = Date.now();

    for (const leadId of args.leadIds) {
      const lead = await ctx.db.get(leadId);
      if (!lead || lead.orgId !== orgId) continue; // skip si no pertenece a la org

      const auditTrail = lead.auditTrail || [];
      await ctx.db.patch(leadId, {
        asignadoA: args.sdrUserId,
        asignadoNombre: args.sdrNombre,
        estado: "asignado",
        lastUpdatedAt: now,
        auditTrail: [
          ...auditTrail,
          {
            accion: `Lead asignado a ${args.sdrNombre} (asignacion masiva)`,
            usuarioId: identity.subject,
            usuarioNombre: identity.name || "Usuario",
            timestamp: now,
          },
        ],
      });
      asignados++;
    }

    return { success: true, asignados };
  },
});

/**
 * reasignarLead — Reasigna un lead de un SDR a otro (VP puede hacer esto)
 */
export const reasignarLead = mutation({
  args: {
    leadId: v.id("leads"),
    nuevoSdrUserId: v.string(),
    nuevoSdrNombre: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const orgId = identity["org_id"] as string;
    if (!orgId) throw new Error("No active organization");

    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead no encontrado");
    if (lead.orgId !== orgId) throw new Error("Forbidden");

    const sdrAnterior = lead.asignadoNombre || "Sin asignar";
    const auditTrail = lead.auditTrail || [];

    await ctx.db.patch(args.leadId, {
      asignadoA: args.nuevoSdrUserId,
      asignadoNombre: args.nuevoSdrNombre,
      estado: "asignado",
      lastUpdatedAt: Date.now(),
      auditTrail: [
        ...auditTrail,
        {
          accion: `Lead reasignado: ${sdrAnterior} → ${args.nuevoSdrNombre}`,
          usuarioId: identity.subject,
          usuarioNombre: identity.name || "Usuario",
          timestamp: Date.now(),
        },
      ],
    });

    return { success: true };
  },
});

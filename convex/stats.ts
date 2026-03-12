import { query } from "./_generated/server";

// ─────────────────────────────────────────────────────────────────────────────
// Sisteco Stats — Aggregation queries para dashboard CEO/VP
//
// CRITICO: orgId extraido del JWT, nunca de args
// Todas las funciones filtran por orgId del usuario autenticado
// ─────────────────────────────────────────────────────────────────────────────

// ── Helper para extraer orgId del JWT ────────────────────────────────────────
async function getOrgId(ctx: any): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const orgId = identity["org_id"] as string;
  if (!orgId) throw new Error("No active organization");
  return orgId;
}

/**
 * getLeadsStats — Conteos para KPI cards del dashboard
 * Retorna: totales por estado, totales por score, nuevos 30d, conversion rate
 */
export const getLeadsStats = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await getOrgId(ctx);

    const leads = await ctx.db
      .query("leads")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();

    const now = Date.now();
    const hace30Dias = now - 30 * 24 * 60 * 60 * 1000;

    // KPIs
    let totalLeads = leads.length;
    let nuevosUltimos30Dias = 0;
    let leadsHot = 0;
    let cerradosGanados = 0;

    // Conteos por estado
    const porEstado: Record<string, number> = {
      sin_asignar: 0,
      asignado: 0,
      en_progreso: 0,
      cerrado: 0,
    };

    // Conteos por scoreCategory
    const porScore: Record<string, number> = {
      HOT: 0,
      WARM: 0,
      NURTURE: 0,
      SKIP: 0,
    };

    for (const lead of leads) {
      if (lead.discoveredAt >= hace30Dias) nuevosUltimos30Dias++;
      if (lead.scoreCategory === "HOT") leadsHot++;
      if (lead.estado === "cerrado" && lead.subestado === "ganado") cerradosGanados++;

      if (lead.estado && lead.estado in porEstado) {
        porEstado[lead.estado]++;
      }
      if (lead.scoreCategory && lead.scoreCategory in porScore) {
        porScore[lead.scoreCategory]++;
      }
    }

    const tasaConversion = totalLeads > 0
      ? Math.round((cerradosGanados / totalLeads) * 1000) / 10
      : 0;

    return {
      total: totalLeads,
      nuevosUltimos30Dias,
      leadsHot,
      cerradosGanados,
      tasaConversion,
      porEstado,
      porScore,
    };
  },
});

/**
 * getFunnelData — Datos del funnel de conversion para visualizacion
 * Retorna conteos por etapa del pipeline
 */
export const getFunnelData = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await getOrgId(ctx);

    const leads = await ctx.db
      .query("leads")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();

    const total = leads.length;
    const hot = leads.filter((l) => l.scoreCategory === "HOT").length;
    const asignados = leads.filter(
      (l) => l.estado === "asignado" || l.estado === "en_progreso"
    ).length;
    const enProgreso = leads.filter((l) => l.estado === "en_progreso").length;
    const cerrados = leads.filter((l) => l.estado === "cerrado").length;
    const ganados = leads.filter(
      (l) => l.estado === "cerrado" && l.subestado === "ganado"
    ).length;

    return {
      stages: [
        { nombre: "Total Leads", valor: total, leads: total },
        { nombre: "HOT", valor: hot, leads: hot, pct_prev: total > 0 ? Math.round((hot / total) * 100) : 0 },
        { nombre: "Asignados", valor: asignados, leads: asignados, pct_prev: hot > 0 ? Math.round((asignados / hot) * 100) : 0 },
        { nombre: "En Progreso", valor: enProgreso, leads: enProgreso, pct_prev: asignados > 0 ? Math.round((enProgreso / asignados) * 100) : 0 },
        { nombre: "Cerrados", valor: cerrados, leads: cerrados, pct_prev: enProgreso > 0 ? Math.round((cerrados / enProgreso) * 100) : 0 },
        { nombre: "Ganados", valor: ganados, leads: ganados, pct_prev: cerrados > 0 ? Math.round((ganados / cerrados) * 100) : 0 },
      ],
    };
  },
});

/**
 * getLeadsByIndustry — Agrupa leads por industria para graficos de segmentacion
 */
export const getLeadsByIndustry = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await getOrgId(ctx);

    const leads = await ctx.db
      .query("leads")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();

    // Agrupar por industria
    const byIndustria: Record<string, number> = {};
    for (const lead of leads) {
      const ind = lead.industria || "Sin clasificar";
      byIndustria[ind] = (byIndustria[ind] || 0) + 1;
    }

    // Ordenar por cantidad desc y tomar top 10
    const sorted = Object.entries(byIndustria)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([label, valor]) => ({ label, valor }));

    return sorted;
  },
});

// Sisteco Subscriptions — Gestion de suscripciones y estado de trial
//
// Estado del ciclo de vida de una suscripcion:
//   trial → active → grace (fallido pago) → cancelled | expired
//   trial → expired (si no paga en 14 dias)
//   active → paused (por admin)
//
// Tabla subscriptions indexada por orgId, status, y trialEndsAt.
// La funcion getByOrgId es publica (usada por el dashboard).
// Las mutaciones de escritura son internas excepto createTrialSubscription
// y registerTenantSheet que son publicas con adminSecret para uso desde CLI.

import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

// ── MUTATIONS (publicas autenticadas — para el dashboard) ──────────────────

/**
 * acceptDpa — Registra la aceptacion del DPA por el usuario desde el dashboard.
 * Publica con autenticacion JWT — no requiere adminSecret (el usuario esta logueado).
 * Llamada por dpa-acceptance.js via window.mutateConvex('subscriptions:acceptDpa').
 */
export const acceptDpa = mutation({
  args: { dpaVersion: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const orgId = identity.org_id as string;
    if (!orgId) throw new Error("No organization — JWT template 'convex' must include org_id");

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .first();

    if (!sub) throw new Error(`No subscription found for orgId: ${orgId}`);

    await ctx.db.patch(sub._id, {
      dpaSignedAt: Date.now(),
      dpaVersion: args.dpaVersion,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

// ── MUTATIONS (publicas con adminSecret — para npx convex run) ────────────────

/**
 * createTrialSubscription — Crea una suscripcion de trial de 14 dias.
 * Publica con adminSecret para que provision-trial.js pueda llamarla via CLI.
 */
export const createTrialSubscription = mutation({
  args: {
    orgId: v.string(),
    plan: v.union(v.literal("base"), v.literal("crecimiento"), v.literal("enterprise")),
    billingEmail: v.string(),
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    // Validar adminSecret
    const expectedSecret = process.env.SAAN_API_SECRET;
    if (!expectedSecret || args.adminSecret !== expectedSecret) {
      throw new Error("Unauthorized: invalid admin secret");
    }
    const now = Date.now();
    const subscriptionId = await ctx.db.insert("subscriptions", {
      orgId: args.orgId,
      plan: args.plan,
      status: "trial",
      trialStartedAt: now,
      trialEndsAt: now + 14 * 24 * 60 * 60 * 1000,
      billingEmail: args.billingEmail,
      pipelineRunCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    return subscriptionId;
  },
});

/**
 * registerTenantSheet — Registra el spreadsheetId de un tenant en tenantSheets.
 * Publica con adminSecret para que provision-trial.js pueda llamarla via CLI.
 */
export const registerTenantSheet = mutation({
  args: {
    orgId: v.string(),
    spreadsheetId: v.string(),
    sheetName: v.optional(v.string()),
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    // Validar adminSecret
    const expectedSecret = process.env.SAAN_API_SECRET;
    if (!expectedSecret || args.adminSecret !== expectedSecret) {
      throw new Error("Unauthorized: invalid admin secret");
    }
    // Upsert: si ya existe, actualizar spreadsheetId
    const existing = await ctx.db
      .query("tenantSheets")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        spreadsheetId: args.spreadsheetId,
        sheetName: args.sheetName,
        lastSyncAt: Date.now(),
        status: "active",
      });
      return existing._id;
    }
    return await ctx.db.insert("tenantSheets", {
      orgId: args.orgId,
      spreadsheetId: args.spreadsheetId,
      sheetName: args.sheetName,
      createdAt: Date.now(),
      status: "active",
    });
  },
});

// ── QUERIES (publicas) ────────────────────────────────────────────────────────

/**
 * getByOrgId — Retorna la suscripcion de una org.
 * Usado por el dashboard para mostrar estado de trial y banner.
 * Valida orgId via JWT para seguridad multi-tenant.
 */
export const getByOrgId = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    // Validar identidad: orgId debe coincidir con el JWT
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const tokenOrgId = identity["org_id"] as string;
    if (!tokenOrgId || tokenOrgId !== args.orgId) {
      throw new Error("Forbidden: org_id mismatch");
    }
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .first();
  },
});

// ── MUTATIONS (internas) ──────────────────────────────────────────────────────

/**
 * activateFromWebhook — Activa una suscripcion desde el webhook de Reveniu.
 * Busca por billingEmail para resistencia a interrupciones (idempotente).
 * No lanza error si no encuentra la suscripcion (webhook resilience).
 */
export const activateFromWebhook = internalMutation({
  args: {
    reveniuSubscriptionId: v.string(),
    email: v.string(),
    plan: v.union(v.literal("base"), v.literal("crecimiento"), v.literal("enterprise")),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    // Buscar suscripcion por billingEmail
    const sub = await ctx.db
      .query("subscriptions")
      .filter((q) => q.eq(q.field("billingEmail"), args.email))
      .first();

    if (!sub) {
      console.error(`activateFromWebhook: no subscription found for email ${args.email}`);
      return null;
    }

    const now = Date.now();
    await ctx.db.patch(sub._id, {
      status: "active",
      reveniuSubscriptionId: args.reveniuSubscriptionId,
      plan: args.plan,
      billingAmount: args.amount,
      billingCycle: "monthly",
      currentPeriodStart: now,
      currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
      updatedAt: now,
    });

    return sub._id;
  },
});

/**
 * getMetrics — Calcula MRR, churn, LTV y conteos de suscripciones.
 * Usado internamente por reporting y dashboard de admin.
 */
export const getMetrics = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allSubs = await ctx.db.query("subscriptions").collect();

    const activeSubs = allSubs.filter((s) => s.status === "active");
    const cancelledSubs = allSubs.filter((s) => s.status === "cancelled");
    const trialSubs = allSubs.filter((s) => s.status === "trial");

    const mrr = activeSubs.reduce((sum, s) => sum + (s.billingAmount ?? 0), 0);
    const activeCount = activeSubs.length;
    const cancelledCount = cancelledSubs.length;
    const trialCount = trialSubs.length;

    const churnRate = activeCount > 0 ? cancelledCount / (activeCount + cancelledCount) : 0;
    const avgBilling =
      activeCount > 0 ? mrr / activeCount : 0;
    const ltv = churnRate > 0 ? avgBilling / churnRate : 0;

    return {
      mrr,
      churnRate,
      ltv,
      activeCount,
      cancelledCount,
      trialCount,
    };
  },
});

/**
 * updateStatus — Actualiza el estado de una suscripcion por orgId.
 */
export const updateStatus = internalMutation({
  args: {
    orgId: v.string(),
    status: v.union(
      v.literal("trial"),
      v.literal("active"),
      v.literal("grace"),
      v.literal("paused"),
      v.literal("cancelled"),
      v.literal("expired"),
    ),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!sub) {
      throw new Error(`No subscription found for orgId: ${args.orgId}`);
    }

    await ctx.db.patch(sub._id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

/**
 * recordPipelineRun — Incrementa el contador de ejecuciones de pipeline.
 * Llamado por n8n al completar una corrida exitosa.
 */
export const recordPipelineRun = internalMutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!sub) {
      throw new Error(`No subscription found for orgId: ${args.orgId}`);
    }

    await ctx.db.patch(sub._id, {
      lastPipelineRunAt: Date.now(),
      pipelineRunCount: sub.pipelineRunCount + 1,
      updatedAt: Date.now(),
    });
  },
});

/**
 * signDpa — Registra la firma del DPA (Data Processing Agreement) por el cliente.
 * Se llama cuando el cliente acepta los terminos durante el onboarding.
 */
export const signDpa = internalMutation({
  args: {
    orgId: v.string(),
    dpaVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .first();

    if (!sub) {
      throw new Error(`No subscription found for orgId: ${args.orgId}`);
    }

    await ctx.db.patch(sub._id, {
      dpaSignedAt: Date.now(),
      dpaVersion: args.dpaVersion,
      updatedAt: Date.now(),
    });
  },
});

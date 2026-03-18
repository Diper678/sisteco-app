// Sisteco Trial Requests — Gestion de formularios de intake publico
//
// Flujo de provisioning:
//   1. HTTP POST /intake → create() — guarda datos del prospecto, status: "received"
//   2. Admin ejecuta provision-trial.js → updateStatus() cambia a "provisioning"
//   3. Script completa provisioning → markProvisioned() actualiza a "provisioned"
//
// Todas las mutaciones son internas (no expuestas al publico) excepto markProvisioned
// que es publica con validacion de adminSecret para llamarla desde CLI.

import { v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";

// ── MUTATIONS (internas) ───────────────────────────────────────────────────────

/**
 * create — Crea una nueva solicitud de trial desde el formulario de intake.
 * Llamado desde HTTP POST /intake handler.
 * Retorna el ID del nuevo documento.
 */
export const create = internalMutation({
  args: {
    nombre: v.string(),
    email: v.string(),
    empresa: v.string(),
    cargo: v.optional(v.string()),
    telefono: v.optional(v.string()),
    sector: v.string(),
    mercado: v.string(),
    tipoclientes: v.string(),
    crm: v.optional(v.string()),
    almacenamientoLeads: v.optional(v.string()),
    setupCorreos: v.optional(v.string()),
    procesoVentas: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requestId = await ctx.db.insert("trialRequests", {
      nombre: args.nombre,
      email: args.email,
      empresa: args.empresa,
      cargo: args.cargo,
      telefono: args.telefono,
      sector: args.sector,
      mercado: args.mercado,
      tipoclientes: args.tipoclientes,
      crm: args.crm,
      almacenamientoLeads: args.almacenamientoLeads,
      setupCorreos: args.setupCorreos,
      procesoVentas: args.procesoVentas,
      status: "received",
      createdAt: Date.now(),
    });
    return requestId;
  },
});

/**
 * updateStatus — Actualiza el estado de una solicitud de trial.
 * Llamado desde provision-trial.js para trackear progreso.
 */
export const updateStatus = internalMutation({
  args: {
    id: v.id("trialRequests"),
    status: v.union(
      v.literal("received"),
      v.literal("provisioning"),
      v.literal("provisioned"),
      v.literal("error"),
    ),
    clerkOrgId: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    spreadsheetId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    provisionedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    // Solo patchear los campos que vienen definidos
    const patch: Record<string, unknown> = { status: fields.status };
    if (fields.clerkOrgId !== undefined) patch.clerkOrgId = fields.clerkOrgId;
    if (fields.clerkUserId !== undefined) patch.clerkUserId = fields.clerkUserId;
    if (fields.spreadsheetId !== undefined) patch.spreadsheetId = fields.spreadsheetId;
    if (fields.errorMessage !== undefined) patch.errorMessage = fields.errorMessage;
    if (fields.provisionedAt !== undefined) patch.provisionedAt = fields.provisionedAt;
    await ctx.db.patch(id, patch);
  },
});

// ── MUTATIONS (publicas con adminSecret) ──────────────────────────────────────

/**
 * markProvisioned — Marca una solicitud como provisionada con los IDs de recursos creados.
 * Publica con adminSecret para que provision-trial.js pueda llamarla via `npx convex run`.
 */
export const markProvisioned = mutation({
  args: {
    id: v.id("trialRequests"),
    clerkOrgId: v.string(),
    clerkUserId: v.string(),
    spreadsheetId: v.string(),
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    // Validar adminSecret
    const expectedSecret = process.env.SAAN_API_SECRET;
    if (!expectedSecret || args.adminSecret !== expectedSecret) {
      throw new Error("Unauthorized: invalid admin secret");
    }
    await ctx.db.patch(args.id, {
      status: "provisioned",
      clerkOrgId: args.clerkOrgId,
      clerkUserId: args.clerkUserId,
      spreadsheetId: args.spreadsheetId,
      provisionedAt: Date.now(),
    });
  },
});

// ── QUERIES (internas) ────────────────────────────────────────────────────────

/**
 * getByEmail — Busca la solicitud mas reciente por email.
 * Usa indice by_email para lookup eficiente.
 */
export const getByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trialRequests")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

/**
 * getById — Busca una solicitud por ID.
 */
export const getById = internalQuery({
  args: { id: v.id("trialRequests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * getPending — Retorna todas las solicitudes en estado "received".
 * Usada por el admin para ver los pendientes de provisioning.
 */
export const getPending = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("trialRequests")
      .withIndex("by_status", (q) => q.eq("status", "received"))
      .collect();
  },
});

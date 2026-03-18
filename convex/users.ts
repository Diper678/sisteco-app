import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ─────────────────────────────────────────────────────────────────────────────
// Sisteco Users — Gestion de usuarios y roles por organizacion
//
// Los roles determinan que vista del dashboard ve cada usuario:
//   - ceo        → app/ceo.html
//   - vp_ventas  → app/vp-ventas.html
//   - sdr        → app/sdr.html
//
// CRITICO: orgId extraido del JWT, nunca de args
// ─────────────────────────────────────────────────────────────────────────────

// ── Helper para extraer orgId del JWT ────────────────────────────────────────
async function getOrgId(ctx: any): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const orgId = identity["org_id"] as string;
  if (!orgId) throw new Error("No active organization");
  return orgId;
}

// ── QUERIES ───────────────────────────────────────────────────────────────────

/**
 * getUserRole — Retorna el rol del usuario actual en la organizacion
 * Busca en tabla users por clerkUserId + orgId
 */
export const getUserRole = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const orgId = identity["org_id"] as string;
    if (!orgId) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .first();

    return user?.rol || null;
  },
});

/**
 * getTeamMembers — Lista todos los usuarios (SDRs) de la org
 * Usado para dropdowns de asignacion de leads
 */
export const getTeamMembers = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await getOrgId(ctx);

    return await ctx.db
      .query("users")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

/**
 * getTeamSdrs — Lista solo los SDRs de la org (para asignacion de leads)
 */
export const getTeamSdrs = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await getOrgId(ctx);

    return await ctx.db
      .query("users")
      .withIndex("by_orgId_rol", (q) =>
        q.eq("orgId", orgId).eq("rol", "sdr")
      )
      .collect();
  },
});

// ── MUTATIONS ─────────────────────────────────────────────────────────────────

/**
 * getOrCreateUser — Upsert del registro de usuario al hacer login
 * Llama esto cuando el usuario hace login para asegurar que existe en DB
 */
export const getOrCreateUser = mutation({
  args: {
    nombre: v.string(),
    email: v.string(),
    rol: v.union(
      v.literal("ceo"),
      v.literal("vp_ventas"),
      v.literal("sdr")
    ),
    iniciales: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const orgId = identity["org_id"] as string;
    if (!orgId) throw new Error("No active organization");

    const clerkUserId = identity.subject;

    // Buscar usuario existente
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .first();

    if (existing) {
      // Actualizar datos si cambiaron
      await ctx.db.patch(existing._id, {
        nombre: args.nombre,
        email: args.email,
        iniciales: args.iniciales,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    // Crear nuevo usuario
    const userId = await ctx.db.insert("users", {
      orgId,
      clerkUserId,
      nombre: args.nombre,
      email: args.email,
      iniciales: args.iniciales,
      rol: args.rol,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return userId;
  },
});

/**
 * createFromProvisioning — Crea un usuario desde el script de provisioning.
 * Publica con adminSecret para que provision-trial.js pueda llamarla via CLI.
 * Idempotente: si el usuario ya existe en esa org, no hace nada.
 */
export const createFromProvisioning = mutation({
  args: {
    orgId: v.string(),
    clerkUserId: v.string(),
    nombre: v.string(),
    email: v.string(),
    rol: v.union(
      v.literal("ceo"),
      v.literal("vp_ventas"),
      v.literal("sdr")
    ),
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    // Validar adminSecret
    const expectedSecret = process.env.SAAN_API_SECRET;
    if (!expectedSecret || args.adminSecret !== expectedSecret) {
      throw new Error("Unauthorized: invalid admin secret");
    }

    // Idempotente: si ya existe, retornar su ID
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("users", {
      orgId: args.orgId,
      clerkUserId: args.clerkUserId,
      nombre: args.nombre,
      email: args.email,
      rol: args.rol,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * updateUserRole — Actualiza el rol de un usuario (solo CEO/VP pueden hacer esto)
 */
export const updateUserRole = mutation({
  args: {
    targetClerkUserId: v.string(),
    nuevoRol: v.union(
      v.literal("ceo"),
      v.literal("vp_ventas"),
      v.literal("sdr")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const orgId = identity["org_id"] as string;
    if (!orgId) throw new Error("No active organization");

    // Verificar que el usuario que actualiza tiene permisos (CEO o VP)
    const requestingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .first();

    if (!requestingUser) throw new Error("Usuario no encontrado");
    if (requestingUser.rol !== "ceo" && requestingUser.rol !== "vp_ventas") {
      throw new Error("Sin permisos para cambiar roles");
    }

    // Buscar el usuario a actualizar
    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.targetClerkUserId))
      .filter((q) => q.eq(q.field("orgId"), orgId))
      .first();

    if (!targetUser) throw new Error("Usuario destino no encontrado");

    await ctx.db.patch(targetUser._id, {
      rol: args.nuevoRol,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

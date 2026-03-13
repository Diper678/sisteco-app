import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─────────────────────────────────────────────────────────────────────────────
// ICP Configuration — Ideal Customer Profile
// Stores the 4-parameter ICP wizard data per org.
// orgId ALWAYS from JWT (getUserIdentity) — never from request body.
// ─────────────────────────────────────────────────────────────────────────────

/* ── saveIcpConfig ─────────────────────────────────────────────────────────── */
// Upserts the ICP config for the authenticated org.
// Called by the VP ICP wizard before activating the pipeline.
export const saveIcpConfig = mutation({
  args: {
    industria: v.string(),
    tamano: v.string(),
    ubicacion: v.string(),
    keywords: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const orgId = identity["org_id"] as string | undefined;
    if (!orgId) {
      throw new Error("No organization context. Activate Clerk Organizations.");
    }

    const now = Date.now();
    const userId = identity.subject;

    // Check if ICP profile already exists for this org
    const existing = await ctx.db
      .query("icpProfiles")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .first();

    // Map wizard tamano to min/max employees
    const tamanoMap: Record<string, { min: number; max?: number }> = {
      "10-50":    { min: 10,  max: 50 },
      "50-200":   { min: 50,  max: 200 },
      "200-1000": { min: 200, max: 1000 },
      "1000+":    { min: 1000 },
    };
    const empleados = tamanoMap[args.tamano] || { min: 10 };

    // Map ubicacion to locations array
    const ubicacionMap: Record<string, string[]> = {
      "Santiago":   ["Santiago", "Región Metropolitana"],
      "Regiones":   ["Antofagasta", "Valparaíso", "Biobío", "Araucanía", "Los Lagos"],
      "Todo Chile": ["Chile"],
    };
    const locations = ubicacionMap[args.ubicacion] || [args.ubicacion];

    // Build keywords as buying signals if provided
    const keywords = args.keywords
      ? args.keywords.split(",").map((k) => k.trim()).filter(Boolean)
      : [];

    if (existing) {
      // Update existing profile
      await ctx.db.patch(existing._id, {
        industries: [args.industria],
        minEmployees: empleados.min,
        maxEmployees: empleados.max,
        locations,
        buyingSignals: keywords,
        updatedAt: now,
      });
      return { action: "updated", profileId: existing._id };
    } else {
      // Create new profile
      const profileId = await ctx.db.insert("icpProfiles", {
        orgId,
        name: "ICP Principal — " + args.industria,
        isActive: true,
        industries: [args.industria],
        minEmployees: empleados.min,
        maxEmployees: empleados.max,
        locations,
        companyTypes: ["b2b"],
        buyingSignals: keywords,
        techStackPositive: [],
        techStackNegative: [],
        weights: {
          industryFit: 30,
          companySize: 25,
          buyingIntent: 20,
          contactQuality: 15,
          techFit: 10,
        },
        targetRoles: ["CEO", "Gerente Comercial", "VP Ventas", "Director"],
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
      });
      return { action: "created", profileId };
    }
  },
});

/* ── getIcpConfig ──────────────────────────────────────────────────────────── */
// Returns the active ICP profile for the authenticated org.
// Returns null if no ICP configured yet.
export const getIcpConfig = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const orgId = identity["org_id"] as string | undefined;
    if (!orgId) return null;

    const profile = await ctx.db
      .query("icpProfiles")
      .withIndex("by_orgId_active", (q) =>
        q.eq("orgId", orgId).eq("isActive", true)
      )
      .first();

    if (!profile) return null;

    // Return simplified wizard-friendly format
    const tamanoReverse: Record<string, string> = {
      "10":  "10-50",
      "50":  "50-200",
      "200": "200-1000",
      "1000": "1000+",
    };
    const tamanoKey = String(profile.minEmployees);
    const tamano = tamanoReverse[tamanoKey] || profile.minEmployees + "+";

    return {
      _id: profile._id,
      industria: profile.industries[0] || "",
      tamano,
      ubicacion: profile.locations.includes("Chile") ? "Todo Chile"
        : profile.locations.some((l) => l === "Santiago" || l === "Región Metropolitana") ? "Santiago"
        : "Regiones",
      keywords: profile.buyingSignals.join(", "),
      isActive: profile.isActive,
      createdAt: profile.createdAt,
    };
  },
});

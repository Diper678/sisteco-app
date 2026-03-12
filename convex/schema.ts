import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ─────────────────────────────────────────────────────────────────────────────
// Sisteco Dashboard — Convex Schema
// Multi-tenant B2B SaaS para automatizacion de ventas en Chile
//
// ARQUITECTURA:
//   - Multi-tenant via Clerk Organizations (orgId en todos los documentos)
//   - Aislamiento por org en TODAS las queries (nunca confiar en orgId del request)
//   - ConvexHttpClient one-shot (DASH-07: sin subscripciones reactivas)
//
// LEADS — campos heredados de SAAN v1.0 + campos multi-tenant nuevos
// ─────────────────────────────────────────────────────────────────────────────

export default defineSchema({

  // ── Leads B2B multi-tenant ─────────────────────────────────────────────────
  // Extiende el schema de SAAN v1.0 con campos multi-tenant (orgId, estado, auditTrail)
  leads: defineTable({
    // NUEVO: Multi-tenant isolation (Clerk Organization ID)
    orgId: v.string(),

    // ── Identificacion del contacto ──────────────────────────────────────────
    empresa: v.string(),
    contacto: v.optional(v.string()),
    cargo: v.optional(v.string()),
    email: v.optional(v.string()),
    telefono: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),

    // ── Clasificacion de empresa ─────────────────────────────────────────────
    industria: v.optional(v.string()),
    tamano: v.optional(v.string()),       // "50-100", "100-500", "500+"
    ubicacion: v.optional(v.string()),
    companyType: v.optional(v.string()),  // "b2b", "b2c", "b2b2c"

    // ── Scoring ──────────────────────────────────────────────────────────────
    score: v.number(),                    // 0-100
    scoreCategory: v.string(),            // "HOT" | "WARM" | "NURTURE" | "SKIP"
    scoreReasoning: v.optional(v.string()),
    scoreVersion: v.optional(v.number()),
    scoredAt: v.optional(v.number()),

    // ── Enriquecimiento SII ───────────────────────────────────────────────────
    enrichedData: v.optional(v.any()),    // { descripcion, actividad SII, inicio_actividades, etc }
    enrichedAt: v.optional(v.number()),

    // ── Multi-fuente tracking ─────────────────────────────────────────────────
    source: v.string(),                   // "firecrawl_search" | "phantombuster_linkedin" | "manual"
    sourceUrl: v.optional(v.string()),
    sourceDetails: v.optional(v.any()),
    estimatedCostUsd: v.optional(v.number()),

    // ── Pipeline SDR (estado nuevo multi-tenant) ──────────────────────────────
    // Estados principales del workflow de ventas
    estado: v.union(
      v.literal("sin_asignar"),     // Nuevo lead, sin SDR asignado
      v.literal("asignado"),        // SDR asignado, aun no contactado
      v.literal("en_progreso"),     // En proceso de contacto/negociacion
      v.literal("cerrado")          // Finalizado (con subestado)
    ),
    // Subestados para leads cerrados
    subestado: v.optional(v.union(
      v.literal("ganado"),          // Se convirtio en cliente
      v.literal("perdido"),         // No convirtio
      v.literal("descartado")       // Descartado (no aplica para seguimiento)
    )),
    // SDR asignado (Clerk userId)
    asignadoA: v.optional(v.string()),
    // Nombre del SDR para display (evitar join constante)
    asignadoNombre: v.optional(v.string()),

    // ── Audit Trail ───────────────────────────────────────────────────────────
    // Timeline de acciones sobre el lead (asignaciones, cambios de estado, notas)
    auditTrail: v.optional(v.array(v.object({
      accion: v.string(),
      usuarioId: v.string(),
      usuarioNombre: v.string(),
      timestamp: v.number(),
    }))),

    // ── Pipeline legacy (SAAN v1.0, mantenido para compatibilidad) ────────────
    status: v.optional(v.string()),       // "new" | "enriched" | "scored" | "outreach_queued" | ...
    outreachStage: v.optional(v.string()),
    outreachStartedAt: v.optional(v.number()),
    lastContactedAt: v.optional(v.number()),
    nextFollowUpAt: v.optional(v.number()),
    outreachNotes: v.optional(v.string()),

    // ── Skill tracking ────────────────────────────────────────────────────────
    discoveredBySkill: v.optional(v.string()),
    enrichedBySkill: v.optional(v.string()),
    scoredBySkill: v.optional(v.string()),

    // ── Timestamps ────────────────────────────────────────────────────────────
    discoveredAt: v.number(),
    lastUpdatedAt: v.number(),
  })
    // Indices multi-tenant (SIEMPRE filtrar por orgId primero)
    .index("by_orgId", ["orgId"])
    .index("by_orgId_estado", ["orgId", "estado"])
    .index("by_orgId_asignadoA", ["orgId", "asignadoA"])
    .index("by_orgId_score", ["orgId", "scoreCategory"])
    // Indices legacy (sin orgId — para compatibilidad SAAN v1.0)
    .index("by_email", ["email"])
    .index("by_empresa", ["empresa"])
    .index("by_status", ["status"])
    .index("by_score_category", ["scoreCategory"])
    .index("by_score", ["score"])
    .index("by_discovered", ["discoveredAt"])
    .index("by_source", ["source"])
    .index("by_next_followup", ["nextFollowUpAt"]),

  // ── Usuarios y roles (multi-tenant) ───────────────────────────────────────
  users: defineTable({
    // Multi-tenant isolation
    orgId: v.string(),
    // Clerk user ID
    clerkUserId: v.string(),
    // Datos del usuario
    nombre: v.string(),
    email: v.string(),
    iniciales: v.optional(v.string()),
    // Rol en la organizacion
    rol: v.union(
      v.literal("ceo"),
      v.literal("vp_ventas"),
      v.literal("sdr")
    ),
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_orgId", ["orgId"])
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_orgId_rol", ["orgId", "rol"]),

  // ── ICP Profiles por organizacion ─────────────────────────────────────────
  // Perfil de Cliente Ideal configurado por VP/CEO para activar pipeline
  icpProfiles: defineTable({
    orgId: v.string(),
    name: v.string(),
    isActive: v.boolean(),

    // Criterios del ICP (wizard de 3-4 preguntas)
    industries: v.array(v.string()),
    minEmployees: v.number(),
    maxEmployees: v.optional(v.number()),
    locations: v.array(v.string()),
    companyTypes: v.array(v.string()),

    // Senales de compra
    buyingSignals: v.array(v.string()),
    techStackPositive: v.array(v.string()),
    techStackNegative: v.array(v.string()),

    // Pesos de scoring (suman 100)
    weights: v.object({
      industryFit: v.number(),
      companySize: v.number(),
      buyingIntent: v.number(),
      contactQuality: v.number(),
      techFit: v.number(),
    }),

    targetRoles: v.array(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.string(),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_active", ["orgId", "isActive"]),

  // ── Infraestructura SAAN v1.0 (mantenida para compatibilidad) ─────────────
  // Estas tablas no son multi-tenant — son infra compartida del sistema

  agentsState: defineTable({
    agentId: v.string(),
    status: v.string(),
    lastRun: v.optional(v.number()),
    nextRun: v.optional(v.number()),
    currentTask: v.optional(v.string()),
    errorCount: v.number(),
    errorLastMessage: v.optional(v.string()),
    metadata: v.optional(v.any()),
  })
    .index("by_agent_id", ["agentId"])
    .index("by_status", ["status"]),

  agentTasks: defineTable({
    fromAgent: v.string(),
    toAgent: v.string(),
    taskType: v.string(),
    priority: v.string(),
    status: v.string(),
    payload: v.any(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    result: v.optional(v.any()),
  })
    .index("by_agent_status", ["toAgent", "status"])
    .index("by_priority_status", ["priority", "status"])
    .index("by_from_agent", ["fromAgent"]),

  agentMemory: defineTable({
    agentId: v.string(),
    memoryType: v.string(),
    content: v.string(),
    tags: v.optional(v.array(v.string())),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
  })
    .index("by_agent_type", ["agentId", "memoryType"])
    .index("by_agent_created", ["agentId", "createdAt"]),

  agentMessages: defineTable({
    messageId: v.string(),
    fromAgent: v.string(),
    toAgent: v.string(),
    messageType: v.string(),
    priority: v.string(),
    payload: v.any(),
    status: v.string(),
    requiresAck: v.boolean(),
    createdAt: v.number(),
    expiresAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_recipient_status", ["toAgent", "status"])
    .index("by_from_agent", ["fromAgent"])
    .index("by_created", ["createdAt"]),

  marketIntelligence: defineTable({
    category: v.string(),
    subject: v.string(),
    data: v.any(),
    source: v.string(),
    confidence: v.optional(v.number()),
    createdAt: v.number(),
    validUntil: v.optional(v.number()),
  })
    .index("by_category", ["category"])
    .index("by_created", ["createdAt"])
    .index("by_category_subject", ["category", "subject"]),

  systemHealth: defineTable({
    service: v.string(),
    metric: v.string(),
    value: v.number(),
    unit: v.string(),
    recordedAt: v.number(),
  })
    .index("by_service_metric", ["service", "metric"])
    .index("by_recorded", ["recordedAt"]),

  skillsRegistry: defineTable({
    skillId: v.string(),
    skillName: v.string(),
    description: v.string(),
    agentOwner: v.string(),
    skillType: v.string(),
    config: v.any(),
    parameters: v.optional(v.any()),
    isActive: v.boolean(),
    usageCount: v.number(),
    lastUsed: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_skill_id", ["skillId"])
    .index("by_type", ["skillType"])
    .index("by_owner", ["agentOwner"]),

  mcpRegistry: defineTable({
    mcpId: v.string(),
    mcpName: v.string(),
    description: v.string(),
    tools: v.array(v.string()),
    installCommand: v.string(),
    configSchema: v.optional(v.any()),
    status: v.string(),
    monthlyCostUsd: v.optional(v.number()),
    addedBy: v.string(),
    addedAt: v.number(),
    installedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_mcp_id", ["mcpId"])
    .index("by_status", ["status"]),

  telegramQueue: defineTable({
    messageType: v.string(),
    agentId: v.string(),
    priority: v.string(),
    content: v.string(),
    status: v.string(),
    retryCount: v.number(),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
    consolidationWindow: v.optional(v.string()),
    inlineKeyboard: v.optional(v.any()),
  })
    .index("by_status_priority", ["status", "priority"])
    .index("by_status_created", ["status", "createdAt"])
    .index("by_consolidation", ["consolidationWindow", "status"]),
});

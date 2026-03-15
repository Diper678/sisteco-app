# Phase 4: Compliance Basico Ley 21.719 - Research

**Researched:** 2026-03-15
**Domain:** Data protection compliance (Ley 21.719 Chile) + Convex schema + n8n workflows + public forms
**Confidence:** HIGH

## Summary

Phase 4 implements the minimum viable compliance layer for Sisteco to operate legally under Chile's Ley 21.719 (effective December 1, 2026). The phase spans five requirement areas: privacy notices (COMP-01), data registry (COMP-02), opt-out/deletion mechanism (COMP-03), legal basis logging per lead (COMP-04), and automated data retention with purge (COMP-05).

The pivote to workflows-first changes the compliance surface significantly. Sisteco acts as both "responsable" (data controller for scraping) and "encargado" (data processor for clients). The DPA becomes the primary compliance instrument, replacing dashboard-centric transparency. Data lives in three locations (Convex, Google Sheets, client CRM), requiring propagation logic for opt-outs and deletions. The existing `sisteco-legal` skill already contains DPA, RAT, privacy policy, EIPD, and SCC templates that can be used directly -- the implementation work is building the technical infrastructure (schema fields, HTTP endpoints, cron jobs, n8n workflows) and publishing the legal documents.

**Primary recommendation:** Build the compliance layer as: (1) Convex schema extensions + new tables, (2) public HTTP endpoints for opt-out/ARCO-POL, (3) Convex cron for retention purge, (4) n8n workflows for propagation/notification, (5) static HTML pages for privacy policy and rights form, (6) legal documents finalized from templates.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Area 1 -- UX del Compliance (revisada post-pivote):**
1. Aviso compliance via DPA -- mecanismo de transparencia migra al DPA firmado
2. Link permanente en dashboard -- secundario, DPA es canal principal
3. Opt-out via link en emails -- cada comunicacion incluye link a formulario publico standalone
4. Email + verificacion para opt-out -- lead pone email, recibe confirmacion, al confirmar se ejecuta
5. Soft delete + propagacion a Sheets/CRM -- anonimizar en Convex, propagar a Sheets (auto) y CRM (notificacion)
6. Politica publica + seccion en DPA -- sisteco.cl/privacidad (completa) + resumen en DPA
7. RAT en Convex + Obsidian -- interno, no visible para tenants

**Area 2 -- Derechos del Titular:**
1. ARCO-POL completo centralizado -- Sisteco gestiona TODAS las solicitudes como punto unico
2. Pagina standalone para formulario -- sisteco.cl/privacidad/derechos
3. Gestion hibrida (MVP) -- n8n triage automatico + humano confirma + n8n ejecuta
4. Opt-out global instantaneo -- blacklist global en Convex, elimina de TODOS los tenants

**Area 3 -- Retencion de Datos:**
1. 24 meses de retencion default para leads sin interaccion
2. Soft delete + hard delete a 30 dias de gracia
3. Propagacion hibrida -- Sisteco borra de Convex + Sheets (auto), notifica cliente para CRM
4. Interaccion extiende con techo 36 meses absoluto desde recoleccion

**Area 4 -- Compliance Visible para el Tenant:**
1. Columna en sheet + reporte mensual -- estado_compliance, base_legal, fuente, fecha_expiracion en cada Sheet
2. DPA pre-onboarding obligatorio -- sin DPA firmado no se activa servicio
3. Badge propio "Cumple Ley 21.719" -- en sheets, reportes, landing, propuestas
4. DPA con obligaciones + educacion breve -- obligaciones cliente + video/email 5 min

### Claude's Discretion

No hay items marcados explicitamente como "discrecion de Claude" en CONTEXT.md. Sin embargo, la implementacion tecnica especifica (estructura de tablas, naming de endpoints, orden de ejecucion) queda a criterio del implementador.

### Deferred Ideas (OUT OF SCOPE)

- Educacion compliance como linea de negocio (futuro, no prioridad)
- Certificacion MPI oficial (post dic 2026, cuando APDP opere)
- ISO 27001 / SOC 2 (Phase 5+ / enterprise)
- Compliance dashboard para clientes (diferenciacion Q1-Q2 2027)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMP-01 | Aviso de privacidad en dashboard y comunicaciones | Privacy policy page (sisteco.cl/privacidad) + List-Unsubscribe header in Resend emails + link in dashboard footer. Templates exist in sisteco-legal skill. |
| COMP-02 | Registro de bases de datos ante futura APDP | RAT (Registro de Actividades de Tratamiento) stored in Convex `complianceRAT` table + mirrored in Obsidian. Template exists in sisteco-legal skill section 8. |
| COMP-03 | Mecanismo de opt-out/eliminacion de datos para leads | Public standalone form + Convex HTTP action endpoint + email verification via Resend + global blacklist table + soft delete + n8n propagation to Sheets/CRM notification |
| COMP-04 | Logging de consentimiento y base legal por lead | New compliance fields on leads schema (baseLegal, fuenteDatos, fechaExpiracion, testPonderacionRef) + balancing test document. Templates exist in sisteco-legal skill section 5. |
| COMP-05 | Politica de retencion de datos (auto-purga configurable) | Convex cron job (daily) scans leads by fechaExpiracion, soft-deletes expired, hard-deletes after 30 days grace. Interaction extends timer with 36-month ceiling. |
</phase_requirements>

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Convex | (installed) | Database + cron jobs + HTTP actions + scheduled functions | Already the project DB; crons and HTTP actions are native Convex features -- no new dependencies |
| Resend | (installed) | Email verification for opt-out + List-Unsubscribe headers | Already used for email; supports custom headers including List-Unsubscribe |
| n8n | self-hosted | ARCO-POL triage workflow + propagation to Sheets/CRM | Already the workflow engine; GDPR deletion workflow templates exist |
| Google Sheets API | googleapis | Delete/clear rows from client sheets on opt-out | Already used via `scripts/sheets-manager.js`; supports batchUpdate for row deletion |

### Supporting (new files, no new npm dependencies)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Convex crons.ts | native | Daily retention scan + weekly hard-delete batch | Scheduled data lifecycle management |
| Convex http.ts | native | Public endpoints: opt-out, ARCO-POL, one-click unsubscribe | Public-facing unauthenticated compliance endpoints |
| crypto (Node.js built-in) | native | Generate secure verification tokens for opt-out | Email verification flow |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Convex HTTP actions for public form | Vercel serverless /api routes | Convex HTTP actions keep data logic in one place; Vercel adds another layer. Use Convex since it can call mutations directly. |
| Custom opt-out form | Third-party consent management (OneTrust, Didomi) | Overkill for MVP; Sisteco needs a simple form, not enterprise consent platform. Revisit when 100+ clients. |
| Convex cron for retention | External scheduler (cron service, n8n scheduled) | Convex cron is transactional with the database -- guarantees consistency. No external dependency. |

**No new npm packages needed.** Everything is built with existing dependencies.

## Architecture Patterns

### Recommended Project Structure (new files only)

```
convex/
  schema.ts              # MODIFY: add compliance fields to leads + new tables
  compliance.ts          # NEW: mutations/queries for compliance operations
  optOut.ts              # NEW: opt-out specific mutations (soft delete, blacklist)
  retention.ts           # NEW: internal mutations for retention cron
  crons.ts               # NEW: scheduled retention scans
  http.ts                # NEW: public HTTP endpoints (opt-out, ARCO-POL, unsubscribe)

mockups/shared/
  privacy-notice.html    # NEW: footer link for dashboard -> privacy notice

docs/legal/
  politica-privacidad.md        # NEW: full privacy policy (from sisteco-legal template)
  test-ponderacion.md           # NEW: balancing test for legitimate interest
  DPA-template.md               # NEW: finalized DPA (from sisteco-legal template)
  RAT.md                        # NEW: registro de actividades de tratamiento
  EIPD-scoring-ia.md            # NEW: impact assessment for AI scoring

scripts/
  sheets-compliance-sync.js     # NEW: propagate opt-out/deletion to Google Sheets
```

### Pattern 1: Convex Schema Extension for Compliance Fields

**What:** Add compliance-specific fields to the existing `leads` table and create new tables for blacklist and ARCO-POL requests.
**When to use:** Every lead must carry its legal basis and lifecycle metadata.

```typescript
// New fields to add to leads table in schema.ts
// Compliance fields
baseLegal: v.optional(v.union(
  v.literal("interes_legitimo"),
  v.literal("consentimiento"),
  v.literal("contrato")
)),
fuenteDatos: v.optional(v.union(
  v.literal("linkedin_search"),
  v.literal("sitio_web"),
  v.literal("formulario"),
  v.literal("referido"),
  v.literal("sii_publico")
)),
fechaExpiracion: v.optional(v.number()),      // auto-calculated: discoveredAt + 24 months
testPonderacionRef: v.optional(v.string()),   // ref to balancing test document
complianceStatus: v.optional(v.union(
  v.literal("activo"),
  v.literal("expirado"),
  v.literal("opt_out"),
  v.literal("eliminado"),
  v.literal("anonimizado")
)),
optOutAt: v.optional(v.number()),
optOutMotivo: v.optional(v.string()),
softDeletedAt: v.optional(v.number()),
hardDeleteScheduledAt: v.optional(v.number()),
ultimaInteraccion: v.optional(v.number()),    // resets retention timer
```

### Pattern 2: Global Blacklist Table

**What:** Separate table for opt-out blacklist, persists even after lead hard-delete.
**When to use:** Prevent re-importing leads who have opted out, across ALL tenants.

```typescript
// New table in schema.ts
optOutBlacklist: defineTable({
  email: v.string(),                // the opted-out email (hashed for privacy)
  emailHash: v.string(),            // SHA-256 hash for lookup without storing PII
  optOutAt: v.number(),
  motivo: v.optional(v.string()),
  source: v.union(
    v.literal("email_link"),
    v.literal("formulario_web"),
    v.literal("arco_solicitud"),
    v.literal("manual")
  ),
  // Keep minimal data only -- no PII beyond what's needed for matching
  tenantsNotified: v.optional(v.array(v.string())),  // orgIds that were notified
})
  .index("by_emailHash", ["emailHash"])
  .index("by_email", ["email"]),
```

### Pattern 3: ARCO-POL Request Tracking

**What:** Table to track data rights requests (access, rectification, suppression, opposition, portability, limitation).
**When to use:** Every incoming ARCO-POL request gets logged for audit trail and SLA tracking.

```typescript
// New table in schema.ts
arcoRequests: defineTable({
  email: v.string(),
  nombre: v.optional(v.string()),
  tipoSolicitud: v.union(
    v.literal("acceso"),
    v.literal("rectificacion"),
    v.literal("supresion"),
    v.literal("oposicion"),
    v.literal("portabilidad"),
    v.literal("limitacion")
  ),
  estado: v.union(
    v.literal("recibida"),
    v.literal("verificando"),      // email verification sent
    v.literal("verificada"),       // email confirmed
    v.literal("en_proceso"),       // n8n triage assigned
    v.literal("completada"),
    v.literal("rechazada")
  ),
  detalles: v.optional(v.string()),
  verificationToken: v.optional(v.string()),
  verifiedAt: v.optional(v.number()),
  tenantsAfectados: v.optional(v.array(v.string())),  // orgIds with this lead
  respuesta: v.optional(v.string()),
  completadaAt: v.optional(v.number()),
  // SLA: 15 dias habiles (decision from CONTEXT.md)
  fechaLimite: v.number(),
  createdAt: v.number(),
})
  .index("by_email", ["email"])
  .index("by_estado", ["estado"])
  .index("by_token", ["verificationToken"]),
```

### Pattern 4: Convex HTTP Actions for Public Endpoints

**What:** Unauthenticated public endpoints for opt-out and ARCO-POL.
**When to use:** These must be accessible WITHOUT login -- leads are not Sisteco users.

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// POST: One-click unsubscribe (RFC 8058) from email headers
http.route({
  path: "/unsubscribe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    // Parse email from body or URL params
    // Mark opt-out in blacklist, trigger soft-delete across tenants
    await ctx.runMutation(/* internal opt-out mutation */);
    return new Response("", { status: 200 });
  }),
});

// GET: Opt-out form page (returns HTML)
http.route({
  path: "/opt-out",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // Return standalone HTML form
    return new Response(OPT_OUT_FORM_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }),
});

// POST: Submit opt-out request (sends verification email)
http.route({
  path: "/opt-out",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { email } = await request.json();
    // Create verification token, send email via Resend
    await ctx.runAction(/* send verification email */);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// GET: Confirm opt-out (from verification email link)
http.route({
  path: "/opt-out/confirm",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    // Verify token, execute opt-out, return confirmation page
    await ctx.runMutation(/* execute opt-out */);
    return new Response(CONFIRMATION_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }),
});

// POST: ARCO-POL request submission
http.route({
  path: "/derechos",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { email, nombre, tipo, detalles } = await request.json();
    // Create request, send verification, trigger n8n webhook
    await ctx.runMutation(/* create ARCO request */);
    return new Response(JSON.stringify({ ok: true }));
  }),
});

export default http;
```

### Pattern 5: Convex Cron for Retention Management

**What:** Daily cron job scans leads for expired retention, applies soft/hard delete.
**When to use:** Automated data lifecycle -- no manual intervention needed.

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily at 03:00 UTC (00:00 Chile) -- scan for expired leads
crons.daily(
  "retention-scan",
  { hourUTC: 3, minuteUTC: 0 },
  internal.retention.scanExpiredLeads
);

// Daily at 04:00 UTC -- hard delete leads soft-deleted > 30 days ago
crons.daily(
  "hard-delete-batch",
  { hourUTC: 4, minuteUTC: 0 },
  internal.retention.hardDeleteExpired
);

export default crons;
```

### Pattern 6: Resend Email with List-Unsubscribe Header

**What:** Every outreach email includes List-Unsubscribe header per RFC 8058.
**When to use:** All emails sent via Resend must include opt-out mechanism.

```typescript
// In n8n workflow or Resend API call
await resend.emails.send({
  from: 'Sisteco <hola@sisteco.cl>',
  to: [leadEmail],
  subject: subject,
  html: emailBody,
  headers: {
    'List-Unsubscribe': `<https://<deployment>.convex.site/unsubscribe?email=${encodeURIComponent(leadEmail)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  },
});
```

### Anti-Patterns to Avoid

- **Storing opt-out state only in leads table:** The blacklist MUST be a separate table that survives hard-delete. Otherwise, a hard-deleted-then-re-scraped lead loses their opt-out.
- **Trusting client-side orgId for compliance operations:** All compliance mutations must extract orgId from JWT, same as existing pattern.
- **Synchronous Sheet deletion in HTTP action:** Google Sheets API calls are slow. Use `ctx.scheduler.runAfter(0, ...)` to handle Sheet propagation asynchronously after the Convex mutation succeeds.
- **Storing full PII in blacklist:** Only store email hash + original email. No name, company, or other data in the blacklist -- minimization principle.
- **Hard-coding retention periods:** Store retention config (24 months default, 36 max) as constants that can be updated without schema change.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email verification tokens | Custom crypto/random | `crypto.randomUUID()` or `crypto.randomBytes(32).toString('hex')` | Secure token generation is subtle; use built-in |
| Cron scheduling | setTimeout loops or external cron | Convex `cronJobs()` in `crons.ts` | Transactional with DB, survives deploys, dashboard monitoring |
| Opt-out across all tenants | Query each tenant separately | Single indexed query on `optOutBlacklist.by_email` | Blacklist is global, not per-tenant |
| Sheet row deletion by email | Manual row-by-row deletion | Google Sheets `batchUpdate` with `deleteRange` | Batch operations are faster and avoid rate limits |
| DPA/privacy policy text | Write from scratch | `sisteco-legal` skill templates (sections 3, 4, 6) | Already written and reviewed; just fill in specifics |
| RAT format | Custom document format | `sisteco-legal` skill template (section 8) | Already aligned with Art. 16 Ley 21.719 |
| EIPD for AI scoring | Custom assessment | `sisteco-legal` skill template (section 9) | Already covers Gemini scoring use case |

**Key insight:** The legal document templates already exist in the `sisteco-legal` skill. The actual implementation work is building the technical plumbing (Convex schema, HTTP endpoints, cron jobs, n8n workflows) to enforce those legal commitments in code.

## Common Pitfalls

### Pitfall 1: Opt-out Race Condition
**What goes wrong:** Lead opts out while an outreach email is being sent. Email goes out after opt-out.
**Why it happens:** Opt-out mutation and email sending are not atomic.
**How to avoid:** Check blacklist immediately before every email send in the n8n workflow. Add a "pre-send blacklist check" node.
**Warning signs:** Opt-out complaints from leads who already opted out.

### Pitfall 2: Retention Timer Not Resetting on Interaction
**What goes wrong:** A lead with active engagement gets auto-deleted because `discoveredAt + 24 months` expired.
**Why it happens:** Using only `discoveredAt` for expiration without tracking last interaction.
**How to avoid:** Update `ultimaInteraccion` on every meaningful interaction. Recalculate `fechaExpiracion = max(ultimaInteraccion + 24 months, discoveredAt + 36 months ceiling)`.
**Warning signs:** Active pipeline leads disappearing from the system.

### Pitfall 3: Blacklist Not Checked on Lead Import
**What goes wrong:** PhantomBuster re-scrapes an opted-out lead and re-imports them.
**Why it happens:** The import workflow doesn't check the blacklist before inserting.
**How to avoid:** Add blacklist check as the FIRST step in the lead import n8n workflow, before any Convex insert.
**Warning signs:** Opted-out leads reappearing in client Sheets.

### Pitfall 4: Google Sheets Propagation Failure
**What goes wrong:** Lead is deleted from Convex but remains in the client's Google Sheet.
**Why it happens:** Sheets API call fails (auth expired, rate limit, network error) and there's no retry.
**How to avoid:** Use n8n workflow with retry logic (3 retries, exponential backoff). Log failures for manual review.
**Warning signs:** Inconsistency between Convex and Sheets data.

### Pitfall 5: Confusing Soft Delete with Anonymization
**What goes wrong:** Soft-deleted leads still have full PII accessible via direct DB queries.
**Why it happens:** Soft delete only sets a flag but doesn't remove data.
**How to avoid:** Soft delete ALSO anonymizes PII fields (replace name with "[ELIMINADO]", email with hash, etc.). Only the blacklist retains the original email for matching.
**Warning signs:** Audit reveals PII in "deleted" records.

### Pitfall 6: No CORS on Public HTTP Endpoints
**What goes wrong:** Standalone opt-out form cannot POST to Convex HTTP action.
**Why it happens:** Browser blocks cross-origin requests.
**How to avoid:** Add CORS headers to all public HTTP endpoints + handle OPTIONS preflight. OR serve the form HTML directly from the Convex HTTP action (same-origin).
**Warning signs:** Form submissions fail silently in browser.

## Code Examples

### Soft Delete + Anonymize Lead (Convex Mutation)

```typescript
// convex/optOut.ts
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// Internal: find all leads by email across ALL tenants
export const findLeadsByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("leads")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
  },
});

// Internal: soft delete + anonymize a single lead
export const softDeleteLead = internalMutation({
  args: { leadId: v.id("leads") },
  handler: async (ctx, { leadId }) => {
    const lead = await ctx.db.get(leadId);
    if (!lead) return;

    const now = Date.now();
    await ctx.db.patch(leadId, {
      // Anonymize PII
      contacto: "[ELIMINADO]",
      email: `anon-${leadId}@eliminated.local`,
      telefono: undefined,
      linkedinUrl: undefined,
      // Keep non-PII for aggregate stats
      // empresa, industria, tamano stay for anonymized analytics
      // Mark compliance status
      complianceStatus: "opt_out",
      optOutAt: now,
      softDeletedAt: now,
      hardDeleteScheduledAt: now + (30 * 24 * 60 * 60 * 1000), // +30 days
      estado: "cerrado",
      subestado: "descartado",
      lastUpdatedAt: now,
      auditTrail: [
        ...(lead.auditTrail || []),
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

// Internal: add email to global blacklist
export const addToBlacklist = internalMutation({
  args: {
    email: v.string(),
    emailHash: v.string(),
    source: v.string(),
    motivo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if already blacklisted
    const existing = await ctx.db
      .query("optOutBlacklist")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) return existing._id; // Already blacklisted

    return await ctx.db.insert("optOutBlacklist", {
      email: args.email,
      emailHash: args.emailHash,
      optOutAt: Date.now(),
      source: args.source as any,
      motivo: args.motivo,
      tenantsNotified: [],
    });
  },
});
```

### Retention Scan Cron (Convex Internal Mutation)

```typescript
// convex/retention.ts
import { internalMutation } from "./_generated/server";

const BATCH_SIZE = 100; // Process in batches to avoid timeout

export const scanExpiredLeads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find leads where fechaExpiracion has passed and not already handled
    const expiredLeads = await ctx.db
      .query("leads")
      .filter((q) =>
        q.and(
          q.neq(q.field("complianceStatus"), "opt_out"),
          q.neq(q.field("complianceStatus"), "eliminado"),
          q.neq(q.field("complianceStatus"), "anonimizado"),
          q.lt(q.field("fechaExpiracion"), now)
        )
      )
      .take(BATCH_SIZE);

    let processed = 0;
    for (const lead of expiredLeads) {
      if (!lead.fechaExpiracion || lead.fechaExpiracion > now) continue;

      await ctx.db.patch(lead._id, {
        complianceStatus: "expirado",
        softDeletedAt: now,
        hardDeleteScheduledAt: now + (30 * 24 * 60 * 60 * 1000),
        contacto: "[EXPIRADO]",
        email: `expired-${lead._id}@retention.local`,
        telefono: undefined,
        linkedinUrl: undefined,
        lastUpdatedAt: now,
        auditTrail: [
          ...(lead.auditTrail || []),
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

    // Log execution
    console.log(`Retention scan: ${processed} leads processed`);
  },
});

export const hardDeleteExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find leads scheduled for hard delete where grace period passed
    const toDelete = await ctx.db
      .query("leads")
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("complianceStatus"), "opt_out"),
            q.eq(q.field("complianceStatus"), "expirado"),
            q.eq(q.field("complianceStatus"), "anonimizado")
          ),
          q.lt(q.field("hardDeleteScheduledAt"), now)
        )
      )
      .take(BATCH_SIZE);

    let deleted = 0;
    for (const lead of toDelete) {
      await ctx.db.delete(lead._id);
      deleted++;
    }

    console.log(`Hard delete batch: ${deleted} leads permanently deleted`);
  },
});
```

### Email Verification Token Generation

```typescript
// In Convex action (needs Node.js runtime)
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

export const sendOptOutVerification = internalAction({
  args: { email: v.string(), requestId: v.string() },
  handler: async (ctx, { email, requestId }) => {
    // Generate secure token
    const token = crypto.randomUUID();
    const confirmUrl = `https://<deployment>.convex.site/opt-out/confirm?token=${token}`;

    // Store token in request
    await ctx.runMutation(/* store token on ARCO request */);

    // Send verification email via Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Sisteco Privacidad <privacidad@sisteco.cl>",
        to: [email],
        subject: "Confirma tu solicitud de privacidad - Sisteco",
        html: `
          <p>Hemos recibido tu solicitud. Para confirmar, haz clic en el siguiente enlace:</p>
          <a href="${confirmUrl}">Confirmar solicitud</a>
          <p>Este enlace expira en 24 horas.</p>
          <p>Si no solicitaste esto, ignora este email.</p>
        `,
      }),
    });
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dashboard-centric compliance notices | DPA as primary compliance instrument | Pivote 2026-03-15 | Privacy notice in dashboard is secondary; DPA covers transparency obligations |
| Per-tenant opt-out | Global blacklist across all tenants | CONTEXT.md decision | One opt-out removes lead from ALL clients, not just one |
| Manual data deletion | Automated retention crons + propagation | This phase | No human intervention needed for routine data lifecycle |
| Ley 19.628 (current Chilean law) | Ley 21.719 (effective Dec 2026) | Published Dec 2024, effective Dec 2026 | New enforcement agency (APDP), real sanctions up to 20,000 UTM |

**Key regulatory dates:**
- **June 2026:** APDP may start early installation (Comision Ministerial recommendation)
- **October 2026:** APDP Consejo Directivo assumes
- **December 1, 2026:** Law enters full force -- Sisteco MUST be compliant by then
- **~8.5 months remaining** from today (March 15, 2026)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected -- no test files in project |
| Config file | none -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

**Note:** This project uses vanilla HTML/JS + Convex without a test framework. Compliance verification will rely on:
1. Manual testing via Playwright CLI (`scripts/` or `.playwright-cli/`)
2. Convex dashboard verification of cron execution and data state
3. Smoke tests via HTTP requests to public endpoints (curl/fetch)

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | Privacy policy page accessible at /privacidad path | smoke | `curl -s https://<site>/privacidad` returns 200 | -- Wave 0 |
| COMP-02 | RAT document exists and lists all treatment activities | manual-only | Verify `docs/legal/RAT.md` exists and covers all activities | -- Wave 0 |
| COMP-03 | Opt-out flow: submit email -> receive verification -> confirm -> lead anonymized | e2e | Playwright CLI script testing full flow | -- Wave 0 |
| COMP-03 | Blacklist prevents re-import of opted-out email | integration | Script: insert blacklisted email via n8n, verify rejection | -- Wave 0 |
| COMP-04 | New leads have baseLegal, fuenteDatos, fechaExpiracion fields | smoke | Convex dashboard query on leads table | -- Wave 0 |
| COMP-05 | Retention cron soft-deletes expired leads | integration | Insert test lead with past fechaExpiracion, wait for cron, verify state | -- Wave 0 |

### Sampling Rate
- **Per task commit:** Manual smoke test of affected endpoint/page
- **Per wave merge:** Full flow test: opt-out + retention + Sheet propagation
- **Phase gate:** All COMP-01 through COMP-05 verified before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No test framework installed -- compliance tests will be manual + Playwright CLI scripts
- [ ] `scripts/test-compliance.js` -- smoke test script for HTTP endpoints (curl-based)
- [ ] Playwright CLI flow for opt-out form e2e test

## Open Questions

1. **Resend sender address for privacy emails**
   - What we know: Project uses `hola@sisteco.cl` for general emails
   - What's unclear: Whether `privacidad@sisteco.cl` is configured as a verified sender in Resend
   - Recommendation: Use existing `hola@sisteco.cl` or create alias `privacidad@sisteco.cl` in Resend dashboard

2. **Convex HTTP action base URL**
   - What we know: Convex HTTP actions are served at `https://<deployment>.convex.site`
   - What's unclear: Exact deployment name for production Convex instance
   - Recommendation: Use `process.env.CONVEX_SITE_URL` which is already in `.env.example`

3. **Google Sheets API: finding client sheet IDs**
   - What we know: `sheets-manager.js` exists and can read/write/delete from sheets
   - What's unclear: How to discover which Sheet IDs belong to which tenant for propagation
   - Recommendation: Store Sheet IDs in a new Convex table `tenantSheets` mapping orgId -> spreadsheetId

4. **n8n webhook for ARCO-POL triage**
   - What we know: n8n is self-hosted on Railway, receives webhooks
   - What's unclear: Whether a new webhook URL is needed or the existing `N8N_WEBHOOK_URL` can be reused
   - Recommendation: Create a dedicated n8n workflow with its own webhook URL for ARCO-POL requests

5. **DPA signing mechanism**
   - What we know: CONTEXT.md mentions "Digital (DocuSign/HelloSign or similar)"
   - What's unclear: Which e-signature service to use, if any, for MVP
   - Recommendation: For MVP, use a simple PDF DPA sent via email with "reply to accept" or use Pandadoc free tier. Full e-signature integration is Phase 5 (onboarding).

## Sources

### Primary (HIGH confidence)
- Convex Cron Jobs docs: https://docs.convex.dev/scheduling/cron-jobs
- Convex Scheduled Functions docs: https://docs.convex.dev/scheduling/scheduled-functions
- Convex HTTP Actions docs: https://docs.convex.dev/functions/http-actions
- Resend List-Unsubscribe docs: https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails
- Google Sheets API row operations: https://developers.google.com/workspace/sheets/api/samples/rowcolumn
- Project file: `convex/schema.ts` -- current leads schema
- Project file: `convex/leads.ts` -- current multi-tenant query patterns
- Project file: `scripts/sheets-manager.js` -- existing Sheets integration
- Project file: `.claude/skills/sisteco-legal.md` -- DPA, RAT, privacy policy, EIPD templates

### Secondary (MEDIUM confidence)
- Ley 21.719 full text: https://www.bcn.cl/leychile/navegar?idNorma=1209272
- BigID compliance guide: https://bigid.com/blog/chile-new-data-privacy-law-21-719/
- FPF analysis: https://fpf.org/blog/chiles-new-data-protection-law-context-overview-and-key-takeaways/
- Didomi regulation overview: https://www.didomi.io/regulations/chile
- n8n GDPR workflow template: https://n8n.io/workflows/1455-handle-gdpr-data-deletion-requests-with-slack/
- heydata n8n compliance guide: https://heydata.eu/en/magazine/marketing-automation-with-n8n-gdpr-ai-act-and-nis-2-compliant-1/
- Project file: `sisteco-knowledge/estrategia/LEY_21719_COMPLIANCE.md` -- internal compliance strategy document

### Tertiary (LOW confidence)
- DPA signing: Pandadoc/DocuSign pricing and availability for Chile -- needs validation before implementation
- APDP early installation timeline (June 2026) -- based on Garrigues article, may shift

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools are already in the project; no new dependencies needed
- Architecture: HIGH -- patterns follow existing Convex conventions (http.ts, crons.ts, internal mutations) verified against official docs
- Legal templates: HIGH -- `sisteco-legal` skill contains complete templates already aligned with Ley 21.719
- Pitfalls: HIGH -- based on GDPR precedent patterns that directly apply to Ley 21.719
- Retention logic: MEDIUM -- 24/36 month periods are from CONTEXT.md decisions; edge cases (interaction definition, batch size limits) need implementation-time validation

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- law text is final, tools are established)

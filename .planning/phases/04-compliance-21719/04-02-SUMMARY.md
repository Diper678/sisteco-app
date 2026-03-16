---
phase: 04-compliance-21719
plan: 02
subsystem: compliance-api
tags: [convex, compliance, ley-21719, opt-out, arco-pol, http-endpoints, gdpr-chile, privacy]

requires:
  - phase: 04-compliance-21719
    plan: 01
    provides: optOutBlacklist table, arcoRequests table, complianceStatus field on leads

provides:
  - Public HTTP endpoints for opt-out and ARCO-POL (no auth required)
  - Global opt-out lifecycle: find leads by email cross-tenant, anonymize PII, add to blacklist
  - ARCO-POL request intake with email verification (token via crypto.randomUUID)
  - One-click unsubscribe RFC 8058 via POST /unsubscribe
  - Privacy policy publicly accessible at /privacidad

affects:
  - 04-03 (retention cron will call similar anonymization patterns — reuse softDeleteLead logic)
  - n8n workflows (ARCO-POL triage webhook triggers from arcoRequests verificada state)
  - Lead import workflows (should call checkBlacklist before inserting any new lead)

tech-stack:
  added: []
  patterns:
    - "internalMutation/internalQuery for server-only compliance functions (not exposed to clients)"
    - "internalAction for Resend API calls (needs Node.js fetch, not available in mutations)"
    - "httpAction for public unauthenticated endpoints (leads are not Sisteco users)"
    - "emailHash = email in mutations (V8 runtime lacks crypto.subtle; comment documents limitation)"
    - "crypto.randomUUID() in internalMutation (available in Convex V8 runtime)"
    - "CORS headers on all public endpoints (prevents browser blocking cross-origin POST)"
    - "result.email explicit return from verifyArcoRequest — enables opt-out chain in confirm handler"
    - "Inline logic in executeGlobalOptOut (Convex mutations cannot call other mutations)"

key-files:
  created:
    - convex/optOut.ts
    - convex/compliance.ts
    - convex/http.ts
  modified: []

key-decisions:
  - "emailHash stores email directly in mutations (V8 runtime limitation: no crypto.subtle in internalMutation)"
  - "verifyArcoRequest returns email explicitly — avoids needing a separate query in the HTTP confirm handler"
  - "executeGlobalOptOut inlines all logic (blacklist insert + lead anonymization) because mutations cannot call other mutations"
  - "Resend send failure is non-fatal — logs error but returns {sent: false} to not block opt-out flow"
  - "RFC 8058 /unsubscribe always returns 200 even on error — email clients expect silent success, no retries"
  - "sendVerificationEmail uses contacto@sisteco.cl as sender (existing verified sender, avoids new domain setup)"
  - "POST /opt-out creates tipoSolicitud: supresion ARCO request (reuses ARCO flow for opt-out verification token)"

requirements-completed: [COMP-01, COMP-03]

duration: 6min
completed: 2026-03-16
---

# Phase 4 Plan 02: Compliance Ley 21.719 — Opt-out Endpoints + ARCO-POL Summary

**Public-facing compliance infrastructure: 6 HTTP endpoints (opt-out form, verification, unsubscribe RFC 8058, ARCO-POL intake, privacy policy) with cross-tenant PII anonymization and global blacklist via 3 Convex files**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T21:57:40Z
- **Completed:** 2026-03-16T22:03:46Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- `convex/optOut.ts`: 5 internal functions — findLeadsByEmail (cross-tenant query), checkBlacklist (blacklist lookup), softDeleteLead (single lead anonymization), addToBlacklist (idempotent insert), executeGlobalOptOut (orchestrator: blacklist + find all leads + anonymize all in one transaction)
- `convex/compliance.ts`: 4 internal mutations/queries + 1 internal action — createArcoRequest (token generation, 15-day SLA), verifyArcoRequest (token verification, returns email explicitly), updateArcoStatus (operator/n8n state machine), getArcoRequestsByEstado (triage query), sendVerificationEmail (Resend API with Sisteco branding)
- `convex/http.ts`: 6 public HTTP endpoints with CORS — GET/POST /opt-out (form + submission), GET /opt-out/confirm (token verification + executeGlobalOptOut), POST /unsubscribe (RFC 8058), POST /derechos (ARCO-POL intake), GET /privacidad (full privacy policy HTML inline)

## Task Commits

1. **Task 1: Create opt-out and blacklist mutations** - `44a9345` (feat)
2. **Task 2: Create ARCO-POL mutations and email verification action** - `f36ebbf` (feat)
3. **Task 3: Create HTTP router with public compliance endpoints** - `3c8116f` (feat)

**Plan metadata:** (this summary commit — see below)

## Files Created/Modified

- `convex/optOut.ts` — Internal mutations for opt-out lifecycle: findLeadsByEmail cross-tenant, checkBlacklist, softDeleteLead PII anonymization, addToBlacklist idempotent, executeGlobalOptOut orchestrator
- `convex/compliance.ts` — ARCO-POL request management: createArcoRequest with crypto.randomUUID token + 15-day SLA, verifyArcoRequest returning email, updateArcoStatus, getArcoRequestsByEstado query, sendVerificationEmail via Resend
- `convex/http.ts` — HTTP router: 6 routes + 3 OPTIONS preflight, Sisteco-branded HTML forms, CORS headers, RFC 8058 unsubscribe, inline privacy policy from docs/legal/politica-privacidad.md content

## Decisions Made

- `emailHash` in `optOutBlacklist` stores the email directly in internalMutation context (Convex V8 runtime does not expose `crypto.subtle` in mutations). SHA-256 hashing would require an internalAction, which cannot be transactional with a mutation insert. Documented with inline comment. `by_email` index provides efficient lookup without URL exposure.
- `verifyArcoRequest` explicitly includes `email: request.email` in its return value. This is required because the `/opt-out/confirm` HTTP handler needs the email to call `executeGlobalOptOut` — the handler cannot look it up separately after verification.
- `executeGlobalOptOut` inlines all logic (blacklist check/insert + lead query + anonymization loop) because Convex mutations cannot call other mutations via `ctx.runMutation`. This keeps the entire opt-out operation in one atomic transaction.
- Resend send failure is non-fatal: logs error, returns `{sent: false}`, allows opt-out flow to proceed. User can always confirm via direct email if verification email fails.
- POST /unsubscribe returns 200 even on internal error — RFC 8058 clients expect silent success and should not retry on 5xx.
- POST /opt-out creates a `tipoSolicitud: "supresion"` ARCO request (reuses ARCO verification token flow for opt-out). This elegantly unifies both flows through the same `verifyArcoRequest` mutation.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. All 3 files compiled cleanly on first attempt with `npx convex dev --once --typecheck disable`.

## User Setup Required

Environment variables must be set in Convex dashboard before endpoints are functional:
- `RESEND_API_KEY` — API key from Resend for sending verification emails
- `CONVEX_SITE_URL` — Base URL of the Convex deployment (e.g., `https://xyz.convex.site`)

After env vars are set, endpoints will be available at:
- `https://<deployment>.convex.site/opt-out`
- `https://<deployment>.convex.site/opt-out/confirm`
- `https://<deployment>.convex.site/unsubscribe`
- `https://<deployment>.convex.site/derechos`
- `https://<deployment>.convex.site/privacidad`

## Next Phase Readiness

- Plan 04-03 (retention cron) can reuse the anonymization pattern from `executeGlobalOptOut` and `softDeleteLead`
- `checkBlacklist` is ready to be added as first step in the n8n lead import workflow (prevents re-importing opted-out leads — CONTEXT.md Area 2 Decision 4)
- ARCO-POL triage n8n workflow can query `getArcoRequestsByEstado("verificada")` to find requests needing processing

---
*Phase: 04-compliance-21719*
*Completed: 2026-03-16*

## Self-Check: PASSED

- convex/optOut.ts: FOUND
- convex/compliance.ts: FOUND
- convex/http.ts: FOUND
- .planning/phases/04-compliance-21719/04-02-SUMMARY.md: FOUND
- Commit 44a9345: FOUND
- Commit f36ebbf: FOUND
- Commit 3c8116f: FOUND

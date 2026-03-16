---
phase: 04-compliance-21719
plan: 04
subsystem: compliance
tags: [google-sheets, discord-webhook, n8n, arco-pol, ley-21719, convex, scheduler]

# Dependency graph
requires:
  - phase: 04-02
    provides: executeGlobalOptOut mutation, verifyArcoRequest mutation, arcoRequests table, compliance.ts actions

provides:
  - tenantSheets table in Convex schema (orgId → spreadsheetId mapping)
  - propagateOptOutToSheets: deletes lead row from tenant Google Sheets on opt-out
  - notifyTenantsOfDeletion: Discord notification to tenants for CRM cleanup
  - triggerArcoPolWebhook: n8n triage webhook for verified ARCO-POL requests (non-supresion)
  - GET /derechos/confirm HTTP route for ARCO-POL token verification
  - scripts/sheets-compliance-sync.js: manual backup script for compliance ops

affects: [05-onboarding-clientes, n8n-workflows, google-sheets-integration]

# Tech tracking
tech-stack:
  added: [Google Sheets API v4 (fetch-based, no SDK), Convex scheduler pattern]
  patterns: [scheduler.runAfter(0) for async propagation from mutations, email redaction for privacy in logs/notifications, best-effort pattern with graceful degradation on missing API keys]

key-files:
  created:
    - convex/sheetsPropagation.ts
    - scripts/sheets-compliance-sync.js
  modified:
    - convex/schema.ts
    - convex/optOut.ts
    - convex/http.ts

key-decisions:
  - "ctx.scheduler.runAfter(0, ...) from internalMutation to trigger internalActions — Convex mutations cannot call actions directly, scheduler is the correct pattern"
  - "Email redaction (3 chars + ***@domain) in all Discord/n8n notifications — privacy by design for compliance system"
  - "Best-effort Sheet propagation: if GOOGLE_SHEETS_API_KEY missing, log warning and continue — Convex opt-out already succeeded"
  - "batchUpdate deleteDimension (not deleteRange) for Sheets row deletion — deleteDimension is the correct Sheets API v4 method"
  - "GET /derechos/confirm routes supresion to executeGlobalOptOut, other ARCO types to triggerArcoPolWebhook for human triage"
  - "tenantSheets table is global (not per-org) — it maps orgs to their Sheets, used for propagation infrastructure"

patterns-established:
  - "Async propagation pattern: mutations use ctx.scheduler.runAfter(0, ...) to trigger actions that cannot run inside mutations"
  - "Graceful degradation: check env vars at start of action, log warning and return early if not configured"
  - "Compliance notifications: Discord as primary channel, email (Resend) as future secondary"

requirements-completed: [COMP-03, COMP-01]

# Metrics
duration: 6min
completed: 2026-03-16
---

# Phase 4 Plan 4: Sheets Propagation + ARCO-POL Triage Summary

**Convex scheduler-based Google Sheets propagation on opt-out, tenant Discord notifications, n8n webhook for ARCO-POL human triage, and tenantSheets table for orgId-to-spreadsheetId mapping**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T22:30:39Z
- **Completed:** 2026-03-16T22:36:01Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- tenantSheets table added to Convex schema with `by_orgId` index — enables orgId-to-spreadsheetId lookup for compliance propagation
- `executeGlobalOptOut` now schedules Sheet row deletion and tenant Discord notification via `ctx.scheduler.runAfter(0, ...)` after anonymization
- Verified ARCO-POL requests (non-supresion) trigger n8n webhook at `/arco-pol-triage` for human-in-the-loop triage with 15-day deadline
- GET /derechos/confirm HTTP route added — confirms ARCO-POL tokens, routes supresion to opt-out flow and other types to triage webhook
- Manual `scripts/sheets-compliance-sync.js` script available for backup compliance ops (delete-email, check-email commands)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add tenantSheets table and Sheets propagation + ARCO-POL triage** - `839bace` (feat)
2. **Task 2: Wire propagation into opt-out flow and create manual sync script** - `ae30612` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `convex/schema.ts` — Added tenantSheets table with orgId, spreadsheetId, sheetName, status, by_orgId index
- `convex/sheetsPropagation.ts` — 4 exported functions: propagateOptOutToSheets, notifyTenantsOfDeletion, getTenantSheets, triggerArcoPolWebhook
- `convex/optOut.ts` — Added `import { internal }`, ctx.scheduler.runAfter calls for propagation + notification after anonymization loop
- `convex/http.ts` — Added GET /derechos/confirm route, ARCO-POL HTML templates (success/error), CORS preflight for /derechos/confirm
- `scripts/sheets-compliance-sync.js` — Standalone Node.js backup script: delete-email, check-email, list-sheets commands

## Decisions Made

- Used `ctx.scheduler.runAfter(0, ...)` (not direct action call) — Convex mutations cannot invoke actions directly; scheduler is the correct decoupled pattern
- Email redaction (3 chars + `***@domain`) in all external notifications (Discord, n8n webhook) for privacy by design
- Best-effort Sheet propagation: if `GOOGLE_SHEETS_API_KEY` not configured, logs warning and skips — Convex opt-out already succeeded and is authoritative
- `deleteDimension` (not `deleteRange`) for Sheets row deletion — `deleteRange` shifts content but keeps empty rows; `deleteDimension` removes the row entirely
- `triggerArcoPolWebhook` sends Discord notification always (as secondary channel), even when n8n is configured — ensures human visibility
- `tenantSheets` is infrastructure-level table (not per-tenant-isolated) — it maps orgs to delivery Sheets; accessed only by compliance propagation code

## Deviations from Plan

None - plan executed exactly as written. The `batchUpdate` vs `deleteRange` terminology in the plan referred to the same Sheets API batchUpdate endpoint; implementation correctly uses `deleteDimension` within the batchUpdate requests payload, which is the proper Sheets API v4 pattern for row deletion.

## Issues Encountered

None - Convex compiled cleanly on both tasks. No type errors or import issues.

## User Setup Required

The following environment variables must be configured for propagation to work:

- `GOOGLE_SHEETS_API_KEY` — Sheets API key from Google Cloud Console (for row deletion in tenant Sheets)
- `DISCORD_WEBHOOK_URL` — Discord webhook URL (for tenant CRM cleanup notifications and ARCO-POL alerts)
- `N8N_WEBHOOK_URL` — n8n base URL (for ARCO-POL triage webhook at `/arco-pol-triage`)

Without these, the system degrades gracefully: Convex opt-out succeeds, propagation is skipped with a warning log.

## Next Phase Readiness

- Phase 4 compliance layer complete: opt-out flow (Plan 02), retention crons (Plan 03), and Sheets propagation + ARCO-POL triage (Plan 04) all implemented
- Phase 5 (Onboarding Clientes Fundadores) can proceed: tenantSheets table is ready to be populated during client onboarding
- When onboarding a new client, insert a tenantSheets row with their orgId and spreadsheetId
- n8n workflow for ARCO-POL triage (`/arco-pol-triage` route) needs to be built in n8n as part of Phase 5 operations setup

---
*Phase: 04-compliance-21719*
*Completed: 2026-03-16*

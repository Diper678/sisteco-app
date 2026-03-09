---
phase: 02-http-layer-telegram-bot
plan: 01
subsystem: infra
tags: [convex, http-actions, telegram, circuit-breaker, rate-limiting]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Convex schema (8 tables), agents.ts mutations/queries, agentMessages.ts, intelligence.ts"
provides:
  - "HTTP Action endpoint POST /api/call with shared-secret auth and function allowlist"
  - "telegramQueue table with consolidation, priority sorting, and retry logic"
  - "createTaskWithBreaker mutation with atomic circuit breaker (hourly limits per agent)"
  - "Smoke test script covering auth, forbidden, queries, and queue operations"
affects: [02-02-telegram-bot, 03-monitor-agent, 04-leads-agent, 05-finance-agent]

# Tech tracking
tech-stack:
  added: [typescript (devDep), "@types/node (devDep)"]
  patterns: ["HTTP Action with allowlist dispatch", "shared-secret auth via X-SAAN-Secret header", "consolidation window pattern for message batching", "atomic circuit breaker in Convex mutation"]

key-files:
  created: [SAAN/convex/http.ts, SAAN/convex/telegramQueue.ts, SAAN/tests/smoke-phase2.sh]
  modified: [SAAN/convex/schema.ts, SAAN/convex/agents.ts]

key-decisions:
  - "Initialized git repo in SAAN directory for code tracking (was untracked)"
  - "Used process.env for SAAN_API_SECRET access in Convex HTTP Actions (requires @types/node)"
  - "Allowlist includes 19 functions covering all Phase 1 exports plus new telegramQueue and createTaskWithBreaker"
  - "QUERIES Set used to dispatch ctx.runQuery vs ctx.runMutation correctly"

patterns-established:
  - "HTTP dispatch pattern: POST /api/call with { function, args } body, allowlist lookup, query/mutation dispatch"
  - "Circuit breaker pattern: atomic count + insert in single mutation, pauses agent on limit breach"
  - "Telegram consolidation: 30-second windows per agent, CRITICAL bypasses consolidation"

requirements-completed: [INFRA-01, INFRA-02, INFRA-06, INFRA-07]

# Metrics
duration: 7min
completed: 2026-03-05
---

# Phase 2 Plan 1: HTTP Layer + Telegram Queue Summary

**Generic /api/call HTTP endpoint with shared-secret auth, telegramQueue table with priority/consolidation, and atomic circuit breaker preventing runaway agent loops**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-05T19:58:45Z
- **Completed:** 2026-03-05T20:05:53Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- HTTP Action endpoint /api/call with 19-function allowlist, shared-secret auth, and CORS support
- telegramQueue table with enqueue (consolidation windows), getPending (priority-sorted, 30/batch), markSent, markFailed (3 retries), getFailedCount
- createTaskWithBreaker mutation with per-agent hourly limits (monitor:15, leads:10, finance:5, default:10) and automatic agent pausing
- Smoke test script with 7 curl-based tests covering auth, forbidden, valid queries, and queue operations

## Task Commits

Each task was committed atomically (in SAAN repo):

1. **Task 1: Schema + Telegram Queue mutations** - `60611e8` (feat) — includes SAAN repo initialization
2. **Task 2: HTTP endpoint + Circuit Breaker** - `e77ca82` (feat)
3. **Task 3: Smoke test script** - `bd51ec7` (test)

## Files Created/Modified
- `SAAN/convex/schema.ts` - Added telegramQueue table with 3 indexes (by_status_priority, by_status_created, by_consolidation)
- `SAAN/convex/telegramQueue.ts` - Queue mutations: enqueue, getPending, getConsolidated, markSent, markFailed, getFailedCount
- `SAAN/convex/http.ts` - HTTP Action router with POST /api/call + OPTIONS /api/call (CORS)
- `SAAN/convex/agents.ts` - Added createTaskWithBreaker with atomic circuit breaker
- `SAAN/tests/smoke-phase2.sh` - 7 curl-based smoke tests

## Decisions Made
- Initialized git repo in SAAN directory (previously untracked) for proper commit tracking
- Installed typescript and @types/node as devDependencies for Convex typecheck and process.env typing
- Added getFailedCount to allowlist (not in original plan list but referenced in telegramQueue.ts exports)
- CORS headers allow any origin for dashboard/testing flexibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SAAN directory had no git repo**
- **Found during:** Task 1 (attempting to commit)
- **Issue:** SAAN code lived in sibling directory with no version control
- **Fix:** Initialized git repo with git config for Felipe Martinez, committed Phase 1 baseline + Task 1 changes together
- **Files modified:** All SAAN files (initial commit)
- **Verification:** git log shows proper commit history

**2. [Rule 3 - Blocking] TypeScript not installed for Convex typecheck**
- **Found during:** Task 1 verification
- **Issue:** `npx convex typecheck` reported no tsc binary
- **Fix:** Installed typescript as devDependency
- **Files modified:** package.json, package-lock.json

**3. [Rule 3 - Blocking] @types/node missing for process.env**
- **Found during:** Task 2 verification
- **Issue:** TypeScript error TS2580 — process not defined
- **Fix:** Installed @types/node as devDependency
- **Files modified:** package.json, package-lock.json

**4. [Rule 3 - Blocking] Convex codegen needed for new module types**
- **Found during:** Task 2 verification
- **Issue:** api.telegramQueue and api.agents.createTaskWithBreaker not recognized in generated types
- **Fix:** Ran `npx convex codegen` to regenerate _generated/api.ts
- **Files modified:** convex/_generated/* (gitignored)

---

**Total deviations:** 4 auto-fixed (4 blocking)
**Impact on plan:** All auto-fixes were necessary for build/typecheck to pass. No scope creep.

## Issues Encountered
- Task 1 commit included both SAAN initialization and schema/telegramQueue changes in a single commit since it was the root commit of the new repo

## User Setup Required

External services require manual configuration:
- **SAAN_API_SECRET**: Generate via `openssl rand -hex 32`, set in Convex Dashboard -> Settings -> Environment Variables
- **Convex deployment**: Run `cd SAAN && npx convex dev` (or `npx convex deploy` for production)
- **Smoke tests**: Run with `SAAN_CONVEX_SITE_URL=https://xxx.convex.site SAAN_API_SECRET=xxx bash SAAN/tests/smoke-phase2.sh`

## Next Phase Readiness
- HTTP layer is ready for Plan 02-02 (Telegram Bot) to build on top
- telegramQueue is ready to receive messages from any agent
- Circuit breaker protects against runaway loops from any n8n workflow
- Smoke tests can verify deployment once Convex env vars are configured

## Self-Check: PASSED

All 5 files verified present. All 3 commit hashes verified in SAAN git log.

---
*Phase: 02-http-layer-telegram-bot*
*Completed: 2026-03-05*

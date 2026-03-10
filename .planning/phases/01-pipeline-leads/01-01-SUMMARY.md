---
phase: 01-pipeline-leads
plan: 01
subsystem: infra
tags: [convex, http, auth, leads, n8n, cors]

# Dependency graph
requires:
  - phase: SAAN v1.0 (archived)
    provides: leads.ts CRUD, icpProfiles.ts, http.ts base router
provides:
  - HTTP allowlist with all 19 leads + ICP functions accessible via /api/call
  - Dual auth header support (X-SAAN-Secret + Authorization Bearer)
  - Smoke test suite for leads pipeline HTTP operations
affects: [01-pipeline-leads, n8n-workflows, scoring-workflows]

# Tech tracking
tech-stack:
  added: []
  patterns: [dual-auth-header, leads-http-allowlist]

key-files:
  created:
    - SAAN/tests/smoke-phase1.sh
  modified:
    - SAAN/convex/http.ts

key-decisions:
  - "Dual auth via fallback chain (X-SAAN-Secret || Authorization Bearer) instead of separate endpoints"
  - "All 15 leads + 4 ICP functions added to allowlist at once for complete n8n integration"

patterns-established:
  - "Dual auth: X-SAAN-Secret OR Authorization Bearer, same secret value"
  - "Smoke tests per phase: tests/smoke-phase{N}.sh with call_api helper"

requirements-completed: [LEAD-02, LEAD-05]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 1 Plan 01: HTTP Allowlist + Auth Fix Summary

**Fixed 2 critical bugs in Convex http.ts blocking all n8n-to-leads communication: added 19 functions to allowlist and enabled dual auth header support (X-SAAN-Secret + Bearer)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T01:13:29Z
- **Completed:** 2026-03-10T01:16:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- All 15 leads functions + 4 ICP profile functions added to HTTP allowlist (was 0, now 19 new)
- 12 query functions added to QUERIES set for correct ctx.runQuery routing
- Dual auth header: n8n scoring workflows using Bearer token now authenticate correctly
- CORS updated to allow Authorization header for browser-based scoring calls
- Smoke test script with 7 test cases covering insert, dedup, dual auth, and forbidden access

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix HTTP allowlist + auth header in http.ts** - `46811ce` (feat)
2. **Task 2: Create smoke test for leads HTTP operations** - `6295bf3` (test)

**Note:** Commits are in the SAAN repo at `C:/Users/Dell 5520/Documents/AgenticWorkflows/SAAN/`

## Files Created/Modified
- `SAAN/convex/http.ts` - Added 19 functions to ALLOWLIST, 12 to QUERIES, dual auth, CORS fix
- `SAAN/tests/smoke-phase1.sh` - 7 integration tests for leads pipeline HTTP layer

## Decisions Made
- Used fallback chain for dual auth (`X-SAAN-Secret || Authorization Bearer`) rather than separate middleware — minimal change, backward compatible
- Added all leads + ICP functions at once rather than incrementally — avoids repeated http.ts edits as pipeline develops

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- SAAN repo is outside The Agentic Company git repo — commits were made in the SAAN repo directly. No impact on functionality.

## User Setup Required

None - no external service configuration required. To run smoke tests, provide `SAAN_CONVEX_SITE_URL` and `SAAN_API_SECRET` environment variables.

## Next Phase Readiness
- HTTP layer ready for all n8n lead pipeline workflows (discovery, enrichment, scoring, outreach)
- Smoke tests available for verifying deployment after `npx convex deploy`
- All ICP profile functions accessible for scoring workflow integration

## Self-Check: PASSED

- FOUND: SAAN/convex/http.ts
- FOUND: SAAN/tests/smoke-phase1.sh
- FOUND: 01-01-SUMMARY.md
- FOUND: commit 46811ce (Task 1)
- FOUND: commit 6295bf3 (Task 2)

---
*Phase: 01-pipeline-leads*
*Completed: 2026-03-10*

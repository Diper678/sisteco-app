---
phase: "03-dashboard-build"
plan: "03"
subsystem: "sdr-dashboard"
tags: [convex, clerk, gsap, multi-tenant, sdr, lead-panel, content-builders]
dependency_graph:
  requires: ["03-01"]
  provides: ["sdr-tareas-list", "lead-detail-panel", "contact-actions", "status-change-panel"]
  affects: ["app/sdr.html", "shared/content-builders.js", "shared/interactions.js", "convex/leads.ts"]
tech_stack:
  added: ["getLeadsByAssignee query (Convex)", "window.contentBuilders.sdr namespace", "window.openLeadPanelConvex global"]
  patterns: ["async content builders", "GSAP slide-in panel", "localStorage seen-leads", "navigator.clipboard copy"]
key_files:
  created: ["shared/content-builders.js"]
  modified: ["app/sdr.html", "shared/interactions.js", "convex/leads.ts"]
decisions:
  - "Async content builders render into pre-existing DOM elements (not inject content blocks) for tareas/mis-leads; builders for hot-pending/stats return HTML strings for content blocks"
  - "window.openLeadPanelConvex exposed globally from content-builders.js so interactions.js can delegate to it without circular dependency"
  - "Score factors rendered conditionally: use lead.scoreFactors if present, else proportional from total score"
  - "Audit trail fallback: synthetic entry from discoveredAt if auditTrail array is empty"
  - "getLeadsByAssignee added to convex/leads.ts with orgId isolation — queries by_asignadoA index then filters by orgId for full multi-tenant safety"
metrics:
  duration_minutes: 37
  completed_date: "2026-03-12"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
requirements_completed: [DASH-02, DASH-04]
---

# Phase 03 Plan 03: SDR Dashboard — Leads Asignados y Lead Detail Panel Summary

SDR dashboard wired to real Convex data: to-do list with HOT-first prioritization, GSAP slide-in lead detail panel with score breakdown, audit trail, copy-to-clipboard contact actions, and status mutation — all multi-tenant via Clerk JWT orgId isolation.

## What Was Built

### Task 1: getLeadsByAssignee + SDR content builders
- Added `getLeadsByAssignee` to `convex/leads.ts`: uses `identity.subject` (Clerk userId) as assignee filter + `identity["org_id"]` for tenant isolation. Queries `by_asignadoA` index, filters by orgId, sorts by score descending.
- Created `shared/content-builders.js` with `window.contentBuilders.sdr` namespace:
  - `buildSdrTareas()`: queries `getLeadsByAssignee`, groups HOT → en_progreso → asignado → rest, renders colored-border to-do list, auto-opens first HOT lead after 400ms
  - `buildSdrLeadDetail(leadId)`: queries `getLeadById`, fills panel with score factors, audit trail, copy buttons, status dropdown with `mutateConvex`
  - `buildSdrMisLeads()`: table view with "Nuevo" badges (localStorage persistence)
  - `buildSdrHotPending()`: filters HOT leads not yet closed
  - `buildSdrStats()`: count by estado for assigned leads
  - Exposed `window.openLeadPanelConvex` globally for cross-file panel delegation
- Deployed updated Convex schema: `npx convex deploy --yes` to `animated-pika-122.convex.cloud`

### Task 2: SDR page wiring + panel interactions
- Updated `app/sdr.html`: removed inline mock-data rendering functions, added clean auth guard + Convex init, loads content-builders.js before mock-data.js, calls `buildSdrTareas()` + `buildSdrMisLeads()` on page load after auth
- Extended `shared/interactions.js`:
  - SDR role delegation via `_loadContentSdr()` — routes query buttons to appropriate builders
  - `initLeadPanel()` checks for `window.openLeadPanelConvex` first, falls back to mock path
  - Async builder handling in `insertNewBlock()` — awaits Promise builders before DOM update
  - `contentBuilders` map extended: `{ ceo: {}, vp: {}, sdr: {} }`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] content-builders.js did not exist**
- **Found during:** Task 1
- **Issue:** Plan referenced `shared/content-builders.js` as pre-existing file but it had not been created by Plan 03-02 (running in parallel)
- **Fix:** Created `shared/content-builders.js` from scratch with full SDR namespace as this plan required
- **Files modified:** `shared/content-builders.js` (created)
- **Commit:** 84d263a

**2. [Rule 3 - Blocking] Convex deploy required after adding new query**
- **Found during:** Task 1
- **Issue:** Adding `getLeadsByAssignee` to `convex/leads.ts` required deploying to Convex cloud before the frontend could call it
- **Fix:** Ran `npx convex deploy --yes` — schema validation complete, deployed to animated-pika-122.convex.cloud
- **Files modified:** convex/leads.ts (deployed)
- **Commit:** 84d263a

## Verification Results

All 18 automated checks passed:
- SDR builders present in content-builders.js: true
- getLeadsByAssignee in convex/leads.ts: true
- Has auth guard (initAuth): true
- Has content-builders script: true
- Has panel container: true
- SDR delegation in interactions.js: true
- buildSdrTareas function: true
- buildSdrLeadDetail function: true
- openLeadPanelConvex exposed globally: true
- mutateConvex called in content-builders.js: true
- localStorage usage (seen leads): true
- Copy functionality present: true
- GSAP animation in panel: true
- Audit trail rendering: true
- Score factors rendering: true
- Status dropdown in panel: true
- Async builder handling: true
- SDR to-do section target element: true

## Key Decisions

1. **Async content builders dual dispatch pattern**: `buildSdrTareas` and `buildSdrMisLeads` render into pre-existing DOM elements for seamless page sections; `buildSdrHotPending` and `buildSdrStats` return HTML strings for content block injection via `_loadContentSdr`.

2. **Global panel opener via window property**: `window.openLeadPanelConvex` exposed from content-builders.js solves the circular dependency problem — interactions.js delegates to it without importing or tight coupling.

3. **orgId isolation defense in depth**: `getLeadsByAssignee` uses `by_asignadoA` index for efficient query then also filters by `orgId === identity["org_id"]` — ensuring cross-tenant leakage is impossible even if index returns unexpected results.

4. **Score factors graceful degradation**: If `lead.scoreFactors` is absent (leads imported without enrichment), proportional bars are calculated from the total `lead.score` value distributed across 4 factors.

## Self-Check

Checking files created and commits made...

| Item | Status |
|------|--------|
| shared/content-builders.js | FOUND |
| app/sdr.html | FOUND |
| shared/interactions.js | FOUND |
| convex/leads.ts | FOUND |
| 03-03-SUMMARY.md | FOUND |
| Commit 84d263a | FOUND |
| Commit 83f714b | FOUND |

## Self-Check: PASSED

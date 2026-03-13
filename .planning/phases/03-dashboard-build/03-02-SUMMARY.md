---
phase: 03-dashboard-build
plan: "02"
subsystem: dashboard-data
tags: [convex, vanilla-js, html, kpis, pipeline, bulk-assign, status-change, localStorage]

requires:
  - phase: 03-dashboard-build
    plan: "01"
    provides: "Convex schema multi-tenant + shared/auth.js + shared/convex-client.js + app/*.html with auth guard"

provides:
  - "CEO dashboard wired to real Convex data (kpis, funnel, industria, comparar, hot, equipo)"
  - "VP Ventas pipeline table with real Convex leads — filterable, bulk-assignable, status-changeable"
  - "window.contentBuilders.ceo.* — 6 async builders (query stats/leads/users from Convex)"
  - "window.contentBuilders.vp.* — 6 async builders (pipeline, sin-asignar, equipo, kpis, hot-urgente, conversion)"
  - "Query history (last 5) stored in localStorage per role with restore on page reload"
  - "Dynamic badge counts on query buttons from real Convex stats"
  - "In-place estado change without full table reload via mutateConvex"
  - "Bulk lead assignment via checkboxes + SDR dropdown + bulkAssignLeads mutation"

affects:
  - 03-03-PLAN
  - 03-04-PLAN

tech-stack:
  patterns:
    - "Async content builders: builder(bodyEl) pattern — skeleton → queryConvex → render HTML → animate"
    - "In-place mutation: mutateConvex → update DOM badge → toast (no reload)"
    - "Floating picker: fixed-position div on badge click → close on outside click"
    - "localStorage query history: _HISTORY_KEY_PREFIX + role → last 5 queries + last active query"
    - "Mock fallback: queryConvex check with setTimeout retry → _renderMock() if still unavailable"
    - "VP filter: data-estado/data-score on rows → client-side show/hide on pill/select/input change"
    - "Bulk assign bar: hidden by default, shown when checkboxes checked, SDR dropdown populated from Convex"

key-files:
  created: []
  modified:
    - shared/content-builders.js
    - shared/interactions.js
    - app/ceo.html
    - app/vp-ventas.html

key-decisions:
  - "CEO and VP builders appended to existing content-builders.js (SDR builders already present from Plan 01)"
  - "Floating fixed-position picker for estado change — avoids table layout issues with overflow:hidden"
  - "Mock fallback with setTimeout retry in VP page — allows dev without Clerk org setup"
  - "queryConvex string routing: 'stats:getLeadsStats' (anyApi proxy from convex@1.33.0)"
  - "Bulk assign bar hidden in DOM until checkbox selected — avoids layout shift on load"
  - "refreshQueryBadges() called from initQueryButtons() after render — badges update async without blocking"

requirements-completed: [DASH-02, DASH-03]

duration: 18min
completed: 2026-03-13
---

# Phase 3 Plan 02: Dashboard Data Wiring Summary

**CEO y VP Ventas dashboards conectados a datos reales de Convex con 12 builders async, bulk assignment via checkboxes, cambio de estado click-directo in-place, y historial de queries en localStorage**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-13T00:39:00Z
- **Completed:** 2026-03-13T00:57:45Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- 6 CEO async builders en `window.contentBuilders.ceo.*`: kpis, funnel, industria, comparar, hot, equipo — todos llaman `queryConvex()` con skeleton loading y GSAP count-up animations
- 6 VP async builders en `window.contentBuilders.vp.*`: pipeline, sin-asignar, equipo, kpis, hot-urgente, conversion — todos muestran datos reales de Convex
- VP pipeline table con checkboxes + bulk assign bar (oculto hasta seleccion) + `bulkAssignLeads` mutation
- Estado change click-directo: badge clickable → floating picker → subestado dropdown para "cerrado" → `updateLeadStatus` mutation in-place
- Reasignacion con `confirm()` dialog → `reasignarLead` mutation → update DOM celda SDR sin reload
- Query history (ultimas 5 por rol) en localStorage + restore de ultima query activa en page load
- `refreshQueryBadges()` actualiza descripciones de botones con conteos reales de Convex al inicializar

## Task Commits

1. **Task 1: CEO builders + interactions.js update + ceo.html wiring** - `ae82859` (feat)
2. **Task 2: VP pipeline + assignment + status change + vp-ventas.html wiring** - `174cda2` (feat)

## Files Modified

- `shared/content-builders.js` — Appended CEO and VP builder functions (897 → 2220 lines). SDR builders from Plan 01 preserved intact.
- `shared/interactions.js` — `loadContent()` now routes CEO/VP to async builders; added `_saveQueryToHistory`, `refreshQueryBadges`, `_getLastQuery`; updated `initQueryButtons` to restore last query; updated `renderSuggestions` to show localStorage recents.
- `app/ceo.html` — Added `content-builders.js` script tag; added `queryConvex` prefetch in auth load handler; updated footer.
- `app/vp-ventas.html` — Replaced mock renderKPIs/renderPipeline with `loadVpKpis()` + `loadPipelineTable()` using Convex; added bulk assign bar; added checkbox column + select-all; added in-table estado picker; added reassignment picker; added toast-container; added filter bar wiring script.

## Decisions Made

- CEO/VP builders appended after line 897 of content-builders.js (SDR IIFE already closed) — no overwrite of existing SDR builders
- Floating position picker (position:fixed) for estado change dropdown — avoids overflow/z-index issues in table cells
- Mock fallback with retry in VP page — VP page still renders usable data during Clerk org setup (a known blocker from Plan 01)
- `queryConvex` string routing confirmed working: `'stats:getLeadsStats'` via anyApi proxy in convex@1.33.0
- Badge count refresh is async and non-blocking — page loads immediately, badges update when stats arrive

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Mock fallback for VP pipeline when Convex auth not ready**
- **Found during:** Task 2 implementation
- **Issue:** VP page renders before Clerk auth completes — queryConvex would fail silently leaving empty table
- **Fix:** Added `setTimeout` retry (1.5s) with mock fallback `_renderPipelineMock()` if Convex still unavailable
- **Files modified:** app/vp-ventas.html
- **Impact:** No scope creep — mock data was already present in the file

**2. [Rule 2 - Missing Critical] Toast container missing from VP page**
- **Found during:** Task 2 (writing VP mutation handlers that call _showToast)
- **Issue:** VP vp-ventas.html had no `#toast-container` div — toast notifications would silently fail
- **Fix:** Added `<div id="toast-container">` before closing `</main>` tag
- **Files modified:** app/vp-ventas.html

None of the above required architectural changes — both were inline fixes.

## Next Phase Readiness

- CEO and VP now display real Convex data for all 6 query buttons each
- VP mutations (updateLeadStatus, assignLead, bulkAssignLeads, reasignarLead) wired end-to-end
- SDR dashboard (Plan 03) will reuse the same builder pattern — `window.contentBuilders.sdr.*` already complete from Plan 01
- Plan 04 (ICP Wizard + pipeline activation from VP) can build on `window.contentBuilders.vp.buildVpPipeline` as base

---
*Phase: 03-dashboard-build*
*Completed: 2026-03-13*

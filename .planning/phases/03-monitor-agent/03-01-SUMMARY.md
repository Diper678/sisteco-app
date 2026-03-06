---
phase: 03-monitor-agent
plan: 01
subsystem: monitoring
tags: [convex, n8n, health-checks, telegram-alerts, uptime, heartbeat]

# Dependency graph
requires:
  - phase: 02-http-layer-telegram-bot
    provides: HTTP endpoint /api/call with shared-secret auth, telegramQueue table and enqueue mutation
provides:
  - "Convex functions for Monitor Agent: checkServicesHealth, detectDownAgents, getUptimeSummary24h, getLastAlertTime, recordAlertSent, updateMonitorState"
  - "n8n heartbeat workflow: 5-min cron checking Vercel, Convex Landing, Convex SAAN, n8n"
  - "Anti-duplicate alert system via agentMemory with 2h cooldown"
affects: [03-02, dashboard, reports]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batch health check mutation: single call records multiple service metrics"
    - "Alert anti-duplication via agentMemory with TTL and service tags"
    - "n8n workflow uses $vars for deployment-specific URLs (SAAN_CONVEX_SITE_URL, SAAN_API_SECRET, N8N_BASE_URL)"
    - "Minute-based purge heuristic since n8n loses run count on restart"

key-files:
  created:
    - SAAN/convex/monitor.ts
    - SAAN/n8n-workflows/saan-monitor-heartbeat.json
  modified: []

key-decisions:
  - "Used minute-based heuristic for hourly purge (min < 5) instead of run counter since n8n loses state on restart"
  - "Alert cooldown of 2 hours via getLastAlertTime prevents duplicate alerts after n8n restarts"
  - "Agent down severity: >30 min = CRITICAL, 15-30 min = WARNING"

patterns-established:
  - "Monitor workflow pattern: health check -> save metrics -> detect failures -> alert -> update state"
  - "Convex agentMemory as anti-duplication store with TTL expiry"

requirements-completed: [MON-01, MON-02, MON-03, MON-04, MON-06, MON-07, MON-08]

# Metrics
duration: 4min
completed: 2026-03-06
---

# Phase 3 Plan 1: Monitor Agent Core Summary

**Convex functions + n8n heartbeat workflow for 5-min health checks of 4 core services with CRITICAL/WARNING alert routing to Telegram**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T15:20:59Z
- **Completed:** 2026-03-06T15:24:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- 6 Convex functions for Monitor Agent: batch health recording, down-agent detection, 24h uptime summary, alert anti-duplication, and state management
- Complete n8n workflow (16 nodes) with 5-min cron checking Vercel, Convex Landing, Convex SAAN, and n8n
- Alert system with CRITICAL/WARNING severity taxonomy, 2-hour anti-duplication window, and Telegram queue integration
- Idempotent design: all state in Convex (not n8n), safe to resume after n8n restart (MON-08)

## Task Commits

Each task was committed atomically:

1. **Task 1: Crear funciones Convex del Monitor Agent** - `db356ec` (feat)
2. **Task 2: Crear workflow n8n de heartbeat cada 5 minutos** - `50ba555` (feat)

## Files Created/Modified
- `SAAN/convex/monitor.ts` - 6 exported functions: detectDownAgents, getUptimeSummary24h, getLastAlertTime, recordAlertSent, checkServicesHealth, updateMonitorState
- `SAAN/n8n-workflows/saan-monitor-heartbeat.json` - 16-node n8n workflow with cron trigger, HTTP health checks, failure detection, alert routing, and metric purge

## Decisions Made
- Used minute-based heuristic (minute < 5) for hourly purge instead of run counter, since n8n loses in-memory state on restart
- Alert cooldown of 2 hours via agentMemory prevents duplicate alerts after n8n restarts
- Agent down severity thresholds: >30 min without heartbeat = CRITICAL, 15-30 min = WARNING
- Added "convex_saan" as 4th monitored service alongside vercel, convex_landing, and n8n

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required. n8n variables ($vars) are configured at import time.

## Next Phase Readiness
- Monitor Agent core functions ready for Plan 2 (daily uptime report + dashboard queries)
- Workflow ready to import into n8n once SAAN Convex deployment exists
- Requires Phase 2 HTTP endpoint and telegramQueue to be deployed first

## Self-Check: PASSED

- FOUND: SAAN/convex/monitor.ts
- FOUND: SAAN/n8n-workflows/saan-monitor-heartbeat.json
- FOUND: .planning/phases/03-monitor-agent/03-01-SUMMARY.md
- FOUND: commit db356ec (Task 1)
- FOUND: commit 50ba555 (Task 2)

---
*Phase: 03-monitor-agent*
*Completed: 2026-03-06*

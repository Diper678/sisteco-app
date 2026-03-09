---
phase: 04-leads-agent
plan: 01
subsystem: database
tags: [convex, leads, icp, scoring, sdr-pipeline, multi-source, deduplication]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Convex schema base, agentsState, agentTasks, agentMemory tables"
provides:
  - "leads table with 9 indices for multi-source B2B leads with SDR pipeline"
  - "icpProfiles table with configurable ICP criteria and scoring weights"
  - "15 CRUD functions in leads.ts (upsert, batch, enrich, score, outreach, stats)"
  - "4 functions in icpProfiles.ts with default Sisteco ICP and scoring-ready format"
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 06-leads-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [deduplication-by-email-empresa, single-active-icp, auto-advance-status, batch-mutation-with-cost-tracking]

key-files:
  created:
    - SAAN/convex/leads.ts
    - SAAN/convex/icpProfiles.ts
  modified:
    - SAAN/convex/schema.ts

key-decisions:
  - "Dedup by email first then empresa for reliable lead merge"
  - "Single active ICP enforced at mutation level (deactivate others before activating)"
  - "Default ICP hardcoded as fallback when no DB profile exists"
  - "Auto-advance status to 'scored' when score >= 80"

patterns-established:
  - "Lead deduplication: email-first then empresa lookup before insert"
  - "Batch mutations: max 50 items with cost tracking and inserted/updated counts"
  - "ICP scoring prompt: getIcpForScoring generates plain-text for AI prompt injection"
  - "SDR pipeline: 10 statuses from new to converted with outreach stage tracking"

requirements-completed: [LEAD-01, LEAD-08]

# Metrics
duration: 5min
completed: 2026-03-06
---

# Phase 4 Plan 1: Leads Schema + CRUD Summary

**Convex leads table with multi-source deduplication, SDR pipeline tracking, and configurable ICP profiles with AI scoring-ready format**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T18:07:44Z
- **Completed:** 2026-03-06T18:12:51Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Leads table with 9 indices supporting multi-source tracking (Firecrawl, PhantomBuster, ScrapingBee), SDR pipeline (10 statuses), and skill tracking
- ICP profiles table with configurable scoring weights, buying signals, and single-active enforcement
- 15 lead CRUD functions with email/empresa deduplication, batch upsert (max 50), enrichment auto-populate, and outreach scheduling
- 4 ICP functions with hardcoded Sisteco default fallback and prompt-ready scoring format

## Task Commits

Each task was committed atomically:

1. **Task 1: Agregar tabla icpProfiles y expandir tabla leads en schema** - `0054d54` (feat)
2. **Task 2: Crear icpProfiles.ts con CRUD y perfil default de Sisteco** - `c308683` (feat)
3. **Task 3: Crear leads.ts con CRUD expandido, multi-fuente y SDR** - `63cbd67` (feat)

## Files Created/Modified
- `SAAN/convex/schema.ts` - Added icpProfiles (2 indices) and leads (9 indices) tables
- `SAAN/convex/icpProfiles.ts` - 4 functions: upsertIcpProfile, getActiveIcp, listIcpProfiles, getIcpForScoring
- `SAAN/convex/leads.ts` - 15 functions: upsertLead, batchUpsertLeads, getLeadByEmail, getLeadByCompany, getLeadsByStatus, getLeadsByScore, getLeadsBySource, updateLeadStatus, updateLeadScore, enrichLead, getLeadsToEnrich, getLeadsToScore, updateOutreachStatus, getLeadsForOutreach, getLeadsStats

## Decisions Made
- Dedup by email first, then empresa -- ensures contacts with same email across companies merge correctly
- Single active ICP enforced at mutation level -- deactivates all others before setting new active
- Default ICP hardcoded in getActiveIcp -- system works without any DB data on first run
- Score >= 80 auto-advances status to "scored" -- eliminates need for separate scoring workflow step
- getIcpForScoring generates plain text (not JSON) -- ready for direct injection into AI scoring prompts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. SAAN Convex deployment already active.

## Next Phase Readiness
- Schema and CRUD ready for 04-02 (Firecrawl discover + enrich workflows)
- getIcpForScoring ready for 04-03 (AI scoring with Gemini)
- getLeadsForOutreach ready for 04-06 (SDR pipeline management)
- All 15 functions deployed and verified on Convex

---
*Phase: 04-leads-agent*
*Completed: 2026-03-06*

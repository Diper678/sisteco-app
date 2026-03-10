---
phase: 01-pipeline-leads
plan: 02
subsystem: enrichment
tags: [n8n, sii, simpleapi, rut, chile, b2b, enrichment, workflow]

requires:
  - phase: 01-pipeline-leads/01
    provides: "Convex HTTP allowlist and auth fixes enabling workflow API calls"
provides:
  - "SII enrichment workflow (saan-leads-enrich-sii.json) via SimpleAPI"
  - "Rate-limited RUT/razon_social/giro/domicilio lookup for Chilean companies"
  - "Pipeline documentation: Firecrawl -> SII -> Scoring chain"
affects: [01-pipeline-leads/03, dashboard-build]

tech-stack:
  added: [SimpleAPI]
  patterns: [n8n-staticData-rate-limiting, decoupled-enrichment-workflows]

key-files:
  created:
    - "SAAN/n8n-workflows/saan-leads-enrich-sii.json"
  modified:
    - "SAAN/n8n-workflows/saan-leads-enrich.json"

key-decisions:
  - "SII enrichment as separate workflow (not chained inside Firecrawl) for decoupling and rate limit control"
  - "Rate limiting via n8n staticData global counter (10 calls/month free tier)"
  - "4-hour schedule staggered from Firecrawl 2-hour to avoid overlap"

patterns-established:
  - "Rate limiting pattern: n8n staticData global with monthly counter reset"
  - "Enrichment pipeline: decoupled workflows connected by lead status"

requirements-completed: [LEAD-03]

duration: 3min
completed: 2026-03-10
---

# Phase 1 Plan 02: SII Enrichment Summary

**n8n workflow for SII enrichment via SimpleAPI with monthly rate-limit guard and decoupled pipeline documentation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T01:13:38Z
- **Completed:** 2026-03-10T01:16:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created SII enrichment workflow with 17 nodes: schedule trigger, Convex fetch, SII filter, rate limit guard, SimpleAPI lookup, response parsing, lead update, error handler
- Rate limit protection prevents exceeding 10 SimpleAPI calls/month on free tier using n8n staticData
- Documented enrichment pipeline chain: Firecrawl (2h) -> SII (4h) -> Scoring

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SII enrichment workflow JSON** - `639507f` (feat)
2. **Task 2: Update existing enrich workflow to note SII dependency** - `dfa0c03` (docs)

_Note: Commits are in SAAN repo (outside The Agentic Company repo) since workflow files live there._

## Files Created/Modified
- `SAAN/n8n-workflows/saan-leads-enrich-sii.json` - New SII enrichment workflow: SimpleAPI RUT lookup, rate limiting, Convex integration
- `SAAN/n8n-workflows/saan-leads-enrich.json` - Added sticky note documenting SII enrichment chain

## Decisions Made
- SII enrichment runs as a separate decoupled workflow rather than chained inside the Firecrawl workflow, to respect SimpleAPI rate limits independently
- Rate limiting uses n8n staticData global counter with automatic monthly reset
- 4-hour schedule (staggered from Firecrawl 2-hour) to avoid overlap
- Sticky note added as warning: SimpleAPI endpoint format needs manual verification (MEDIUM confidence from research)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Workflow files are in the SAAN repo (outside The Agentic Company git repo), so task commits went to the SAAN repo. Planning docs committed to The Agentic Company repo.

## User Setup Required

Before activating the SII workflow in n8n:
1. Set `SIMPLE_API_KEY` n8n variable with SimpleAPI bearer token
2. Verify SimpleAPI endpoint format matches `https://api.simpleapi.cl/api/rut/buscar?q={empresa}` (research confidence: MEDIUM)
3. Test manually with one known company name before enabling schedule

## Next Phase Readiness
- SII enrichment ready to activate once SimpleAPI key is configured and endpoint verified
- Pipeline chain documented and clear for scoring phase (01-03)
- Rate limit guard ensures free tier stays within bounds during testing

---
*Phase: 01-pipeline-leads*
*Completed: 2026-03-10*

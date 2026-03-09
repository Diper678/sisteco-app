---
phase: 04-leads-agent
plan: 02
subsystem: n8n-workflows
tags: [n8n, leads, discovery, enrichment, firecrawl, phantombuster, scrapingbee, multi-source]

# Dependency graph
requires:
  - phase: 04-leads-agent-01
    provides: "leads table with batchUpsertLeads, enrichLead, getLeadsToEnrich mutations"
provides:
  - "3 discovery workflows: Firecrawl (daily), PhantomBuster (3x/week), ScrapingBee (2x/week)"
  - "1 unified enrichment workflow: Firecrawl Scrape every 2 hours"
  - "Multi-source lead pipeline feeding same Convex leads table with deduplication"
affects: [04-03, 04-04, 04-05, 04-06]

# Tech tracking
tech-stack:
  added: [firecrawl-search-api, firecrawl-scrape-api, phantombuster-api, scrapingbee-api]
  patterns: [cron-staggered-schedules, polling-loop-for-async-apis, extract-rules-scraping, minimal-enrichment-fallback]

key-files:
  created:
    - SAAN/n8n-workflows/saan-leads-discover-firecrawl.json
    - SAAN/n8n-workflows/saan-leads-discover-phantombuster.json
    - SAAN/n8n-workflows/saan-leads-discover-scrapingbee.json
    - SAAN/n8n-workflows/saan-leads-enrich.json
  modified: []

key-decisions:
  - "Staggered cron schedules prevent API collision: Firecrawl daily 06:00, PB Mon/Wed/Fri 07:00, SB Tue/Thu 06:30"
  - "PhantomBuster uses polling loop (max 10 attempts, 30s) since agent execution is async"
  - "ScrapingBee uses extract_rules with broad CSS selectors to handle varied directory layouts"
  - "Enrich workflow handles leads without websiteUrl via minimal enrichment path instead of skipping"
  - "Industry detection uses 7 regex patterns covering Chilean B2B market segments"

patterns-established:
  - "Discovery workflow pattern: Config -> Agent State Active -> API Call -> Parse -> batchUpsert -> Memory -> Idle"
  - "Error handler pattern: Save error to agentMemory (for learning) + set agentState to error"
  - "Rate limiting pattern: Wait nodes between API calls (2-3s) to respect provider limits"
  - "Multi-source convergence: All sources feed leads:batchUpsertLeads with source-specific skillId"

requirements-completed: [LEAD-02, LEAD-03]

# Metrics
duration: 6min
completed: 2026-03-06
---

# Phase 4 Plan 2: Multi-Source Discovery + Enrichment Workflows Summary

**3 staggered discovery workflows (Firecrawl web search, PhantomBuster LinkedIn, ScrapingBee directories) plus unified enrichment with tech stack/industry/size detection via Firecrawl Scrape**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-06T18:18:21Z
- **Completed:** 2026-03-06T18:25:00Z
- **Tasks:** 4
- **Files created:** 4

## Accomplishments
- Firecrawl Discovery workflow with 8 rotative Chilean B2B search queries, daily at 06:00 Chile (~$0.008/day)
- PhantomBuster Discovery workflow extracting LinkedIn decision-makers with cargo, empresa, LinkedIn URL (Mon/Wed/Fri, ~$1.50/week)
- ScrapingBee Discovery workflow scraping 4 Chilean B2B directories with JS rendering and extract_rules (Tue/Thu, ~$0.002/week)
- Unified Enrichment workflow processing leads from ANY source every 2 hours, detecting tech stack (16 tools), company size, and industry (7 patterns) via Firecrawl Scrape (~$0.12/day)
- Total estimated cost: ~$2/week for full multi-source lead pipeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Workflow Firecrawl Discovery** - `ca3ca80` (feat) - SAAN repo
2. **Task 2: Workflow PhantomBuster Discovery** - `a47fc6e` (feat) - SAAN repo
3. **Task 3: Workflow ScrapingBee Discovery** - `3c6db85` (feat) - SAAN repo
4. **Task 4: Workflow Enriquecimiento Unificado** - `2b5c619` (feat) - SAAN repo

## Files Created
- `SAAN/n8n-workflows/saan-leads-discover-firecrawl.json` - 12 nodes, daily cron, Firecrawl Search API
- `SAAN/n8n-workflows/saan-leads-discover-phantombuster.json` - 11 nodes, 3x/week cron, PhantomBuster Launch+Poll
- `SAAN/n8n-workflows/saan-leads-discover-scrapingbee.json` - 12 nodes, 2x/week cron, ScrapingBee extract_rules
- `SAAN/n8n-workflows/saan-leads-enrich.json` - 16 nodes, every 2h, Firecrawl Scrape with industry/stack/size detection

## Schedule Matrix

| Workflow | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|----------|-----|-----|-----|-----|-----|-----|-----|
| Firecrawl Discovery | 06:00 | 06:00 | 06:00 | 06:00 | 06:00 | 06:00 | 06:00 |
| PhantomBuster Discovery | 07:00 | - | 07:00 | - | 07:00 | - | - |
| ScrapingBee Discovery | - | 06:30 | - | 06:30 | - | - | - |
| Enrichment | every 2h | every 2h | every 2h | every 2h | every 2h | every 2h | every 2h |

## Cost Estimates

| Source | Cost/Unit | Units/Week | Weekly Cost |
|--------|-----------|------------|-------------|
| Firecrawl Search | $0.001/credit | 56 credits | $0.056 |
| PhantomBuster | $0.02/lead | 75 leads | $1.50 |
| ScrapingBee | $0.0005/lead | ~40 credits | $0.002 |
| Firecrawl Scrape (enrich) | $0.001/scrape | ~840 scrapes | $0.84 |
| **Total** | | | **~$2.40/week** |

## Decisions Made
- Staggered cron schedules avoid API rate limit collisions across all 3 discovery sources
- PhantomBuster polling loop handles async agent execution (up to 5 min wait)
- ScrapingBee extract_rules use broad CSS selectors (.company-card, .listing-item, .empresa) for varied layouts
- Leads without websiteUrl get minimal enrichment (marked as enriched) instead of being skipped forever
- All workflows use n8n $vars for credentials (not hardcoded), enabling easy environment switching

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Before importing workflows to n8n, the following environment variables must be set:
- `SAAN_CONVEX_SITE_URL` - Convex deployment site URL
- `SAAN_API_SECRET` - Shared secret for HTTP API auth
- `FIRECRAWL_API_KEY` - Firecrawl API key
- `PHANTOMBUSTER_API_KEY` - PhantomBuster API key
- `PB_SALES_NAV_AGENT_ID` - PhantomBuster Sales Navigator agent ID
- `PB_SALES_NAV_SEARCH_URL` - LinkedIn Sales Navigator search URL (optional, has default)
- `SCRAPINGBEE_API_KEY` - ScrapingBee API key

## Next Phase Readiness
- Discovery workflows produce leads with status "new" ready for enrichment
- Enrichment workflow advances leads to status "enriched" ready for 04-03 (AI Scoring)
- All leads tracked with skillId and cost, ready for ROI reporting in 04-06
- PhantomBuster extracts contacto+cargo for high-quality SDR outreach in 04-05

## Self-Check: PASSED

- [x] saan-leads-discover-firecrawl.json: FOUND
- [x] saan-leads-discover-phantombuster.json: FOUND
- [x] saan-leads-discover-scrapingbee.json: FOUND
- [x] saan-leads-enrich.json: FOUND
- [x] Commit ca3ca80: FOUND
- [x] Commit a47fc6e: FOUND
- [x] Commit 3c6db85: FOUND
- [x] Commit 2b5c619: FOUND

---
*Phase: 04-leads-agent*
*Completed: 2026-03-06*

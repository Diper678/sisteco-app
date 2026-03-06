---
phase: 04-leads-agent
plan: 03
subsystem: ai-workflows
tags: [n8n, gemini, claude, scoring, sdr, outreach, leads, ai]

# Dependency graph
requires:
  - phase: 04-leads-agent
    plan: 01
    provides: "leads table with CRUD, icpProfiles with getIcpForScoring, updateLeadScore, getLeadsForOutreach"
provides:
  - "n8n workflow for AI lead scoring using Gemini 2.5 Flash Lite against dynamic ICP"
  - "n8n workflow for SDR outreach sequence generation using Claude Sonnet"
  - "Memory-before-action pattern: agent consults previous insights before scoring"
  - "Cost tracking per lead scored and per outreach generated"
affects: [04-04, 04-05, 04-06, 06-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [gemini-flash-lite-bulk-scoring, claude-creative-outreach, memory-before-action, cost-tracking-per-operation, loop-with-rate-limit]

key-files:
  created:
    - SAAN/n8n-workflows/saan-leads-score-ai.json
    - SAAN/n8n-workflows/saan-leads-sdr-outreach.json
  modified: []

key-decisions:
  - "Gemini 2.5 Flash Lite for scoring (bulk, ~$0.0002/lead) vs Claude for outreach (quality, ~$0.01/outreach)"
  - "7-second wait between Gemini calls for safe 10 RPM on free tier"
  - "Scoring prompt includes enriched data + previous insights for improved accuracy over time"
  - "4-step multi-channel outreach sequences with Chilean Spanish tone"

patterns-established:
  - "Memory-before-action: fetch agentMemory insights before AI operations for learning"
  - "Cost tracking: calculate and log token costs per API call for budget monitoring"
  - "Loop-with-rate-limit: SplitInBatches + Wait node for API rate management"
  - "Dual-model strategy: cheap model for bulk operations, expensive model for quality output"

requirements-completed: [LEAD-04, LEAD-05, LEAD-06, LEAD-07]

# Metrics
duration: 4min
completed: 2026-03-06
---

# Phase 4 Plan 3: AI Scoring + SDR Outreach Workflows Summary

**Gemini 2.5 Flash Lite bulk scoring workflow with dynamic ICP and Claude Sonnet SDR outreach generator with 4-step multi-channel sequences**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T18:18:54Z
- **Completed:** 2026-03-06T18:22:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- 21-node scoring workflow using Gemini 2.5 Flash Lite for bulk lead evaluation against configurable ICP from Convex (~$0.016/day for 80 scorings)
- 20-node SDR outreach workflow using Claude Sonnet for personalized 4-step multi-channel sequences (~$0.20/day for 20 outreach)
- Memory-before-action pattern: scoring fetches previous insights from agentMemory for improved accuracy
- HOT leads automatically create CEO tasks with approach, channel suggestion, and deal size estimate

## Task Commits

Each task was committed atomically:

1. **Task 1: Workflow Scoring AI con Gemini 2.5 Flash Lite + ICP dinamico** - `4e5721c` (feat)
2. **Task 2: Workflow SDR Outreach Generator** - `c4ae945` (feat)

## Files Created/Modified
- `SAAN/n8n-workflows/saan-leads-score-ai.json` - 21-node Gemini scoring workflow with ICP, memory-before-action, cost tracking, and CEO task creation for HOT leads
- `SAAN/n8n-workflows/saan-leads-sdr-outreach.json` - 20-node Claude outreach workflow generating 4-step personalized sequences with multi-channel support

## Decisions Made
- Gemini 2.5 Flash Lite chosen for scoring: practically free ($0.0002/lead), 30 RPM free tier, JSON response mode built-in
- Claude Sonnet chosen for outreach: creative quality justifies $0.01/outreach for personalized Chilean Spanish messaging
- 7-second delay between Gemini calls ensures safe 10 RPM (well within 30 RPM free tier limit)
- Scoring prompt includes all enriched data fields + previous scoring insights for progressive improvement
- Outreach sequences are 4 steps: configurable channels (email, LinkedIn connect, LinkedIn message, phone)
- Regex-based JSON extraction in outreach parser handles Claude responses with markdown code blocks

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Environment variables needed in n8n:
- `GEMINI_API_KEY` - Google AI Studio API key for Gemini 2.5 Flash Lite scoring
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude Sonnet outreach generation
- `SAAN_CONVEX_SITE_URL` and `SAAN_CONVEX_SECRET` (already configured from Phase 2)

## Next Phase Readiness
- Scoring workflow ready to process enriched leads from 04-02 pipeline
- Outreach workflow processes HOT/WARM scored leads into actionable sequences
- CEO receives tasks for both HOT lead review and outreach sequence approval
- Cost tracking enables budget monitoring (~$0.22/day total AI costs)
- Combined daily cost: scoring $0.016 + outreach $0.20 = ~$1.54/week

## Self-Check: PASSED

- [x] saan-leads-score-ai.json exists (21 nodes, valid JSON)
- [x] saan-leads-sdr-outreach.json exists (20 nodes, valid JSON)
- [x] Commit 4e5721c (scoring workflow) verified
- [x] Commit c4ae945 (outreach workflow) verified
- [x] 04-03-SUMMARY.md exists

---
*Phase: 04-leads-agent*
*Completed: 2026-03-06*

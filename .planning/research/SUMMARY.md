# Research Summary: SAAN Fases 2-3

**Domain:** Autonomous Agent Network (Monitor, Leads, Finance Agents)
**Researched:** 2026-03-05
**Overall confidence:** HIGH

## Executive Summary

SAAN's Phase 1 foundation (Convex schema, mutations, dashboard skeleton, n8n orchestrator) is solid and ready for agents to be built on top. The core infrastructure decisions (Convex for reactive state, n8n for orchestration, Discord for CEO communication) are well-suited for this domain and within the $65/month budget constraint.

The most critical discovery in this research is a set of technology landmines that must be addressed before building. Google's `@google/generative-ai` SDK is deprecated (support ended Nov 2025) and must be replaced with `@google/genai`. Gemini 2.0 Flash models are being retired June 1, 2026 -- all scoring should use `gemini-2.5-flash-lite` from day one to avoid a forced migration in 3 months. The existing n8n orchestrator uses an incorrect Convex API path (`/api/mutation`) that needs to be replaced with proper HTTP Actions in `convex/http.ts`.

The agent system can be built entirely with existing free-tier services plus the already-budgeted infrastructure. Gemini 2.5 Flash Lite costs < $0.05/month for 100 leads/day scoring. Discord Webhook API is free. Firecrawl free tier covers 200 leads/month. The total additional cost for Phases 2-3 is under $1/month beyond existing infrastructure.

The biggest operational risks are agent runaway loops (infinite task creation crashing n8n), Convex bandwidth exhaustion from reactive dashboard queries, and Discord alert fatigue. All three have documented prevention strategies outlined in PITFALLS.md.

## Key Findings

**Stack:** Use `@google/genai` v1.43+ with `gemini-2.5-flash-lite` model, n8n HTTP Request nodes for Discord webhooks, Convex HTTP Actions for n8n-Convex communication, Firecrawl for lead scraping, Reveniu webhooks for financial data.

**Architecture:** "Shared Brain, Independent Limbs" -- Convex as central nervous system, n8n workflows as independent agent executors, ONE Discord notification workflow for all alert types.

**Critical pitfall:** The deprecated Gemini SDK and retiring 2.0 Flash model must be avoided. Building on either creates a forced migration within months.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 2A: Convex HTTP Layer + Discord Webhook Foundation** (~2-3 days)
   - Addresses: HTTP Actions gateway, Discord webhook setup, basic notification channels
   - Avoids: Incorrect Convex API pattern pitfall, multiple notification workflow pitfall
   - Rationale: Every agent depends on both the HTTP layer and Discord for alerts. Must come first.

2. **Phase 2B: Monitor Agent** (~2-3 days)
   - Addresses: Service heartbeats, critical alerts, daily report, health metric recording
   - Avoids: Alert fatigue (severity taxonomy), n8n crash detection
   - Rationale: Monitor validates the HTTP layer and provides alerting infrastructure all other agents need. Also catches errors during Leads/Finance development.

3. **Phase 3A: Leads Agent** (~3-4 days)
   - Addresses: Lead enrichment (Firecrawl), AI scoring (Gemini 2.5 Flash Lite), lead storage
   - Avoids: Gemini rate limits (async batching), deprecated SDK, enrichment data quality issues
   - Rationale: Leads is the highest-value agent for the business. Requires schema addition (leads table).

4. **Phase 3B: Finance Agent** (~2-3 days)
   - Addresses: Reveniu webhook receiver, MRR/churn/LTV calculation, financial reports
   - Avoids: MRR edge cases (subscription state machine), webhook signature validation
   - Rationale: Can run in parallel with Leads Agent since no shared dependencies. Requires schema addition (financialMetrics table).

5. **Phase 3C: Agent Learning + Dashboard Enhancement** (~2 days)
   - Addresses: Memory-before-action pattern, weekly reflection workflows, dashboard population
   - Avoids: Memory bloat (tiered retention + purge crons)
   - Rationale: Depends on all agents producing data. Final integration phase.

**Phase ordering rationale:**
- HTTP layer is a hard dependency for all agents (they call Convex via HTTP from n8n)
- Discord webhook is a hard dependency for all alerts (every agent sends critical alerts)
- Monitor Agent validates the infrastructure and catches errors during development of other agents
- Leads and Finance agents are independent and can be built in parallel
- Learning system needs data from all agents, so it comes last

**Research flags for phases:**
- Phase 3A (Leads Agent): Needs deeper research on Chilean business directories for prospect sourcing
- Phase 3B (Finance Agent): Needs verification that Reveniu/dLocal Go have the specific API endpoints required for subscription listing
- Phase 2B (Monitor Agent): Standard patterns, unlikely to need additional research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against official docs. SDK deprecation confirmed. Model retirement dates confirmed. |
| Features | HIGH | Based on existing requirements in PROJECT.md plus standard SaaS patterns. Table stakes are clear. |
| Architecture | HIGH | Convex HTTP Actions and n8n patterns verified against official documentation. Anti-patterns documented from community sources. |
| Pitfalls | HIGH | Multiple sources confirm each pitfall. Gemini deprecation from official Google repos. n8n memory issues from Railway community. Discord webhook limits from official API docs. |

## Gaps to Address

- **Chilean business directory APIs**: Need to identify specific sources for B2B prospect discovery (not researched in this stack-focused pass)
- **Reveniu API endpoint specifics**: Need to verify exact endpoints for listing active subscriptions (webhook events are documented, but pull-based queries less so)
- **dLocal Go vs Reveniu decision**: Which payment provider to integrate first depends on which one Sisteco actually uses for production billing (both are in the stack doc but unclear which is primary)
- **Convex Professional plan**: Decision on when to upgrade from free tier (1 GB bandwidth may be insufficient for multi-agent reactive queries)
- **n8n version pinning**: Specific version to pin to, given the CVE disclosures in early 2026

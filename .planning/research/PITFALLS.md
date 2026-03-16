# Domain Pitfalls: SAAN Multi-Agent System

**Domain:** Autonomous agent network (n8n + Convex + Discord + Gemini + scraping tools)
**Researched:** 2026-03-05
**Confidence:** HIGH (verified against official docs and multiple community sources)

---

## Critical Pitfalls

Mistakes that cause outages, data loss, or runaway costs.

---

### Pitfall 1: Agent Runaway Loops (Denial of Wallet)

**What goes wrong:** An agent triggers a workflow that creates a new task, which triggers another workflow, creating an infinite execution chain. On n8n + Convex this means: n8n runs out of memory and crashes, Convex burns through bandwidth (1 GB/month on free tier), and Gemini API credits evaporate. A single infinite loop on Railway has been documented to consume 8+ GB of memory and crash the entire n8n instance.

**Why it happens:** Agent A creates a task for Agent B, which creates a follow-up task for Agent A. Or a monitor detects an error, creates an alert, the alert handler fails, creating another error, creating another alert. The `agentTasks` table becomes the amplification vector.

**Consequences:** n8n crashes on Railway (documented issue), Convex bandwidth quota exhausted in hours instead of a month, Gemini API costs spike. Recovery requires manual intervention while the system is down.

**Prevention:**
- Hard cap on tasks per agent per hour (e.g., max 20 tasks/hour per agent) using Convex rate limiter component
- Circuit breaker: if an agent creates more than N tasks in M minutes, auto-pause and alert human
- Every workflow must have a `maxIterations` counter (n8n has this built in for loops, but you must set it explicitly -- default is unlimited)
- Tag tasks with `depth` field: task created by task created by task. Reject depth > 3
- n8n: set `EXECUTIONS_TIMEOUT=300` (5 min max per execution) and `EXECUTIONS_TIMEOUT_MAX=600` as environment variables on Railway

**Detection:** Monitor `agentTasks` creation rate. If > 5 tasks/minute for any single agent, something is wrong. Add a Convex scheduled function that checks task creation velocity every 5 minutes.

**Phase:** Phase 2 (Monitor Agent) -- must be built BEFORE Leads and Finance agents exist.

---

### Pitfall 2: Using the Deprecated Gemini SDK (@google/generative-ai)

**What goes wrong:** Building with `@google/generative-ai` which Google deprecated. Support ended permanently November 30, 2025.

**Why it happens:** Old tutorials and Stack Overflow answers still reference it. npm still serves it. The package name looks official.

**Consequences:** No bug fixes, no security patches, no new features. When Google updates the Gemini API, the old SDK breaks silently. Structured output features may not work correctly.

**Prevention:** Use `@google/genai` (the new unified SDK, v1.43.0+). Verify import: `import { GoogleGenAI } from "@google/genai"` NOT `import { GoogleGenerativeAI } from "@google/generative-ai"`. Check package.json for the old name.

**Detection:** If `@google/generative-ai` appears in package.json or any import statement, it must be replaced immediately.

**Phase:** Before any phase that uses Gemini (scoring, reports, analysis).

---

### Pitfall 3: Building on Gemini 2.0 Flash (Retiring June 2026)

**What goes wrong:** Gemini 2.0 Flash and Flash-Lite models are being retired June 1, 2026. Building scoring and reporting on them means forced migration in 3 months.

**Why it happens:** Most current tutorials still use `gemini-2.0-flash` as the example model. It works today, so developers don't check deprecation dates.

**Consequences:** All scoring prompts and structured output schemas need retesting on new model. Possible behavior differences in scoring. Hard deadline forces rushed migration.

**Prevention:** Use `gemini-2.5-flash-lite` for scoring (same cost tier: $0.10/1M input, $0.40/1M output) and `gemini-2.5-flash` for complex analysis. Never hardcode model names in n8n workflows -- store them in environment variables so they can be changed without editing workflows.

**Detection:** If any model string contains "2.0", it needs to be updated.

**Phase:** All phases using Gemini.

---

### Pitfall 4: n8n on Railway Memory Crashes

**What goes wrong:** n8n self-hosted on Railway crashes with "JavaScript heap out of memory" errors. Workflows that process large JSON payloads (lead enrichment results, financial data aggregations) consume all available memory. Railway restarts the service, but in-flight workflow executions are lost -- they neither complete nor retry.

**Why it happens:** Railway's default memory allocation is limited. n8n loads entire workflow execution data into memory. A single workflow processing 500+ leads with enrichment data can easily exceed 512 MB. Sub-workflows compound the problem as each spawns its own memory context.

**Consequences:** Lost workflow executions with no retry. Leads partially enriched. Financial calculations interrupted mid-aggregation, producing incorrect MRR/churn numbers. CEO gets no daily report because the workflow crashed at 7:55 AM.

**Prevention:**
- Set `NODE_OPTIONS=--max-old-space-size=1024` on Railway (allocate 1 GB heap)
- Process data in batches: never process more than 50 leads per workflow execution
- Use n8n's "Execute Workflow" node to split work into sub-workflows, but limit concurrency to 2
- Configure `EXECUTIONS_DATA_PRUNE=true` and `EXECUTIONS_DATA_MAX_AGE=168` (7 days) to prevent execution history from consuming memory
- Set up Railway health check endpoint so Railway auto-restarts crashed instances
- Store intermediate results in Convex (not in n8n memory) so work can resume after crash

**Detection:** Railway deployment logs showing OOMKilled. n8n health endpoint returning 503. Monitor Agent heartbeat detecting n8n unreachable.

**Phase:** Phase 2 (Monitor Agent heartbeat) + infrastructure config before Phase 3.

---

### Pitfall 5: Convex Bandwidth Exhaustion from Reactive Queries

**What goes wrong:** The dashboard or agent workflows subscribe to Convex queries that read from frequently-updated tables (agentsState, agentTasks, systemHealth). Every mutation to these tables invalidates all active subscriptions, causing full data re-sends. With 5 agents updating state every few minutes, the dashboard re-fetches entire table contents repeatedly, burning through the 1 GB/month bandwidth limit in days.

**Why it happens:** Convex's reactive system re-sends ALL results of a query when ANY document in the result set changes. A dashboard showing "all agent states" re-sends all 5+ agent records every time any single agent updates its heartbeat.

**Consequences:** Hit 1 GB bandwidth limit mid-month. Dashboard stops working. Agent queries fail. Everything breaks simultaneously.

**Prevention:**
- Query by specific agent ID, never `db.query("agentsState")` without filters -- each dashboard widget should subscribe to ONE agent's state
- Separate high-frequency data (heartbeat timestamps) from low-frequency data (agent configuration) into different tables
- Use `db.query().withIndex()` everywhere -- never table scans
- agentMemory and systemHealth: do NOT subscribe reactively. Use periodic polling instead of live subscriptions
- Budget monitoring: create a Convex action that tracks approximate bandwidth usage and alerts at 50% and 80% thresholds
- Consider upgrading to Professional ($25/mo, 50 GB bandwidth) early -- the free tier's 1 GB is dangerously low for a multi-agent system

**Detection:** Convex dashboard shows bandwidth usage approaching limit. Sudden spike in "function calls" metric.

**Phase:** Phase 2 (Dashboard) -- must architect queries correctly from the start. Retrofitting is painful.

---

### Pitfall 6: Discord Webhook Alert Fatigue and Rate Limits

**What goes wrong:** Monitor Agent sends alerts for every minor issue. CEO gets 50 Discord messages per day. Important alerts get buried in noise. Additionally, Discord webhook rate limits are 30 requests per 60 seconds per webhook URL.

**Why it happens:** Engineers set alert thresholds too low ("alert if response time > 200ms"). Every agent wants to report status. If rate limited (429), Discord enforces a cooldown period.

**Consequences:** CEO ignores Discord notifications entirely (alert fatigue). Critical alerts missed.

**Prevention:**
- Three severity levels: CRITICAL (instant Discord webhook), WARNING (daily digest), INFO (dashboard only)
- Only CRITICAL alerts go to Discord: system down, payment failed, human approval needed
- Aggregate warnings into a single daily digest message (8 AM report)
- Implement message queue: never send more than 1 Discord webhook message per 3 seconds
- Alert deduplication: same alert type suppressed for 30 minutes after first occurrence
- Single webhook URL for all agents, with a centralized send queue

**Detection:** Count messages sent per hour. If > 10/hour outside of scheduled reports, alert thresholds need tuning.

**Phase:** Phase 2 (Monitor Agent) -- define severity taxonomy before any agent starts sending alerts.

---

### Pitfall 7: Multiple Discord Webhook URLs Causing Confusion

**What goes wrong:** Creating separate Discord webhooks for each notification type, leading to scattered alerts across channels.

**Why it happens:** Easy to create many webhooks, but makes it hard to track which channel has which alerts.

**Consequences:** Alerts arrive in wrong channels. CEO misses important notifications.

**Prevention:** ONE Discord webhook URL for all critical alerts, configured in a single n8n workflow with routing logic. Use embeds with different colors to distinguish alert types.

**Detection:** If you have more than one DISCORD_WEBHOOK_URL in your n8n variables, consolidate.

**Phase:** Phase 2 (Discord webhook setup).

---

## Moderate Pitfalls

Issues that cause incorrect data or degraded functionality but not outages.

---

### Pitfall 8: Lead Enrichment Data Decay and False Positives

**What goes wrong:** Scraped lead data goes stale fast. B2B contact data degrades at ~30% per year. Firecrawl/ScrapingBee return HTML that looks like valid data but contains outdated information, cookie walls, or anti-bot pages.

**Why it happens:** Company websites change. People change jobs. ScrapingBee might return a "Please verify you're human" page as 200 OK with HTML content. Firecrawl credits get consumed even on failed scrapes.

**Prevention:**
- Validate enrichment results: check that scraped page contains expected data patterns before storing
- Set a `dataFreshness` timestamp on every enriched field. Re-enrich leads older than 30 days
- Check response for anti-bot markers (`captcha`, `verify`, `cloudflare`) before parsing
- Budget Firecrawl credits: Free tier is 500 pages. At 2-3 pages per lead, that is ~200 leads per month max
- Implement a `confidence` field on each enrichment data point

**Detection:** Track enrichment success rate in agentMemory. If success rate drops below 70%, scraping targets may have changed.

**Phase:** Phase 3 (Leads Agent).

---

### Pitfall 9: Financial Calculation Edge Cases (MRR/Churn/LTV)

**What goes wrong:** Finance Agent mishandles: mid-month upgrades/downgrades (double-counting), failed payments that are later retried successfully (false churn), free trial users (included in MRR when they should not be), and refunds/credits.

**Why it happens:** SaaS financial metrics have well-known edge cases that are deceptively simple to describe but complex to implement correctly.

**Consequences:** CEO makes business decisions based on incorrect MRR. Investor conversations based on bad numbers.

**Prevention:**
- Define explicit subscription states: TRIAL, ACTIVE, PAST_DUE, CHURNED, PAUSED. Only ACTIVE contributes to MRR
- Grace period for churn: a failed payment is not churn until 7 days have passed without successful retry
- Store raw payment events immutably in Convex. Calculate metrics from events, never from running totals
- Snapshot MRR daily at midnight Chile time. Compare snapshots, do not recalculate history
- Compare calculated MRR against dLocal Go/Reveniu dashboard numbers weekly

**Detection:** Discrepancy > 5% between calculated and dashboard MRR triggers human review.

**Phase:** Phase 3 (Finance Agent) -- define the state machine before writing calculation logic.

---

### Pitfall 10: Gemini Structured Output Returning Invalid JSON

**What goes wrong:** Even with `responseMimeType: "application/json"` and `responseSchema`, Gemini occasionally returns malformed JSON or adds unexpected fields.

**Prevention:** Always wrap JSON.parse in try/catch. Define a fallback score (e.g., category: "NURTURE", score: 50) when parsing fails. Log raw response to agentMemory for debugging. Use Zod schema validation as a second check.

**Phase:** Phase 3 (Leads Agent scoring).

---

### Pitfall 11: Not Validating Reveniu Webhook Signatures

**What goes wrong:** Accepting webhook data without verifying the `Reveniu-Secret-Key` header. An attacker could send fake payment events.

**Prevention:** In the n8n Webhook node, add a Code node that compares `headers["reveniu-secret-key"]` against the stored secret. Reject non-matching requests with 401.

**Phase:** Phase 3 (Finance Agent).

---

### Pitfall 12: Gemini API Rate Limits Breaking Lead Scoring

**What goes wrong:** Leads Agent tries to score 100 prospects and hits Gemini's RPM limits. Free tier: 10 RPM for Flash models. Workflow fails partway, leaving inconsistent data.

**Prevention:**
- Process max 8 leads per scoring batch with 90-second delays between batches
- Implement exponential backoff on 429 responses
- Score leads asynchronously: enrichment writes to Convex, separate scheduled workflow scores in small batches
- Budget for Tier 1 paid (requires billing setup): 150 RPM changes the game entirely

**Detection:** n8n execution logs showing 429 responses. Convex query for leads with null scores.

**Phase:** Phase 3 (Leads Agent).

---

### Pitfall 13: Agent Memory Bloat in Convex

**What goes wrong:** Without pruning, agentMemory grows indefinitely. A Leads Agent processing 50 leads/day stores ~150 entries/day. In 6 months: 27,000+ documents.

**Prevention:**
- Tiered retention: errors 7 days, decisions 30 days, insights 90 days, milestones forever
- Monthly summarize-and-purge: Gemini summarizes old insights, then delete originals
- Cap memory query results: max 20 entries returned
- Never store raw API responses. Store extracted insights only (max 500 chars)
- Alert when agentMemory exceeds 5,000 documents

**Phase:** Phase 2 (foundation) -- build purge mechanism before agents start writing.

---

### Pitfall 14: Convex Action Timeouts

**What goes wrong:** Convex actions have a default 10-second timeout (300s max on paid plan). If a Gemini call takes > 10s, the action fails.

**Prevention:** Do NOT call Gemini from Convex actions for production scoring. Call Gemini from n8n Code nodes (no timeout constraints). Only use Convex actions for simple, fast operations (< 5s).

**Detection:** Convex dashboard shows action failures with timeout errors.

**Phase:** Phase 3 (Leads Agent scoring).

---

## Minor Pitfalls

---

### Pitfall 15: n8n Security Vulnerabilities

**What goes wrong:** In early 2026, six CVEs were disclosed for n8n including remote code execution. The self-hosted instance on Railway is exposed if not properly secured.

**Prevention:**
- Pin n8n to a specific version. Test updates in staging first
- Set `N8N_BASIC_AUTH_ACTIVE=true` with strong credentials
- Restrict Railway deployment -- do not expose n8n UI publicly
- Review n8n security advisories monthly

**Phase:** Infrastructure setup before Phase 2.

---

### Pitfall 16: Chilean Timezone and DST Edge Cases

**What goes wrong:** Chile uses CLT (UTC-4) and CLST (UTC-3), switching DST dates set by government decree (not fixed). Reports trigger at wrong local time after DST change.

**Prevention:**
- Store timestamps in UTC in Convex
- Use `America/Santiago` timezone in n8n cron expressions, not UTC offsets
- Test DST transitions explicitly

**Phase:** Phase 2 (Monitor scheduled reports) and Phase 3 (Finance daily snapshots).

---

### Pitfall 17: Discord Embed Formatting Issues

**What goes wrong:** Discord embeds have field limits (title: 256 chars, description: 4096 chars, fields: 25 max). Messages exceeding limits are silently dropped.

**Prevention:** Keep embed descriptions under 4000 chars. Use `content` field for simple text alerts. Test with long data before going live.

**Phase:** Phase 2 (all Discord webhook messages).

---

### Pitfall 18: Ley 21.719 Compliance for Lead Data

**What goes wrong:** Storing scraped personal data without proper legal basis violates Chile's data protection law. Automated profiling (lead scoring) has additional requirements.

**Prevention:**
- Document legal basis for each data field (legitimate interest for B2B prospecting)
- Implement data deletion capability for specific leads on request
- Do not scrape personal social media profiles -- stick to business/company data
- Add `consentBasis` field to lead records
- Review with a Chilean lawyer before scraping at scale

**Phase:** Phase 3 (Leads Agent) -- before scraping begins.

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Phase 2: Monitor Agent | Alert fatigue drowning CEO in noise (Pitfall 6) | Define severity taxonomy first. Only CRITICAL goes to Discord |
| Phase 2: Monitor Agent | n8n crash goes undetected (Pitfall 4) | Heartbeat must be external to n8n (Convex scheduled function pings n8n) |
| Phase 2: Discord Webhook | Multiple webhooks cause confusion (Pitfall 7) | ONE webhook URL, routing logic in workflow. No exceptions |
| Phase 2: Dashboard | Convex bandwidth burn from reactive queries (Pitfall 5) | Query by specific ID, never full table scans |
| Phase 3: Leads Agent | Deprecated Gemini SDK (Pitfall 2) | Use @google/genai, NOT @google/generative-ai |
| Phase 3: Leads Agent | Gemini 2.0 Flash retiring (Pitfall 3) | Use gemini-2.5-flash-lite from the start |
| Phase 3: Leads Agent | Gemini rate limits (Pitfall 12) | Async scoring, small batches, exponential backoff |
| Phase 3: Leads Agent | Enrichment data quality (Pitfall 8) | Validate scrape results, multi-source, cache results |
| Phase 3: Finance Agent | MRR/churn edge cases (Pitfall 9) | Define subscription state machine first |
| Phase 3: Finance Agent | Webhook signature validation (Pitfall 11) | Verify Reveniu-Secret-Key before processing |
| All Phases | Agent runaway loops (Pitfall 1) | Task depth limits, rate caps, circuit breakers |
| All Phases | Memory bloat (Pitfall 13) | TTL on entries, daily purge, cap query results |
| All Phases | Convex action timeouts (Pitfall 14) | Do scoring in n8n, not Convex actions |

---

## Sources

- [Convex Limits (official)](https://docs.convex.dev/production/state/limits) -- HIGH confidence
- [Convex Rate Limiting](https://stack.convex.dev/rate-limiting) -- HIGH confidence
- [Convex Queries That Scale](https://stack.convex.dev/queries-that-scale) -- HIGH confidence
- [Discord Webhooks (official)](https://discord.com/developers/docs/resources/webhook) -- HIGH confidence
- [Discord Rate Limits (official)](https://discord.com/developers/docs/topics/rate-limits) -- HIGH confidence
- [Gemini API Rate Limits (official)](https://ai.google.dev/gemini-api/docs/rate-limits) -- HIGH confidence
- [Gemini API Pricing / Deprecation](https://ai.google.dev/gemini-api/docs/pricing) -- HIGH confidence
- [Legacy Gemini SDK Deprecation](https://github.com/google-gemini/deprecated-generative-ai-js) -- HIGH confidence
- [Firecrawl Rate Limits (official)](https://docs.firecrawl.dev/rate-limits) -- HIGH confidence
- [n8n Memory Errors (official)](https://docs.n8n.io/hosting/scaling/memory-errors/) -- HIGH confidence
- [n8n Railway Memory Issues (community)](https://station.railway.com/questions/n8n-service-consuming-excessive-memory-a-7f24105d) -- MEDIUM confidence
- [n8n CVEs 2026 (The Register)](https://www.theregister.com/2026/02/05/n8n_security_woes_roll_on/) -- HIGH confidence
- [Reveniu Webhooks](https://docs.reveniu.com/api-recursos/webhooks) -- HIGH confidence
- [Convex HTTP Actions](https://docs.convex.dev/functions/http-actions) -- HIGH confidence

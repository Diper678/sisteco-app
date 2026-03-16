# Feature Landscape

**Domain:** Autonomous Agent Network for B2B SaaS Operations (Monitor, Leads, Finance Agents + Discord Bot + Agent Learning)
**Researched:** 2026-03-05

---

## 1. Monitor Agent

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Service heartbeat checks (HTTP) | Without this the agent has no purpose. Must ping Vercel, Convex, n8n, Resend endpoints every 5 min | Low | Use n8n Schedule Trigger + HTTP Request nodes. n8n exposes `/healthz` and `/healthz/readiness` natively |
| Status recording to Convex | Health data must persist for trend analysis. Write to `systemHealth` table | Low | Already have the table and `recordHealthMetric` mutation |
| Instant critical alerts via Discord | Downtime costs revenue. CEO must know within seconds when a service is unreachable | Low | Discord Bot API `sendMessage` from n8n. Simple HTTP POST |
| Daily summary report (8 AM Chile) | CEO needs a pulse check without asking. Uptime %, incidents, anomalies in last 24h | Medium | n8n Cron at 8:00 America/Santiago, aggregate from `systemHealth` |
| Agent state tracking | Each agent must report its own health via `agentsState`. Monitor Agent checks for stale `lastRun` values | Low | Query `agentsState`, flag any agent not updated in >2x its expected interval |
| Error escalation with context | Alert must include: which service, what failed, since when, how many consecutive failures | Low | Build structured message with service name, HTTP status, timestamp, failure streak |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto-recovery actions | Instead of just alerting, attempt restart (e.g., re-trigger a stalled n8n workflow, clear a Convex backlog) | High | Requires careful guardrails. Start with n8n workflow restart only |
| Latency trend detection | Alert not just on down/up but on degradation (latency creeping up over days) | Medium | Compare rolling 24h average vs 7-day baseline. Store in `agentMemory` as insight |
| Cost monitoring per service | Track credits remaining (ScrapingBee, Resend, etc.) and alert before exhaustion | Medium | Service-specific API calls for usage/balance. Store as `credits_remaining` metric |
| Incident timeline | When an outage occurs, automatically log start/end/duration as a structured incident in `agentMemory` | Medium | State machine: HEALTHY -> DEGRADED -> DOWN -> RECOVERING -> HEALTHY |
| Dependency mapping | Know that if Convex is down, dashboard and agents are affected. Cascade alerts | Medium | Hardcoded dependency graph (Convex -> dashboard, agents; n8n -> all workflows) |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full APM/distributed tracing | Overkill for 6 services and ~$65/mo infra. Adds complexity without proportional value | Simple HTTP health checks + latency recording is sufficient |
| Custom metrics dashboard (Grafana/Prometheus) | Existing Convex-powered dashboard + Discord reports cover the need. Grafana adds another service to maintain | Use the CEO dashboard already scaffolded in Phase 1 |
| SMS/voice call alerts | Discord is always-on for the CEO. Adding Twilio/SMS adds cost and complexity | Discord with persistent notifications covers urgency |

---

## 2. Leads Agent

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Automated prospect discovery | Core purpose. Find Chilean B2B companies (50+ employees) matching ICP via web scraping | High | Use Firecrawl to crawl directories (LinkedIn, SII, industry listings). Store raw prospects |
| Contact data enrichment | Raw company names are useless without decision-maker emails, phone, role | High | ScrapingBee + Firecrawl for website scraping. Extract contact pages, LinkedIn profiles |
| AI lead scoring (100-point scale) | Must prioritize leads. Without scoring, all leads look equal | Medium | Gemini Pro via n8n. Score on: company size, industry fit, tech signals, engagement signals |
| Score categorization (HOT/WARM/NURTURE/SKIP) | Actionable buckets the CEO can act on immediately | Low | HOT: 80-100, WARM: 60-79, NURTURE: 30-59, SKIP: 0-29. Configurable thresholds |
| Lead deduplication | Without dedup, the same company appears multiple times wasting scoring credits | Medium | Match on RUT (Chilean tax ID), domain, or normalized company name |
| Ley 21.719 compliance flags | Chilean data protection law. Must track consent basis and data source for each lead | Low | Add `dataSource`, `legalBasis` fields. Flag leads scraped from public vs private sources |
| Lead storage in Convex | Leads must persist with full history. Need a `leads` table (not yet in schema) | Medium | New table needed: company info, contacts, scores, source, timestamps, status |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Firmographic + technographic scoring | Score not just on company size but on tech stack compatibility (do they use CRMs? marketing automation?) | High | Scrape technology signals from websites (BuiltWith-style). Indicates sophistication level |
| Behavioral intent signals | Track if a prospect visits sisteco.cl, opens emails, clicks links. Huge signal boost | High | Requires Convex event tracking on landing page. Defer to Phase 4 when Resend email sequences exist |
| ICP auto-refinement | Agent learns which lead profiles actually convert and adjusts scoring weights | High | Requires closed-loop data (which leads became customers). Store insights in `agentMemory` |
| Competitor displacement detection | Identify companies using competitor tools (inferior alternatives) as high-value targets | Medium | Firecrawl competitor customer pages, case studies, testimonials |
| Batch processing with rate limiting | Process 50-100 leads per run without hitting API limits or burning credits | Medium | n8n SplitInBatches node + configurable delays. Track credits consumed |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Automated outreach / cold email | Premature. No Resend templates verified, no email sequences designed. Sending bad emails burns the domain | Agent finds and scores leads. CEO decides outreach strategy. Outreach = Phase 4 (Sales Agent) |
| CRM integration (HubSpot/Salesforce) | Sisteco IS the CRM. Building integration to external CRM contradicts the product vision | Store in Convex. The dashboard IS the CRM view |
| Real-time LinkedIn scraping | LinkedIn aggressively blocks scrapers. Risk of account bans. Legal gray area | Use public data sources, company websites, business directories. LinkedIn only for manual verification |
| Purchase intent from third-party providers (Bombora, G2) | Expensive ($500+/mo minimum). Disproportionate to current stage | Build own intent signals from website visits and email engagement over time |

---

## 3. Finance Agent

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| MRR calculation | Most fundamental SaaS metric. Sum of all active monthly subscription values | Medium | Pull from payment provider (dLocal Go or Reveniu API). Need a `subscriptions` or `financialMetrics` table |
| Churn rate tracking | Must know monthly customer churn (customers lost / total customers at period start) | Medium | Compare active subscriptions month-over-month. Revenue churn AND logo churn |
| LTV calculation | LTV = ARPU / monthly churn rate. Essential for knowing if acquisition costs are sustainable | Low | Derived metric from MRR and churn. Calculate and store weekly |
| Weekly financial report via Discord | CEO needs financial pulse without logging into dashboards | Medium | n8n Cron weekly (Monday 9 AM). Format: MRR, new customers, churned, net revenue change |
| Subscription status monitoring | Know which subscriptions are active, trial, past-due, cancelled | Medium | Poll payment provider API. Alert on past-due (potential churn) |
| Infrastructure cost tracking | At $65/mo, every dollar matters. Track actual spend vs budget | Low | Manual config initially (known fixed costs). Alert if any service cost spikes |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Revenue forecasting | Project MRR 3 months ahead based on current trajectory, pipeline, and churn trends | High | Requires enough historical data (3+ months). Use Gemini for trend analysis |
| Churn risk detection | Flag customers showing churn signals (reduced usage, support tickets, payment failures) before they cancel | High | Requires product usage data. Defer detailed implementation until product has usage metrics |
| Cohort analysis | Group customers by signup month, track retention curves. Shows if retention is improving | Medium | Store cohort metadata with each subscription. Visualize in dashboard |
| CAC payback period | Calculate months to recover customer acquisition cost. Critical for scaling decisions | Medium | Requires marketing spend data (manual input initially) |
| Payment failure auto-retry alerts | When a payment fails, alert CEO immediately with customer context for manual intervention | Low | Webhook from payment provider or poll for failed payments |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Automated dunning sequences | Premature with few customers. Personal touch matters more at early stage | Alert CEO about failed payments. Manual follow-up builds relationships |
| Multi-currency support | Chile-only market (CLP/UF). Adding USD/EUR adds complexity without value until LATAM expansion (2027+) | Hardcode CLP. Add currency abstraction only when expanding |
| Tax calculation engine | Chilean tax rules (IVA, boletas) are complex. Get wrong = legal problems | Use dLocal Go / Reveniu for tax compliance. Don't build custom tax logic |
| Full accounting integration (QuickBooks/Xero) | At current scale, a spreadsheet export is sufficient. Integration maintenance cost > value | Export CSV/JSON for manual import. Integrate when revenue justifies it |

---

## 4. Discord Bot

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Receive critical alerts | Primary alert channel for CEO. Must receive Monitor, Leads, Finance alerts with clear formatting | Low | Discord Bot API via n8n. Use Markdown formatting for readability |
| `/status` command | CEO asks "how's everything?" and gets instant system status summary | Medium | n8n webhook triggered by Discord command. Query `agentsState` for all agents |
| `/leads` command | Show today's new leads, top HOT leads, pipeline summary | Medium | Query leads table, format top 5 with scores and company names |
| `/finance` command | Quick MRR, new revenue, churn summary on demand | Medium | Query financial metrics, return formatted summary |
| `/help` command | List available commands. Without this, CEO forgets what's possible | Low | Static response listing all commands |
| Message formatting (Markdown) | Alerts must be scannable on mobile. Headers, bold, emojis for status indicators | Low | Discord supports MarkdownV2. Use checkmarks, warning signs, red circles for status |
| Error handling in bot | If a command fails, respond gracefully instead of silently failing | Low | Try/catch in n8n workflows. Return "Something went wrong, checking..." message |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `/approve [task-id]` command | CEO approves human-in-the-loop tasks directly from Discord without opening dashboard | Medium | Update `agentTasks` status from "pending" to "approved". Trigger downstream workflow |
| `/pause [agent]` and `/resume [agent]` | Emergency agent control from mobile. Stop a misbehaving agent instantly | Medium | Update `agentsState` status. Agents check their status before executing |
| Conversational context | Bot remembers last topic. "Tell me more" expands the last alert or report | High | Store conversation state in Convex. Use Gemini to interpret follow-up questions |
| Daily digest preferences | CEO configures what's in the morning report: "skip leads, double on finance" | Medium | Store preferences in Convex. Apply filters to report generation |
| Inline buttons for actions | Instead of typing commands, tap buttons: [Approve] [Reject] [Details] | Medium | Discord InlineKeyboardMarkup. Better UX than typing commands |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multi-user bot | Only the CEO uses this. Adding user management, permissions, roles adds complexity | Hardcode CEO's Discord chat_id. Reject messages from other users |
| Natural language processing for all commands | Gemini API calls for every message = cost and latency. Most commands are simple | Use slash commands for standard operations. Reserve NLP for `/ask [question]` only |
| File uploads/downloads via bot | Edge case. Reports are better viewed in dashboard or email | Send formatted text summaries. Link to dashboard for detailed views |
| Bot-initiated conversations | Discord bots cannot initiate conversations with users who haven't started a chat first. Anti-pattern to try to work around this | CEO sends `/start` once. All subsequent communication is responses or alerts |

---

## 5. Agent Learning System

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Episodic memory logging | Every agent action/result stored in `agentMemory`. Without this, agents are stateless and repeat mistakes | Low | Already have the table. Ensure every n8n workflow writes to it on completion |
| Pre-action memory consultation | Before acting, agent queries recent memories for relevant context. "Did this fail last time?" | Medium | n8n workflow step: query `agentMemory` by agentId + tags before main logic |
| Structured insight format | Memories must be queryable. JSON with: what happened, what worked/failed, recommendation | Low | Define standard JSON schema for `content` field across all memory types |
| Memory expiration/cleanup | Without TTL, memory table grows unbounded. Old operational data becomes noise | Low | Already have `expiresAt` field. Add n8n workflow for weekly cleanup of expired memories |
| Error pattern recording | When something fails, record: what failed, why, what was tried, what worked | Low | Standardize error memory format. Tag with service name and error type |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cross-agent insight sharing | Monitor Agent detects pattern -> shares with relevant agent. E.g., "ScrapingBee slow on Tuesdays" shared with Leads Agent | Medium | Use `agentMessages` broadcast. Receiving agent stores in own memory with "external_insight" tag |
| Scoring model feedback loop | Leads Agent tracks which scored leads actually converted -> adjusts weights over time | High | Requires conversion tracking (manual initially). Gemini re-evaluates scoring criteria quarterly |
| Anomaly detection via memory | Compare current metrics to historical patterns stored in memory. Flag deviations | High | Requires sufficient data (30+ days). Use statistical thresholds (2 standard deviations) |
| Performance self-assessment | Each agent periodically evaluates its own effectiveness and reports to CEO | Medium | Weekly self-report: tasks completed, errors, insights generated, accuracy of predictions |
| Semantic memory consolidation | Compress many episodic memories into generalized knowledge. "ScrapingBee fails 30% on Tuesdays" instead of 30 individual failure records | High | Use Gemini to summarize patterns from episodic memories. Store as "consolidated_insight" type |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Vector database for memory retrieval | Overkill at current scale. Convex indexes on `agentId + memoryType + tags` are sufficient for <10K memories | Use Convex native queries with indexes. Revisit vector search at 100K+ memories |
| Autonomous behavior modification | Agents changing their own logic without human review is dangerous. One bad learning corrupts operations | Agents propose changes as insights. CEO reviews and approves via Discord/dashboard |
| Full reinforcement learning loop | Requires massive data volumes and careful reward function design. Premature at this stage | Use simple heuristic adjustments: if X fails 3 times, try Y instead. Log as decision memory |
| Inter-agent negotiation protocols | Agent-to-agent commerce/negotiation is Phase 8 (2028+). Building infrastructure now wastes effort | Use simple task queue (`agentTasks`) for inter-agent coordination. No negotiation, just requests |

---

## Feature Dependencies

```
Discord Bot Setup ─────────────────┐
                                    ├──> Monitor Agent Alerts
Monitor Agent (heartbeat) ──────────┘
         │
         ├──> Monitor Agent (daily report) ──> requires health data accumulation (24h+)
         │
         └──> Agent State Tracking ──> all other agents depend on Monitor checking them

Leads Agent (discovery) ────────────┐
         │                          │
         ├──> Leads Agent (enrichment) ──> requires raw prospects to exist
         │         │
         │         └──> Leads Agent (scoring) ──> requires enriched data for quality scores
         │
         └──> New `leads` table in Convex schema ──> MUST be added before Leads Agent works

Finance Agent (subscription monitoring) ──> requires payment provider API access (dLocal Go / Reveniu)
         │
         ├──> Finance Agent (MRR/churn/LTV) ──> requires subscription data to exist
         │
         └──> New `financialMetrics` table in schema ──> MUST be added

Agent Learning ──> depends on ALL agents writing to agentMemory consistently
         │
         └──> Cross-agent insights ──> depends on agentMessages bus being actively used

Discord Bot (commands) ──> depends on each agent's data being queryable
```

### Critical Path

1. **Discord Bot creation** (BotFather) - unblocks ALL alerts
2. **Monitor Agent heartbeats** - unblocks daily reports and establishes health baseline
3. **Schema additions** (leads table, financial metrics table) - unblocks Leads and Finance agents
4. **Leads Agent discovery + enrichment** - unblocks scoring
5. **Finance Agent subscription monitoring** - unblocks MRR/churn calculations
6. **Agent learning** - runs in parallel once agents are producing data

---

## MVP Recommendation

### Build First (Phase 2 - Monitor + Discord)

1. **Discord Bot setup** (BotFather, webhook, n8n integration) - everything depends on this
2. **Monitor Agent heartbeat** (5-min HTTP checks to all services) - immediate value, CEO knows system status
3. **Monitor Agent daily report** (8 AM summary via Discord) - daily peace of mind
4. **`/status` command** - CEO can check on demand
5. **Episodic memory logging** for Monitor Agent - start accumulating data from day one

### Build Second (Phase 3 - Leads + Finance)

1. **Schema additions** (leads table, financialMetrics table)
2. **Leads Agent discovery** (Firecrawl crawling Chilean business directories)
3. **Leads Agent enrichment** (ScrapingBee for contact data)
4. **Leads Agent scoring** (Gemini 100-point model)
5. **Finance Agent subscription monitoring** (payment provider integration)
6. **Finance Agent MRR/churn/LTV** calculation
7. **`/leads` and `/finance` Discord commands**
8. **`/approve` command** for human-in-the-loop tasks

### Defer

- **Behavioral intent signals** for leads: Requires email sequences (Phase 4 - Sales Agent)
- **Revenue forecasting**: Requires 3+ months of financial data
- **Conversational Discord context**: Nice-to-have, not essential for operations
- **Semantic memory consolidation**: Requires sufficient episodic data (30+ days of agent operation)
- **Auto-recovery actions**: High risk, build trust in monitoring first

---

## Sources

- [n8n Monitoring Docs](https://docs.n8n.io/hosting/logging-monitoring/monitoring/) - n8n health endpoints
- [n8n Community - Heartbeat Monitoring](https://community.n8n.io/t/cron-job-monitoring-aka-heartbeat-monitoring/19930)
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook) - official Discord webhook capabilities
- [B2B Lead Scoring Criteria - TechBusinessOnline](https://techbusinessonline.com/b2b-lead-scoring-criteria-examples/) - scoring model best practices
- [Gartner - Lead Scoring Intent Signals](https://www.gartner.com/en/digital-markets/insights/lead-scoring-intent-signals)
- [SaaS Financial Metrics - GoLimelight](https://www.golimelight.com/blog/saas-financial-metrics) - key SaaS metrics
- [SaaS Metrics for Indie Hackers - CalmOps](https://calmops.com/indie-hackers/saas-metrics-mrr-churn-ltv-cac/)
- [AI Agent Monitoring Best Practices - UptimeRobot](https://uptimerobot.com/knowledge-hub/monitoring/ai-agent-monitoring-best-practices-tools-and-metrics/)
- [ICLR 2026 Workshop - Memory for LLM-Based Agents](https://openreview.net/pdf?id=U51WxL382H) - academic research on agent memory systems
- [Amplemarket - AI Lead Generation Tools 2026](https://www.amplemarket.com/blog/best-ai-lead-generation-tools)

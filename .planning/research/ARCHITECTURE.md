# Architecture Patterns

**Domain:** Multi-agent autonomous business operations (SAAN)
**Researched:** 2026-03-05
**Confidence:** HIGH (based on existing codebase analysis + verified documentation)

## Recommended Architecture

### Overview: "Shared Brain, Independent Limbs"

SAAN follows a **shared-state multi-agent** pattern where Convex is the central nervous system (shared memory, task queues, message bus) and n8n workflows are the agents' limbs (autonomous execution units). The Discord bot is the CEO's nerve ending into the system.

```
                          +------------------+
                          |   CEO (Discord)  |
                          +--------+---------+
                                   |
                          +--------v---------+
                          | Discord Bot      |
                          | (n8n workflow)    |
                          +--------+---------+
                                   |
                    +--------------v--------------+
                    |       CONVEX (Shared Brain)  |
                    |                              |
                    |  agentsState    agentTasks   |
                    |  agentMemory    agentMessages|
                    |  systemHealth   marketIntel  |
                    |  skillsRegistry mcpRegistry  |
                    +-+----+----+----+----+-------+
                      |    |    |    |    |
               +------+  ++   ++   ++  ++------+
               |       |  |    |    |  |        |
          +----v--+ +--v--v+ +-v---v+ +v------+
          |Monitor| | Leads | |Finance| |Future |
          | Agent | | Agent | | Agent | |Agents |
          +-------+ +-------+ +------+ +-------+
          (n8n      (n8n       (n8n
          workflows) workflows) workflows)
```

### Critical Architectural Discovery

**The existing orchestrator workflow calls Convex incorrectly.** It uses `$vars.SAAN_CONVEX_URL/api/mutation` which is NOT the documented Convex external API pattern. Convex requires you to either:

1. Use `ConvexHttpClient` from a Node.js environment, OR
2. Define HTTP Actions in `convex/http.ts` that expose endpoints at `https://<deployment>.convex.site/...`

**Recommendation:** Create a `convex/http.ts` file that exposes REST endpoints for n8n to call. This is the correct, documented pattern for external service integration. Each endpoint wraps the corresponding mutation/query.

## Component Boundaries

| Component | Responsibility | Communicates With | Protocol |
|-----------|---------------|-------------------|----------|
| **Convex DB** | State, memory, tasks, messages, health metrics | All agents, Dashboard, Discord bot | HTTP Actions (`*.convex.site`) |
| **Orchestrator** (n8n) | Route events, dispatch alerts, create human tasks | Convex, Discord, all agents | Webhook receiver + HTTP |
| **Monitor Agent** (n8n) | Heartbeat checks, daily reports, purge expired data | Convex (write health), Discord (alerts) | Cron-triggered + HTTP |
| **Leads Agent** (n8n) | Prospect search, enrichment, scoring | Convex (write leads data), Firecrawl, ScrapingBee, PhantomBuster, Gemini | Webhook-triggered + Cron |
| **Finance Agent** (n8n) | Subscription tracking, MRR/churn/LTV calculation | Convex (read/write finance data), dLocal/Reveniu APIs | Cron-triggered |
| **Discord Bot** (n8n) | Receive CEO commands, send alerts, approve tasks | Convex (read tasks, write approvals), Orchestrator | Discord Webhook trigger |
| **Dashboard** (HTML) | Visual CEO interface, task approval | Convex (read-only queries + approve mutations) | Convex JS client (CDN) |

## Data Flow

### 1. Agent Lifecycle (Every Agent)

Every agent workflow follows this lifecycle pattern in n8n:

```
[Trigger] → [Report Status: "active"] → [Execute Work] → [Save Memory] → [Report Status: "idle"]
     |                                         |
     |                                    [On Error]
     |                                         |
     |                               [Report Status: "error"]
     |                               [Create Alert Task]
     v
Trigger types:
  - Cron (Monitor heartbeat: */5 * * * *)
  - Cron (Daily report: 0 8 * * *)
  - Webhook (Orchestrator dispatches work)
  - Cron (Leads prospecting: 0 9 * * 1)
```

**Standard n8n agent workflow template (6 nodes minimum):**

```
1. Trigger (Cron or Webhook)
2. HTTP Request: POST convex.site/agent/status  → { agentId, status: "active", currentTask }
3. [Agent-specific work nodes: 3-15 nodes]
4. HTTP Request: POST convex.site/agent/memory  → { agentId, memoryType: "report", content }
5. HTTP Request: POST convex.site/agent/status  → { agentId, status: "idle" }
6. Error Handler → POST convex.site/agent/status → { agentId, status: "error", errorMessage }
```

### 2. Inter-Agent Communication Flow

Agents do NOT talk directly to each other. All communication goes through Convex tables:

```
Leads Agent                    Convex                      Finance Agent
    |                            |                              |
    |--- save lead score ------->| agentMemory                  |
    |                            |                              |
    |--- create task ----------->| agentTasks (toAgent:"finance")|
    |                            |                              |
    |                            |<----- poll pending tasks ----|
    |                            |                              |
    |                            |--- return task ------------->|
    |                            |                              |
    |                            |<----- mark task done --------|
```

**Why this pattern (not direct HTTP between agents):**
- Agents may be offline (n8n workflow not running)
- Tasks persist and retry automatically
- Full audit trail in Convex
- Decoupled: adding/removing agents requires zero changes to other agents
- Convex indexes make polling efficient

### 3. Human-in-the-Loop Escalation Flow

```
Any Agent                 Convex               Discord Bot        CEO
    |                       |                       |                |
    |-- createTask -------->|                       |                |
    |   toAgent: "human"    | agentTasks            |                |
    |   priority: "high"    |                       |                |
    |                       |                       |                |
    |                       |-- (via Monitor poll)->|                |
    |                       |                       |-- send msg --->|
    |                       |                       |   with buttons |
    |                       |                       |                |
    |                       |                       |<-- /approve ---|
    |                       |                       |                |
    |                       |<-- updateTaskStatus --|                |
    |                       |   status: "done"      |                |
    |                       |   result: {approved}  |                |
```

**Escalation rules (hardcode these, do NOT let agents decide):**
- Spending > $50 USD: ALWAYS escalate
- New lead category discovered: escalate first 3 times, then auto-approve
- Service down > 15 minutes: alert (not escalation)
- MCP installation: ALWAYS escalate
- Data deletion: ALWAYS escalate

### 4. Autonomous Learning Loop

```
Agent executes task
    |
    v
Save result as agentMemory (memoryType: "report")
    |
    v
Periodically (weekly cron), agent runs "reflection" workflow:
    |
    v
Query last 50 memories → Send to Gemini with prompt:
  "Analyze these task results. What patterns do you see?
   What should I do differently? Return 1-3 actionable insights."
    |
    v
Save insights as agentMemory (memoryType: "insight", tags: ["actionable"])
    |
    v
Before each task execution, agent queries recent insights:
  getRecentMemory({ agentId, memoryType: "insight", limit: 5 })
    |
    v
Include insights in task context (e.g., Gemini scoring prompt includes past insights)
```

**This is NOT AGI.** It is structured prompt enrichment using historical context. Keep expectations realistic.

### 5. Discord Bot Data Flow

```
                    Discord API
                         |
            (webhook to Railway n8n URL)
                         |
              +----------v-----------+
              | n8n: Discord Trigger |
              | (single workflow)     |
              +----------+-----------+
                         |
              +----------v-----------+
              | Parse Command         |
              | /status /approve /help|
              | /leads /health /mrr   |
              +----------+-----------+
                         |
          +--------------+--------------+
          |              |              |
    /status        /approve <id>    /leads
          |              |              |
    Query Convex   Update Task    Query Convex
    agentsState    status:"done"  agentMemory
          |              |              |
    Format msg     Confirm msg    Format msg
          |              |              |
          +------+-------+------+
                 |
          Send Discord reply
```

**Critical constraint:** Discord allows only ONE webhook URL per bot. All bot logic lives in a SINGLE n8n workflow with a Switch node routing commands. Do NOT create separate workflows per command.

## Convex HTTP Actions Layer (New Component)

The existing orchestrator uses an undocumented API path. Create `convex/http.ts` as the gateway:

```typescript
// convex/http.ts — REST API for n8n agents
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// Agent status updates
http.route({
  path: "/agent/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const id = await ctx.runMutation(api.agents.upsertAgentState, body);
    return new Response(JSON.stringify({ ok: true, id }), {
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// Agent memory
http.route({
  path: "/agent/memory",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const id = await ctx.runMutation(api.agents.saveMemory, body);
    return new Response(JSON.stringify({ ok: true, id }));
  }),
});

// Task operations
http.route({
  path: "/agent/tasks/create",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const id = await ctx.runMutation(api.agents.createTask, body);
    return new Response(JSON.stringify({ ok: true, id }));
  }),
});

http.route({
  path: "/agent/tasks/pending",
  method: "GET",  // ?toAgent=monitor
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const toAgent = url.searchParams.get("toAgent") || "human";
    const tasks = await ctx.runQuery(api.agents.getPendingTasks, { toAgent });
    return new Response(JSON.stringify(tasks));
  }),
});

// ... additional routes for messages, health, intelligence

export default http;
```

**Base URL:** `https://<deployment-name>.convex.site/agent/...`

All n8n workflows call this URL instead of the incorrect `/api/mutation` path.

## n8n Workflow Patterns per Agent

### Monitor Agent (3 workflows)

| Workflow | Trigger | Nodes | Purpose |
|----------|---------|-------|---------|
| `saan-monitor-heartbeat` | Cron */5 * * * * | 8-10 | Ping services, record latency, alert on failure |
| `saan-monitor-daily-report` | Cron 0 8 * * * | 6-8 | Aggregate 24h metrics, send Discord summary |
| `saan-monitor-housekeeping` | Cron 0 3 * * * | 4-5 | Purge expired messages, old health metrics |

**Heartbeat workflow detail:**
```
Cron 5min → Report active → HTTP Ping [vercel, convex, n8n, resend...] (parallel)
  → For each: Record health metric in Convex
  → If any DOWN: Send Discord alert + Create critical task
  → Report idle
```

### Leads Agent (4 workflows)

| Workflow | Trigger | Nodes | Purpose |
|----------|---------|-------|---------|
| `saan-leads-prospect` | Cron 0 9 * * 1 (Monday 9AM) | 12-15 | Find new prospects via LinkedIn/web |
| `saan-leads-enrich` | Webhook (orchestrator) | 8-10 | Enrich a single lead with company data |
| `saan-leads-score` | Webhook (orchestrator) | 6-8 | Score a lead with Gemini (0-100) |
| `saan-leads-weekly-reflect` | Cron 0 10 * * 5 (Friday) | 5-7 | Analyze scoring accuracy, generate insights |

**Scoring workflow detail:**
```
Webhook (lead data) → Report active → Query recent insights from memory
  → Build Gemini prompt (criteria + past insights + lead data)
  → Call Gemini API → Parse score (HOT/WARM/NURTURE/SKIP)
  → Save score to Convex → If HOT: create task for CEO notification
  → Save memory (report) → Report idle
```

### Finance Agent (3 workflows)

| Workflow | Trigger | Nodes | Purpose |
|----------|---------|-------|---------|
| `saan-finance-daily-metrics` | Cron 0 7 * * * | 8-10 | Calculate MRR, churn, LTV |
| `saan-finance-weekly-report` | Cron 0 9 * * 1 | 6-8 | Weekly financial summary via Discord |
| `saan-finance-subscription-check` | Cron 0 */6 * * * | 6-8 | Check payment status, flag failed charges |

### Discord Bot (1 workflow)

| Workflow | Trigger | Nodes | Purpose |
|----------|---------|-------|---------|
| `saan-discord-bot` | Discord Webhook | 15-20 | All CEO commands, task approval, status queries |

**Bot command routing:**
```
Discord Trigger → Switch (message.text) →
  /status  → Query all agent states → Format table → Reply
  /health  → Query health snapshot → Format → Reply
  /leads   → Query recent leads scored → Format top 5 → Reply
  /mrr     → Query latest finance metrics → Format → Reply
  /approve → Parse task ID → Update task status → Confirm → Reply
  /tasks   → Query human pending tasks → Format list → Reply
  /help    → Static help text → Reply
  (default) → "Comando no reconocido. Usa /help"
```

## Suggested Build Order

The build order is driven by dependencies. Each component builds on the previous one.

### Phase 2A: Convex HTTP Layer + Discord Bot Foundation
**Must come first** because all agents depend on the HTTP Actions layer, and Discord is needed for alerts.

1. Create `convex/http.ts` with all REST endpoints
2. Crear webhook en canal Discord para notificaciones
3. Build `saan-discord-bot` n8n workflow with /help, /status, /tasks, /approve
4. Test: Send /status from Discord, get response

**Dependencies:** None (builds on Fase 1 foundation)

### Phase 2B: Monitor Agent
**Must come second** because it validates the HTTP layer and provides the alerting foundation all other agents need.

1. Build `saan-monitor-heartbeat` workflow
2. Build `saan-monitor-housekeeping` workflow
3. Build `saan-monitor-daily-report` workflow (sends via Discord)
4. Test: Let it run 24h, verify health data in Convex, verify daily report arrives

**Dependencies:** Phase 2A (HTTP layer, Discord bot for alerts)

### Phase 2C: Leads Agent
**Can start after Monitor is stable.**

1. Build `saan-leads-score` workflow (simplest, webhook-triggered)
2. Build `saan-leads-enrich` workflow
3. Build `saan-leads-prospect` workflow (most complex, uses PhantomBuster/Firecrawl)
4. Build `saan-leads-weekly-reflect` workflow (learning loop)
5. Test: Score a manual lead, verify in Convex and dashboard

**Dependencies:** Phase 2A (HTTP layer), Phase 2B (monitoring for error detection)

### Phase 2D: Finance Agent
**Can run in parallel with Leads Agent** since they share no dependencies.

1. Build `saan-finance-daily-metrics` workflow
2. Build `saan-finance-weekly-report` workflow
3. Build `saan-finance-subscription-check` workflow
4. Test: Verify MRR calculation, weekly report via Discord

**Dependencies:** Phase 2A (HTTP layer), Phase 2B (monitoring)

### Phase 2E: Dashboard Enhancement + Learning Loop
**Final phase** because it integrates everything.

1. Update dashboard to show lead scores, finance metrics
2. Implement learning loop pattern across all agents
3. Add Discord inline keyboard buttons for task approval

**Dependencies:** All previous phases

## Patterns to Follow

### Pattern 1: Standard Agent Workflow Template

Every agent workflow MUST follow this structure. No exceptions.

```
[Trigger]
  → [POST /agent/status: active, currentTask: "description"]
  → [Try: Agent work nodes]
  → [POST /agent/memory: save report]
  → [POST /agent/status: idle]
  → [Catch: POST /agent/status: error, errorMessage]
  → [Catch: POST /agent/tasks/create: alert to monitor]
```

**Why:** Consistent lifecycle reporting means the dashboard always shows accurate state, and Monitor Agent can detect stale agents (lastRun too old).

### Pattern 2: Idempotent Health Checks

Monitor Agent heartbeats must be idempotent. If a check runs twice, the second run should produce the same result. Use `recordHealthMetric` (append-only) not `upsertAgentState` for health data.

### Pattern 3: Task Expiration

All tasks created with `expiresAt`. Default: 7 days for human tasks, 24 hours for agent-to-agent tasks. Monitor housekeeping workflow cancels expired tasks.

### Pattern 4: Memory-Bounded Reflection

Learning loop queries last 50 memories maximum. Gemini processes and returns 1-3 insights. This prevents context window overflow and keeps costs predictable (~$0.01 per reflection call).

### Pattern 5: Single Discord Workflow

All Discord interaction goes through ONE workflow. Use a Switch node to route commands. Never create separate workflows per command (Discord allows only one webhook URL per bot).

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct Agent-to-Agent HTTP Calls
**What:** Agent A calling Agent B's webhook directly.
**Why bad:** Creates coupling, fails when Agent B is offline, no audit trail.
**Instead:** Agent A creates a task in Convex, Agent B polls for pending tasks.

### Anti-Pattern 2: Storing Secrets in Convex
**What:** Putting API keys in Convex tables (skillsRegistry.config, etc).
**Why bad:** Convex data is accessible to anyone with the deployment URL.
**Instead:** Store secret references as variable names (e.g., `"PHANTOMBUSTER_API_KEY"`), actual values live in n8n environment variables.

### Anti-Pattern 3: Fat Orchestrator
**What:** Making the orchestrator workflow do all the work (scoring, enrichment, etc).
**Why bad:** Single point of failure, impossible to debug, can't scale.
**Instead:** Orchestrator only routes and dispatches. Agent workflows do actual work.

### Anti-Pattern 4: Unbounded Queries
**What:** `ctx.db.query("agentMemory").collect()` without limits.
**Why bad:** As data grows, query time and cost explode.
**Instead:** Always use `.take(N)` or slice results. Current code already does this correctly with `slice(0, limit ?? 20)`.

### Anti-Pattern 5: Polling Convex from n8n Instead of Cron+Push
**What:** Setting up an n8n interval that queries Convex every 30 seconds for new tasks.
**Why bad:** Wastes n8n executions, adds latency, costs money on Railway.
**Instead:** Use the orchestrator webhook to trigger agent workflows when tasks arrive. For periodic work, use cron triggers.

## Scalability Considerations

| Concern | Now (1 CEO) | At 10 clients | At 100 clients |
|---------|-------------|---------------|----------------|
| Convex reads | Free tier sufficient | Still fine (reactive queries) | Paid plan needed |
| n8n executions | ~200/day across all agents | ~2000/day, still within Railway limits | Need dedicated VPS or n8n Cloud |
| Discord messages | ~20/day | One bot per client or command namespacing | Dedicated bots per client |
| Gemini API calls | ~10/day for scoring | ~100/day, ~$3/month | ~1000/day, ~$30/month |
| Health check storage | 7-day retention, ~1000 rows | Same pattern, per-tenant schema | Need sharding strategy |

**At current scale (single Sisteco company): All within free/budget tiers. No premature optimization needed.**

## Sources

- [n8n Multi-Agent Systems Guide](https://blog.n8n.io/multi-agent-systems/) - Patterns for agent orchestration
- [n8n AI Agent Orchestration Frameworks](https://blog.n8n.io/ai-agent-orchestration-frameworks/) - Framework comparison
- [Convex HTTP Actions Documentation](https://docs.convex.dev/functions/http-actions) - Official docs on external service integration
- [Convex ConvexHttpClient](https://docs.convex.dev/api/classes/browser.ConvexHttpClient) - HTTP client for external calls
- [n8n Discord Integration](https://n8n.io/integrations/webhook/and/discord/) - Webhook setup patterns
- [Railway n8n Webhook Template](https://station.railway.com/templates/n8n-w-webhook-processors-76e9cf8c) - HTTPS webhook configuration
- [n8n Community: Workflow + Agent Patterns 2025](https://community.n8n.io/t/when-workflows-meet-agents-emerging-patterns-for-hybrid-automation-in-2025/157805) - Hybrid automation patterns
- Existing SAAN codebase: `SAAN/convex/schema.ts`, `agents.ts`, `agentMessages.ts`, `intelligence.ts`, `skills.ts`
- Existing orchestrator: `SAAN/n8n-workflows/saan-orchestrator.json`

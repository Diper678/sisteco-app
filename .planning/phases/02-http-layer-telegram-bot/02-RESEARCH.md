# Phase 2: HTTP Layer + Telegram Bot - Research

**Researched:** 2026-03-05
**Domain:** Convex HTTP Actions, Telegram Bot API, n8n orchestration
**Confidence:** HIGH

## Summary

Phase 2 builds the communication backbone of SAAN: HTTP endpoints in Convex that n8n can call to read/write data, a Telegram bot for CEO interaction, a message queue in Convex for rate-limited Telegram delivery, and a circuit breaker to prevent runaway agent loops. The existing orchestrator workflow uses Slack webhooks and incorrect Convex API paths (`/api/mutation`) -- both must be replaced.

Convex HTTP Actions use `httpRouter` in `convex/http.ts` to expose endpoints at `*.convex.site`. Handlers use `ctx.runMutation()` and `ctx.runQuery()` to interact with the database. Environment variables are accessed via `process.env`. Telegram Bot API has clear rate limits (30 msg/sec global, 1 msg/sec per chat) and supports HTML formatting and inline keyboards for human-in-the-loop buttons. n8n has a native Telegram Trigger node that handles both messages and callback queries, plus a Telegram node for sending messages with inline keyboards.

**Primary recommendation:** Build a single generic `POST /api/call` endpoint in `convex/http.ts` with an allowlist Map, validate via `X-SAAN-Secret` header, and use n8n's native Telegram nodes (Trigger + Send) instead of raw HTTP requests to the Telegram API.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- HTTP API: Generic POST /api/call endpoint with allowlist, shared secret auth via X-SAAN-Secret header, standard response wrapper { ok, data }
- Telegram: HTML format, emoji identity per agent, inline buttons for human-in-the-loop (Approve/Reject/Postpone), unknown commands get help suggestion
- Circuit breaker: Per-agent limits (Monitor 15/h, Leads 10/h, Finance 5/h, Default 10/h), pause+alert+escalation (30min->1h->manual), state in Convex agentsState.metadata
- Telegram queue: New telegramQueue table in Convex, 30s consolidation window for WARNING/INFO, CRITICAL immediate, 3 retries with exponential backoff, failed message recovery notification
- Commands Phase 2: /status, /help, /health
- Orchestrator needs full replacement (currently uses Slack + wrong Convex paths)

### Claude's Discretion
- Internal code structure within http.ts (helper functions, error handling patterns)
- n8n workflow node organization and naming
- Telegram message template exact HTML structure
- Circuit breaker query optimization approach

### Deferred Ideas (OUT OF SCOPE)
- REST-like specific endpoints per resource (Phase 4+ if generic is insufficient)
- Advanced Telegram commands (/leads, /mrr, /pause agent) (Phase 3-5)
- Telegram queue dashboard with delivery graphs (Phase 6)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Convex HTTP Actions exponen endpoints REST en *.convex.site para que n8n pueda llamar mutations y queries | Convex httpRouter + httpAction pattern verified; generic /api/call with allowlist Map |
| INFRA-02 | Autenticacion de requests n8n->Convex via shared secret header | process.env.SAAN_API_SECRET accessible in httpAction; validate X-SAAN-Secret header |
| INFRA-03 | Telegram Bot creado via @BotFather con webhook configurado hacia n8n | n8n Telegram Trigger node handles webhook setup automatically; HTTPS required (Railway provides it) |
| INFRA-04 | Workflow n8n unico para Telegram con Switch node para routing de comandos | n8n Switch node routes by update type (message vs callback_query) and command text |
| INFRA-05 | Comandos basicos del bot: /status, /help, /health | Each command calls Convex HTTP endpoint, formats response as HTML, sends via Telegram node |
| INFRA-06 | Cola de mensajes Telegram centralizada para respetar rate limits (30 msg/sec) | New telegramQueue table in Convex schema; n8n cron consumer workflow; consolidation logic |
| INFRA-07 | Circuit breaker global: limite de tareas por agente por hora | Query agentTasks by fromAgent + createdAt in last hour; store breaker state in agentsState.metadata |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| convex | ^1.32.0 | Backend DB + HTTP Actions | Already installed in SAAN; httpRouter is built-in |
| Telegram Bot API | Latest | CEO communication channel | Direct HTTP API, no SDK needed (n8n handles it) |
| n8n Telegram nodes | Built-in | Bot trigger + message sending | Native n8n integration, handles webhook setup |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| n8n HTTP Request node | Built-in | Call Convex HTTP endpoints from n8n | Every Convex data read/write from n8n |
| n8n Switch node | Built-in | Route Telegram commands | Command routing in bot workflow |
| n8n Code node | Built-in | Format messages, parse callbacks | Message formatting, data transformation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Generic /api/call | Individual REST endpoints | More conventional but requires http.ts changes for each new function |
| n8n Telegram nodes | Raw HTTP to Telegram API | More control but reinvents webhook management and credential handling |
| telegramQueue in Convex | External queue (Redis, SQS) | External queue adds infrastructure cost; Convex is already the DB |

**Installation:**
No new packages needed. Convex ^1.32.0 already includes httpRouter and httpAction.

## Architecture Patterns

### Recommended Project Structure
```
SAAN/convex/
  http.ts              # NEW — httpRouter with /api/call endpoint
  schema.ts            # MODIFY — add telegramQueue table
  agents.ts            # EXISTING — expose via HTTP allowlist
  agentMessages.ts     # EXISTING — expose via HTTP allowlist
  intelligence.ts      # EXISTING — expose via HTTP allowlist
  telegramQueue.ts     # NEW — mutations/queries for telegram queue

SAAN/n8n-workflows/
  saan-orchestrator.json      # REPLACE — remove Slack, fix Convex paths
  saan-telegram-bot.json      # NEW — Telegram bot with commands + callbacks
  saan-telegram-consumer.json # NEW — cron that drains telegramQueue
```

### Pattern 1: Generic HTTP Action Endpoint with Allowlist
**What:** Single POST endpoint that dispatches to any allowed Convex function
**When to use:** When n8n needs to call many different mutations/queries without changing http.ts each time
**Example:**
```typescript
// Source: Convex HTTP Actions docs + CONTEXT.md decision
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

// Allowlist: maps string names to actual function references
const ALLOWLIST: Record<string, any> = {
  "agents:upsertAgentState": api.agents.upsertAgentState,
  "agents:createTask": api.agents.createTask,
  "agents:updateTaskStatus": api.agents.updateTaskStatus,
  "agents:getAgentState": api.agents.getAgentState,
  "agents:getAllAgentsState": api.agents.getAllAgentsState,
  "agents:getPendingTasks": api.agents.getPendingTasks,
  "agents:getHumanPendingTasks": api.agents.getHumanPendingTasks,
  "agents:saveMemory": api.agents.saveMemory,
  "agentMessages:send": api.agentMessages.send,
  "intelligence:getHealthSnapshot": api.intelligence.getHealthSnapshot,
  "intelligence:recordHealthMetric": api.intelligence.recordHealthMetric,
};

// Determine if a function reference is a query or mutation
// Queries use ctx.runQuery, mutations use ctx.runMutation
const QUERIES = new Set([
  "agents:getAgentState",
  "agents:getAllAgentsState",
  "agents:getPendingTasks",
  "agents:getHumanPendingTasks",
  "intelligence:getHealthSnapshot",
]);

http.route({
  path: "/api/call",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Auth check
    const secret = request.headers.get("X-SAAN-Secret");
    if (secret !== process.env.SAAN_API_SECRET) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json();
    const { function: fnName, args } = body;

    const fnRef = ALLOWLIST[fnName];
    if (!fnRef) {
      return new Response(
        JSON.stringify({ ok: false, error: `Function not allowed: ${fnName}` }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const result = QUERIES.has(fnName)
        ? await ctx.runQuery(fnRef, args || {})
        : await ctx.runMutation(fnRef, args || {});
      return new Response(
        JSON.stringify({ ok: true, data: result }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

export default http;
```

### Pattern 2: Telegram HTML Message Template
**What:** Standardized message format for all agent notifications
**When to use:** Every Telegram message sent by any agent
**Example:**
```html
<!-- Telegram HTML format (parse_mode: "HTML") -->
<!-- Supported: <b>, <i>, <u>, <s>, <code>, <pre>, <a href=""> -->
<!-- NO <br> tags — use \n for line breaks -->
<!-- Emojis are UTF-8 characters, not HTML entities -->

<b>🔍 Monitor — Health Check</b>
━━━━━━━━━━━━━━━━━━━━

• Vercel: ✅ 120ms
• Convex Landing: ✅ 85ms
• n8n: ⚠️ 450ms (lento)

<b>Pasos sugeridos:</b>
1. Verificar Railway dashboard
2. Revisar logs de n8n

<i>Severidad: WARNING</i>
```

### Pattern 3: Circuit Breaker in agentsState.metadata
**What:** Store circuit breaker state in the existing metadata field of agentsState
**When to use:** Before every createTask call, check task count for that agent in the last hour
**Example:**
```typescript
// Circuit breaker state structure in agentsState.metadata
{
  circuitBreaker: {
    tripCount: 0,        // number of times tripped
    trippedAt: null,     // timestamp of last trip
    resetAt: null,       // timestamp of auto-reset
    hourlyLimit: 10,     // max tasks per hour for this agent
  }
}

// Before createTask, count recent tasks:
// Query agentTasks WHERE fromAgent = X AND createdAt > (now - 1 hour) AND status != "cancelled"
// If count >= limit, reject and trip the breaker
```

### Pattern 4: n8n Workflow Structure for Telegram Bot
**What:** Single n8n workflow that handles all Telegram interactions
**When to use:** The main Telegram bot workflow
**Example structure:**
```
Telegram Trigger (webhook)
  → Switch: Is callback_query?
    → YES: Parse callback data → Execute action → Answer callback query
    → NO: Switch by command text
      → /status: HTTP Request to Convex → Format → Telegram Send
      → /help: Static help text → Telegram Send
      → /health: HTTP Request to Convex → Format → Telegram Send
      → default: "Comando no reconocido" → Telegram Send
```

### Anti-Patterns to Avoid
- **Using /api/mutation or /api/query Convex paths:** These are the OLD client-side API paths. HTTP Actions use custom routes on *.convex.site domain. The existing orchestrator makes this mistake.
- **Sending Telegram messages directly from httpAction:** HTTP Actions have no retry and limited execution time. Queue messages in telegramQueue and let n8n consume them.
- **Storing circuit breaker state outside Convex:** Putting state in n8n variables or env vars loses it on restart. Convex is the source of truth.
- **Using Markdown parse_mode in Telegram:** Markdown has escaping issues with technical data (underscores, asterisks). HTML is more predictable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Telegram webhook setup | Custom webhook registration code | n8n Telegram Trigger node | Handles SSL, webhook registration, and re-registration automatically |
| Telegram credential management | Store bot token in Convex or code | n8n Credential system | Encrypted storage, shared across workflows |
| Rate limiting for Telegram | Custom token bucket in Convex | telegramQueue with n8n cron consumer | Simpler, queue already provides ordering and retry |
| Convex function dispatching | Custom REST routes per function | Generic /api/call with allowlist Map | Extensible without code changes to http.ts |

**Key insight:** n8n provides battle-tested Telegram integration nodes. Use them for all Telegram I/O. Convex handles data and queue state. Don't mix concerns.

## Common Pitfalls

### Pitfall 1: Wrong Convex URL Domain
**What goes wrong:** Using `*.convex.cloud` instead of `*.convex.site` for HTTP Actions
**Why it happens:** Convex has two domains — `.convex.cloud` for client SDK connections, `.convex.site` for HTTP Actions
**How to avoid:** Always use the `.convex.site` URL for HTTP endpoints. Set as n8n variable `SAAN_CONVEX_SITE_URL`
**Warning signs:** 404 errors when n8n calls Convex

### Pitfall 2: Convex ID Serialization
**What goes wrong:** Convex document IDs (like `agentTasks` IDs) are objects, not plain strings. Passing them as strings from n8n fails validation.
**Why it happens:** `v.id("agentTasks")` expects a Convex ID type, not a raw string
**How to avoid:** When calling `updateTaskStatus` from n8n, the taskId must be the exact Convex ID string (format: `j57...`). Convex automatically deserializes these from JSON strings.
**Warning signs:** Validation errors about expected ID type

### Pitfall 3: Telegram Trigger Fires Multiple Times
**What goes wrong:** n8n Telegram Trigger can fire multiple times for a single callback_query
**Why it happens:** Known n8n issue (GitHub #15483) — duplicate webhook deliveries
**How to avoid:** Add idempotency check in the workflow: store last processed callback_query_id and skip duplicates
**Warning signs:** Duplicate Telegram responses, double task approvals

### Pitfall 4: HTML Escaping in Telegram Messages
**What goes wrong:** Messages with `<`, `>`, or `&` in data break HTML formatting
**Why it happens:** Telegram HTML parser treats these as tag delimiters
**How to avoid:** Escape user/agent data before inserting into HTML templates: `&` -> `&amp;`, `<` -> `&lt;`, `>` -> `&gt;`
**Warning signs:** Truncated messages, formatting errors

### Pitfall 5: Circuit Breaker Race Condition
**What goes wrong:** Two concurrent task creations both pass the limit check, then both succeed
**Why it happens:** Count query and insert are separate operations
**How to avoid:** Use a Convex mutation that atomically checks count AND creates the task (or rejects). Don't split into query + mutation from n8n side.
**Warning signs:** Task count exceeds hourly limit

### Pitfall 6: Orchestrator Uses Slack References
**What goes wrong:** The existing saan-orchestrator.json references Slack webhooks ($vars.SLACK_WEBHOOK_ALERTS, $vars.SLACK_WEBHOOK_STATUS) and uses incorrect Convex paths (/api/mutation)
**Why it happens:** Phase 1 was built before Telegram decision and before HTTP Actions
**How to avoid:** Full replacement of the workflow, not incremental patching. Replace all Slack nodes with Telegram queue insertions via Convex HTTP endpoint.
**Warning signs:** Any reference to Slack or `/api/mutation` in n8n workflows

## Code Examples

### Calling Convex from n8n (HTTP Request node)
```javascript
// n8n HTTP Request node configuration
// URL: {{ $vars.SAAN_CONVEX_SITE_URL }}/api/call
// Method: POST
// Headers: { "X-SAAN-Secret": "{{ $vars.SAAN_API_SECRET }}" }
// Body (JSON):
{
  "function": "agents:getAllAgentsState",
  "args": {}
}

// Response:
// { "ok": true, "data": [{ "agentId": "monitor", "status": "idle", ... }] }
```

### telegramQueue Schema Addition
```typescript
// Add to SAAN/convex/schema.ts
telegramQueue: defineTable({
  messageType: v.string(),           // "alert" | "report" | "task" | "system"
  agentId: v.string(),
  priority: v.string(),              // "critical" | "high" | "normal" | "low"
  content: v.string(),               // HTML formatted, ready to send
  status: v.string(),                // "pending" | "consolidated" | "sent" | "failed"
  retryCount: v.number(),
  createdAt: v.number(),
  sentAt: v.optional(v.number()),
  consolidationWindow: v.optional(v.string()),
  inlineKeyboard: v.optional(v.any()), // Optional inline keyboard markup
})
  .index("by_status_priority", ["status", "priority"])
  .index("by_status_created", ["status", "createdAt"])
  .index("by_consolidation", ["consolidationWindow", "status"]),
```

### Inline Keyboard for Human-in-the-Loop
```javascript
// n8n Code node: build inline keyboard for task approval
const taskId = $json.data._id;
const keyboard = {
  inline_keyboard: [
    [
      { text: "✅ Aprobar", callback_data: `approve:${taskId}` },
      { text: "❌ Rechazar", callback_data: `reject:${taskId}` },
      { text: "⏳ Posponer", callback_data: `postpone:${taskId}` }
    ]
  ]
};

// Send via Telegram node with reply_markup = keyboard
```

### answerCallbackQuery Pattern
```javascript
// n8n: After processing a callback, ALWAYS answer the query
// to dismiss the loading spinner on Telegram client
// Use Telegram node → Operation: Answer Callback Query
// Query ID: {{ $json.callback_query.id }}
// Text: "Tarea aprobada ✅" (optional toast message)
```

### Circuit Breaker Atomic Check (Convex mutation)
```typescript
// In a new function or enhanced createTask
export const createTaskWithBreaker = mutation({
  args: {
    fromAgent: v.string(),
    toAgent: v.string(),
    taskType: v.string(),
    priority: v.string(),
    payload: v.any(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    // Get agent state for limits
    const agentState = await ctx.db
      .query("agentsState")
      .withIndex("by_agent_id", (q) => q.eq("agentId", args.fromAgent))
      .unique();

    const limit = agentState?.metadata?.circuitBreaker?.hourlyLimit ?? 10;

    // Count tasks in last hour
    const recentTasks = await ctx.db
      .query("agentTasks")
      .withIndex("by_from_agent", (q) => q.eq("fromAgent", args.fromAgent))
      .collect();
    const count = recentTasks.filter(t => t.createdAt > oneHourAgo).length;

    if (count >= limit) {
      // Trip the breaker
      if (agentState) {
        const meta = agentState.metadata || {};
        const cb = meta.circuitBreaker || {};
        await ctx.db.patch(agentState._id, {
          status: "paused",
          metadata: {
            ...meta,
            circuitBreaker: {
              ...cb,
              tripCount: (cb.tripCount || 0) + 1,
              trippedAt: Date.now(),
              resetAt: null,
              hourlyLimit: limit,
            }
          }
        });
      }
      throw new Error(`Circuit breaker tripped: ${args.fromAgent} exceeded ${limit} tasks/hour`);
    }

    // Create the task
    return await ctx.db.insert("agentTasks", {
      fromAgent: args.fromAgent,
      toAgent: args.toAgent,
      taskType: args.taskType,
      priority: args.priority,
      status: "pending",
      payload: args.payload,
      createdAt: Date.now(),
      expiresAt: args.expiresAt,
    });
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Convex /api/mutation endpoint | httpRouter + httpAction custom routes | Always (client path never worked for external HTTP) | Must use *.convex.site with httpRouter |
| Slack webhooks for alerts | Telegram Bot API via n8n nodes | Project decision (Phase 2) | Full orchestrator replacement needed |
| Individual REST routes per function | Generic dispatcher with allowlist | Project decision (CONTEXT.md) | Single endpoint, extensible without code changes |

**Deprecated/outdated in existing code:**
- `saan-orchestrator.json`: Uses `$vars.SLACK_WEBHOOK_ALERTS` and `$vars.SLACK_WEBHOOK_STATUS` -- must become Telegram queue insertions
- `saan-orchestrator.json`: Uses `$vars.SAAN_CONVEX_URL + "/api/mutation"` -- must become `$vars.SAAN_CONVEX_SITE_URL + "/api/call"`

## Open Questions

1. **Convex deployment name for *.convex.site URL**
   - What we know: The SAAN deployment exists but exact deployment name (e.g., `happy-animal-123`) is needed for the HTTP endpoint URL
   - What's unclear: Whether the user has already deployed SAAN to Convex (STATE.md says "SAAN Convex deployment not yet created")
   - Recommendation: User must run `cd SAAN && npx convex dev` to create deployment before testing HTTP Actions. Store the deployment name as n8n variable.

2. **Telegram Bot Token**
   - What we know: Bot must be created via @BotFather
   - What's unclear: Whether user has already created the bot
   - Recommendation: First plan task should include bot creation steps as prerequisite, with token stored in n8n credentials

3. **n8n Telegram Trigger duplicate callback issue**
   - What we know: GitHub issue #15483 reports duplicate trigger fires for callback_query
   - What's unclear: Whether this is fixed in current n8n Railway version
   - Recommendation: Add idempotency guard regardless (check last processed callback ID)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected -- SAAN has no test infrastructure |
| Config file | none -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | HTTP endpoint responds to POST /api/call | smoke | `curl -X POST https://<deployment>.convex.site/api/call -H "X-SAAN-Secret: test" -H "Content-Type: application/json" -d '{"function":"agents:getAllAgentsState","args":{}}'` | -- Wave 0 |
| INFRA-02 | Requests without valid secret get 401 | smoke | `curl -X POST https://<deployment>.convex.site/api/call -H "Content-Type: application/json" -d '{"function":"agents:getAllAgentsState","args":{}}' -w "%{http_code}"` | -- Wave 0 |
| INFRA-03 | Telegram bot responds to /help | manual-only | Send /help in Telegram chat with bot | N/A |
| INFRA-04 | Switch node routes commands correctly | manual-only | Test each command in Telegram, verify n8n execution log | N/A |
| INFRA-05 | /status, /help, /health return correct data | manual-only | Send each command, verify response format | N/A |
| INFRA-06 | telegramQueue drains pending messages | smoke | Insert test message in queue via Convex, verify it arrives in Telegram within 10s | -- Wave 0 |
| INFRA-07 | Circuit breaker trips at limit | smoke | Create tasks until limit, verify next is rejected | -- Wave 0 |

### Sampling Rate
- **Per task commit:** Manual smoke test of modified component
- **Per wave merge:** Run all curl smoke tests + manual Telegram verification
- **Phase gate:** All 7 INFRA requirements verified manually before /gsd:verify-work

### Wave 0 Gaps
- [ ] No test framework installed -- tests for this phase are curl-based smoke tests and manual Telegram interaction
- [ ] SAAN Convex deployment must exist before any HTTP test can run
- [ ] Telegram bot must be created via @BotFather before manual testing
- [ ] n8n variables must be configured: SAAN_CONVEX_SITE_URL, SAAN_API_SECRET, TELEGRAM_CHAT_ID

## Sources

### Primary (HIGH confidence)
- [Convex HTTP Actions docs](https://docs.convex.dev/functions/http-actions) - httpRouter, httpAction, ctx.runMutation/runQuery, environment variables, *.convex.site domain
- [Convex Environment Variables](https://docs.convex.dev/production/environment-variables) - process.env access in functions, 100 variable limit, 40 char name limit
- [Telegram Bot API](https://core.telegram.org/bots/api) - sendMessage, InlineKeyboardMarkup, answerCallbackQuery, setWebhook, HTML parse_mode
- [Telegram Bots FAQ](https://core.telegram.org/bots/faq) - Rate limits: 30 msg/sec global, 1 msg/sec per chat, 20 msg/min per group
- [n8n Telegram Trigger docs](https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.telegramtrigger/) - Webhook auto-setup, callback_query handling
- [n8n Telegram node docs](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.telegram/) - Send message, answer callback query operations

### Secondary (MEDIUM confidence)
- [n8n Telegram callback operations](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.telegram/callback-operations/) - answerCallbackQuery node operation
- [n8n GitHub #15483](https://github.com/n8n-io/n8n/issues/15483) - Duplicate callback_query trigger issue
- [n8n community: inline keyboard callbacks](https://community.n8n.io/t/n8n-telegram-inline-keyboard-callback-query-workflow-example/112588) - Workflow patterns

### Tertiary (LOW confidence)
- None -- all findings verified with primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Convex httpRouter and Telegram Bot API are well-documented, stable APIs
- Architecture: HIGH - Generic endpoint pattern is proven; n8n Telegram nodes are battle-tested
- Pitfalls: HIGH - Known issues documented in official sources and GitHub issues
- Circuit breaker: MEDIUM - Race condition mitigation via atomic mutation is standard Convex pattern but untested in this specific context

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable APIs, 30-day validity)

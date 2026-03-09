---
phase: 2
slug: http-layer-telegram-bot
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | curl smoke tests + manual Telegram verification |
| **Config file** | none — no test framework for this phase |
| **Quick run command** | `curl -s -X POST https://<deployment>.convex.site/api/call -H "X-SAAN-Secret: $SAAN_API_SECRET" -H "Content-Type: application/json" -d '{"function":"agents:getAllAgentsState","args":{}}' \| jq .ok` |
| **Full suite command** | `bash SAAN/tests/smoke-phase2.sh` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run curl smoke test against modified endpoint/function
- **After every plan wave:** Run full smoke script + manual Telegram command verification
- **Before `/gsd:verify-work`:** All 7 INFRA requirements verified
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | INFRA-01 | smoke | `curl -s -X POST .../api/call -H "X-SAAN-Secret: ..." -d '{"function":"agents:getAllAgentsState","args":{}}'` | -- W0 | pending |
| 02-01-02 | 01 | 1 | INFRA-02 | smoke | `curl -s -X POST .../api/call -d '{"function":"agents:getAllAgentsState","args":{}}' -w "%{http_code}"` (expect 401) | -- W0 | pending |
| 02-01-03 | 01 | 1 | INFRA-07 | smoke | Create tasks until limit, verify rejection | -- W0 | pending |
| 02-02-01 | 02 | 1 | INFRA-06 | smoke | Insert message in telegramQueue, verify delivery in Telegram | -- W0 | pending |
| 02-03-01 | 03 | 2 | INFRA-03 | manual | Send /help to bot in Telegram | N/A | pending |
| 02-03-02 | 03 | 2 | INFRA-04 | manual | Test each command, verify n8n execution log | N/A | pending |
| 02-03-03 | 03 | 2 | INFRA-05 | manual | Send /status, /help, /health — verify responses | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `SAAN/tests/smoke-phase2.sh` — curl-based smoke tests for HTTP endpoints
- [ ] SAAN Convex deployment must be active (`cd SAAN && npx convex dev`)
- [ ] Telegram bot created via @BotFather with token stored in n8n credentials
- [ ] n8n variables configured: `SAAN_CONVEX_SITE_URL`, `SAAN_API_SECRET`, `TELEGRAM_CHAT_ID`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Telegram bot responds to /help | INFRA-03, INFRA-05 | Requires real Telegram interaction | Send /help to bot, verify HTML-formatted response |
| Telegram bot responds to /status | INFRA-05 | Requires real Telegram interaction | Send /status, verify agent states listed |
| Telegram bot responds to /health | INFRA-05 | Requires real Telegram interaction | Send /health, verify service health data |
| Switch node routes correctly | INFRA-04 | Requires n8n execution log review | Send each command, check n8n execution history |
| Inline buttons work | INFRA-05 | Requires Telegram callback interaction | Create test task, verify Approve/Reject buttons appear and work |
| Unknown command gets help | INFRA-05 | Requires Telegram interaction | Send random text, verify help suggestion |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

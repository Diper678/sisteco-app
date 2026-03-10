---
phase: 01
slug: pipeline-leads
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual + n8n workflow execution logs |
| **Config file** | none — workflows validated via n8n execution |
| **Quick run command** | `curl -s https://primary-yelp-production.up.railway.app/api/v1/workflows -H "X-N8N-API-KEY: $N8N_API_KEY"` |
| **Full suite command** | Execute each workflow manually in n8n and verify Convex data |
| **Estimated runtime** | ~60 seconds per workflow |

---

## Sampling Rate

- **After every task commit:** Verify changed files exist and are valid JSON/TS
- **After every plan wave:** Run affected workflow in n8n test mode
- **Before `/gsd:verify-work`:** Full pipeline end-to-end test
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | LEAD-01 | integration | n8n workflow test execution | TBD | pending |
| 01-01-02 | 01 | 1 | LEAD-02 | integration | Convex dashboard query | TBD | pending |
| 01-02-01 | 02 | 1 | LEAD-03 | integration | SII API test call | TBD | pending |
| 01-02-02 | 02 | 1 | LEAD-04 | integration | Gemini scoring test | TBD | pending |
| 01-03-01 | 03 | 2 | LEAD-05 | integration | Dedup test with duplicate data | TBD | pending |
| 01-03-02 | 03 | 2 | LEAD-06 | manual | Telegram/email notification check | TBD | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] Fix http.ts allowlist to include leads.ts and icpProfiles.ts functions
- [ ] Fix auth header mismatch (Authorization Bearer vs X-SAAN-Secret)
- [ ] Verify Convex deployment is active and env vars configured

*These blockers must be resolved before any workflow can execute.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PhantomBuster extraction | LEAD-01 | Requires active PB account + Sales Nav | Configure phantom, run, check n8n logs |
| SII RUT validation | LEAD-03 | Requires SimpleAPI account | Call API with known RUT, verify response |
| Telegram HOT notification | LEAD-06 | Requires bot setup | Create bot, send test, verify delivery |
| Pipeline runs 1 week | All | Time-based | Monitor n8n executions over 7 days |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

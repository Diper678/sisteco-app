---
phase: 04
slug: compliance-21719
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No test framework — vanilla JS + Convex project |
| **Config file** | none — Wave 0 creates smoke test scripts |
| **Quick run command** | `node scripts/test-compliance.js` |
| **Full suite command** | `node scripts/test-compliance.js --full` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/test-compliance.js`
- **After every plan wave:** Run `node scripts/test-compliance.js --full`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | COMP-02 | manual | Verify `docs/legal/RAT.md` exists and covers all activities | -- Wave 0 | ⬜ pending |
| 04-01-02 | 01 | 1 | COMP-04 | smoke | Query Convex leads table for baseLegal, fuenteDatos fields | -- Wave 0 | ⬜ pending |
| 04-02-01 | 02 | 1 | COMP-01 | smoke | `curl -s https://<site>/privacidad` returns 200 | -- Wave 0 | ⬜ pending |
| 04-02-02 | 02 | 1 | COMP-03 | e2e | Playwright CLI opt-out form flow | -- Wave 0 | ⬜ pending |
| 04-02-03 | 02 | 1 | COMP-03 | integration | Insert blacklisted email, verify rejection | -- Wave 0 | ⬜ pending |
| 04-03-01 | 03 | 2 | COMP-05 | integration | Insert expired lead, trigger cron, verify soft-delete | -- Wave 0 | ⬜ pending |
| 04-03-02 | 03 | 2 | COMP-03 | integration | Sheet propagation: verify row deleted after opt-out | -- Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/test-compliance.js` — smoke test script for HTTP endpoints + schema validation
- [ ] Playwright CLI flow script for opt-out form e2e test
- [ ] Manual verification checklist for RAT document completeness

*No test framework install needed — smoke tests use node built-in fetch + Convex client.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RAT covers all treatment activities | COMP-02 | Legal document review | Read RAT.md, verify each data flow (scraping, scoring, Sheet delivery, CRM sync) is documented |
| DPA template is legally sound | COMP-04 | Legal review | Read DPA template, verify covers processor obligations per Ley 21.719 Art. 15 bis |
| Privacy policy matches actual processing | COMP-01 | Legal-technical alignment | Compare privacy policy claims vs actual data flows in system |
| Badge text is accurate | COMP-01 | Marketing/legal judgment | Verify "Cumple Ley 21.719" claim matches actual compliance state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

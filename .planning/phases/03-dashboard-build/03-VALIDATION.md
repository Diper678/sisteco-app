---
phase: 3
slug: dashboard-build
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright CLI (`.claude/skills/playwright-cli/`) + manual smoke tests |
| **Config file** | `.playwright-cli/` (session directory) |
| **Quick run command** | `playwright-cli open http://localhost:3000/app/ceo.html` + visual snapshot |
| **Full suite command** | Sequential smoke: open 3 role pages + verify auth redirect + screenshot each |
| **Estimated runtime** | ~30 seconds (3 page loads + screenshots) |

---

## Sampling Rate

- **After every task commit:** Run `playwright-cli open http://localhost:3000/app/{role}.html` — visual check
- **After every plan wave:** Full smoke of 3 roles + auth redirect + mobile viewport
- **Before `/gsd:verify-work`:** All DASH-XX requirements verified green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | DASH-01 | smoke | `playwright-cli open /app/ceo.html` → verify redirect to login | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | DASH-05 | security | Login Org A → query → verify isolation | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | DASH-07 | unit | `playwright-cli network` → verify no WS | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | DASH-03 | smoke | `playwright-cli eval` KPI values != 0 | ❌ W1 | ⬜ pending |
| 03-02-02 | 02 | 2 | DASH-02 | integration | Click filter → snapshot filtered table | ❌ W1 | ⬜ pending |
| 03-02-03 | 02 | 2 | DASH-04 | integration | Click lead row → snapshot detail panel | ❌ W1 | ⬜ pending |
| 03-03-01 | 03 | 3 | DASH-02 | integration | VP assign lead → verify state change | ❌ W2 | ⬜ pending |
| 03-03-02 | 03 | 3 | DASH-04 | integration | SDR change status → verify audit trail | ❌ W2 | ⬜ pending |
| 03-04-01 | 04 | 4 | DASH-06 | visual | `playwright-cli resize 375 812` → screenshot | ❌ W4 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/auth.config.ts` — Clerk JWT validation config
- [ ] `convex/schema.ts` update — add orgId, estados, auditTrail, indices
- [ ] `shared/auth.js` — Clerk JS bootstrap (vanilla, CDN)
- [ ] `shared/convex-client.js` — ConvexHttpClient wrapper with auth refresh
- [ ] `api/gemini-query.js` — Vercel serverless proxy for Gemini
- [ ] `app/login.html` — Clerk sign-in page
- [ ] `vercel.json` — Multi-page routing config

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth popup works | DASH-01 | Requires real Google OAuth credentials | Click "Continuar con Google" on login.html, verify popup |
| PDF branded with Sisteco identity | DASH-03 (PDF) | Visual quality check for branding | Generate PDF → open → verify logo, colors, fonts |
| Gemini fallback returns useful response | Context decision | AI output quality varies | Type unknown query in command bar → check response relevance |
| ICP wizard activates n8n pipeline | Context decision | Requires live n8n instance | Complete wizard → verify n8n webhook received payload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

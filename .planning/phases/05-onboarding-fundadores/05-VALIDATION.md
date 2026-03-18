---
phase: 5
slug: onboarding-fundadores
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js scripts + manual (no jest/vitest — same pattern as Phase 4) |
| **Config file** | none — verificación via Convex CLI + curl HTTP endpoints |
| **Quick run command** | `npx convex dev --once 2>&1 | tail -5` |
| **Full suite command** | `npx convex deploy --dry-run 2>&1` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx convex dev --once 2>&1 | tail -5`
- **After every plan wave:** Run `npx convex deploy --dry-run 2>&1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | PAY-01 | schema | `npx convex dev --once` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | PAY-01 | HTTP endpoint | `curl -X POST /intake` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | PAY-02 | webhook | `curl -X POST /reveniu-webhook` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | PAY-02 | provisioning | `node scripts/provision-client.js` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | PAY-03 | trial flow | manual — ver instrucciones | manual | ⬜ pending |
| 05-03-02 | 03 | 2 | PAY-03 | rate limit | `npx convex dev --once` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 3 | PAY-04 | case study | manual — doc review | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/subscriptions.ts` — tabla subscriptions + mutations
- [ ] `convex/trialRequests.ts` — tabla trialRequests + mutations
- [ ] `convex/http.ts` — agregar rutas /intake y /reveniu-webhook
- [ ] `scripts/provision-client.js` — Clerk org creation + Convex org init

*Existing infrastructure (Convex, n8n, Sheets, Resend) ya está operativa.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Trial de 14 días con datos reales | PAY-03 | Requiere corrida real del pipeline n8n | 1. Ejecutar provisioning script 2. Verificar leads en dashboard cliente 3. Confirmar 14-day expiry en DB |
| Cobro mensual Reveniu | PAY-02 | Requiere sandbox/prod Reveniu real | 1. Crear plan en Reveniu 2. Completar checkout 3. Verificar webhook recibido 4. Verificar org activada en Convex |
| Caso de estudio documentado | PAY-04 | Output qualitativo, no automatizable | Revisar documento generado — ¿incluye métricas reales del cliente? |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

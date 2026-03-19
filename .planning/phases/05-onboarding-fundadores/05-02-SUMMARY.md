---
phase: 05-onboarding-fundadores
plan: 02
subsystem: monetizacion-webhook-emails
tags: [convex, reveniu, webhook, resend, email, onboarding, metrics]
dependency_graph:
  requires: [phase-05-01]
  provides: [reveniu-webhook, onboarding-email-module, metrics-calc, smoke-tests]
  affects: [convex/http.ts, convex/onboardingEmail.ts, scripts/test-*.js]
tech_stack:
  added: ["convex/onboardingEmail.ts", "Resend internalAction pattern", "webhook secret validation"]
  patterns: ["httpAction secret header validation", "internalAction + public action wrapper", "pure function unit testing"]
key_files:
  created:
    - convex/onboardingEmail.ts
    - scripts/test-reveniu-webhook.js
    - scripts/test-metrics.js
    - scripts/test-plan-links.js
  modified:
    - convex/http.ts (added /reveniu-webhook routes)
decisions:
  - "sendViaResend helper extraido como funcion compartida — DRY entre sendWelcomeEmail y triggerWelcomeEmail"
  - "REVENIU_LINKS hardcodeados como constantes — estas URLs son de negocio y raramente cambian"
  - "triggerWelcomeEmail como action publica con adminSecret — unico modo de llamar desde CLI via npx convex run"
  - "Webhook retorna 200 incluso en error interno — previene reintentos de Reveniu ante errores transitorios"
  - "test-metrics.js usa logica pura (sin Convex) — permite CI sin red"
metrics:
  duration_minutes: 0
  tasks_completed: 2
  files_created: 4
  files_modified: 1
  completed_date: "2026-03-19"
---

# Phase 5 Plan 2: Reveniu Webhook + Onboarding Email Module Summary

**One-liner:** Webhook /reveniu-webhook que activa subscriptions al pagar + módulo de emails de onboarding via Resend (welcome, trial expiry, payment confirmation) + 3 smoke tests.

## What Was Built

### Task 1: Reveniu Webhook + Email Module (commit `9d59be6`)

**convex/http.ts** — 2 nuevas rutas:
- `OPTIONS /reveniu-webhook` — CORS preflight (204)
- `POST /reveniu-webhook` — Verifica `Reveniu-Secret-Key` header vs `REVENIU_WEBHOOK_SECRET` env var. En eventos `subscription_activated`, `payment_successful`, `subscription_renewed` → llama `internal.subscriptions.activateFromWebhook`. Retorna 200 incluso ante errores (webhook resilience).

**convex/onboardingEmail.ts** — Módulo nuevo completo:

| Export | Tipo | Propósito |
|--------|------|-----------|
| `REVENIU_LINKS` | const | 3 checkout links hardcodeados (base, crecimiento, enterprise) |
| `PLAN_INFO` | const | Nombres y precios CLP/USD por plan |
| `sendWelcomeEmail` | internalAction | Email de bienvenida al crear trial (llamado internamente) |
| `triggerWelcomeEmail` | action (público) | Wrapper con adminSecret — callable desde CLI via `npx convex run` |
| `sendTrialExpiryReminder` | internalAction | Recordatorio N días antes del vencimiento con CTA Reveniu |
| `sendPaymentConfirmation` | internalAction | Confirmación de pago exitoso, pipeline activado |

Todos los emails usan `sendViaResend()` helper compartido: Resend API, `from: noreply@sisteco.cl`, branding Sisteco (#F8F7F5, #c5ed36).

### Task 2: Smoke Tests (commit `0c0e489`)

| Script | Tests | Resultado |
|--------|-------|-----------|
| `scripts/test-plan-links.js` | 6 assertions — 3 links Reveniu en .env | 6/6 PASS |
| `scripts/test-metrics.js` | 18 assertions — MRR, churn, LTV, edge cases | 18/18 PASS |
| `scripts/test-reveniu-webhook.js` | 2-3 assertions — 401 sin secret, 401 secret inválido, 200 con secret correcto | Requiere red |

## Verification Results

```
node scripts/test-plan-links.js:
  PASS: REVENIU_LINK_BASE_MONTHLY existe
  PASS: REVENIU_LINK_BASE_MONTHLY apunta a app.reveniu.com
  PASS: REVENIU_LINK_GROWTH_MONTHLY existe
  PASS: REVENIU_LINK_GROWTH_MONTHLY apunta a app.reveniu.com
  PASS: REVENIU_LINK_ENTERPRISE_MONTHLY existe
  PASS: REVENIU_LINK_ENTERPRISE_MONTHLY apunta a app.reveniu.com
  === Resultado: 6 passed, 0 failed ===

node scripts/test-metrics.js:
  Test 1-5: MRR, churnRate, LTV, edge cases
  === Resultado: 18 passed, 0 failed ===
```

All 13 Task 1 acceptance criteria: PASS
All 8 Task 2 acceptance criteria: PASS

## Deviations from Plan

- `/reveniu-webhook` fue implementado en sesión anterior (commit `9d59be6`) — esta sesión solo creó los smoke tests faltantes
- Task 1 ya estaba 100% completo; Task 2 ejecutado ahora

## Decisions Made

1. **sendViaResend helper compartido** — La lógica de envío via Resend se extrae como función privada para evitar duplicación entre `sendWelcomeEmail` (internal) y `triggerWelcomeEmail` (public). Mismo patrón que `buildWelcomeEmailHtml`.

2. **Webhook retorna 200 en error** — El handler de Reveniu captura todos los errores y siempre retorna 200. Esto previene reintentos automáticos de Reveniu que podrían causar duplicaciones de activación.

3. **test-metrics.js sin dependencias de red** — Los tests de métricas prueban la lógica pura (misma que `subscriptions.ts getMetrics`) sin necesidad de conexión a Convex. Permite correr en CI sin credenciales.

## Git Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 9d59be6 | feat(05-02): add Reveniu webhook endpoint and onboarding email module |
| Task 2 | 0c0e489 | test(05-02): add smoke tests for Reveniu webhook, metrics, and plan links |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| convex/http.ts: `/reveniu-webhook` POST + OPTIONS | FOUND |
| convex/http.ts: `Reveniu-Secret-Key` header check | FOUND |
| convex/http.ts: `internal.subscriptions.activateFromWebhook` | FOUND |
| convex/onboardingEmail.ts: `REVENIU_LINKS` + `PLAN_INFO` | FOUND |
| convex/onboardingEmail.ts: `sendWelcomeEmail` internalAction | FOUND |
| convex/onboardingEmail.ts: `triggerWelcomeEmail` action (public) | FOUND |
| convex/onboardingEmail.ts: `sendTrialExpiryReminder` internalAction | FOUND |
| convex/onboardingEmail.ts: `sendPaymentConfirmation` internalAction | FOUND |
| convex/onboardingEmail.ts: `api.resend.com` + `noreply@sisteco.cl` | FOUND |
| scripts/test-plan-links.js: 6/6 PASS | ✅ |
| scripts/test-metrics.js: 18/18 PASS | ✅ |
| scripts/test-reveniu-webhook.js: exists + pattern checks | FOUND |
| 05-02-SUMMARY.md: CREADO | ✅ |

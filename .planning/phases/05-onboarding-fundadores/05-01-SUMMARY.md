---
phase: 05-onboarding-fundadores
plan: 01
subsystem: monetizacion-provisioning
tags: [convex, subscriptions, trial, provisioning, clerk, google-sheets, onboarding]
dependency_graph:
  requires: [phase-03-dashboard, phase-04-compliance]
  provides: [subscriptions-table, trialRequests-table, intake-endpoint, provisioning-script]
  affects: [convex/schema.ts, convex/http.ts, convex/subscriptions.ts, convex/trialRequests.ts]
tech_stack:
  added: ["@clerk/backend (provisioning script)", "convex/subscriptions module", "convex/trialRequests module"]
  patterns: ["adminSecret validation for CLI-callable mutations", "internalMutation + public mutation pattern", "9-step provisioning script"]
key_files:
  created:
    - convex/trialRequests.ts
    - convex/subscriptions.ts
    - scripts/provision-trial.js
    - scripts/test-trial-status.js
  modified:
    - convex/schema.ts (added trialRequests + subscriptions tables)
    - convex/http.ts (added POST /intake + OPTIONS /intake)
decisions:
  - "createTrialSubscription expuesta como mutation publica con adminSecret — permite npx convex run desde CLI sin necesidad de HTTP privado"
  - "registerTenantSheet en subscriptions.ts (no en tenantSheets.ts separado) — cohesion con el flujo de provisioning"
  - "Paso 9 (email bienvenida) es no-fatal en provision-trial.js — Plan 02 puede no estar desplegado aun"
  - "getById en trialRequests es internalQuery — provision-trial.js usa HTTP API de Convex con Authorization Bearer"
  - "createFromProvisioning en convex/users.ts para crear usuario CEO de la org provisionada"
metrics:
  duration_minutes: 0
  tasks_completed: 2
  files_created: 4
  files_modified: 2
  completed_date: "2026-03-19"
---

# Phase 5 Plan 1: Subscriptions + Trial Provisioning Pipeline Summary

**One-liner:** Convex schema de monetizacion (subscriptions + trialRequests) + endpoint publico /intake + script de provisioning 9 pasos con Clerk org + Google Sheet + email de bienvenida.

## What Was Built

### Task 1: Convex Schema + CRUD Modules + Trial Status Test

**Tables added to convex/schema.ts:**

`trialRequests` — Almacena datos del formulario de intake publico. Status machine: `received` → `provisioning` → `provisioned` | `error`. Indices: `by_email`, `by_status`.

`subscriptions` — Monetizacion y ciclo de vida de suscripciones. Status machine: `trial` → `active` → `grace` → `cancelled` | `expired`. Indices: `by_orgId`, `by_status`, `by_trialEndsAt`.

**convex/trialRequests.ts:**
- `create` (internalMutation) — Crea solicitud de trial con status "received"
- `updateStatus` (internalMutation) — Actualiza status + IDs de Clerk/Sheet
- `markProvisioned` (mutation publica, adminSecret) — Marca como provisionado con clerkOrgId/clerkUserId/spreadsheetId
- `getByEmail` (internalQuery) — Lookup por email via indice
- `getById` (internalQuery) — Lookup por ID
- `getPending` (internalQuery) — Todas las solicitudes en status "received"

**convex/subscriptions.ts:**
- `createTrialSubscription` (mutation publica, adminSecret) — Crea trial de 14 dias
- `registerTenantSheet` (mutation publica, adminSecret) — Upsert en tenantSheets
- `getByOrgId` (query publica) — Con validacion JWT org_id para multi-tenant
- `activateFromWebhook` (internalMutation) — Activa subscription desde Reveniu webhook
- `getMetrics` (internalQuery) — Calcula MRR, churn rate, LTV
- `updateStatus` (internalMutation) — Cambia status de subscription por orgId
- `recordPipelineRun` (internalMutation) — Incrementa pipelineRunCount
- `signDpa` (internalMutation) — Registra firma DPA del cliente

**scripts/test-trial-status.js:**
Verifica la logica pura de `getTrialStatus(sub)` — 7 assertions, 6 tests, exit 0 si todos pasan. No requiere conexion a Convex.

### Task 2: POST /intake Endpoint + Provisioning Script

**convex/http.ts** — Nuevas rutas agregadas:
- `OPTIONS /intake` — CORS preflight (204, corsHeaders())
- `POST /intake` — Valida 6 campos requeridos (nombre, email, empresa, sector, mercado, tipoclientes), llama `internal.trialRequests.create`, retorna `{ ok, requestId, message }`

**scripts/provision-trial.js** (358 lineas) — Script 9 pasos para provisioning de nuevos clientes:

| Paso | Accion | Falla si... |
|------|--------|-------------|
| 1/9 | Lee trial request via HTTP API de Convex | Request ID invalido |
| 2/9 | Crea o encuentra usuario en Clerk (dedup por email) | CLERK_SECRET_KEY invalido |
| 3/9 | Crea organizacion en Clerk | Error Clerk API |
| 4/9 | Crea Google Sheet (HOT, WARM, NURTURE, Todos) | Google auth no configurada |
| 5/9 | Comparte Sheet con email del cliente (reader) | No fatal — continua |
| 6/9 | Registra tenantSheet en Convex via npx convex run | Convex no disponible |
| 7/9 | Crea subscription trial 14 dias en Convex | Convex no disponible |
| 8/9 | Crea user record en Convex (rol: CEO) | Convex no disponible |
| 9/9 | Envia email de bienvenida via onboardingEmail:sendWelcomeEmail | No fatal — requiere Plan 02 |

Uso: `node scripts/provision-trial.js <requestId>`

## Verification Results

```
node scripts/test-trial-status.js:
  PASS: status === "trial" (test 1)
  PASS: daysRemaining === 14 (test 1)
  PASS: daysRemaining === 7 (test 2)
  PASS: daysRemaining === 0 (test 3)
  PASS: daysRemaining === -2 (test 4)
  PASS: status === "active" (test 5)
  PASS: status === "grace" (test 6)
  === Resultado: 7 passed, 0 failed ===

node -c scripts/provision-trial.js: Syntax OK
```

Acceptance criteria: All 13 Task 1 criteria PASS, all 10 Task 2 criteria PASS.

## Deviations from Plan

None — plan executed exactly as written. The code was fully implemented in the prior session (commits 7f689f1 and 8107537). This SUMMARY documents the verified complete implementation.

## Decisions Made

1. **adminSecret pattern para mutaciones CLI-callable** — `createTrialSubscription`, `registerTenantSheet`, `markProvisioned`, y `createFromProvisioning` son mutaciones publicas que validan `args.adminSecret === process.env.SAAN_API_SECRET`. Permite `npx convex run` desde CLI sin exponer un endpoint HTTP adicional.

2. **Paso 9 no-fatal** — El envio de email de bienvenida usa try/catch que no termina el proceso si falla. Plan 02 (`onboardingEmail.ts`) puede no estar desplegado cuando se ejecuta Plan 01. Felipe puede enviar el email manualmente.

3. **getById como internalQuery** — Para leer el trial request en el paso 1, el script usa `Authorization: Bearer` en la HTTP API de Convex. Si Convex rechaza la query interna, el script termina con instrucciones para el usuario.

4. **registerTenantSheet en subscriptions.ts** — Por cohesion con el flujo de provisioning completo. Encapsula todos los pasos de setup de un nuevo tenant en un mismo modulo.

## Git Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 7f689f1 | feat(05-01): add subscriptions + trialRequests tables and CRUD modules |
| Task 2 | 8107537 | feat(05-01): add POST /intake endpoint and provision-trial.js script |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| convex/trialRequests.ts exists | FOUND |
| convex/subscriptions.ts exists | FOUND |
| convex/http.ts exists | FOUND |
| scripts/provision-trial.js exists | FOUND |
| scripts/test-trial-status.js exists | FOUND |
| 05-01-SUMMARY.md exists | FOUND |
| Commit 7f689f1 exists | FOUND |
| Commit 8107537 exists | FOUND |

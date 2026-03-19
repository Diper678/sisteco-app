---
phase: 05-onboarding-fundadores
plan: 03
subsystem: trial-ui-dpa
tags: [dashboard, trial-banner, dpa, reveniu, vanilla-js, convex]
dependency_graph:
  requires: [phase-05-01, phase-05-02]
  provides: [trial-banner-component, dpa-acceptance-modal, acceptDpa-mutation]
  affects: [shared/trial-banner.js, shared/dpa-acceptance.js, convex/subscriptions.ts, app/*.html]
tech_stack:
  added: ["shared/trial-banner.js", "shared/dpa-acceptance.js", "acceptDpa public mutation"]
  patterns: ["vanilla JS IIFE module", "window.* global API", "requestAnimationFrame for DOM dim", "async Convex mutation in modal"]
key_files:
  created:
    - shared/trial-banner.js
    - shared/dpa-acceptance.js
  modified:
    - convex/subscriptions.ts (added acceptDpa public mutation)
    - app/ceo.html (script tags + SistecoTrialBanner.init())
    - app/vp-ventas.html (script tags + SistecoTrialBanner.init())
    - app/sdr.html (script tags + SistecoTrialBanner.init())
decisions:
  - "dpa-acceptance.js cargado ANTES de trial-banner.js — banner usa window.SistecoDPA al hacer click CTA"
  - "Fallo en mutateConvex(acceptDpa) es non-blocking — redirige al checkout de todas formas"
  - "dimDashboardContent usa requestAnimationFrame para no pelear con renders de GSAP"
  - "acceptDpa usa JWT identity (no adminSecret) — el usuario ya esta logueado en el dashboard"
  - "REVENIU_LINKS hardcodeados en trial-banner.js (sincronizados con onboardingEmail.ts)"
metrics:
  duration_minutes: 0
  tasks_completed: 1
  files_created: 2
  files_modified: 4
  completed_date: "2026-03-19"
---

# Phase 5 Plan 3: Trial Banner + DPA Acceptance Summary

**One-liner:** Banner de trial en los 3 dashboards con 5 estados + modal DPA que registra aceptación en Convex antes de redirigir al checkout Reveniu.

## What Was Built

### Task 1: Trial Banner + DPA Components (commit `7b8233d`)

**shared/trial-banner.js** (255 líneas) — `window.SistecoTrialBanner.init()`:

| Estado sub | Estilo | Texto | CTA |
|-----------|--------|-------|-----|
| `trial` (días > 0) | Verde #f0ffd9, borde #c5ed36 | "Trial gratuito — Quedan X dias" | "Contratar ahora" → DPA modal |
| `trial` (días ≤ 0) | Rojo #fff0f0, borde #f44336 | "Tu trial vencio" | "Ver planes" → Reveniu |
| `grace` | Naranja #fff3e0, borde #ff9800 | "Tu pago fallo..." | "Actualizar pago" → Reveniu |
| `expired` | Rojo #fff0f0, borde #f44336 | "Tu trial vencio" | "Ver planes" → Reveniu |
| `active` | Sin banner | — | — |
| `paused` | Gris #f5f5f5 | "Cuenta pausada..." | Sin CTA |

- Banner insertado como primer hijo de `document.body`
- Estado `expired`/`trial-vencido`: opaca dashboard al 50% con `pointerEvents: none`
- REVENIU_LINKS hardcodeados (sincronizados con `convex/onboardingEmail.ts`)

**shared/dpa-acceptance.js** (183 líneas) — `window.SistecoDPA.showAcceptanceModal(plan, onAccepted)`:
- Modal overlay con branding Sisteco (#F8F7F5 bg, #c5ed36 accent)
- Texto legal referencia Ley 21.719
- Link a `/privacidad` (política completa)
- Muestra precio del plan (CLP con IVA)
- Checkbox obligatorio antes de activar botón "Continuar al pago"
- Llama `mutateConvex('subscriptions:acceptDpa', { dpaVersion: 'v1.0-2026-03-15' })` al aceptar
- Si falla Convex: continúa al checkout de todas formas (no-blocking)

**convex/subscriptions.ts** — nueva `acceptDpa` mutation pública:
- Autentica via `getUserIdentity()` (JWT Clerk con `org_id`)
- Busca subscription por `orgId` via índice `by_orgId`
- Escribe `dpaSignedAt`, `dpaVersion`, `updatedAt`

**HTML dashboards** — 3 archivos inyectados:
- `<script src="../shared/dpa-acceptance.js">` + `<script src="../shared/trial-banner.js">` después de pdf-report.js
- `SistecoTrialBanner.init()` en `window.load` después de `initAuth()`

## Verification Results

```
Acceptance criteria:
  ✅ shared/trial-banner.js: 255 líneas (> 60)
  ✅ REVENIU_LINKS: presente (2 occurrencias)
  ✅ daysRemaining: presente (3 occurrencias)
  ✅ SistecoTrialBanner: presente
  ✅ 5 estados: trial, grace, expired, active, paused — todos encontrados
  ✅ shared/dpa-acceptance.js: 183 líneas (> 40)
  ✅ SistecoDPA: presente (2 occurrencias)
  ✅ subscriptions:acceptDpa: presente
  ✅ Ley 21.719: presente (2 occurrencias)
  ✅ app/ceo.html: trial-banner.js + dpa-acceptance.js
  ✅ app/vp-ventas.html: trial-banner.js + dpa-acceptance.js
  ✅ app/sdr.html: trial-banner.js + dpa-acceptance.js
  ✅ convex/subscriptions.ts: export const acceptDpa = mutation(
  ✅ npx convex dev --once: OK (1.85s)

Task 2 (checkpoint humano): PENDIENTE — requiere verificacion visual en browser
```

## Deviations from Plan

- Script path: `../shared/` (no `/shared/`) — los HTML están en `app/`, shared en la raíz del proyecto, no en `app/shared/`
- `dpa-acceptance.js` cargado antes de `trial-banner.js` para que `window.SistecoDPA` esté disponible cuando el banner lo llama en el CTA click

## Decisions Made

1. **Orden de carga: dpa-acceptance antes de trial-banner** — El banner llama `window.SistecoDPA.showAcceptanceModal()` en el onClick del CTA. Si trial-banner.js carga primero, `window.SistecoDPA` podría no existir al hacer click (aunque en la práctica el click es tardío). Mejor garantizar el orden.

2. **acceptDpa non-blocking en DPA modal** — Si falla la mutation de Convex (token expirado, sin red), el modal igual llama `onAccepted()` y redirige al checkout. El DPA de Reveniu ya tiene su propio mecanismo de aceptación — Convex es secundario.

3. **dimDashboardContent con requestAnimationFrame** — Para no interferir con las animaciones GSAP que corren al cargar el dashboard. El dimming espera al siguiente frame de render.

## Git Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 7b8233d | feat(05-03): add trial banner, DPA acceptance modal, and acceptDpa mutation |
| Task 2 | PENDIENTE | (checkpoint humano — verificación visual) |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| shared/trial-banner.js: 5 estados | ✅ |
| shared/dpa-acceptance.js: Ley 21.719 + acceptDpa | ✅ |
| app/ceo.html: scripts inyectados | ✅ |
| app/vp-ventas.html: scripts inyectados | ✅ |
| app/sdr.html: scripts inyectados | ✅ |
| convex/subscriptions.ts: acceptDpa mutation | ✅ |
| npx convex dev --once: compilación OK | ✅ |
| 05-03-SUMMARY.md: CREADO | ✅ |

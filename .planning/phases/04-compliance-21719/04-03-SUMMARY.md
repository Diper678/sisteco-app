---
phase: 04-compliance-21719
plan: 03
subsystem: compliance-retention
tags: [compliance, ley-21719, retention, cron, dashboard, smoke-test]
dependency_graph:
  requires: [04-01]
  provides: [retention-lifecycle, privacy-footer, compliance-smoke-tests]
  affects: [convex/schema.ts, mockups/ceo.html, mockups/vp-ventas.html, mockups/sdr.html]
tech_stack:
  added: [convex/cronJobs]
  patterns: [internalMutation, daily-cron, batch-processing, pii-anonymization]
key_files:
  created:
    - convex/retention.ts
    - convex/crons.ts
    - scripts/test-compliance.js
  modified:
    - mockups/ceo.html
    - mockups/vp-ventas.html
    - mockups/sdr.html
decisions:
  - "Retention scan uses by_fechaExpiracion index then filters complianceStatus in handler — Convex no soporta condicion compuesta en un solo indice"
  - "hardDeleteExpired hace dos queries separadas (anonimizado + opt_out) y las combina — evita full-scan"
  - "Crons a 03:00 y 04:00 UTC (00:00/01:00 Chile) — ventana nocturna, minimal interference con usuarios activos"
  - "Smoke test script usa ES modules (import/export) con node --experimental o top-level await IIFE"
metrics:
  duration: "~5 minutos"
  completed: "2026-03-16"
  tasks_completed: 3
  files_created: 3
  files_modified: 3
requirements:
  - COMP-05
  - COMP-01
---

# Phase 04 Plan 03: Retention Lifecycle and Compliance Testing Summary

Daily cron retention system (24-month expiry, 30-day grace, 36-month ceiling) with PII anonymization, dashboard privacy footer on all three views, and smoke test script covering all COMP requirements.

## Objective

Implement automated data retention lifecycle required by COMP-05 (Ley 21.719 Art. 14 duty to suppress obsolete data), add a visible privacy link to all dashboard pages per COMP-01 Area 1.2, and create a reusable smoke test script for compliance verification.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create retention mutations and cron jobs | `666427c` | convex/retention.ts, convex/crons.ts |
| 2 | Add privacy policy footer link to dashboard pages | `43fdcda` | mockups/ceo.html, mockups/vp-ventas.html, mockups/sdr.html |
| 3 | Create compliance smoke test script | `1a94977` | scripts/test-compliance.js |

## What Was Built

### convex/retention.ts

Three internal mutations implementing the full retention lifecycle:

- **`scanExpiredLeads`** — Queries `by_fechaExpiracion` index for leads past their expiry date, filters out terminal states (opt_out, eliminado, anonimizado), and for each expired lead: sets `complianceStatus: "anonimizado"`, overwrites PII (`contacto: "[EXPIRADO]"`, `email: "expired-{id}@retention.local"`, telefono/linkedinUrl: undefined), schedules hard delete at `now + 30 days`, appends audit trail entry with `usuarioNombre: "Retention Cron"`.

- **`hardDeleteExpired`** — Queries leads with `complianceStatus: "anonimizado"` or `"opt_out"` where `hardDeleteScheduledAt < now`. Calls `ctx.db.delete()` permanently. Batches to 100 per run.

- **`updateInteraction`** — Called when real interaction occurs (email open, call, meeting). Recalculates expiry as `min(now + 24months, discoveredAt + 36months)`. Skips terminal states.

### convex/crons.ts

Two daily cron jobs:
- `retention-scan` at 03:00 UTC (00:00 Chile) → `internal.retention.scanExpiredLeads`
- `hard-delete-batch` at 04:00 UTC (01:00 Chile) → `internal.retention.hardDeleteExpired`

### Privacy Footer (3 dashboard pages)

Fixed-position footer (z-index: 10, bottom: 0) with 11px/color:#999 minimal styling on all three dashboard views (CEO, VP Ventas, SDR). Links to `/privacidad` and `/privacidad/derechos`, plus text "Sisteco cumple Ley 21.719".

### scripts/test-compliance.js

Smoke test script (Node.js, no external deps, ES modules) covering:
- Test 1: `/privacidad` returns 200 with privacy content
- Test 2: `/opt-out` form accessible (200, has email field)
- Test 3: POST `/opt-out` returns `{ ok: true }`
- Test 4: POST `/derechos` ARCO-POL returns `{ ok: true }`
- Test 5: OPTIONS `/opt-out` returns CORS headers
- Test 6: Local file existence check for RAT.md, test-ponderacion.md, EIPD-scoring-ia.md, DPA-template.md, politica-privacidad.md
- Test 7: `mockups/ceo.html` contains "Politica de Privacidad" link
- `--full` flag: Tests 8-9 (one-click unsubscribe + invalid token handling)

Exit code 0 = all pass, 1 = any fail.

## Verification Results

```
convex/retention.ts — created, Convex typecheck passes
convex/crons.ts — created, Convex typecheck passes
RETENTION_MS = 24 months, MAX_RETENTION_MS = 36 months, GRACE_PERIOD_MS = 30 days
Crons at hourUTC: 3 and hourUTC: 4
mockups/ceo.html, vp-ventas.html, sdr.html — all contain "Politica de Privacidad" and "/privacidad"
scripts/test-compliance.js — --help runs successfully, exits 0
```

## Deviations from Plan

None — plan executed exactly as written.

## Requirements Satisfied

- **COMP-05**: Automated data purge via daily cron jobs. Leads without interaction for 24+ months are anonymized and scheduled for permanent deletion after 30-day grace period.
- **COMP-01** (Area 1.2): Visible privacy policy link present in all three dashboard views (CEO, VP Ventas, SDR).

## Self-Check: PASSED

```
convex/retention.ts: FOUND
convex/crons.ts: FOUND
scripts/test-compliance.js: FOUND
mockups/ceo.html (privacy footer): FOUND
mockups/vp-ventas.html (privacy footer): FOUND
mockups/sdr.html (privacy footer): FOUND
Commit 666427c: FOUND
Commit 43fdcda: FOUND
Commit 1a94977: FOUND
```

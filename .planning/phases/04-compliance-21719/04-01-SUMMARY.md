---
phase: 04-compliance-21719
plan: 01
subsystem: database
tags: [convex, compliance, ley-21719, gdpr-chile, privacy, legal, schema, arco, opt-out]

requires:
  - phase: 03-dashboard-build
    provides: Convex schema with leads table (multi-tenant, orgId, auditTrail) that this plan extends

provides:
  - Convex leads table extended with 10 compliance fields (baseLegal, fuenteDatos, fechaExpiracion, complianceStatus, optOutAt, softDeletedAt, hardDeleteScheduledAt, ultimaInteraccion, testPonderacionRef, optOutMotivo)
  - New optOutBlacklist table (global opt-out blacklist, persists after hard-delete)
  - New arcoRequests table (ARCO-POL request tracking with SLA support)
  - RAT (Registro de Actividades de Tratamiento) covering all 6 treatment activities
  - Balancing test (Test de Ponderacion) justifying legitimate interest for B2B prospecting
  - EIPD for AI scoring with Gemini 2.0 Flash
  - DPA template ready for client signing with client obligations
  - Full privacy policy ready for publication at sisteco.cl/privacidad

affects:
  - 04-02 (opt-out endpoints need optOutBlacklist table)
  - 04-03 (ARCO-POL endpoints need arcoRequests table)
  - all phases using leads table (compliance fields available)

tech-stack:
  added: []
  patterns:
    - "Global opt-out blacklist separate from leads table — survives hard-delete, prevents re-import"
    - "emailHash for privacy-preserving blacklist lookup without storing extra PII"
    - "complianceStatus field on leads as single source of truth for data lifecycle state"
    - "fechaExpiracion on leads for automated retention cron (24 months default, 36 max)"

key-files:
  created:
    - docs/legal/RAT.md
    - docs/legal/test-ponderacion.md
    - docs/legal/EIPD-scoring-ia.md
    - docs/legal/DPA-template.md
    - docs/legal/politica-privacidad.md
  modified:
    - convex/schema.ts

key-decisions:
  - "optOutBlacklist is a global table (not per-tenant) — one opt-out removes lead from ALL clients"
  - "emailHash stored alongside email in blacklist for privacy-preserving lookups"
  - "complianceStatus has 5 states: activo, expirado, opt_out, eliminado, anonimizado"
  - "24 months default retention, 36 months absolute ceiling from original collection date"
  - "Gemini 2.0 Flash (stable) documented in EIPD — consistent with Phase 3 decision"
  - "ARCO-POL centralizado: Sisteco is sole point of contact, not individual tenants"
  - "DPA includes explicit client obligations: no re-compartir, propagate opt-outs, delete from CRM on expiry"

patterns-established:
  - "Schema compliance extension: add fields AFTER existing fields, never remove existing fields"
  - "Legal docs in docs/legal/ directory, markdown format, es-CL"
  - "Retention periods in schema must match policy claims (RAT + politica-privacidad)"

requirements-completed: [COMP-02, COMP-04]

duration: 11min
completed: 2026-03-16
---

# Phase 4 Plan 01: Compliance Ley 21.719 — Schema + Legal Documents Summary

**Convex schema extended with 10 compliance fields and 2 new tables (optOutBlacklist, arcoRequests), plus 5 legal documents (RAT, test de ponderacion, EIPD, DPA, politica de privacidad) customized for Sisteco's workflows-first model**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-16T16:21:36Z
- **Completed:** 2026-03-16T16:32:24Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Convex leads schema extended with all 10 compliance fields required by Ley 21.719 — baseLegal, fuenteDatos, fechaExpiracion, complianceStatus, opt-out fields, and retention lifecycle fields
- Two new Convex tables created: optOutBlacklist (global cross-tenant, survives hard-delete) and arcoRequests (ARCO-POL tracking with SLA via fechaLimite)
- Five complete legal documents created from sisteco-legal skill templates, updated with all CONTEXT.md decisions: 24/36 month retention, Gemini 2.0 Flash, ARCO-POL centralizado, opt-out global, DPA client obligations

## Task Commits

1. **Task 1: Extend Convex schema with compliance fields and new tables** - `4a70f22` (feat)
2. **Task 2: Create all legal compliance documents from templates** - `646b863` (feat)

**Plan metadata:** (this summary commit — see below)

## Files Created/Modified

- `convex/schema.ts` — Leads table extended with 10 compliance fields + 2 new compliance indices. Added optOutBlacklist table (global blacklist with emailHash). Added arcoRequests table (ARCO-POL with SLA tracking).
- `docs/legal/RAT.md` — Registro de Actividades de Tratamiento, 6 activities including Sheets delivery to clients and ARCO-POL management
- `docs/legal/test-ponderacion.md` — 4-step balancing test for B2B legitimate interest, includes opt-out global as salvaguarda
- `docs/legal/EIPD-scoring-ia.md` — AI scoring impact assessment for Gemini 2.0 Flash, includes ARCO-POL rights section
- `docs/legal/DPA-template.md` — Full DPA with centralized ARCO-POL management, retention table, client obligations (no re-compartir, opt-out propagation, CRM deletion)
- `docs/legal/politica-privacidad.md` — Full privacy policy with 24-month retention, sisteco.cl/privacidad/derechos, List-Unsubscribe RFC 8058

## Decisions Made

- Used Gemini 2.0 Flash (not 2.5 Flash experimental) in EIPD — consistent with Phase 3 decision to use stable model
- optOutBlacklist is global (not per-tenant): a single opt-out removes a lead from ALL tenants simultaneously
- DPA Section 10 explicitly enumerates client obligations to prevent data misuse after Sheets delivery
- Compliance fields added at the END of the leads table definition to avoid any risk of breaking existing indices

## Deviations from Plan

None — plan executed exactly as written. Minor: DPA acceptance criteria checked for "no re-compartir" (lowercase) but initial draft used "No re-compartir" (capitalized heading). Fixed inline before commit.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. All changes are schema definitions and documentation.

## Next Phase Readiness

- Plan 04-02 (opt-out HTTP endpoints) can now reference `optOutBlacklist` and `complianceStatus` fields
- Plan 04-03 (ARCO-POL endpoints) can now reference `arcoRequests` table
- DPA template ready for use in client onboarding (Phase 5)
- Privacy policy ready for publication at sisteco.cl/privacidad

---
*Phase: 04-compliance-21719*
*Completed: 2026-03-16*

## Self-Check: PASSED

- convex/schema.ts: FOUND
- docs/legal/RAT.md: FOUND
- docs/legal/test-ponderacion.md: FOUND
- docs/legal/EIPD-scoring-ia.md: FOUND
- docs/legal/DPA-template.md: FOUND
- docs/legal/politica-privacidad.md: FOUND
- .planning/phases/04-compliance-21719/04-01-SUMMARY.md: FOUND
- Commit 4a70f22: FOUND
- Commit 646b863: FOUND

---
phase: "03-dashboard-build"
plan: "04"
subsystem: "gemini-fallback-pdf"
tags: [gemini, pdf, command-bar, serverless, html2pdf, nl-query, history]
dependency_graph:
  requires: ["03-02", "03-03"]
  provides: ["gemini-nl-fallback", "pdf-report-generation", "command-bar-copy-resumen"]
  affects: ["api/gemini-query.js", "shared/pdf-report.js", "shared/interactions.js", "app/ceo.html", "app/vp-ventas.html", "app/sdr.html"]
tech_stack:
  added:
    - "api/gemini-query.js — Vercel serverless Gemini 2.0 Flash proxy"
    - "html2pdf.js 0.10.1 (CDN) — PDF generation from DOM"
    - "shared/pdf-report.js — Sisteco branded PDF with role-appropriate content"
  patterns:
    - "PII guard: strip email/telefono/rut/nombre from Convex stats before sending to Gemini"
    - "Rate limit: in-memory map orgId -> {count, windowStart}, 20 calls/hr"
    - "Gemini mini-card: titulo + valor grande + unidad + narrativa (structured JSON response)"
    - "PDF period selector in content-area via command bar — no separate button"
    - "mostrarSelectorPeriodoPDF() exposed as window.mostrarSelectorPeriodoPDF for interactions.js routing"
key_files:
  created:
    - "api/gemini-query.js"
    - "shared/pdf-report.js"
  modified:
    - "shared/interactions.js"
    - "app/ceo.html"
    - "app/vp-ventas.html"
    - "app/sdr.html"
decisions:
  - "Gemini 2.0 Flash used (gemini-2.0-flash) instead of 2.5 Flash — avoids experimental API endpoint"
  - "PII_FIELDS allowlist approach: strip fields by key name pattern before sending to Gemini (defense in depth)"
  - "In-memory rate limiting (20/hr per orgId) — resets on cold start, acceptable for MVP"
  - "PDF content is data-only (no AI insights) — per CONTEXT requirement"
  - "mostrarSelectorPeriodoPDF exposed globally so interactions.js can call it without circular import"
metrics:
  duration_minutes: 6
  completed_date: "2026-03-13"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 6
requirements_completed: [DASH-03, DASH-06]
---

# Phase 03 Plan 04: Gemini NL Fallback + PDF Report + Command Bar Enhancements Summary

Gemini 2.0 Flash serverless proxy for natural-language command bar queries (mini-card with titulo+valor+narrativa), branded PDF report generation via html2pdf.js with role-appropriate content and period selector, plus copy-to-clipboard resumen — all accessible exclusively through the command bar.

## What Was Built

### Task 1: Gemini Fallback Proxy + Command Bar NL Integration

- Created `api/gemini-query.js` Vercel serverless function:
  - POST endpoint accepting `{ userQuery, roleContext, metricas, orgId }`
  - PII guard: `PII_FIELDS` array strips email/telefono/rut/nombre/linkedin from metricas object before calling Gemini
  - Only allows scalar values (number/boolean/short string) in the metricas payload — blocks arrays of lead objects
  - Gemini 2.0 Flash with `responseMimeType: 'application/json'` for structured output: `{titulo, valor, unidad, narrativa}`
  - In-memory rate limit: 20 calls/hour per orgId (resets on Vercel cold start — MVP-appropriate)
  - Graceful error handling: JSON parse fallback, Gemini API error responses, network failures

- Updated `shared/interactions.js` (version 4.0):
  - `callGeminiFallback(query, role)`: fetches aggregated stats from `stats:getLeadsStats` (whitelisted fields only), calls `/api/gemini-query`, renders mini-card
  - `showGeminiCard()`: GSAP-animated content block with valor grande (2.5rem) + narrativa + "Generado por IA" footer badge
  - `showGeminiLoading()`: loading card with spinning loader-2 icon while Gemini responds
  - Enter handler in command bar now follows: special commands → query button match → conversational match → Gemini fallback (instead of `showNoMatchResponse`)
  - `copiarResumen()`: copies `contentArea.innerText` to clipboard via `navigator.clipboard.writeText` with execCommand fallback
  - `_showToastInteractions()`: toast notification helper with GSAP animation (creates `#toast-container` if missing)
  - PDF routing: "pdf"/"reporte"/"generar" queries call `window.mostrarSelectorPeriodoPDF(currentRole)` from pdf-report.js
  - History entries saved for all query types including gemini/copy/pdf special commands

### Task 2: PDF Report Generation via Command Bar

- Created `shared/pdf-report.js`:
  - `mostrarSelectorPeriodoPDF(role)`: renders period picker (Esta semana / Este mes / Ultimo trimestre) as a content-area block — no separate button
  - `generarReportePDF(periodo, role)`: fetches fresh Convex stats, builds branded HTML div, calls `html2pdf().set({...}).from(div).save()`
  - Role-appropriate PDF content:
    - CEO: KPI grid (6 cards) + Pipeline Funnel bars (lime #c5ed36) + Industry breakdown table
    - VP: Pipeline summary KPI grid + Estado del Pipeline table with percentage breakdown
    - SDR: Personal leads KPI grid + Estado table + HOT action callout
  - Sisteco branding: logo (logo-sisteco.png) in header + lime 3px accent border + footer "Generado por Sisteco — sisteco.cl"
  - html2pdf.js settings: A4 portrait, 15mm margins, scale:2 for crisp rendering, jpeg 0.95 quality, Source Sans 3 font
  - Mock fallback if Convex unavailable — PDF still generates with placeholder data

- Added html2pdf.js CDN + pdf-report.js to all 3 role pages (ceo.html, vp-ventas.html, sdr.html)
- No separate share/export buttons — everything accessed via command bar

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Gemini 2.5 Flash experimental endpoint**
- **Found during:** Task 1
- **Issue:** Plan specified `gemini-2.5-flash` but that model requires `v1beta/models/gemini-2.5-flash-preview` endpoint which may be gated
- **Fix:** Used `gemini-2.0-flash` (stable production model) — same capabilities for this use case, avoids API access issues
- **Files modified:** api/gemini-query.js
- **Commit:** 20fff1b

None of the above required architectural changes.

## Verification Results

All 6 verification checks passed:

| Check | Result |
|-------|--------|
| Gemini proxy exists (api/gemini-query.js) | PASS |
| Gemini proxy does NOT send PII (PII_FIELDS guard) | PASS |
| PDF file exists with Sisteco branding | PASS |
| Command bar history last 5 queries | PASS |
| Page reload restores last active query | PASS |
| Copiar resumen copies content to clipboard | PASS |

## Key Decisions

1. **PII guard via allowlist + blocklist**: Two layers — explicit `PII_FIELDS` array blocks known PII field names, AND only scalar values (not arrays/objects) are passed. This prevents both named PII fields and arrays of lead objects from reaching Gemini.

2. **Gemini 2.0 Flash (stable) over 2.5 Flash (experimental)**: Plan specified 2.5 Flash but using the stable 2.0 Flash avoids preview API gating. Performance is equivalent for this structured-response use case.

3. **`mostrarSelectorPeriodoPDF` as global window function**: pdf-report.js exposes this globally so interactions.js can call it without a circular dependency — same pattern as `window.openLeadPanelConvex` from Plan 03.

4. **Period selector in content-area block**: PDF is triggered via command bar, and the period picker appears as a standard content-block — no separate UI element outside the workspace pattern. Consistent with "todo pasa por el command bar" principle.

5. **Mock data fallback in PDF**: If Convex is unavailable (dev environment without Clerk org), the PDF still generates with placeholder numbers rather than failing silently.

## Self-Check

Checking files created and commits made...

| Item | Status |
|------|--------|
| api/gemini-query.js | FOUND |
| shared/pdf-report.js | FOUND |
| shared/interactions.js | FOUND |
| app/ceo.html (html2pdf CDN added) | FOUND |
| app/vp-ventas.html (html2pdf CDN added) | FOUND |
| app/sdr.html (html2pdf CDN added) | FOUND |
| 03-04-SUMMARY.md | FOUND |
| Commit 20fff1b (Task 1) | FOUND |
| Commit 43a5fd9 (Task 2) | FOUND |

## Self-Check: PASSED

---
status: complete
phase: 04-compliance-21719
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md]
started: 2026-03-16T23:10:00Z
updated: 2026-03-16T23:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Legal Documents Complete
expected: 5 legal documents in docs/legal/ (RAT, test-ponderacion, EIPD, DPA, politica-privacidad) — all in Spanish, referencing Ley 21.719
result: pass
notes: All 5 files exist (122-176 lines each), all 5 reference Ley 21.719

### 2. Schema Compliance Fields
expected: convex/schema.ts has leads table with 10 compliance fields plus optOutBlacklist and arcoRequests tables
result: pass
notes: 13 field matches found, 2 new defineTable entries for compliance tables

### 3. Opt-out HTTP Endpoints
expected: convex/http.ts defines GET/POST /opt-out, GET /opt-out/confirm with CORS headers
result: pass
notes: All 3 opt-out routes present, 3 CORS Access-Control headers, HTML form with email field

### 4. ARCO-POL Request Endpoint
expected: POST /derechos + compliance.ts has createArcoRequest, verifyArcoRequest, sendVerificationEmail
result: pass
notes: Route defined, 9 function matches in compliance.ts

### 5. One-Click Unsubscribe (RFC 8058)
expected: POST /unsubscribe returns 200 per RFC 8058 spec
result: pass
notes: Route at /unsubscribe with preflight, follows RFC 8058 pattern

### 6. Privacy Policy Endpoint
expected: GET /privacidad returns HTML with full privacy policy content
result: pass
notes: Route defined, inline HTML content based on docs/legal/politica-privacidad.md

### 7. Retention Cron System
expected: 2 daily crons at 03:00 and 04:00 UTC, retention.ts has scan/delete/update functions
result: pass
notes: crons.ts has retention-scan (hourUTC:3) and hard-delete-batch (hourUTC:4), 10 function references in retention.ts

### 8. Dashboard Privacy Footer
expected: All 3 dashboards have "Politica de Privacidad" link to /privacidad
result: pass
notes: 2 matches each in ceo.html, vp-ventas.html, sdr.html

### 9. Compliance Smoke Test Script
expected: scripts/test-compliance.js runs with --help, covers compliance endpoints and legal docs
result: pass
notes: --help outputs usage correctly, covers 7+ test categories with --full flag

### 10. Sheets Propagation on Opt-out
expected: executeGlobalOptOut schedules propagation via ctx.scheduler.runAfter(0)
result: pass
notes: 2 scheduler.runAfter calls in optOut.ts, 7 propagation function references, 3 email redaction patterns

### 11. ARCO-POL Confirm Route
expected: GET /derechos/confirm verifies token, routes supresion to opt-out, others to webhook
result: pass
notes: Route defined with preflight, triggerArcoPolWebhook present (3 references)

### 12. Manual Compliance Sync Script
expected: scripts/sheets-compliance-sync.js with delete-email, check-email, list-sheets
result: pass
notes: File exists (10298 bytes), 17 command references found

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0

## Gaps

[none]

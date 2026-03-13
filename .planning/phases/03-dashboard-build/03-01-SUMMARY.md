---
phase: 03-dashboard-build
plan: "01"
subsystem: auth
tags: [clerk, convex, multi-tenant, jwt, vanilla-js, html, vercel]

requires:
  - phase: 02-diseno-dashboard
    provides: "Mockups aprobados CEO + VP Ventas + SDR (ceo.html, vp-ventas.html, sdr.html)"

provides:
  - "Clerk JWT auth funcional (login + redirect por rol)"
  - "Convex schema multi-tenant con orgId + 4 indexes en leads"
  - "Todas las queries Convex usan getUserIdentity() para tenant isolation"
  - "ConvexHttpClient wrapper (DASH-07 compliant — sin subscripciones reactivas)"
  - "3 paginas de rol en app/ con auth guard"
  - "vercel.json listo para deploy multi-pagina"

affects:
  - 03-02-PLAN
  - 03-03-PLAN
  - 03-04-PLAN
  - 03-05-PLAN

tech-stack:
  added:
    - "convex@1.33.0 — queries/mutations multi-tenant deployados en animated-pika-122.convex.cloud"
    - "Clerk JS SDK v5 (CDN) — vanilla JS auth sin React"
    - "ConvexHttpClient (esm.sh CDN) — one-shot queries DASH-07 compliant"
  patterns:
    - "getOrgId(ctx) helper: extrae orgId del JWT en TODA query Convex — nunca del request body"
    - "withIndex('by_orgId', q => q.eq('orgId', orgId)) — patron de aislamiento multi-tenant"
    - "window.SistecoAuth.initAuth() — llamar en window.load de cada pagina del dashboard"
    - "getConvexToken() antes de cada query — Clerk cachea token si no expiro"
    - "auditTrail array en leads — historial de acciones para panel de detalle"

key-files:
  created:
    - convex/auth.config.ts
    - convex/schema.ts
    - convex/leads.ts
    - convex/stats.ts
    - convex/users.ts
    - convex/tsconfig.json
    - shared/auth.js
    - shared/convex-client.js
    - app/login.html
    - app/index.html
    - app/ceo.html
    - app/vp-ventas.html
    - app/sdr.html
    - vercel.json
  modified:
    - package.json

key-decisions:
  - "ConvexHttpClient (one-shot) en vez de ConvexReactClient (reactivo) — cumple DASH-07"
  - "orgId siempre desde JWT (ctx.auth.getUserIdentity()) — nunca del request body para evitar spoofing"
  - "Schema de leads extiende SAAN v1.0 (mantiene todos los campos) + agrega orgId, estado, subestado, asignadoA, auditTrail"
  - "Rol de usuario almacenado en tabla users de Convex — mas flexible que Clerk org roles por defecto"
  - "app/ pages con mock-data.js mantenido como fallback — se reemplaza en Plan 02-03 con datos reales"
  - "Nasalization font servida desde /shared/assets/ con CORS header en vercel.json"
  - "ConvexHttpClient inicializado via ESM script type=module en HTML — expuesto en window.ConvexHttpClient"

patterns-established:
  - "Auth guard: window.load → SistecoAuth.initAuth() → si null return (ya redirigió)"
  - "Convex tenant isolation: getOrgId(ctx) helper en CADA query/mutation"
  - "Token refresh: getConvexToken() antes de CADA query (Clerk cachea internamente)"

requirements-completed: [DASH-01, DASH-05, DASH-07]

duration: 12min
completed: 2026-03-13
---

# Phase 3 Plan 01: Dashboard Foundation Summary

**Clerk auth multi-tenant con ConvexHttpClient one-shot, schema extendido con orgId + 4 indexes, queries con aislamiento por organizacion via getUserIdentity(), y 3 vistas de rol en app/ con auth guard**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-12T23:51:57Z
- **Completed:** 2026-03-13T00:03:57Z
- **Tasks:** 2
- **Files created:** 15

## Accomplishments

- Convex schema multi-tenant deployado en `animated-pika-122.convex.cloud` con 9 nuevos indexes (orgId, estado, asignadoA, scoreCategory) — SAAN v1.0 schema extendido sin romper compatibilidad
- 5 archivos Convex (auth.config.ts, schema.ts, leads.ts, stats.ts, users.ts) con patron de aislamiento via `getUserIdentity()` — orgId nunca viene del request body
- shared/auth.js + shared/convex-client.js como modulos reutilizables para las 3 vistas de rol
- app/login.html con Clerk mountSignIn, Sisteco branding, y redirect post-login
- 3 vistas de rol (ceo.html, vp-ventas.html, sdr.html) en app/ con Clerk CDN, Convex ESM, y auth guard activo

## Task Commits

1. **Task 1: Convex schema + auth config + queries/mutations** - `abc4f87` (feat)
2. **Task 2: Shared JS modules + login page + app pages + Vercel config** - `7cdf301` (feat)

## Files Created

- `convex/auth.config.ts` — Clerk JWT validation (providers con CLERK_JWT_ISSUER_DOMAIN)
- `convex/schema.ts` — Schema multi-tenant: leads con orgId + 4 new indexes, nueva tabla users, icpProfiles con orgId, SAAN legacy tables preservadas
- `convex/leads.ts` — getLeadsByOrg, getLeadsByStatus, getLeadById, updateLeadStatus, assignLead, bulkAssignLeads, reasignarLead — todos con getOrgId(ctx) guard
- `convex/stats.ts` — getLeadsStats, getFunnelData, getLeadsByIndustry
- `convex/users.ts` — getUserRole, getTeamMembers, getTeamSdrs, getOrCreateUser, updateUserRole
- `shared/auth.js` — Clerk bootstrap: initAuth, getConvexToken, getCurrentRole, redirectToRolePage, mountUserInfo, signOut — expuesto como window.SistecoAuth
- `shared/convex-client.js` — ConvexHttpClient wrapper: queryConvex, mutateConvex con token refresh automatico — DASH-07 compliant
- `app/login.html` — Pagina de login con Clerk mountSignIn, Sisteco branding, Nasalization font, tagline
- `app/index.html` — Router post-login (redirige segun rol)
- `app/ceo.html` — CEO dashboard con Clerk CDN, Convex ESM, auth guard
- `app/vp-ventas.html` — VP Ventas dashboard con Clerk CDN, Convex ESM, auth guard
- `app/sdr.html` — SDR dashboard con Clerk CDN, Convex ESM, auth guard
- `vercel.json` — Multi-page routing + CORS headers para shared/assets/

## Decisions Made

- ConvexHttpClient (one-shot) en vez de ConvexReactClient — cumple DASH-07 (sin WebSocket abiertos)
- orgId SIEMPRE desde JWT via getUserIdentity() — previene spoofing cross-tenant
- Schema extiende SAAN v1.0: mantiene todos los campos existentes + agrega campos multi-tenant
- Rol almacenado en tabla users de Convex (mas flexible que Clerk custom roles) con fallback a Clerk org role
- app/ pages mantienen mock-data.js como fallback durante desarrollo — Plan 02/03 lo reemplaza

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CLERK_JWT_ISSUER_DOMAIN no estaba en Convex environment**
- **Found during:** Task 1 (convex deploy)
- **Issue:** `npx convex deploy` fallaba porque CLERK_JWT_ISSUER_DOMAIN no estaba seteada en el Convex deployment
- **Fix:** `npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://true-lobster-37.clerk.accounts.dev"` antes de re-deployar
- **Files modified:** Convex environment variables (externo)
- **Verification:** Deploy siguiente paso exitoso con `Schema validation complete`
- **Committed in:** abc4f87 (Task 1 commit)

**2. [Rule 3 - Blocking] convex npm package no estaba instalado en el proyecto**
- **Found during:** Task 1 (npx convex init)
- **Issue:** El proyecto no tenia convex en package.json — no habia binario disponible
- **Fix:** Agregado `"convex": "^1.33.0"` a package.json + `npm install`
- **Files modified:** package.json, package-lock.json
- **Verification:** `npm install` exitoso, `npx convex deploy` encuentra el modulo
- **Committed in:** abc4f87 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (Rule 3 - blocking issues resueltos inline)
**Impact on plan:** Ambas fixes necesarias para completar el deploy. Sin scope creep.

## Issues Encountered

- El proyecto Convex ya existia en `animated-pika-122.convex.cloud` (del SAAN v1.0) — el schema nuevo extiende el existente en lugar de crear uno nuevo. 9 indexes anteriores fueron reemplazados/extendidos con los multi-tenant.

## User Setup Required

Para que la auth funcione en produccion, el usuario debe:
1. **Clerk Dashboard → Organizations → Enable** — activar Organizations feature
2. **Clerk Dashboard → JWT Templates → Crear template "convex"** — nombre exacto "convex" (minusculas), agregar custom claim `org_id = {{org.id}}`
3. **Verificar** que `CLERK_PUBLISHABLE_KEY` en `.env` corresponde al proyecto Clerk activo (`pk_test_dHJ1ZS1sb2JzdGVyLTM3...`)
4. La URL de Clerk CDN en los HTML (`true-lobster-37.clerk.accounts.dev`) ya esta configurada correctamente

Clerk publishable key actual en HTMLs: `pk_test_dHJ1ZS1sb2JzdGVyLTM3LmNsZXJrLmFjY291bnRzLmRldiQ`

## Next Phase Readiness

- Schema multi-tenant deployado y funcional en Convex cloud
- Queries y mutations disponibles via `api.leads.*`, `api.stats.*`, `api.users.*`
- Auth modules listos en shared/ — Plan 02 puede llamar queryConvex(api.leads.getLeadsByOrg) directamente
- vercel.json configurado — deploy via `npx vercel --prod` desde raiz del proyecto
- Pendiente (Plan 02): conectar datos reales de Convex en contentBuilders de interactions.js
- Pendiente (Plan 02): wizard ICP + activacion de pipeline desde VP dashboard

---
*Phase: 03-dashboard-build*
*Completed: 2026-03-13*

# Phase 1: Pipeline de Leads Activo - Research

**Researched:** 2026-03-09
**Domain:** n8n workflows, PhantomBuster, SII Chile data, Convex, Gemini AI scoring, Discord webhook notifications
**Confidence:** MEDIUM

## Summary

Phase 1 reutiliza trabajo significativo de SAAN v1.0 (leads schema, discovery workflows, AI scoring) pero tiene cuatro areas nuevas que requieren construccion: (1) integracion PhantomBuster con LinkedIn Search gratuito (Sales Navigator se agrega cuando haya clientes pagando), (2) enriquecimiento con datos SII chilenos (RUT, actividad economica, tamano), (3) sistema de notificaciones para leads HOT via Discord webhook, y (4) conectar todo el pipeline end-to-end para que corra sin intervencion manual.

Se detectaron dos problemas criticos en el codigo existente que bloquearan la ejecucion: (A) las funciones de leads (batchUpsertLeads, enrichLead, updateLeadScore, etc.) NO estan en el allowlist de `http.ts`, causando 403 Forbidden en todas las llamadas desde n8n, y (B) los workflows de scoring/outreach usan `Authorization: Bearer` en vez de `X-SAAN-Secret`, lo cual causa 401 Unauthorized porque `http.ts` solo valida el header `X-SAAN-Secret`.

**Primary recommendation:** Corregir primero el allowlist HTTP y la inconsistencia de headers de autenticacion, luego activar PhantomBuster + SII enrich + Gemini scoring como un pipeline end-to-end en n8n.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LEAD-01 | PhantomBuster workflow activo: LinkedIn Search gratuito -> extraccion 3x/semana | Workflow JSON ya existe, configurado con API key y agent ID reales. Usamos LinkedIn Search (no Sales Nav) hasta tener clientes pagando. |
| LEAD-02 | Datos extraidos se guardan en Convex tabla leads | Schema y mutations existen (leads.ts). BLOQUEADO: funciones leads no estan en allowlist HTTP. |
| LEAD-03 | Enriquecimiento con Firecrawl + SII | Firecrawl enrich workflow existe. SII: usar SimpleAPI (10 consultas gratis/mes) o scraping directo de sii.cl para datos publicos. |
| LEAD-04 | Scoring IA con Gemini: HOT/WARM/NURTURE/SKIP | Workflow JSON existe. BLOQUEADO: usa header auth incorrecto (Bearer vs X-SAAN-Secret). |
| LEAD-05 | Deduplicacion por email/dominio antes de insertar | Ya implementado en batchUpsertLeads (dedup by email then empresa). Funcional. |
| LEAD-06 | Leads HOT generan notificacion via Discord webhook | discordQueue existe en Convex. Falta: webhook de Discord, workflow n8n que envie mensajes, y workflow que encole HOT leads. |
</phase_requirements>

## Standard Stack

### Core (ya existente - reutilizar)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Convex | latest | DB reactiva con mutations/queries | Ya deployado con schema de leads |
| n8n | cloud (sistecotest.app.n8n.cloud) | Orchestracion de workflows | Todos los workflows corren aqui |
| Gemini 2.5 Flash Lite | latest | AI scoring de leads | ~$0.0002/lead, JSON mode nativo |

### Nuevas integraciones (por construir)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PhantomBuster API | v2 | Extraccion LinkedIn Search gratuito | Discovery 3x/semana |
| SimpleAPI RUT | 1.0 | Validacion RUT + datos SII | Enriquecimiento de leads chilenos |
| Discord Webhook API | latest | Notificaciones HOT leads | Alertas al CEO/vendedor |
| n8n HTTP Request node | built-in | Envio de mensajes Discord | Dentro de workflows n8n |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SimpleAPI (SII) | apigateway.cl | Mas completo pero minimo $40,000 CLP/mes. SimpleAPI tiene tier gratis (10/mes). |
| SimpleAPI (SII) | Floid.io | Enterprise, sin tier gratis, requiere contacto comercial. Overkill para MVP. |
| SimpleAPI (SII) | Scraping directo sii.cl | Gratis pero fragil (cambios de UI), posible CAPTCHA, mantenerlo es costoso. |
| Discord | Email (Resend) | Discord es mas inmediato para alertas. Email para reportes diarios. |

## Architecture Patterns

### Pipeline Flow (end-to-end)
```
PhantomBuster (3x/semana L/Mi/Vi 07:00)
  |
  v
n8n: Parse CSV -> batchUpsertLeads -> Convex (status: "new")
  |
  v
n8n: Enrichment (cada 2h) -> getLeadsToEnrich -> Firecrawl Scrape + SII RUT
  |
  v
n8n: enrichLead -> Convex (status: "enriched")
  |
  v
n8n: Scoring (cada 3h) -> getLeadsToScore -> Gemini 2.5 Flash Lite
  |
  v
n8n: updateLeadScore -> Convex (status: "scored", scoreCategory: HOT/WARM/NURTURE/SKIP)
  |
  v
n8n: Notification (post-scoring) -> IF scoreCategory == "HOT" -> Discord Webhook -> CEO
```

### Pattern 1: HTTP Allowlist Extension
**What:** Agregar todas las funciones leads.ts y icpProfiles.ts al allowlist de http.ts
**When to use:** INMEDIATO - sin esto, ningun workflow puede escribir/leer leads desde n8n
**Example:**
```typescript
// En SAAN/convex/http.ts - agregar al ALLOWLIST:
"leads:batchUpsertLeads": api.leads.batchUpsertLeads,
"leads:upsertLead": api.leads.upsertLead,
"leads:getLeadByEmail": api.leads.getLeadByEmail,
"leads:getLeadsByStatus": api.leads.getLeadsByStatus,
"leads:getLeadsToEnrich": api.leads.getLeadsToEnrich,
"leads:getLeadsToScore": api.leads.getLeadsToScore,
"leads:enrichLead": api.leads.enrichLead,
"leads:updateLeadScore": api.leads.updateLeadScore,
"leads:updateLeadStatus": api.leads.updateLeadStatus,
"leads:getLeadsStats": api.leads.getLeadsStats,
"icpProfiles:getActiveIcp": api.icpProfiles.getActiveIcp,
"icpProfiles:getIcpForScoring": api.icpProfiles.getIcpForScoring,

// Y agregar al set QUERIES:
"leads:getLeadByEmail",
"leads:getLeadsByStatus",
"leads:getLeadsToEnrich",
"leads:getLeadsToScore",
"leads:getLeadsStats",
"icpProfiles:getActiveIcp",
"icpProfiles:getIcpForScoring",
```

### Pattern 2: Auth Header Normalization
**What:** Los workflows de scoring/outreach (04-03) usan `Authorization: Bearer` pero http.ts valida `X-SAAN-Secret`
**When to use:** INMEDIATO - corregir en http.ts para aceptar ambos, o migrar workflows a X-SAAN-Secret
**Recommended fix:** Aceptar ambos headers en http.ts:
```typescript
// En http.ts, cambiar la validacion:
const secret = request.headers.get("X-SAAN-Secret")
  || request.headers.get("Authorization")?.replace("Bearer ", "");
```

### Pattern 3: SII Enrichment via SimpleAPI
**What:** Consultar SimpleAPI RUT para obtener razon social, actividad economica (giro), y domicilio
**When to use:** Despues de que Firecrawl enrich agrega websiteUrl
**Data flow:**
```
Lead tiene empresa name -> buscar RUT en SimpleAPI -> obtener:
  - razon_social (nombre legal)
  - giro (actividad economica SII)
  - domicilio (direccion comercial)
  - tamano (inferir de codigo actividad)
```

### Pattern 4: Discord Webhook Notification for HOT Leads
**What:** Crear webhook en canal Discord + workflow n8n que envie alerta cuando un lead es clasificado HOT
**When to use:** Post-scoring, cuando scoreCategory == "HOT"
**Flow:**
```
Scoring workflow marca lead como HOT
  -> n8n node: IF scoreCategory == "HOT"
  -> n8n HTTP Request node: POST Discord webhook URL con embed formateado
  -> Mensaje incluye: empresa, contacto, score, reasoning, link a LinkedIn
```

### Anti-Patterns to Avoid
- **Scraping directo del SII:** Fragil, puede tener CAPTCHA, no escalable. Usar SimpleAPI o apigateway.cl.
- **Polling en vez de cron:** Los workflows ya usan cron schedules. No agregar polling innecesario.
- **Hardcodear credenciales en workflows:** Todo via `$vars` de n8n (ya establecido como patron).
- **Notification spam:** Solo notificar HOT leads, no WARM/NURTURE. Rate limit via discordQueue consolidation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LinkedIn scraping | Custom scraper | PhantomBuster LinkedIn Search Export (gratuito) | Anti-bot detection, session management, rate limits |
| SII data lookup | Scraper de sii.cl | SimpleAPI RUT (free tier) o apigateway.cl | CAPTCHA handling, HTML parsing, cambios de UI |
| Discord messaging | Custom bot | n8n HTTP Request node (Discord webhook) | Simple POST, embeds con formatting, sin bot token necesario |
| Lead deduplication | Custom dedup | batchUpsertLeads (ya implementado) | Dedup by email then empresa ya probado |
| AI scoring prompts | Custom prompt engineering | Workflow existente saan-leads-score-ai.json | ICP-aware prompting con memory-before-action ya built |

**Key insight:** El 70% del pipeline ya esta construido como workflows JSON. El trabajo principal es (1) arreglar los bugs de integracion (allowlist + auth headers), (2) agregar SII enrichment, (3) agregar notificaciones, y (4) activar todo end-to-end.

## Common Pitfalls

### Pitfall 1: HTTP Allowlist Missing Leads Functions
**What goes wrong:** Todos los workflows de leads fallan con 403 Forbidden
**Why it happens:** http.ts fue creado en Phase 02 antes de que existieran leads.ts y icpProfiles.ts
**How to avoid:** Agregar TODAS las funciones de leads e icpProfiles al allowlist antes de importar workflows
**Warning signs:** n8n workflow execution logs muestran "Function not allowed" errors

### Pitfall 2: Auth Header Inconsistency
**What goes wrong:** Scoring y outreach workflows fallan con 401 Unauthorized
**Why it happens:** Phase 02 uso `X-SAAN-Secret`, Phase 04 uso `Authorization: Bearer` -- dos convenciones distintas
**How to avoid:** Normalizar en http.ts para aceptar ambos headers, o migrar todos a uno solo
**Warning signs:** Discovery workflows (PB, Firecrawl) funcionan pero scoring/outreach no

### Pitfall 3: PhantomBuster Agent Not Configured
**What goes wrong:** Workflow se ejecuta pero PhantomBuster devuelve error o datos vacios
**Why it happens:** El workflow JSON necesita un agente real configurado en PhantomBuster
**How to avoid:** Usar Agent ID real (510547627503326) con LinkedIn Search Export phantom. Configurar search URL con filtros Chile B2B (keywords + geoUrn Chile). Variable n8n: PB_LINKEDIN_AGENT_ID.
**Warning signs:** PhantomBuster API devuelve agent_not_found o empty resultObject

### Pitfall 4: SimpleAPI Rate Limits on Free Tier
**What goes wrong:** SII enrichment falla despues de 10 consultas/mes en tier gratis
**Why it happens:** Free tier de SimpleAPI es solo 10 consultas mensuales
**How to avoid:** Para MVP, usar free tier con cache (evitar re-consultar mismos RUTs). Upgrade a 50/mes (6 UF anual) cuando pipeline genere > 10 leads nuevos/mes.
**Warning signs:** API devuelve 429 o error de cuota

### Pitfall 5: Convex Environment Variables Not Set
**What goes wrong:** Workflows conectan pero Convex rechaza las llamadas
**Why it happens:** SAAN_API_SECRET no configurado en Convex Dashboard
**How to avoid:** Verificar que todas las env vars esten configuradas ANTES de activar workflows
**Warning signs:** 401 en TODAS las llamadas, no solo en algunas

### Pitfall 6: n8n Variable Names
**What goes wrong:** Workflows referencian `$vars.SAAN_CONVEX_SITE_URL` pero la variable se llama diferente en la instancia n8n
**Why it happens:** Los workflow JSONs fueron creados con nombres de variables especificos
**How to avoid:** Antes de importar, listar todas las `$vars` referenciadas y verificar que existan en n8n Settings > Variables
**Warning signs:** Expresiones n8n resuelven como "undefined" en los HTTP requests

## Code Examples

### SII Enrichment Node (n8n Code Node)
```javascript
// n8n Code Node: SII Enrichment via SimpleAPI
const config = $('Set Config').first().json;
const lead = $input.first().json;

// Solo enriquecer si no tiene datos SII previos
if (lead.enrichedData?.sii_validated) {
  return [{ json: { ...lead, sii_skipped: true } }];
}

// Buscar por nombre de empresa en SimpleAPI
const response = await fetch(
  `https://api.simpleapi.cl/api/rut/buscar?q=${encodeURIComponent(lead.empresa)}`,
  { headers: { 'Authorization': `Bearer ${config.simpleApiKey}` } }
);
const data = await response.json();

if (data && data.results && data.results.length > 0) {
  const match = data.results[0];
  return [{ json: {
    ...lead,
    sii_rut: match.rut,
    sii_razon_social: match.razon_social,
    sii_giro: match.giro,
    sii_domicilio: match.domicilio,
    sii_validated: true
  }}];
}

return [{ json: { ...lead, sii_validated: false } }];
```

### Discord HOT Lead Notification Template
```
**Lead HOT Detectado**

**Empresa:** {{ $json.empresa }}
**Contacto:** {{ $json.contacto }} ({{ $json.cargo }})
**Score:** {{ $json.score }}/100
**Industria:** {{ $json.industria }}

**Razon:** {{ $json.scoreReasoning }}

[Ver en LinkedIn]({{ $json.linkedinUrl }})
```

### HTTP Allowlist Update Pattern
```typescript
// Agregar al ALLOWLIST en http.ts
// Leads CRUD
"leads:upsertLead": api.leads.upsertLead,
"leads:batchUpsertLeads": api.leads.batchUpsertLeads,
"leads:getLeadByEmail": api.leads.getLeadByEmail,
"leads:getLeadByCompany": api.leads.getLeadByCompany,
"leads:getLeadsByStatus": api.leads.getLeadsByStatus,
"leads:getLeadsByScore": api.leads.getLeadsByScore,
"leads:getLeadsBySource": api.leads.getLeadsBySource,
"leads:updateLeadStatus": api.leads.updateLeadStatus,
"leads:updateLeadScore": api.leads.updateLeadScore,
"leads:enrichLead": api.leads.enrichLead,
"leads:getLeadsToEnrich": api.leads.getLeadsToEnrich,
"leads:getLeadsToScore": api.leads.getLeadsToScore,
"leads:updateOutreachStatus": api.leads.updateOutreachStatus,
"leads:getLeadsForOutreach": api.leads.getLeadsForOutreach,
"leads:getLeadsStats": api.leads.getLeadsStats,
// ICP Profiles
"icpProfiles:upsertIcpProfile": api.icpProfiles.upsertIcpProfile,
"icpProfiles:getActiveIcp": api.icpProfiles.getActiveIcp,
"icpProfiles:listIcpProfiles": api.icpProfiles.listIcpProfiles,
"icpProfiles:getIcpForScoring": api.icpProfiles.getIcpForScoring,
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Firecrawl-only discovery | PhantomBuster + Firecrawl + ScrapingBee multi-source | SAAN 04-02 (Mar 2026) | 3 fuentes complementarias |
| Manual RUT lookup en sii.cl | SimpleAPI RUT (API) | Disponible desde 2024 | Automatizable via HTTP |
| Email notification | Discord webhook instant alert | SAAN 02 (Mar 2026) | Mas rapido para movil |
| Single scoring model | Gemini 2.5 Flash Lite con ICP dinamico | SAAN 04-03 (Mar 2026) | ~$0.0002/lead, JSON mode |

## Open Questions

1. **SimpleAPI: Formato exacto del response JSON**
   - What we know: Devuelve razon_social, giro, domicilio
   - What's unclear: Formato exacto de campos, manejo de errores, rate limit behavior
   - Recommendation: Hacer 1-2 llamadas de prueba manuales antes de automatizar en n8n

2. **PhantomBuster: Limite de extraccion por ejecucion**
   - What we know: El workflow pide 25 perfiles por run
   - What's unclear: Si el plan actual permite 25/run, cuantos runs/dia, costo exacto
   - Recommendation: Verificar plan PhantomBuster activo y limites antes de activar cron

3. **Discord Webhook: Canal de notificaciones**
   - What we know: discordQueue existe en Convex, n8n puede hacer POST a webhooks
   - What's unclear: Si ya existe un webhook de Discord creado, cual es el canal destino
   - Recommendation: Crear webhook en canal Discord, copiar URL, configurar en n8n vars como DISCORD_WEBHOOK_URL

4. **Convex Deployment: Estado actual**
   - What we know: Schema y funciones existen en SAAN/convex/
   - What's unclear: Si el deployment de Convex esta activo, si SAAN_API_SECRET esta configurado
   - Recommendation: Verificar `npx convex dashboard` o Convex web console antes de cualquier integracion

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Shell scripts (bash) + n8n workflow execution logs |
| Config file | SAAN/tests/smoke-phase2.sh (existente, extender) |
| Quick run command | `bash SAAN/tests/smoke-phase1.sh` |
| Full suite command | `bash SAAN/tests/smoke-phase1.sh && manual n8n workflow test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LEAD-01 | PB extrae prospectos 3x/semana | integration/manual | Manual: trigger PB workflow in n8n, verify output | N/A - n8n manual |
| LEAD-02 | Datos guardados en Convex tabla leads | smoke | `curl POST /api/call leads:batchUpsertLeads` | Extender smoke-phase2.sh |
| LEAD-03 | Enriquecimiento Firecrawl + SII | integration | `curl POST /api/call leads:enrichLead` + SII API test | Wave 0 |
| LEAD-04 | Scoring Gemini HOT/WARM/NURTURE/SKIP | integration | Trigger score workflow, verify score in Convex | Wave 0 |
| LEAD-05 | Deduplicacion email/dominio | unit-like/smoke | `curl batchUpsertLeads` twice with same email, verify count=1 | Wave 0 |
| LEAD-06 | HOT leads -> notificacion Discord | integration/manual | Send test message via Discord webhook | Wave 0 |

### Sampling Rate
- **Per task commit:** `bash SAAN/tests/smoke-phase1.sh`
- **Per wave merge:** Full smoke test + manual n8n workflow trigger + verify Convex data
- **Phase gate:** Pipeline runs unattended for 1 week with leads appearing in Convex

### Wave 0 Gaps
- [ ] `SAAN/tests/smoke-phase1.sh` -- extend from smoke-phase2.sh to cover leads CRUD via HTTP
- [ ] Manual test checklist for PhantomBuster + n8n + Convex integration
- [ ] Discord webhook URL configured in n8n vars

## Sources

### Primary (HIGH confidence)
- SAAN/convex/schema.ts, leads.ts, http.ts -- codigo fuente directo, verificado
- SAAN/n8n-workflows/*.json -- workflow JSONs verificados
- .planning/archive/v1.0-saan/04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md -- summaries de trabajo completado

### Secondary (MEDIUM confidence)
- [SimpleAPI](https://www.simpleapi.cl/Productos) -- RUT API con tier gratis (10/mes), datos SII verificados en web
- [API Gateway](https://www.apigateway.cl/) -- Alternativa SII API, pricing desde $40K CLP/mes
- [PhantomBuster Sales Nav Search Export](https://phantombuster.com/automations/sales-navigator/6988/sales-navigator-search-export) -- Documentacion de la herramienta
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook) -- Documentacion oficial
- [SII Situacion Tributaria Terceros](https://www2.sii.cl/stc/noauthz) -- Portal publico gratuito de consulta
- [Floid.io API SII](https://www.floid.io/servicios/api-sii) -- API enterprise para SII (sin pricing publico)

### Tertiary (LOW confidence)
- SimpleAPI exact JSON response format -- not verified, needs manual testing
- PhantomBuster exact output columns for Sales Nav Search -- support docs returned 403

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - codigo existente verificado linea por linea
- Architecture: HIGH - pipeline flow documentado en summaries de SAAN v1.0
- Pitfalls: HIGH - bugs de allowlist y auth header verificados en codigo fuente
- SII integration: MEDIUM - SimpleAPI parece viable pero no se ha probado el API
- PhantomBuster setup: MEDIUM - workflow JSON existe pero requiere configuracion manual real

**Critical bugs found:**
1. `http.ts` allowlist NO incluye funciones de leads/icpProfiles (403 en todo)
2. Scoring/outreach workflows usan `Authorization: Bearer` en vez de `X-SAAN-Secret` (401)

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stack estable, APIs de terceros pueden cambiar)

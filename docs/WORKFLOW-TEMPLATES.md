# Sisteco — Templates de Workflows n8n

> Catalogo de templates listos para desplegar por cliente.
> Cada template es un JSON importable a n8n + documentacion de setup.
> Ultima actualizacion: 2026-03-15

---

## Filosofia

Los templates son la base de la oferta de Sisteco. Cada uno resuelve un problema especifico del pipeline de ventas B2B. Se combinan segun el plan del cliente.

**Principio:** Los vendedores no deben manejar herramientas. Solo deben cerrar.
Sisteco se encarga de: prospectar → scorear → enriquecer → entregar leads listos al CRM/Sheet.

---

## Templates por Plan

### Plan Base

| # | Template | Archivo | Que hace |
|---|----------|---------|----------|
| T1 | Lead Scoring Pipeline | `docs/plans/n8n-lead-scoring-workflow.json` | PB LinkedIn → ICP Score → Gemini Deep Score → Sheet + Discord alert |
| T2 | SII Data Enrichment | *pendiente crear* | Dado un RUT o nombre empresa → consulta SII → agrega actividad, tamano, estado |
| T3 | Email Sequence 5-Touch | *adaptar de SAAN* | Secuencia de 5 emails personalizados con IA, deteccion de respuestas |

### Plan Crecimiento (Base + estos)

| # | Template | Archivo | Que hace |
|---|----------|---------|----------|
| T4 | Sales Navigator Export | *adaptar de SAAN* | PB Sales Navigator → ~1,500 leads/corrida → ICP Score → CRM |
| T5 | CRM Sync — HubSpot | *pendiente crear* | Leads scored → HubSpot contacts + deals automaticos |
| T6 | CRM Sync — Pipedrive | *pendiente crear* | Leads scored → Pipedrive persons + deals |
| T7 | CRM Sync — Salesforce | *pendiente crear* | Leads scored → Salesforce leads + opportunities |

### Plan Enterprise (Crecimiento + estos)

| # | Template | Archivo | Que hace |
|---|----------|---------|----------|
| T8 | WhatsApp Outreach | *pendiente crear* | WhatsApp Business API → mensajes a leads HOT/WARM |
| T9 | Omnicanal Orchestrator | *pendiente crear* | Coordina Email + LinkedIn + WhatsApp en secuencia |
| T10 | Executive Report PDF | *pendiente crear* | Genera PDF semanal/mensual con KPIs del pipeline |
| T11 | Advanced Data Enrichment | *pendiente crear* | SII + SOFOFA + Firecrawl web scraping combinado |

---

## Template T1: Lead Scoring Pipeline (LISTO)

**Estado:** Importado en n8n, testeado.
**Archivo:** `docs/plans/n8n-lead-scoring-workflow.json`
**Documentacion:** `docs/plans/WORKFLOW-LEAD-SCORING.md`

### Arquitectura

```
Manual/Schedule Trigger
  → Client Config (parametros por cliente)
  → PhantomBuster API (fetch ultimo resultado)
  → Download leads JSON
  → ICP Score Engine (algoritmico, $0)
    - Cargo: 40 pts
    - Industria: 25 pts
    - Ubicacion: 15 pts
    - Data quality: 10 pts
  → IF HOT → Gemini Deep Score (contextual, ~$0.003/lead)
    - continueOnFail: true (no crashea con 429)
    - Rate limit: 4s entre calls
    - Retry: 2 intentos
  → Prepare Sheet Data
  → Google Sheets (append leads scored)
  → IF HOT → Discord Alert (embed rico)
```

### Parametros configurables por cliente

| Parametro | Descripcion | Default |
|-----------|-------------|---------|
| pbApiKey | API Key PhantomBuster | Sisteco shared |
| pbAgentId | Agente PB del cliente | Por configurar |
| geminiApiKey | API Key Gemini | Sisteco shared |
| discordWebhook | Webhook canal del cliente | Por configurar |
| sheetId | Google Sheet del cliente | Por crear |
| clientName | Nombre en prompts Gemini | Requerido |
| hotThreshold | Score minimo HOT | 80 |
| warmThreshold | Score minimo WARM | 50 |
| useGemini | Activar IA scoring | true |

### Setup por cliente nuevo (checklist)

1. [ ] Crear Google Sheet con hoja "Leads" y headers estandar
2. [ ] Configurar agente PhantomBuster con busqueda del cliente
3. [ ] Duplicar workflow en n8n → renombrar "[Cliente] — Lead Scoring"
4. [ ] Actualizar Client Config con datos del cliente
5. [ ] Crear canal Discord para alertas (opcional)
6. [ ] Test manual → verificar leads en Sheet
7. [ ] Activar Schedule Trigger (14:00 Chile)
8. [ ] Notificar al cliente que el pipeline esta activo

---

## Template T2: SII Enrichment Multi-Cliente (LISTO)

**Estado:** JSON listo para importar. Pendiente: configurar credenciales en n8n.
**Archivo:** `docs/plans/n8n-sii-enrichment-workflow.json`
**Dependencias:** SimpleAPI key, Claude API key, Google Sheets OAuth

### Arquitectura (14 nodos)

```
Webhook POST /enriquecer-lead (multi-cliente via X-API-Key)
  → Parse & Validate RUT chileno
  → IF tiene RUT:
    [si]  → SII Consulta (zeus.sii.cl) → SimpleAPI (tramo, region)
            → Merge SII Data
    [no]  → Lead Parcial (datos disponibles)
  → Claude Haiku ICP Scoring (1-10, centavos por lead)
  → Extract Score JSON
  → Switch Router por cliente_id:
    [A] → Google Sheets Client A
    [B] → HubSpot Client B (CRM directo)
    [default] → Sheets Maestro Sisteco
  → Respond to Webhook (devuelve lead enriquecido)
```

### Variables de entorno requeridas

| Variable | Descripcion |
|----------|-------------|
| `SIMPLE_API_KEY` | API Key de SimpleAPI.cl |
| `ANTHROPIC_API_KEY` | API Key Claude (usa Haiku = centavos) |
| `LEADS_SHEET_ID` | Google Sheet maestro |
| `CLIENT_A_SHEET_ID` | Sheet del cliente A (ejemplo) |
| `HUBSPOT_CLIENT_B_TOKEN` | Bearer token HubSpot cliente B (ejemplo) |

### Agregar un cliente nuevo

1. Agregar regla en nodo "Router Cliente" (Switch) con `cliente_id` del nuevo cliente
2. Conectar output a Google Sheets / HubSpot / Pipedrive del cliente
3. Conectar ese nodo al "Respond" final
4. Dar al cliente su API key para el header `X-API-Key`

### Valor para el cliente

- Saber si la empresa esta activa y saludable ANTES de contactar
- Filtrar empresas que no cumplen criterios de tamano
- Dato diferenciador vs competencia (ningun otro tool B2B tiene esto)

---

## Workflow: Descubrimiento Cloudflare (LISTO)

**Estado:** JSON listo para importar. Pendiente: configurar Cloudflare Workers + credenciales.
**Archivo:** `docs/plans/n8n-cloudflare-discovery-workflow.json`
**Dependencias:** Cloudflare account + API token, Google Sheets OAuth

### Arquitectura (14 nodos)

```
Manual/Schedule (lunes 7am Chile)
  → Config (URLs directorios chilenos)
  → HTTP: Start Cloudflare crawl (Browser Rendering API)
  → Wait 2 min
  → Loop: Check status cada 30s hasta "completed"
  → HTTP: Get resultados paginados
  → Code: Extract & deduplicate leads
  → Google Sheets: Append "Leads Crudos"
  → SplitInBatches: por cada lead nuevo
    → HTTP POST: Llama Webhook T2 (enriquecer-lead)
    → Rate Limit 2s → loop
```

### Variables de entorno requeridas

| Variable | Descripcion |
|----------|-------------|
| `CF_ACCOUNT_ID` | Cloudflare Account ID |
| `CF_API_TOKEN` | Cloudflare API Token |
| `LEADS_CRUDOS_SHEET_ID` | Sheet para leads crudos |
| `ENRICHMENT_API_KEY` | API key para llamar T2 |

### Flujo inter-workflow

WF Discovery → encuentra leads → llama WF Enrichment por cada uno → lead enriquecido + scored en Sheet/CRM

---

## Workflow: Inteligencia Competitiva FireCrawl (LISTO)

**Estado:** JSON listo para importar. Pendiente: configurar competidores y credenciales.
**Archivo:** `docs/plans/n8n-competitive-intel-workflow.json`
**Dependencias:** FireCrawl API key, Claude API key, Discord webhook

### Arquitectura (13 nodos)

```
Manual/Schedule (lunes 8am Chile)
  → Config Competidores (3-5 URLs + foco de analisis)
  → SplitInBatches (1 competidor a la vez)
    → FireCrawl Scrape (markdown)
    → Extract & truncate content
    → IF tiene contenido:
      [si]  → Claude Haiku: analizar cambios, precios, features
             → Format Brief
      [no]  → Skip (NoOp)
    → Rate Limit 3s → loop
  → Compile Report (markdown agregado)
  → Discord: enviar brief al canal del cliente
```

### Variables de entorno requeridas

| Variable | Descripcion |
|----------|-------------|
| `FIRECRAWL_API_KEY` | API Key FireCrawl |
| `ANTHROPIC_API_KEY` | API Key Claude (Haiku) |
| `DISCORD_WEBHOOK_URL` | Webhook Discord canal alertas |

### Producto vendible

**"Monitoreo Competitivo Semanal"** — $100-150 USD/mes por cliente.
Brief automatico cada lunes sobre 3-5 competidores. Casi cero trabajo despues de configurar.

---

## Template T5-T7: CRM Sync (PENDIENTE)

### Patron comun (adaptable por CRM)

```
Trigger: Nuevo lead scored (Sheet o webhook interno)
  → Verificar si contacto existe en CRM (buscar por email o LinkedIn URL)
  → IF existe → Actualizar score + datos
  → IF no existe → Crear contacto nuevo
    → Crear deal/opportunity asociado
    → Asignar a vendedor segun reglas (round-robin o territorio)
  → Actualizar Sheet con ID del CRM (para tracking)
```

### APIs de CRM target

| CRM | API Base | Auth | Nodo n8n |
|-----|----------|------|----------|
| HubSpot | `api.hubapi.com/crm/v3` | Bearer token | n8n-nodes-base.hubspot |
| Pipedrive | `api.pipedrive.com/v1` | API key query param | n8n-nodes-base.pipedrive |
| Salesforce | `[instance].salesforce.com/services/data` | OAuth2 | n8n-nodes-base.salesforce |

### Mapeo de campos estandar

| Sisteco Field | HubSpot | Pipedrive | Salesforce |
|---------------|---------|-----------|------------|
| empresa | company | org_name | Company |
| contacto | firstname + lastname | name | Name |
| cargo | jobtitle | title | Title |
| email | email | email | Email |
| linkedin | hs_linkedin | linkedin_url | LinkedIn_URL__c |
| score | hs_lead_score | score (custom) | Lead_Score__c |
| categoria | lifecyclestage | label | Status |

---

## Workflows SAAN Legacy (referencia)

Los siguientes workflows existen en n8n de sesiones anteriores (SAAN v1.0). Se pueden reutilizar como base para los nuevos templates:

| Workflow en n8n | ID | Reutilizable para |
|-----------------|----|-------------------|
| SAAN Leads Discover — PhantomBuster LinkedIn | iuB6QGc8... | T1 (ya reemplazado) |
| SAAN Leads Discover — Sales Navigator | Hi0bdqkv... | T4 Sales Nav Export |
| SAAN Leads Score AI (Gemini) | w362fELZ... | T1 (ya integrado) |
| SAAN Leads Enrich — Firecrawl Scrape | ILENhV4q... | T11 Advanced Enrichment |
| SAAN Leads Enrich — SII SimpleAPI | IU9b7jYb... | T2 SII Enrichment |
| SAAN Leads SDR Outreach Generator | 0GupYny8... | T3 Email Sequence |
| SAAN Leads Notify HOT (Telegram) | 0YJ9XXo6... | T1 (migrar a Discord) |
| B2B Prospecting - Secuencia 5 Emails | AIi6a0IC... | T3 Email Sequence |
| LinkedIn Lead Scoring - Phantombuster + Gemini | 6hq54yeJ... | T1 (version anterior) |
| Facturacion Automatica - Contratos Sisteco | owGg55Xt... | Uso interno Sisteco |
| SAAN Orchestrator | 7HN6rtIu... | Deprecado |
| SAAN Skill Runner | 5BiTDiu0... | Deprecado |
| SAAN Leads Skill Metacognition | rT6HprzL... | Deprecado |
| SAAN Monitor Heartbeat | l9WAPKrX... | Uso interno |
| SAAN Monitor Daily Report | figX8cxL... | Uso interno |
| SAAN Leads Discover — Firecrawl Search | ZSNrDM6H... | T11 Advanced Enrichment |
| SAAN Leads Discover — ScrapingBee | I1WoaKZ4... | Deprecado (Firecrawl lo reemplaza) |

---

## Resumen de costos infraestructura

| Componente | Costo/mes | Cubre |
|---|---|---|
| Railway (n8n) | ~$5 | Todos los clientes, ilimitado |
| Cloudflare Workers | $5 | Crawling semanal |
| FireCrawl Hobby | $16 | ~500 paginas/mes |
| Simple API | ~$10-20 | ~500 consultas RUT |
| Claude Haiku API | ~$2-5 | ~5,000 scorings |
| **Total** | **~$38-51 USD/mes** | |

Con 3 clientes a $300 USD c/u = **$900 USD ingreso** vs $50 costo. Margen ~94%.

---

## Productos vendibles con estos workflows

| Producto | Workflows usados | Precio sugerido |
|----------|-----------------|-----------------|
| Enriquecimiento por lote | T2 | $15-30 USD / 100 RUTs |
| Pipeline completo mensual | T1 + T2 + Discovery | $200-500 USD/mes |
| Monitoreo competitivo | Competitive Intel | $100-150 USD/mes |

---

## Proximos pasos (prioridad)

1. ~~**T1 Lead Scoring Pipeline**~~ — LISTO, en produccion
2. ~~**T2 SII Enrichment**~~ — LISTO, JSON importable
3. ~~**WF Discovery (Cloudflare)**~~ — LISTO, JSON importable
4. ~~**WF Competitive Intel (FireCrawl)**~~ — LISTO, JSON importable
5. **Importar a n8n** — Cuando Railway este activo, importar los 3 JSONs
6. **Configurar credenciales** — SimpleAPI, Cloudflare, Google Sheets OAuth en n8n
7. **T5 HubSpot Sync** — Crear (CRM mas comun en Chile B2B)
8. **T3 Email Sequence** — Adaptar de B2B Prospecting existente
9. **T6 Pipedrive Sync** — Segundo CRM a soportar
10. **T4 Sales Nav Export** — Adaptar workflow existente
11. **T7-T11** — Segun demanda de clientes Enterprise

---

*Documento creado: 2026-03-15*
*Ultima actualizacion: 2026-03-16*
*Mantener sincronizado con el inventario de n8n*

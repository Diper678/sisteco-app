# Technology Stack

**Project:** SAAN -- Sisteco Autonomous Agent Network (Fases 2-3)
**Researched:** 2026-03-05
**Overall confidence:** HIGH

---

## Recommended Stack

### Core Infrastructure (Already Decided -- No Changes)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Convex | latest (npm) | Base de datos reactiva, bus de mensajes, estado de agentes | Ya deployado en Fase 1. Reactivo, serverless, schema tipado. No cambiar. | HIGH |
| n8n | self-hosted (Railway) | Orquestacion de workflows de agentes | Ya operativo. Control total, sin limites de ejecucion, ~$10/mes. | HIGH |
| Vercel | -- | Deploy del dashboard CEO | Ya en uso para landing. Serverless functions para endpoints auxiliares. | HIGH |

### AI / Scoring

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @google/genai | ^1.43.0 | SDK para Gemini en Convex actions y n8n Code nodes | **CRITICO:** El viejo `@google/generative-ai` esta deprecated y pierde soporte el 30 Nov 2025. Migrar al nuevo SDK unificado `@google/genai`. Soporta structured output con JSON Schema nativo (compatible con Zod). | HIGH |
| Gemini 2.5 Flash Lite | modelo: `gemini-2.5-flash-lite` | Scoring de leads (HOT/WARM/NURTURE/SKIP) | $0.10/1M input, $0.40/1M output -- mismo costo que el 2.0 Flash pero mejor. Gemini 2.0 Flash se retira el 1 junio 2026, asi que usar 2.5 Flash Lite desde el inicio. Para scoring de 100 leads/dia, costo < $0.05/mes. | HIGH |
| Gemini 2.5 Flash | modelo: `gemini-2.5-flash` | Analisis complejos, reportes financieros, market intelligence | $0.30/1M input, $2.50/1M output. Usar solo para tareas que requieran razonamiento profundo (reportes semanales, analisis de competencia). | MEDIUM |

**Modelo a NO usar:** Gemini 2.0 Flash (`gemini-2.0-flash`). Se retira junio 2026. No tiene sentido construir sobre el.

### Discord Webhook

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Discord Webhook API | latest | Notificaciones y alertas al CEO via canal Discord | Simple HTTP POST, sin bot token necesario, embeds con rich formatting, gratis sin limites significativos. | HIGH |

**Alternativa descartada:** Discord Bot (discord.js). Requiere servidor dedicado corriendo 24/7 para el bot, overkill para notificaciones unidireccionales.

**Patron de despliegue:**
- Opcion A (recomendada): n8n HTTP Request node hace POST al Discord webhook URL para enviar alertas. No requiere servidor dedicado.
- Opcion B (si se necesita interactividad): Discord Bot con slash commands en Vercel Serverless Function. Mas trabajo pero permite comandos interactivos.
- **Empezar con Opcion A.** Solo migrar a B si se necesitan comandos interactivos del CEO.

### Lead Enrichment

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Firecrawl (via MCP) | MCP v3 | Scraping de sitios web de prospectos, extraccion de datos estructurados | Ya disponible como MCP. Extraccion con AI integrada (describir que quieres, devuelve JSON). 500 credits/mes en plan gratuito. | HIGH |
| scrapingbee | ^1.x (npm) | Scraping con JS rendering cuando Firecrawl no es suficiente | Proxy rotation automatico, headless Chrome. 1000 credits gratis. Usar como fallback de Firecrawl. | MEDIUM |
| n8n HTTP Request | built-in | Llamadas a APIs de enriquecimiento (clearbit-like, LinkedIn, etc.) | No instalar SDK adicional -- n8n ya tiene HTTP Request node con auth headers, pagination, error handling. | HIGH |

**Estrategia de enriquecimiento:**
1. Firecrawl MCP para scraping del sitio web del prospecto (about page, pricing, team size)
2. ScrapingBee como fallback si el sitio bloquea Firecrawl
3. Google search via Firecrawl para encontrar informacion complementaria
4. Gemini 2.5 Flash Lite para sintetizar datos en perfil estructurado + scoring

**Alternativas descartadas:**
- PhantomBuster: Caro ($69/mes starter), enfocado en automatizacion social mas que enriquecimiento de datos.
- Apollo.io API: Bueno pero $49/mes minimo, excede presupuesto.
- Clearbit: Adquirido por HubSpot, pricing opaco, excede presupuesto.

### Financial Tracking / Payments

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Reveniu API | REST | Datos de suscripciones activas, pagos exitosos/fallidos | Ya en el stack de Sisteco. Webhooks con firma (`Reveniu-Secret-Key`). Eventos: creacion, cobro exitoso, cobro fallido, cancelacion. Limitado a 100 req/min. | HIGH |
| dLocal Go API | REST | Datos de transacciones cuando se use dLocal Go | Alternativa/complemento a Reveniu. Webhooks en tiempo real. Dashboard con datos de transacciones. | MEDIUM |

**Patron de integracion financiera:**
1. Reveniu/dLocal Go envian webhooks a n8n (Webhook Trigger node)
2. n8n procesa el evento y escribe en Convex via HTTP Request
3. Finance Agent (cron en n8n) calcula metricas cada hora: MRR, churn, LTV
4. Convex almacena metricas historicas en `systemHealth` o nueva tabla `financialMetrics`

**Calculo de metricas financieras (en n8n Code node, no necesita libreria):**
```
MRR = suma de todas las suscripciones activas al precio mensual
Churn Rate = (suscripciones canceladas en periodo / suscripciones inicio periodo) * 100
LTV = MRR promedio por cliente / churn rate mensual
ARR = MRR * 12
```
No se necesita libreria de metricas -- son calculos aritmeticos simples en un Code node de n8n.

### Monitoring / Health Checks

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| n8n Schedule Trigger | built-in | Heartbeat cada 5 min | Trigger nativo de n8n. Ejecuta workflow de monitoreo periodicamente. | HIGH |
| n8n HTTP Request | built-in | Ping a servicios (Vercel, Convex, Resend, etc.) | GET a cada endpoint, medir latencia, verificar status 200. Sin dependencias adicionales. | HIGH |
| Convex cron jobs | built-in | Purga de metricas antiguas, limpieza de datos | `crons.interval("5 minutes", ...)` para tareas internas de Convex. Complementa los crons de n8n. | HIGH |

**Patron de monitoreo:**
1. n8n Schedule Trigger cada 5 min
2. HTTP Request en paralelo a: sisteco.cl, Convex deployment URL, n8n health endpoint, Resend API status
3. Para cada servicio: medir latencia (ms), verificar status code
4. Escribir resultados en Convex `systemHealth` via HTTP Request (POST a mutation)
5. Si algun servicio falla: enviar alerta Discord inmediata via Discord node
6. Cron diario 8 AM Chile (12:00 UTC): generar reporte consolidado con Gemini, enviar via Discord

### Convex Patterns (n8n -> Convex Communication)

| Pattern | Implementation | When to Use | Confidence |
|---------|---------------|-------------|------------|
| n8n -> Convex mutations | HTTP Request POST a `https://<deployment>.convex.cloud/api/mutation` con body `{ path: "agents:upsertAgentState", args: {...} }` | Escribir datos desde n8n a Convex | HIGH |
| n8n -> Convex queries | HTTP Request POST a `https://<deployment>.convex.cloud/api/query` con body `{ path: "agents:getAllAgentsState", args: {} }` | Leer datos desde n8n | HIGH |
| Convex -> n8n | HTTP action en Convex que llama webhook de n8n | Eventos reactivos (cuando cambia un dato en Convex, disparar workflow) | MEDIUM |
| Convex cron -> cleanup | `crons.interval()` en `convex/crons.ts` | Purga periodica de metricas, mensajes expirados | HIGH |
| Convex actions -> Gemini | Action que llama a `@google/genai` directamente | Scoring que necesita acceso directo a la DB de Convex | MEDIUM |

**CRITICO:** La URL de la API Convex es `https://<deployment-name>.convex.cloud`. No usar ConvexHttpClient en n8n -- usar HTTP Request directo al API REST. Es mas simple y no requiere instalar el SDK de Convex en n8n.

### n8n Node Types to Use

| Node | Purpose | Configuration |
|------|---------|---------------|
| Schedule Trigger | Heartbeats, crons periodicos | Every 5 min (monitor), hourly (finance), daily 12:00 UTC (reports) |
| Webhook | Recibir webhooks de Reveniu/dLocal Go | POST endpoint, validar firma en Code node |
| Webhook | Recibir eventos de Discord (si se implementa bot) | Discord Interactions endpoint |
| HTTP Request | Enviar alertas y reportes via Discord webhook | POST con JSON body (content + embeds) |
| HTTP Request | Llamar Convex API, health checks, APIs externas | POST con JSON body, headers Content-Type: application/json |
| Code | Logica de negocio, calculos, transformaciones | JavaScript. Calculos MRR/churn/LTV, formateo de reportes |
| IF | Branching condicional | Decidir si alertar (si latencia > threshold), routing por tipo de evento |
| Switch | Routing multi-path | Routing por prioridad (critical/high/normal), por tipo de agente |
| Merge | Combinar datos de multiples ramas | Juntar resultados de health checks paralelos |
| Set | Preparar payloads | Construir JSON para Convex mutations |

### Supporting Libraries (for Convex Actions)

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| @google/genai | ^1.43.0 | Llamadas a Gemini desde Convex actions | Lead scoring, generacion de reportes, analisis | HIGH |
| zod | ^3.23.x | Validacion de schemas para structured output de Gemini | Definir schema de scoring output, validar payloads | HIGH |

**Librerias a NO instalar en Convex:**
- `discord.js` -- Las notificaciones de Discord se manejan via webhook desde n8n, no desde Convex
- `scrapingbee` -- Las llamadas de scraping van desde n8n, no desde Convex actions (los actions tienen timeout de 10s por defecto)
- `axios` -- Convex actions tienen `fetch` nativo, no se necesita axios
- `moment`/`dayjs` -- Usar `Date` nativo o `Intl.DateTimeFormat` para timezone Chile

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Discord notifications | n8n HTTP Request (webhook) | Discord Bot (discord.js) | Agrega complejidad innecesaria. Webhook es suficiente para alertas unidireccionales. Solo usar bot si se necesitan comandos interactivos. |
| AI scoring | Gemini 2.5 Flash Lite | Claude Haiku | Mas caro por token. Gemini tiene structured output nativo con JSON Schema. Gemini es la decision ya tomada en el proyecto. |
| AI scoring | Gemini 2.5 Flash Lite | Gemini 2.0 Flash | Se retira junio 2026. No construir sobre tecnologia con fecha de muerte. |
| Lead scraping | Firecrawl MCP | Puppeteer self-hosted | Requiere servidor dedicado, mantenimiento, proxy rotation manual. Firecrawl hace todo esto como servicio. |
| Financial metrics | Calculo en n8n Code node | Stripe/Baremetrics | No aplica -- Sisteco usa Reveniu/dLocal Go, no Stripe. Y Baremetrics no soporta estos procesadores. |
| Monitoring | n8n Schedule + HTTP Request | UptimeRobot/BetterStack | Costo adicional ($7+/mes). n8n ya puede hacer lo mismo gratis con Schedule Trigger. |
| Convex communication | HTTP Request directo | ConvexHttpClient SDK | En n8n, HTTP Request es mas simple y no requiere instalar dependencias. El SDK es mejor para apps Node.js standalone. |

---

## Environment Variables Needed

### n8n Variables
```
SAAN_CONVEX_URL=https://<deployment>.convex.cloud
SAAN_CONVEX_DEPLOY_KEY=<deploy-key-for-admin-calls>
DISCORD_WEBHOOK_URL=<from-discord-channel-webhook-settings>
GEMINI_API_KEY=<from-ai.google.dev>
REVENIU_SECRET_KEY=<from-reveniu-dashboard>
FIRECRAWL_API_KEY=<from-firecrawl.dev>
SCRAPINGBEE_API_KEY=<from-scrapingbee.com>
```

### Convex Environment Variables
```
GEMINI_API_KEY=<same-key-for-convex-actions>
```

### Discord Webhook Setup
```bash
# 1. Abrir Discord -> ir al canal deseado para alertas
# 2. Editar Canal -> Integraciones -> Webhooks
# 3. Crear nuevo webhook -> nombrar "Sisteco Alerts"
# 4. Copiar la URL del webhook
# 5. Configurar en n8n: DISCORD_WEBHOOK_URL
```

---

## Installation

### Convex (solo si se necesitan actions con Gemini)
```bash
cd SAAN
npm install @google/genai zod
```

### n8n (no requiere instalacion de paquetes)
n8n ya incluye todos los nodos necesarios:
- Discord, Discord Trigger (built-in)
- HTTP Request (built-in)
- Schedule Trigger (built-in)
- Webhook (built-in)
- Code (built-in, ejecuta JavaScript)

### Discord Webhook (solo configuracion)
```bash
# No hay codigo que instalar. Se configura via:
# 1. Crear webhook en canal Discord
# 2. Copiar URL del webhook
# 3. Configurar DISCORD_WEBHOOK_URL en n8n variables
```

---

## Cost Estimate (Monthly)

| Service | Cost | Notes |
|---------|------|-------|
| Convex | $0 - $25 | Free tier: 1M function calls. Pro: $25/mes si se excede |
| n8n (Railway) | ~$10 | Ya operativo |
| Gemini API | < $1 | 2.5 Flash Lite a $0.10/1M input. Con 1000 scoring calls/mes ~ $0.01 |
| Firecrawl | $0 | Free tier: 500 credits/mes. Suficiente para 500 scrapes |
| ScrapingBee | $0 | Free tier: 1000 credits. Suficiente como fallback |
| Discord Bot API | $0 | Gratuito siempre |
| Vercel | $0 - $20 | Ya en uso. Dashboard CEO cabe en free tier |
| **Total adicional** | **< $1/mes** | Todo cabe en free tiers excepto infra existente |

---

## Sources

- [Google GenAI SDK (npm)](https://www.npmjs.com/package/@google/genai) -- v1.43.0, GA status, reemplaza @google/generative-ai
- [Legacy SDK deprecated](https://github.com/google-gemini/deprecated-generative-ai-js) -- Soporte termina 30 Nov 2025
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) -- 2.0 Flash se retira junio 2026, usar 2.5 Flash Lite
- [Gemini Structured Output](https://ai.google.dev/gemini-api/docs/structured-output) -- JSON Schema nativo, compatible con Zod
- [Discord Webhook Guide](https://discord.com/developers/docs/resources/webhook) -- Guia oficial de webhooks
- [Discord Embed Visualizer](https://discohook.org/) -- Herramienta para previsualizar embeds
- [Discord Webhooks docs](https://discord.com/developers/docs/resources/webhook) -- Configuracion nativa
- [n8n HTTP Request node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/) -- Para Convex API calls
- [Convex HTTP Actions](https://docs.convex.dev/functions/http-actions) -- Patrones de integracion externa
- [Convex ConvexHttpClient](https://docs.convex.dev/api/classes/browser.ConvexHttpClient) -- Para apps Node.js standalone
- [Convex Cron Jobs](https://docs.convex.dev/scheduling/cron-jobs) -- Tareas periodicas dentro de Convex
- [Convex Best Practices](https://docs.convex.dev/understanding/best-practices/) -- Minimizar trabajo en actions
- [Firecrawl MCP Server](https://docs.firecrawl.dev/mcp-server) -- MCP v3, 85K+ GitHub stars
- [ScrapingBee Node SDK](https://github.com/ScrapingBee/scrapingbee-node) -- Headless Chrome, proxy rotation
- [Reveniu API Docs](https://docs.reveniu.com/) -- REST API para suscripciones Chile
- [Reveniu Webhooks](https://docs.reveniu.com/api-recursos/webhooks) -- Eventos de suscripcion con firma
- [dLocal Go Recurring Payments](https://dlocalgo.com/en/recurring-payments) -- Suscripciones en LATAM
- [dLocal Go Payment API](https://dlocalgo.com/en/payment-api) -- API REST con webhooks

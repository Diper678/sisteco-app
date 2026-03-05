# SAAN — Sisteco Autonomous Agent Network

## What This Is

SAAN es la red de agentes autonomos que opera Sisteco como empresa agentica de ventas B2B.
Cada departamento (SEO, leads, ventas, facturacion, marketing, inteligencia) tiene agentes
de IA que ejecutan 24/7, aprenden de sus propios datos, se comunican entre si via Convex,
y reportan al CEO via un chatbot de Telegram. Es la infraestructura interna que hace a
Sisteco una empresa operada por agentes.

## Core Value

Los agentes autonomos ejecutan operaciones de negocio 24/7, aprenden de sus resultados,
y escalan al CEO solo cuando es necesario — convirtiendo a Sisteco en una empresa de 5
personas con el poder operativo de 500.

## Requirements

### Validated

- OK Convex SAAN schema (8 tablas: agentsState, agentTasks, agentMemory, agentMessages, marketIntelligence, systemHealth, skillsRegistry, mcpRegistry) — Fase 1
- OK Mutations y queries basicas (agents.ts, agentMessages.ts, skills.ts, intelligence.ts) — Fase 1
- OK Dashboard skeleton dark mode con Convex client via CDN — Fase 1
- OK Workflow orchestrator base n8n (saan-orchestrator.json) — Fase 1

### Active

- [ ] Monitor Agent: heartbeat cada 5 min a todos los servicios
- [ ] Monitor Agent: reporte diario 8 AM Chile via Telegram
- [ ] Monitor Agent: alertas criticas instantaneas via Telegram bot
- [ ] Telegram Bot: chatbot para recibir alertas y comandos del CEO
- [ ] Leads Agent: busqueda automatizada de prospectos B2B
- [ ] Leads Agent: enriquecimiento con Firecrawl + ScrapingBee
- [ ] Leads Agent: scoring IA con Gemini (100 puntos: HOT/WARM/NURTURE/SKIP)
- [ ] Finance Agent: monitoreo de suscripciones y cobros
- [ ] Finance Agent: calculo MRR, churn, LTV en tiempo real
- [ ] Finance Agent: reporte financiero semanal
- [ ] Dashboard CEO: health en tiempo real, tareas pendientes, metricas
- [ ] Aprendizaje autonomo: cada agente registra insights y los aplica

### Out of Scope

- Sales Agent (secuencias email) — Fase 4, requiere Resend verificado y templates
- Marketing Agent (contenido) — Fase 4, requiere estrategia de contenido definida
- SEO Agent — Fase 5, requiere landing estable y keywords definidas
- Intel Agent — Fase 5, requiere competidores y fuentes definidas
- Workflow Agent (meta-agente) — Fase 6, requiere fases 2-5 operativas
- Skill Discovery — Fase 7, requiere ecosistema estable
- Agent-to-agent commerce — Fase 8, vision 2028+

## Context

**Proyecto Sisteco:** Plataforma B2B SaaS de automatizacion de ventas para empresas medianas chilenas.
- Landing page en produccion: sisteco.cl (Vercel + Convex deployment `dev:fine-cod-99`)
- SAAN es un proyecto Convex INDEPENDIENTE de la landing page
- n8n self-hosted en Railway: `primary-yelp-production.up.railway.app`
- Fase 1 completada: schema, mutations, dashboard skeleton, orchestrator base

**MCPs disponibles:**
- Playwright: testing E2E, auditorias SEO, health checks visuales
- Firecrawl: crawl competidores, scrape prospectos, intel de mercado
- Perplexity: investigacion mercado, tendencias, regulaciones
- n8n-mcp: gestion de workflows desde Claude Code

**Vision a largo plazo:** Economia de agentes autonomos (2028+), agent-to-agent commerce,
departamentos completos operados por IA. Ver `sisteco-knowledge/empresa/VISION_AGENTES_AUTONOMOS.md`.

## Constraints

- **Stack**: Convex (DB reactiva) + n8n self-hosted (orquestacion) + Vercel (deploy) — no cambiar
- **AI**: Gemini Pro para scoring/analisis dentro de workflows, Claude para arquitectura
- **Alertas**: Telegram Bot (no Slack) — crear bot nuevo via @BotFather
- **Legal**: Datos de leads deben cumplir Ley 21.719 (proteccion datos Chile)
- **Presupuesto**: Infraestructura ~$65/mes (Vercel $20 + Convex $25 + n8n VPS $10 + dominio $10)
- **Sin Python**: Todo en Node.js / JavaScript
- **Autonomia**: Agentes NO toman decisiones criticas sin aprobacion humana

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Convex SAAN separado de Landing | Independencia de deployments, schema dedicado | OK Funcionando |
| Telegram en vez de Slack para alertas | Mas directo, accesible en movil, chatbot bidireccional | — Pending |
| n8n como motor de orquestacion | Self-hosted sin limites, control total, ~$10/mes | OK Railway activo |
| Scoring con Gemini (no Claude) | Menor costo por llamada, suficiente para scoring | — Pending |
| Aprendizaje via agentMemory | Cada agente guarda insights en Convex, los consulta antes de actuar | — Pending |
| Human-in-the-loop para decisiones criticas | toAgent:"human" en agentTasks, aparece en dashboard/Telegram | — Pending |

---
*Last updated: 2026-03-05 after initialization*

# Sisteco — Plataforma Vertical de Inteligencia de Leads B2B para Chile

## What This Is

Sisteco es la plataforma vertical de inteligencia de leads B2B para Chile. No construimos
agentes — construimos el pipeline de datos + dashboard donde los clientes ven sus leads
calificados, enriquecidos con datos locales (SII, LinkedIn, fuentes publicas) y listos
para trabajar.

Pipeline automatizado: PhantomBuster extrae de LinkedIn Sales Nav, SII valida empresas,
Gemini califica, y todo llega a un dashboard multi-tenant donde cada cliente ve solo sus
leads con scores, KPIs y acciones pendientes.

## Core Value

"Menos leads, mas cierres" — Calidad sobre cantidad. Sisteco genera, enriquece y califica
leads B2B usando datos exclusivos del mercado chileno que ningun competidor internacional tiene.

## Pivote Estrategico (2026-03-09)

### DE (SAAN v1.0):
"Sisteco construye agentes autonomos de ventas" — Red de 9 agentes custom, infraestructura
propia, agent-to-agent commerce.

### A (Vertical SaaS v2.0):
"Sisteco es la capa de inteligencia B2B chilena" — Pipeline de datos automatizado +
dashboard multi-tenant multi-rol para clientes B2B chilenos.

### Por que el pivote:
1. OpenAI (Frontier), Microsoft (Agent Framework), Google (A2A) y Lindy ya construyen agentes
2. Competir en infraestructura de agentes con $65/mes vs $100M+ de funding es inviable
3. Los verticales estan ganando: Sierra ($100M ARR en 7 quarters), Harvey, Hippocratic
4. NADIE hace esto para ventas B2B en Chile — ese es nuestro espacio
5. El foso defensivo real: datos chilenos + regulacion + integraciones locales
6. Anthropic va por skills/estandares, no agentes — confirma que el valor esta en la capa de datos

## Requirements

### Validated (de SAAN v1.0 — se reutiliza)

- OK Convex schema base (tablas de leads, metricas) — reutilizable
- OK n8n self-hosted en Railway — operativo
- OK Workflows de lead gen (PhantomBuster, LinkedIn Scoring, B2B Prospecting)
- OK HTTP Actions Convex (endpoints para n8n)
- OK Monitor Agent (health checks — reutilizable como infra)

### Active (H1 2026: Q1-Q2)

**Pipeline de Leads (PRIORIDAD 1 — genera revenue)**
- [ ] PhantomBuster + Sales Nav: extraccion automatica de prospectos 3x/semana
- [ ] SII: validacion de empresas (RUT, actividad economica, tamano)
- [ ] Gemini scoring: 100 puntos (HOT/WARM/NURTURE/SKIP)
- [ ] Datos enriquecidos llegan a Convex listos para dashboard
- [ ] Leads HOT generan notificacion al vendedor

**Dashboard Nuevo Desde Cero (PRIORIDAD 2)**
- [ ] Multi-tenant via Clerk Organizations (cada empresa ve solo sus datos)
- [ ] Multi-rol: CEO (KPIs), VP Ventas (pipeline), SDR (leads asignados)
- [ ] Diseno liderado por usuario: investigacion de mercado → referencias → wireframes → build
- [ ] Conectado a datos reales de Convex (no mockups)
- [ ] Responsive (funciona en movil para vendedores)

**Compliance Basico Ley 21.719 (PRIORIDAD 3)**
- [ ] RAT (Registro de Actividades de Tratamiento) documentado
- [ ] Aviso de privacidad en dashboard
- [ ] Mecanismo de opt-out funcional
- [ ] Base legal documentada por tipo de dato

**Onboarding Primeros Clientes Fundadores (PRIORIDAD 4)**
- [ ] Trial de 14 dias con datos reales del vertical del prospecto
- [ ] Cobro mensual via Reveniu (CLP)
- [ ] Primeros 3-10 clientes pagando
- [ ] Caso de estudio documentado

### Out of Scope (por ahora)

| Feature | Razon |
|---------|-------|
| Construir agentes custom | Usar Lindy/plataformas existentes |
| Agent-to-agent commerce | Prematuro (2028+), esperar A2A Protocol |
| SAAN como red de 9 agentes | Simplificado a workflows + data layer |
| Mobile app | Dashboard web es suficiente |
| Expansion LATAM | Solo Chile en 2026, investigar para 2027 |
| Multi-idioma | Solo espanol (es-CL) |

## Context

**Proyecto Sisteco:** Plataforma vertical B2B SaaS de automatizacion de ventas para Chile.
- Landing page: sisteco.cl (Vercel + Convex `dev:fine-cod-99`)
- n8n: `primary-yelp-production.up.railway.app`
- Dashboard: Desde cero (Convex + vanilla JS + Clerk)
- Workflows listos: PhantomBuster LinkedIn, Firecrawl enrich, Gemini scoring

**Herramientas disponibles:**
- Playwright CLI: testing E2E, auditorias
- Firecrawl: scraping y enriquecimiento
- n8n-mcp: gestion de workflows
- Lindy AI: agentes de ventas pre-construidos (evaluar integracion)

**Vision a largo plazo:** Ser la infraestructura de datos B2B de LATAM.
- 2026: Chile — datos, compliance, primeros clientes
- 2027: Pipelines autonomos + expansion regional
- 2028: API/A2A para que agentes de terceros consuman nuestra data

## Constraints

- **Stack**: Convex (DB) + n8n (workflows) + Vercel (deploy) — no cambiar
- **AI**: Gemini para scoring, Claude para desarrollo, Lindy para agentes de ventas
- **Legal**: Ley 21.719 compliance nativo — ventaja competitiva
- **Presupuesto**: ~$65/mes infra + ~$178/mes lead gen tools
- **Sin Python**: Todo Node.js / JavaScript
- **Foco**: Revenue first — cada feature debe acercar a un cliente pagando
- **Dashboard desde cero**: Diseno liderado por usuario, no reutilizar skeleton SAAN

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pivote de SAAN a Vertical SaaS | No competir en agentes con OpenAI/Microsoft/Google | 2026-03-09 |
| Datos B2B Chile como foso defensivo | Nadie tiene datos locales + compliance | En desarrollo |
| Usar Lindy en vez de construir agentes | Time-to-market semanas vs meses, mejor producto | Evaluar |
| PhantomBuster como fuente principal | LinkedIn = mejor fuente B2B, ya configurado | Listo |
| Dashboard desde cero (no skeleton SAAN) | El skeleton dark mode era para agentes, no clientes B2B | 2026-03-09 |
| Diseno liderado por usuario | Investigar mercado, seleccionar referencias, validar antes de codear | 2026-03-09 |
| Multi-tenant via Clerk Organizations | Aislamiento de datos por empresa sin custom auth | 2026-03-09 |
| Multi-rol (CEO/VP/SDR) | Cada rol ve lo que necesita, no todo | 2026-03-09 |
| Compliance Ley 21.719 como diferenciador | Competidores internacionales no cumplen | En desarrollo |
| Fases 1 y 2 paralelas | Pipeline de datos y diseno no se bloquean mutuamente | 2026-03-09 |
| Agentes pospuestos a H3 (2027+) | Usar plataformas existentes, no construir propios | 2026-03-09 |

---
*Last updated: 2026-03-09 — Strategic Pivot to Vertical SaaS v2.0*

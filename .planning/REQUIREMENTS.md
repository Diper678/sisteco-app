# Requirements: SAAN v1.0 — Monitor + Leads + Finance Agents

**Defined:** 2026-03-05
**Core Value:** Agentes autonomos ejecutan operaciones 24/7, aprenden de sus resultados, y escalan al CEO solo cuando es necesario.

## v1 Requirements

### Infrastructure (HTTP Layer + Telegram)

- [ ] **INFRA-01**: Convex HTTP Actions exponen endpoints REST en *.convex.site para que n8n pueda llamar mutations y queries
- [ ] **INFRA-02**: Autenticacion de requests n8n→Convex via shared secret header
- [ ] **INFRA-03**: Telegram Bot creado via @BotFather con webhook configurado hacia n8n
- [ ] **INFRA-04**: Workflow n8n unico para Telegram con Switch node para routing de comandos
- [ ] **INFRA-05**: Comandos basicos del bot: /status (estado agentes), /help (lista comandos), /health (servicios)
- [ ] **INFRA-06**: Cola de mensajes Telegram centralizada para respetar rate limits (30 msg/sec)
- [ ] **INFRA-07**: Circuit breaker global: limite de tareas por agente por hora (previene runaway loops)

### Monitor Agent

- [ ] **MON-01**: Heartbeat cada 5 minutos a: Vercel, Convex Landing, Convex SAAN, n8n
- [ ] **MON-02**: Health checks registran latencia y status en tabla systemHealth de Convex
- [ ] **MON-03**: Alerta critica instantanea via Telegram cuando un servicio falla (status != 200)
- [ ] **MON-04**: Deteccion de agentes caidos (sin heartbeat > 15 min) con alerta
- [ ] **MON-05**: Reporte diario a las 8:00 AM Chile con resumen de 24h via Telegram
- [ ] **MON-06**: Taxonomia de severidad: CRITICAL (inmediato) / WARNING (consolidado) / INFO (reporte diario)
- [ ] **MON-07**: Monitor Agent actualiza su propio agentsState en Convex (active/idle/error)
- [ ] **MON-08**: Workflows idempotentes: si n8n se reinicia, el workflow retoma sin duplicar alertas

### Leads Agent

- [ ] **LEAD-01**: Nueva tabla `leads` en Convex SAAN schema con campos: empresa, contacto, email, industria, tamano, score, status, source, enrichedData
- [ ] **LEAD-02**: Busqueda de prospectos B2B via Firecrawl (scrape de directorios empresariales)
- [ ] **LEAD-03**: Enriquecimiento de leads: scrape del sitio web del prospecto con Firecrawl (descripcion, productos, stack)
- [ ] **LEAD-04**: Scoring IA con Gemini 2.5 Flash Lite: 100 puntos → HOT (80+) / WARM (50-79) / NURTURE (20-49) / SKIP (<20)
- [ ] **LEAD-05**: Scoring en modo batch async (respetar 5 RPM Gemini Pro / 10 RPM Flash)
- [ ] **LEAD-06**: Leads calificados como HOT generan task automatica para Sales (toAgent:"sales" o "human" si no hay Sales Agent)
- [ ] **LEAD-07**: Leads Agent guarda resultados de scoring en agentMemory para aprendizaje
- [ ] **LEAD-08**: Deduplicacion de leads por email/empresa antes de insertar

### Finance Agent

- [ ] **FIN-01**: Nueva tabla `financialMetrics` en Convex SAAN con campos: date, mrr, churn, ltv, activeSubscriptions, failedPayments
- [ ] **FIN-02**: Monitoreo de suscripciones via webhook de Reveniu (o dLocal Go cuando este activo)
- [ ] **FIN-03**: Calculo diario de MRR (Monthly Recurring Revenue) basado en suscripciones activas
- [ ] **FIN-04**: Calculo de churn rate mensual (suscripciones canceladas / total inicio de mes)
- [ ] **FIN-05**: Alerta via Telegram cuando un cobro falla
- [ ] **FIN-06**: Reporte financiero semanal via Telegram (MRR, churn, LTV, tendencia)
- [ ] **FIN-07**: Finance Agent guarda metricas historicas en agentMemory para detectar tendencias

### Agent Learning

- [ ] **LEARN-01**: Patron "memory-before-action": cada agente consulta insights previos antes de ejecutar
- [ ] **LEARN-02**: Patron "action-then-record": cada agente guarda resultado de ejecucion en agentMemory
- [ ] **LEARN-03**: Workflow de reflexion semanal: consulta ultimas 50 memorias, envia a Gemini, guarda 1-3 insights
- [ ] **LEARN-04**: Retencion escalonada: insights=permanente, reports=90 dias, errors=30 dias, decisions=180 dias
- [ ] **LEARN-05**: Cron de purga mensual para memorias expiradas

### Dashboard CEO

- [ ] **DASH-01**: Seccion de health de servicios en tiempo real (datos de systemHealth)
- [ ] **DASH-02**: Estado de cada agente con ultimo run, proximo run, error count
- [ ] **DASH-03**: Lista de tareas pendientes del CEO (agentTasks con toAgent:"human")
- [ ] **DASH-04**: Metricas clave: leads nuevos hoy, MRR actual, uptime %
- [ ] **DASH-05**: Dashboard NO usa suscripciones reactivas a tablas completas (optimizar queries para evitar bandwidth bloat)

## v2 Requirements

### Sales Agent (Fase 4)

- **SALE-01**: Secuencias de email personalizadas por IA via Resend
- **SALE-02**: Outreach multi-canal: Email → LinkedIn → WhatsApp
- **SALE-03**: Deteccion de respuestas y clasificacion (positiva/negativa/pregunta)

### Marketing Agent (Fase 4)

- **MKT-01**: Generacion de ideas de contenido basadas en tendencias (Perplexity)
- **MKT-02**: Borradores de blog posts y LinkedIn posts

### SEO Agent (Fase 5)

- **SEO-01**: Keyword tracking + page audits con Playwright
- **SEO-02**: Sugerencias de contenido basadas en gaps

### Intel Agent (Fase 5)

- **INTEL-01**: Monitoreo de cambios en sitios de competidores (Firecrawl)
- **INTEL-02**: Escaneo de mercado LATAM (Perplexity)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Workflow Agent (meta-agente) | Fase 6 — requiere todos los agentes operativos |
| Skill Discovery | Fase 7 — requiere ecosistema estable |
| Agent-to-agent commerce | Fase 8 — vision 2028+ |
| Mobile app | Web dashboard es suficiente para CEO |
| Real-time chat con agentes | Telegram cubre la comunicacion bidireccional |
| ScrapingBee integration | Firecrawl cubre la extraccion; ScrapingBee se agrega en v2 si se necesita volumen |
| PhantomBuster (LinkedIn) | Se integra en Fase 4 con Sales Agent |
| Multi-idioma | Solo espanol (es-CL) por ahora |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 2 | Pending |
| INFRA-02 | Phase 2 | Pending |
| INFRA-03 | Phase 2 | Pending |
| INFRA-04 | Phase 2 | Pending |
| INFRA-05 | Phase 2 | Pending |
| INFRA-06 | Phase 2 | Pending |
| INFRA-07 | Phase 2 | Pending |
| MON-01 | Phase 3 | Pending |
| MON-02 | Phase 3 | Pending |
| MON-03 | Phase 3 | Pending |
| MON-04 | Phase 3 | Pending |
| MON-05 | Phase 3 | Pending |
| MON-06 | Phase 3 | Pending |
| MON-07 | Phase 3 | Pending |
| MON-08 | Phase 3 | Pending |
| LEAD-01 | Phase 4 | Pending |
| LEAD-02 | Phase 4 | Pending |
| LEAD-03 | Phase 4 | Pending |
| LEAD-04 | Phase 4 | Pending |
| LEAD-05 | Phase 4 | Pending |
| LEAD-06 | Phase 4 | Pending |
| LEAD-07 | Phase 4 | Pending |
| LEAD-08 | Phase 4 | Pending |
| FIN-01 | Phase 5 | Pending |
| FIN-02 | Phase 5 | Pending |
| FIN-03 | Phase 5 | Pending |
| FIN-04 | Phase 5 | Pending |
| FIN-05 | Phase 5 | Pending |
| FIN-06 | Phase 5 | Pending |
| FIN-07 | Phase 5 | Pending |
| LEARN-01 | Phase 6 | Pending |
| LEARN-02 | Phase 6 | Pending |
| LEARN-03 | Phase 6 | Pending |
| LEARN-04 | Phase 6 | Pending |
| LEARN-05 | Phase 6 | Pending |
| DASH-01 | Phase 6 | Pending |
| DASH-02 | Phase 6 | Pending |
| DASH-03 | Phase 6 | Pending |
| DASH-04 | Phase 6 | Pending |
| DASH-05 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation*

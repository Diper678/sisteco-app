# Roadmap: SAAN v1.0 — Monitor + Leads + Finance Agents

## Overview

SAAN transforma a Sisteco de empresa con herramientas de IA a empresa operada por agentes autonomos. La Fase 1 (schema, mutations, dashboard skeleton, orchestrator) ya esta completa. Este roadmap cubre las Fases 2-3: construir la capa HTTP y Telegram que conecta todo, luego desplegar tres agentes (Monitor, Leads, Finance) con aprendizaje autonomo y un dashboard CEO funcional. Al final, los agentes operan 24/7, aprenden de sus datos, y reportan al CEO via Telegram.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Schema, mutations, dashboard skeleton, orchestrator base (COMPLETE)
- [ ] **Phase 2: HTTP Layer + Telegram Bot** - Infraestructura de comunicacion que conecta n8n con Convex y el CEO con los agentes
- [ ] **Phase 3: Monitor Agent** - Vigilancia 24/7 de todos los servicios con alertas inteligentes
- [ ] **Phase 4: Leads Agent** - Busqueda, enriquecimiento y scoring automatizado de prospectos B2B
- [ ] **Phase 5: Finance Agent** - Monitoreo financiero con metricas en tiempo real y reportes semanales
- [ ] **Phase 6: Agent Learning + Dashboard CEO** - Aprendizaje autonomo entre agentes y panel de control operativo

## Phase Details

### Phase 1: Foundation
**Goal**: Esquema de datos, mutations basicas, dashboard skeleton y orchestrator base listos
**Depends on**: Nothing (first phase)
**Requirements**: Phase 1 validated requirements (see PROJECT.md)
**Status**: COMPLETE (2026-03-05)
**Plans**: Complete

### Phase 2: HTTP Layer + Telegram Bot
**Goal**: n8n puede leer y escribir datos en Convex via HTTP Actions, y el CEO puede interactuar con los agentes via Telegram
**Depends on**: Phase 1
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07
**Success Criteria** (what must be TRUE):
  1. n8n puede llamar cualquier mutation/query de Convex SAAN via endpoints HTTP en *.convex.site con autenticacion por shared secret
  2. El CEO puede enviar /status, /help y /health al bot de Telegram y recibir respuestas correctas
  3. Todos los mensajes Telegram pasan por una cola centralizada que respeta rate limits (30 msg/sec)
  4. Un circuit breaker global detiene agentes que excedan su limite de tareas por hora
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Monitor Agent
**Goal**: El sistema vigila automaticamente todos los servicios 24/7, detecta caidas en minutos, y entrega un reporte diario al CEO
**Depends on**: Phase 2
**Requirements**: MON-01, MON-02, MON-03, MON-04, MON-05, MON-06, MON-07, MON-08
**Success Criteria** (what must be TRUE):
  1. Cada 5 minutos se verifica Vercel, Convex Landing, Convex SAAN y n8n, registrando latencia y status en systemHealth
  2. Si un servicio falla o un agente lleva >15 min sin heartbeat, el CEO recibe alerta critica instantanea en Telegram
  3. A las 8:00 AM Chile el CEO recibe un resumen de 24h con uptime, incidentes y estado de agentes
  4. Las alertas usan taxonomia de severidad (CRITICAL/WARNING/INFO) para evitar fatiga de notificaciones
  5. Si n8n se reinicia, los workflows retoman sin duplicar alertas ni perder estado
**Plans**: 2 planes

Plans:
- [ ] 03-01-PLAN.md — Funciones Convex del Monitor Agent + workflow heartbeat cada 5 min
- [ ] 03-02-PLAN.md — Workflow de reporte diario 8:00 AM Chile

### Phase 4: Leads Agent
**Goal**: Sisteco descubre, enriquece y califica prospectos B2B automaticamente, generando tareas de venta para los leads mas prometedores
**Depends on**: Phase 2
**Requirements**: LEAD-01, LEAD-02, LEAD-03, LEAD-04, LEAD-05, LEAD-06, LEAD-07, LEAD-08
**Success Criteria** (what must be TRUE):
  1. El agente descubre prospectos B2B via Firecrawl y los almacena en tabla leads de Convex con deduplicacion por email/empresa
  2. Cada lead se enriquece con datos del sitio web del prospecto (descripcion, productos, stack) via Firecrawl
  3. El scoring IA con Gemini 2.5 Flash Lite clasifica cada lead en HOT/WARM/NURTURE/SKIP respetando rate limits (batch async)
  4. Los leads HOT generan automaticamente una tarea para el CEO (toAgent:"human") visible en dashboard y Telegram
  5. El agente guarda resultados de scoring en agentMemory para mejorar sus decisiones futuras
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Finance Agent
**Goal**: Sisteco tiene visibilidad financiera en tiempo real con alertas de cobros fallidos y reportes semanales automaticos
**Depends on**: Phase 2
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04, FIN-05, FIN-06, FIN-07
**Success Criteria** (what must be TRUE):
  1. Las suscripciones se monitorean via webhook de Reveniu y los datos se almacenan en tabla financialMetrics de Convex
  2. MRR, churn rate y LTV se calculan diariamente basado en suscripciones activas
  3. El CEO recibe alerta instantanea en Telegram cuando un cobro falla
  4. Cada lunes el CEO recibe reporte financiero semanal via Telegram con MRR, churn, LTV y tendencia
  5. El agente guarda metricas historicas en agentMemory para detectar tendencias
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Agent Learning + Dashboard CEO
**Goal**: Los agentes aprenden de su historial y el CEO tiene un dashboard operativo con toda la informacion critica en un solo lugar
**Depends on**: Phase 3, Phase 4, Phase 5
**Requirements**: LEARN-01, LEARN-02, LEARN-03, LEARN-04, LEARN-05, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. Cada agente consulta sus insights previos antes de ejecutar (memory-before-action) y registra resultados despues (action-then-record)
  2. Semanalmente un workflow de reflexion analiza las ultimas 50 memorias con Gemini y genera 1-3 insights nuevos
  3. Las memorias expiran segun retencion escalonada (insights=permanente, reports=90d, errors=30d, decisions=180d) con purga mensual automatica
  4. El dashboard muestra health de servicios, estado de agentes, tareas pendientes del CEO y metricas clave (leads, MRR, uptime) sin suscripciones reactivas a tablas completas
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

## Progress

**Execution Order:**
Phases 4 and 5 can execute in parallel after Phase 2. Phase 6 requires Phases 3, 4, and 5 complete.
Order: 2 -> 3 -> 4 || 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | - | Complete | 2026-03-05 |
| 2. HTTP Layer + Telegram Bot | 0/? | Not started | - |
| 3. Monitor Agent | 0/2 | Planned | - |
| 4. Leads Agent | 0/? | Not started | - |
| 5. Finance Agent | 0/? | Not started | - |
| 6. Agent Learning + Dashboard CEO | 0/? | Not started | - |

# Requirements: Sisteco Vertical B2B — Lead Gen + Data Layer + Dashboard

**Defined:** 2026-03-05 (SAAN v1.0)
**Pivotado:** 2026-03-09 (Vertical SaaS B2B Chile)
**Core Value:** Inteligencia de datos B2B chilena que ningun competidor internacional puede replicar.

---

## v1 Requirements (Q1-Q2 2026) — REVENUE FIRST

### Pipeline de Leads (Fase 1 — INMEDIATO)

- [x] **LEAD-01**: PhantomBuster workflow activo: LinkedIn Search (gratuito) → extraccion de prospectos 3x/semana (L/Mi/Vi 07:00)
- [x] **LEAD-02**: Datos extraidos se guardan en Convex tabla `leads` (empresa, contacto, email, LinkedIn URL, industria, tamano)
- [x] **LEAD-03**: Enriquecimiento con Firecrawl: scrape del sitio web del prospecto (descripcion, productos, stack, tamano)
- [x] **LEAD-04**: Scoring IA con Gemini: 100 puntos → HOT (80+) / WARM (50-79) / NURTURE (20-49) / SKIP (<20)
- [x] **LEAD-05**: Deduplicacion de leads por email/dominio antes de insertar
- [x] **LEAD-06**: Leads HOT generan notificacion al CEO/vendedor via Discord webhook
- [ ] **LEAD-07**: ICP (Ideal Customer Profile) configurable por cliente
- [ ] **LEAD-08**: Exportacion CSV de leads filtrados

### Dashboard de Clientes (Fase 2)

- [x] **DASH-01**: Login con Clerk (email + Google OAuth)
- [x] **DASH-02**: Vista de leads con filtros (score, industria, estado, fecha)
- [x] **DASH-03**: KPIs principales: leads nuevos, leads HOT, tasa de conversion, pipeline value
- [x] **DASH-04**: Detalle de lead individual (datos enriquecidos, score breakdown, timeline)
- [x] **DASH-05**: Multi-tenant: cada cliente ve solo sus datos
- [x] **DASH-06**: Responsive (funciona en movil para vendedores)
- [x] **DASH-07**: Dashboard NO usa suscripciones reactivas a tablas completas (optimizar queries)

### Datos B2B Chile (Fase 3)

- [ ] **DATA-01**: Integracion con datos publicos del SII (RUTs, actividad economica, tamano)
- [ ] **DATA-02**: Enriquecimiento con fuentes locales: SOFOFA, Camaras de Comercio, INE
- [ ] **DATA-03**: Base de datos de industrias chilenas con clasificacion CIIU
- [ ] **DATA-04**: Verificacion de emails via herramientas de validacion
- [ ] **DATA-05**: Score de calidad de dato (completitud, frescura, verificacion)

### Compliance Ley 21.719 (Transversal)

- [x] **COMP-01**: Aviso de privacidad en dashboard y comunicaciones
- [ ] **COMP-02**: Registro de bases de datos ante futura Agencia de Proteccion de Datos
- [x] **COMP-03**: Mecanismo de opt-out/eliminacion de datos para leads
- [ ] **COMP-04**: Logging de consentimiento y base legal por lead
- [x] **COMP-05**: Politica de retencion de datos (auto-purga configurable)

### Infraestructura Base (Reutilizada de SAAN)

- [x] **INFRA-01**: Convex HTTP Actions para comunicacion n8n ↔ Convex
- [x] **INFRA-02**: Autenticacion via shared secret
- [ ] **INFRA-03**: Discord webhook para alertas al CEO
- [x] **INFRA-06**: Rate limiting en comunicaciones
- [x] **INFRA-07**: Circuit breaker para workflows

### Monetizacion (Fase 4)

- [ ] **PAY-01**: Cobro mensual via Reveniu (CLP, sin entidad legal)
- [ ] **PAY-02**: Planes: Starter ($99.990 CLP), Growth ($249.990 CLP), Enterprise (custom)
- [ ] **PAY-03**: Trial de 14 dias con datos reales del prospecto
- [ ] **PAY-04**: Metricas: MRR, churn, LTV calculados automaticamente

---

## v2 Requirements (Q3-Q4 2026) — ESCALAR

### Integraciones Locales

- [ ] **INT-01**: SII: consulta de datos empresariales por RUT
- [ ] **INT-02**: Facturacion electronica (DTE) via Bsale o similar
- [ ] **INT-03**: Integracion con CRMs populares en Chile (HubSpot, Pipedrive)
- [ ] **INT-04**: WhatsApp Business API para outreach
- [ ] **INT-05**: Flow.cl / Khipu como opciones de pago adicionales

### Outreach Automatizado (via Lindy o similar)

- [ ] **OUT-01**: Secuencias de email personalizadas por IA
- [ ] **OUT-02**: Outreach multi-canal: Email → LinkedIn → WhatsApp
- [ ] **OUT-03**: Agendamiento automatico de reuniones
- [ ] **OUT-04**: Deteccion de respuestas y clasificacion

### Analytics Avanzados

- [ ] **ANA-01**: Benchmarking anonimizado entre clientes (por industria)
- [ ] **ANA-02**: Prediccion de conversion basada en datos historicos
- [ ] **ANA-03**: ROI calculator: impacto de Sisteco en ventas del cliente
- [ ] **ANA-04**: Reportes automaticos semanales por email

### Data Flywheel

- [ ] **FLY-01**: Modelo de scoring mejora con datos de conversion de todos los clientes
- [ ] **FLY-02**: Base de datos B2B crece con cada nuevo cliente (datos compartidos anonimizados)
- [ ] **FLY-03**: API publica para que agentes de terceros consulten datos (preparar para A2A)

---

## Out of Scope

| Feature | Razon |
|---------|-------|
| Construir agentes AI custom | Usar plataformas existentes (Lindy, etc.) |
| Agent-to-agent commerce | Vision 2028+ |
| SAAN como red de agentes | Pivotado a vertical SaaS |
| Sales Agent propio | Usar Lindy o Instantly.ai |
| Marketing Agent propio | Postergado, no genera revenue directo |
| SEO Agent | Postergado |
| Intel Agent | Postergado |
| Mobile app | Dashboard web responsive es suficiente |
| Multi-idioma | Solo espanol (es-CL) |
| Expansion LATAM | Investigar en Q4 2026, ejecutar en 2027 |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LEAD-01 a 06 | Phase 1: Pipeline de Leads | Partial (schema + workflows from SAAN) |
| LEAD-07, LEAD-08 | Phase 3: Dashboard Build | Pending |
| DASH-01 a DASH-07 | Phase 3 Plans 01-05 | Complete |
| DATA-01 a 05 | Phase 1 (SII basico) + H2 (resto) | Partial |
| COMP-01 a 05 | Phase 4: Compliance | Pending |
| INFRA-01,02,06,07 | Reutilizado de SAAN v1.0 | Complete |
| INFRA-03 | Pospuesto (Discord alertas) | Pending |
| PAY-01 a 04 | Phase 5: Onboarding | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to H1 phases: 31
- Reutilizado de SAAN: 4 (INFRA)
- v2 requirements: 14 total (H2 scope)
- Unmapped: 0

---
*Requirements redefined: 2026-03-09 (Strategic Pivot to Vertical SaaS v2.0)*

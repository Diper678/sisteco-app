# Roadmap: Sisteco v2.0 — Vertical SaaS B2B Chile

## Overview

Sisteco es la plataforma de inteligencia de leads B2B para Chile. Pipeline de
datos automatizado (PhantomBuster + LinkedIn Search + SII) alimenta un dashboard
multi-tenant donde cada cliente ve sus leads calificados y listos para trabajar.

Este roadmap cubre el Horizonte 1 (MVP Revenue): activar pipeline, construir
dashboard desde cero, y conseguir los primeros clientes fundadores pagando.

## Phases

- [ ] **Phase 1: Pipeline de Leads Activo** - Activar workflows reales: PhantomBuster extrae, SII valida, Gemini califica, datos llegan a Convex
- [ ] **Phase 2: Diseno Dashboard (Colaborativo)** - Usuario investiga mercado, selecciona referencias, define UX. Claude propone wireframes.
- [ ] **Phase 3: Dashboard Build** - Construir dashboard multi-tenant multi-rol desde cero conectado a datos reales de Convex
- [ ] **Phase 4: Compliance Basico Ley 21.719** - RAT, opt-out, base legal documentada, aviso de privacidad — lo minimo para operar legal
- [ ] **Phase 5: Onboarding Clientes Fundadores** - Trial con datos reales, cobro via Reveniu, primeros 3-10 clientes pagando

## Phase Details

### Phase 1: Pipeline de Leads Activo
**Goal**: Los workflows generan leads reales: PhantomBuster extrae de LinkedIn, SII valida empresas, Gemini califica, todo llega a Convex listo para mostrar
**Depends on**: Nothing (reutiliza trabajo de SAAN v1.0 phases 04-01, 04-02, 04-03)
**Requirements**: LEAD-01, LEAD-02, LEAD-03, LEAD-04, LEAD-05, LEAD-06
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — Fix HTTP allowlist + auth header bugs (blocker for all workflows)
- [x] 01-02-PLAN.md — SII enrichment workflow via SimpleAPI (datos chilenos)
- [ ] 01-03-PLAN.md — Scoring auth fix + Telegram HOT notifications + pipeline activation

**Success Criteria**:
  1. PhantomBuster extrae prospectos de LinkedIn Search (gratuito) 3x/semana y los guarda en Convex
  2. Cada lead se enriquece con datos SII (RUT, rubro, tamano) automaticamente
  3. Gemini 2.5 Flash Lite clasifica cada lead en HOT/WARM/NURTURE/SKIP
  4. Leads HOT generan notificacion (Telegram o email)
  5. El pipeline corre sin intervencion manual por al menos 1 semana

### Phase 2: Diseno Dashboard (Colaborativo)
**Goal**: Tener un diseno aprobado del dashboard que refleje el mercado actual de SaaS B2B, listo para construir
**Depends on**: Nothing (paralelo a Phase 1)
**Requirements**: DASH-01 a DASH-07 (definicion visual)
**Plans:** 2 plans

Plans:
- [ ] 02-01-PLAN.md — Design system compartido + mockup vista CEO (KPIs narrativos, funnel, segmentacion)
- [ ] 02-02-PLAN.md — Mockups VP Ventas (pipeline + equipo) y SDR (to-do + lead detail panel)

**Success Criteria**:
  1. Usuario ha investigado 5+ dashboards SaaS B2B como referencia
  2. Moodboard/referencias compartidas con ejemplos de lo que funciona
  3. Wireframes propuestos y validados para 3 vistas: CEO, VP Ventas, SDR
  4. Diseno visual final aprobado antes de escribir codigo

### Phase 3: Dashboard Build
**Goal**: Dashboard funcional multi-tenant multi-rol conectado a datos reales de Convex
**Depends on**: Phase 1 (datos reales), Phase 2 (diseno aprobado)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07
**Success Criteria**:
  1. Login con Clerk (email + Google OAuth) con organizations para multi-tenant
  2. Cada empresa ve SOLO sus leads (aislamiento por org)
  3. Vista CEO: KPIs (leads nuevos, HOT, conversion, pipeline value)
  4. Vista VP Ventas: pipeline completo, filtros, rendimiento equipo
  5. Vista SDR: leads asignados, scores, acciones pendientes
  6. Responsive en movil
  7. Conectado a datos reales de Convex (no mockups)

### Phase 4: Compliance Basico Ley 21.719
**Goal**: Cumplir los requisitos minimos de la Ley 21.719 para operar legalmente con datos B2B
**Depends on**: Phase 1 (hay datos que proteger), Phase 3 (dashboard donde mostrar avisos)
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05
**Success Criteria**:
  1. RAT (Registro de Actividades de Tratamiento) documentado
  2. Aviso de privacidad visible en dashboard
  3. Mecanismo de opt-out funcional (lead puede pedir eliminacion)
  4. Base legal documentada por tipo de dato (legitimo interes para B2B)
  5. Politica de retencion implementada

### Phase 5: Onboarding Clientes Fundadores
**Goal**: Los primeros 3-10 clientes fundadores usan Sisteco con datos reales y pagan mensualmente
**Depends on**: Phase 3 (dashboard listo), Phase 4 (compliance basico)
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04
**Success Criteria**:
  1. Trial de 14 dias con datos reales del vertical del prospecto
  2. Cobro mensual via Reveniu funcionando
  3. Al menos 3 clientes fundadores pagando
  4. Caso de estudio documentado de al menos 1 cliente

## Progress

**Execution Order:**
Phases 1 y 2 son paralelas. Phase 3 requiere ambas. Phase 4 requiere 1 y 3. Phase 5 requiere 3 y 4.
Order: 1 || 2 -> 3 -> 4 -> 5

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 1. Pipeline de Leads | 3 plans (2 waves) | 2/3 plans complete | - |
| 2. Diseno Dashboard | 2 plans (2 waves) | Not started | - |
| 3. Dashboard Build | TBD | Not started | - |
| 4. Compliance Ley 21.719 | TBD | Not started | - |
| 5. Onboarding Fundadores | TBD | Not started | - |

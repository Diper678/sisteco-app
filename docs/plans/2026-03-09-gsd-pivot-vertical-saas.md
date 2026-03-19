# Pivote GSD: SAAN v1.0 → Vertical SaaS v2.0

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reestructurar el marco GSD para reflejar el pivote de SAAN (agentes custom) a Vertical SaaS B2B Chile (pipeline datos + dashboard + compliance).

**Architecture:** Archivar milestone v1.0 (SAAN), crear milestone v2.0 con fases alineadas al Horizonte 1 del diseno aprobado. Reutilizar 100% del trabajo de Leads Agent (04-01, 04-02, 04-03). Dashboard desde cero con fase de diseno colaborativo.

**Tech Stack:** GSD planning framework (.planning/ directory), Markdown documents

---

### Task 1: Archivar Milestone v1.0 (SAAN)

**Files:**
- Create: `.planning/archive/v1.0-saan/ROADMAP.md`
- Create: `.planning/archive/v1.0-saan/STATE.md`
- Create: `.planning/archive/v1.0-saan/MILESTONES.md`

**Step 1: Crear directorio de archivo**

```bash
mkdir -p ".planning/archive/v1.0-saan"
```

**Step 2: Copiar archivos actuales al archivo**

```bash
cp .planning/ROADMAP.md .planning/archive/v1.0-saan/ROADMAP.md
cp .planning/STATE.md .planning/archive/v1.0-saan/STATE.md
```

**Step 3: Crear MILESTONES.md con registro del trabajo completado**

Crear `.planning/MILESTONES.md`:

```markdown
# Milestones

## v1.0 — SAAN (Autonomous Agent Network)
**Status:** Archived (pivoted)
**Period:** 2026-03-05 to 2026-03-09
**Outcome:** Pivotado a Vertical SaaS. Trabajo reutilizable: Leads schema, workflows, scoring.

### Completed
- Phase 1: Foundation (schema, mutations, dashboard skeleton)
- Phase 3: Monitor Agent (health checks, daily reports)
- Phase 4 parcial: Leads Agent (04-01 schema, 04-02 discovery, 04-03 scoring)

### Archived (not continued)
- Phase 2: HTTP Layer + Discord Bot (parcial — 1/2 plans)
- Phase 4: 04-04 Skill Metacognition (concepto SAAN)
- Phase 5: Finance Agent (no ejecutado)
- Phase 6: Agent Learning + Dashboard CEO (no ejecutado)

## v2.0 — Vertical SaaS B2B Chile
**Status:** Active
**Started:** 2026-03-09
**Goal:** Pipeline de leads activo + dashboard con datos reales → primeros clientes pagando
```

**Step 4: Commit**

```bash
git add .planning/archive/ .planning/MILESTONES.md
git commit -m "docs: archive SAAN v1.0 milestone before vertical SaaS pivot"
```

---

### Task 2: Actualizar PROJECT.md

**Files:**
- Modify: `.planning/PROJECT.md`

**Step 1: Reescribir PROJECT.md con vision Vertical SaaS**

Mantener las secciones existentes pero actualizar:
- "What This Is" → Vertical SaaS, no SAAN
- "Requirements Active" → H1 del diseno aprobado (pipeline + dashboard + compliance basico)
- "Constraints" → agregar "Dashboard desde cero, diseno liderado por usuario"
- "Key Decisions" → agregar decision del pivote con fecha

Contenido clave a reflejar:
- Pipeline: PhantomBuster + Sales Nav + SII → Convex
- Dashboard: nuevo desde cero, multi-tenant, multi-rol
- Compliance: basico Ley 21.719 (RAT, opt-out)
- NO agentes (hasta H3)
- Fase de diseno: usuario lidera investigacion de mercado antes de build

**Step 2: Commit**

```bash
git add .planning/PROJECT.md
git commit -m "docs: update PROJECT.md for vertical SaaS pivot"
```

---

### Task 3: Crear nuevo ROADMAP.md (v2.0)

**Files:**
- Modify: `.planning/ROADMAP.md` (rewrite completo)

**Step 1: Escribir nuevo roadmap con fases H1**

```markdown
# Roadmap: Sisteco v2.0 — Vertical SaaS B2B Chile

## Overview

Sisteco es la plataforma de inteligencia de leads B2B para Chile. Pipeline de
datos automatizado (PhantomBuster + Sales Nav + SII) alimenta un dashboard
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
**Reutiliza**: Leads schema (04-01), discovery workflows (04-02), scoring AI (04-03)
**Trabajo nuevo**: Integracion SII (validacion RUT), activacion real de PhantomBuster, conectar todo end-to-end
**Success Criteria**:
  1. PhantomBuster extrae prospectos de LinkedIn Sales Nav 3x/semana y los guarda en Convex
  2. Cada lead se enriquece con datos SII (RUT, rubro, tamano) automaticamente
  3. Gemini 2.5 Flash Lite clasifica cada lead en HOT/WARM/NURTURE/SKIP
  4. Leads HOT generan notificacion (Discord o email)
  5. El pipeline corre sin intervencion manual por al menos 1 semana

### Phase 2: Diseno Dashboard (Colaborativo)
**Goal**: Tener un diseno aprobado del dashboard que refleje el mercado actual de SaaS B2B, listo para construir
**Depends on**: Nothing (paralelo a Phase 1)
**Requirements**: DASH-01 a DASH-07 (definicion visual)
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
| 1. Pipeline de Leads | TBD | Not started | - |
| 2. Diseno Dashboard | TBD | Not started | - |
| 3. Dashboard Build | TBD | Not started | - |
| 4. Compliance Ley 21.719 | TBD | Not started | - |
| 5. Onboarding Fundadores | TBD | Not started | - |
```

**Step 2: Commit**

```bash
git add .planning/ROADMAP.md
git commit -m "docs: new roadmap v2.0 — vertical SaaS B2B Chile (5 phases)"
```

---

### Task 4: Actualizar REQUIREMENTS.md

**Files:**
- Modify: `.planning/REQUIREMENTS.md`

**Step 1: Actualizar para reflejar prioridades v2.0**

Cambios principales:
- Renumerar "Fases" en la seccion de trazabilidad para matchear nuevo roadmap
- Actualizar status de requirements LEAD-* que ya tienen trabajo hecho (schema, workflows)
- Marcar INFRA-01, 02, 06, 07 como reutilizados
- El documento ya esta bien orientado al vertical SaaS (fue actualizado el 2026-03-09)
- Solo necesita alinear la trazabilidad con las nuevas fases del roadmap

**Step 2: Commit**

```bash
git add .planning/REQUIREMENTS.md
git commit -m "docs: align requirements traceability with v2.0 roadmap phases"
```

---

### Task 5: Resetear STATE.md

**Files:**
- Modify: `.planning/STATE.md` (rewrite)

**Step 1: Escribir STATE.md limpio para v2.0**

```markdown
---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Vertical SaaS B2B Chile
status: planning
last_updated: "2026-03-09"
last_activity: 2026-03-09 — Pivote estrategico de SAAN a Vertical SaaS
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** Inteligencia de leads B2B chilena que ningun competidor internacional puede replicar.
**Current focus:** Phase 1 (Pipeline de Leads) y Phase 2 (Diseno Dashboard) en paralelo.

## Current Position

Phase: 1 of 5 (Pipeline de Leads Activo)
Plan: Pending planning
Status: Planning
Last activity: 2026-03-09 — Strategic pivot completed

Progress: [░░░░░░░░░░] 0%

## Reutilizacion de SAAN v1.0

Trabajo completado que se reutiliza directamente:
- 04-01: Leads schema + CRUD (Convex tables, mutations, dedup)
- 04-02: Multi-source discovery (Firecrawl search + scrape workflows)
- 04-03: AI Scoring (Gemini 2.5 Flash Lite scoring workflow)
- 02-01: Convex HTTP Actions (endpoints para n8n)
- 03-*: Monitor Agent (health checks — reutilizable como infra)

## Accumulated Context

### Decisions

- [2026-03-09]: Pivote de SAAN a Vertical SaaS B2B Chile
- [2026-03-09]: Reutilizar 100% de Leads Agent work (04-01, 04-02, 04-03)
- [2026-03-09]: Dashboard desde cero (no skeleton SAAN)
- [2026-03-09]: Diseno liderado por usuario (investigacion de mercado)
- [2026-03-09]: Agentes pospuestos a Horizonte 3 (2027+)
- [2026-03-09]: Fintechs/bancos pospuestos a Horizonte 2 (Q3-Q4 2026)
- [2026-03-09]: Fases 1 y 2 paralelas (pipeline + diseno)

### Blockers/Concerns

- PhantomBuster necesita configuracion real con Sales Navigator
- Datos SII: identificar API o scraping method para validacion RUT
- Clerk Organizations: configurar para multi-tenant
- Reveniu: verificar API para cobro automatizado

## Session Continuity

Last session: 2026-03-09
Stopped at: Strategic pivot — ready to plan Phase 1
Resume file: None
```

**Step 2: Commit**

```bash
git add .planning/STATE.md
git commit -m "docs: reset state for v2.0 milestone — vertical SaaS pivot"
```

---

### Task 6: Crear directorios de fases nuevas

**Files:**
- Create: `.planning/phases/01-pipeline-leads/`
- Create: `.planning/phases/02-diseno-dashboard/`
- Create: `.planning/phases/03-dashboard-build/`
- Create: `.planning/phases/04-compliance-21719/`
- Create: `.planning/phases/05-onboarding-fundadores/`

**Step 1: Mover fases viejas al archivo**

```bash
# Mover fases SAAN al archivo
mv .planning/phases/02-http-layer-discord-bot .planning/archive/v1.0-saan/
mv .planning/phases/03-monitor-agent .planning/archive/v1.0-saan/
mv .planning/phases/04-leads-agent .planning/archive/v1.0-saan/
mv .planning/phases/05-finance-agent .planning/archive/v1.0-saan/
```

**Step 2: Crear directorios nuevos**

```bash
mkdir -p .planning/phases/01-pipeline-leads
mkdir -p .planning/phases/02-diseno-dashboard
mkdir -p .planning/phases/03-dashboard-build
mkdir -p .planning/phases/04-compliance-21719
mkdir -p .planning/phases/05-onboarding-fundadores
```

**Step 3: Commit**

```bash
git add .planning/phases/ .planning/archive/
git commit -m "docs: restructure phases for v2.0 — archive SAAN, create vertical SaaS phases"
```

---

### Task 7: Actualizar memoria persistente

**Files:**
- Modify: `memory/MEMORY.md` (ruta: ~/.claude/projects/.../memory/MEMORY.md)

**Step 1: Actualizar snapshot de estado rapido**

Cambiar:
- Fase actual: H1 (Pipeline + Dashboard)
- Prioridad: Revenue first — pipeline activo + dashboard real → clientes pagando
- Progreso global: 0% del nuevo milestone (pero con trabajo reutilizable de SAAN)
- Ultimo update: 2026-03-09

**Step 2: No commit (memoria es local, no parte del repo)**

---

### Task 8: Verificacion final

**Step 1: Verificar estructura**

```bash
echo "=== Archive ===" && ls .planning/archive/v1.0-saan/
echo "=== New Phases ===" && ls .planning/phases/
echo "=== Core Files ===" && ls .planning/PROJECT.md .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md .planning/MILESTONES.md
```

Expected: Archivos SAAN en archive, 5 fases nuevas en phases, todos los core files presentes.

**Step 2: Verificar GSD reconoce la nueva estructura**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init progress
```

Expected: Muestra 5 fases, 0 completadas, milestone v2.0.

**Step 3: Commit final si hay ajustes**

```bash
git status
# Si hay cambios pendientes:
git add -A && git commit -m "docs: finalize v2.0 GSD restructure"
```

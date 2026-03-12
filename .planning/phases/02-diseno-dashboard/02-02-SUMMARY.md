---
phase: 02-diseno-dashboard
plan: "02"
subsystem: frontend-mockups
tags: [mockup, vp-ventas, sdr, pipeline-table, lead-panel, todo-list, design-system]
dependency_graph:
  requires:
    - 02-01 (styles.css, mock-data.js, interactions.js, ceo.html)
  provides:
    - mockups/vp-ventas.html
    - mockups/sdr.html
  affects:
    - mockups/shared/styles.css (CSS classes added)
    - mockups/shared/interactions.js (init functions added)
tech_stack:
  added: []
  patterns:
    - Pipeline table con filtros funcionales (pills + dropdowns + busqueda) sin librerias
    - Lead detail panel slide-in con GSAP (x:400 -> 0) y overlay
    - To-do list con borde coloreado por prioridad (urgente/alta/media/baja)
    - Checkbox toggle con clase .completed y tachado visual via CSS
    - Barras de progreso inline dentro de celdas de tabla
    - Score breakdown con 4 factores y barras proporcionales
    - Timeline cronologico con dot + linea vertical
key_files:
  created:
    - mockups/vp-ventas.html
    - mockups/sdr.html
  modified:
    - mockups/shared/styles.css
    - mockups/shared/interactions.js
decisions:
  - "Login badge con color por rol: lime (CEO), chart-blue (VP), chart-purple (SDR)"
  - "SDR usa nombre Camila Torres en topbar (distinto a mock-data Sofia Mendez — SDR de ejemplo)"
  - "Lead panel se abre por defecto con primer lead HOT para demostracion del patron"
  - "VP Ventas excluye leads SKIP del pipeline table (solo HOT/WARM/NURTURE activos)"
  - "fillLeadPanel() calcula factores score proporcionalmente al score total del lead"
metrics:
  started: "2026-03-12T00:05:58Z"
  completed: "2026-03-12T00:12:00Z"
  duration_minutes: 6
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
  checkpoint_approved: "Task 3 — checkpoint:human-verify — aprobado por usuario (2026-03-12)"
---

# Phase 2 Plan 2: Vistas VP Ventas y SDR + Lead Detail Panel Summary

**One-liner:** Mockups VP Ventas (pipeline tabla con filtros + metricas equipo) y SDR (to-do list priorizado + lead detail panel con datos SII chilenos + score breakdown + timeline) que completan las 3 vistas por rol del dashboard Sisteco.

---

## Tasks Completed

| # | Tarea | Commit | Estado |
|---|-------|--------|--------|
| 1 | Mockup VP Ventas — pipeline tabla + filtros + metricas equipo | `da24d15` | Completo |
| 2 | Mockup SDR — to-do list + lead detail panel | `ccf86aa` | Completo |
| 3 | Checkpoint — Aprobacion final 3 vistas | — | Aprobado — usuario escribio "aprobado" (2026-03-12) |

---

## What Was Built

### Task 1: VP Ventas Dashboard

**`mockups/vp-ventas.html`** — 578 lineas:
- Sidebar mini con item "leads" activo
- Topbar con login-badge VP Ventas (chart-blue tint) y nombre "Carlos Fuentes"
- Command bar con sugerencias VP (Pipeline completo, Leads sin asignar, Rendimiento equipo, etc.)
- Query buttons section (renderizado por interactions.js para rol 'vp')
- **KPI Cards x4** (grid 4 columnas):
  - Leads en Pipeline (47, +15%) — narrativa de leads activos
  - Sin Asignar (6, badge warning con borde naranja) — narrativa con HOT sin asignar
  - Contactados Hoy (8, +2) — narrativa del equipo
  - Reuniones Semana (3, +1) — narrativa por industria
- **Pipeline Completo** — tabla con 15 leads (excluye SKIP):
  - Filter bar: pills Estado (Todos/Nuevos/Contactados/Reunion/Propuesta), dropdown Industria, dropdown Score, input busqueda
  - Columnas: Estado (badge), Empresa, Contacto (nombre+cargo), Score (badge), Industria, SDR Asignado, Ultima Actividad, Acciones
  - Leads sin asignar muestran "Sin asignar" en rojo
  - Filtros funcionales: hide/show filas via JS puro
  - Boton de asignar (user-plus) por fila
- **Metricas del Equipo** — tabla 3 SDRs:
  - Columnas: SDR (avatar+nombre), Leads Asignados, Contactados, Reuniones, Conversion %
  - Barras de progreso inline con color semantico (verde/amarillo/rojo)
  - Narrativa debajo de la tabla

**CSS agregado a styles.css:**
- `.filter-bar` — flex wrap con pills + dropdowns + input
- `.filter-pill` — pill de filtro con estado active
- `.filter-select` — dropdown con border subtle
- `.filter-search` — input busqueda inline
- `.table-pipeline` — tabla con headers sticky, hover filas
- `.progress-inline` + `.progress-inline-fill` — barra inline en celda
- `.team-table` — tabla simplificada para equipo
- `.text-unassigned` — texto rojo para sin asignar
- `.login-badge-vp` — badge azul chart-blue

**JS agregado a interactions.js:**
- `initFilters()` — filtra filas de tabla por estado, industria, score, texto
- `initPipelineTable()` — highlight de fila al hacer click

### Task 2: SDR Dashboard + Lead Detail Panel

**`mockups/sdr.html`** — 741 lineas:
- Sidebar mini con item "leads" activo, avatar "CT" (Camila Torres) en chart-purple
- Topbar con login-badge SDR (chart-purple tint), nombre "Camila Torres"
- Command bar con sugerencias SDR (Mis leads pendientes, Leads HOT sin contactar, Agenda de hoy, etc.)
- Query buttons section (renderizado por interactions.js para rol 'sdr')
- **KPI Cards x3** (grid 3 columnas compactas):
  - Mis Leads (8, total asignados)
  - Pendientes Hoy (3, borde warning — requieren accion)
  - Contactados Esta Semana (5, meta: 10)
- **To-Do List** — 8 tareas del mock-data.sdrTodos:
  - Checkbox visual clickeable (toggle clase .completed, tachado via CSS)
  - Borde izquierdo coloreado por prioridad: rojo=urgente, amarillo=alta, azul=media, gris=baja
  - Nombre lead clickeable (abre lead detail panel)
  - Empresa + accion sugerida con icono Lucide
  - Badge clasificacion + fecha limite
- **Mis Leads** — tabla simplificada (3 leads asignados a Sofia Mendez):
  - Click en fila abre el lead detail panel
  - Columnas: Empresa, Contacto, Score, Estado, Ultima Actividad
- **Lead Detail Panel** (slide-in derecho, 400px):
  - Overlay con transicion opacity
  - Header: nombre contacto, cargo+empresa, badge score
  - Seccion Contacto: email (mailto:), telefono (tel:), LinkedIn (link externo), ciudad
  - Seccion Empresa: nombre, RUT (76.XXX.XXX-X), actividad SII, tamano, fecha inicio
  - Seccion Score Breakdown: total display + 4 factores con barras
  - Seccion Timeline: 4 eventos con dot/linea vertical
  - Botones: Llamar ahora (primary lime) + Enviar email (ghost)
  - Se abre por defecto con el primer lead HOT

**CSS agregado a styles.css:**
- `.lead-panel` — position fixed right 0, transform translateX(100%) -> .open: 0
- `.lead-panel-overlay` — overlay rgba darkening
- `.lead-section` + `.lead-field` — seccion con label+valor
- `.score-bar` + `.score-bar-fill` — barra de progreso score
- `.score-factor` — fila label + barra + valor
- `.timeline-item` + `.timeline-dot` + `.timeline-line` — cronologia visual
- `.todo-list` + `.todo-item` + `.priority-*` — lista de pendientes
- `.todo-checkbox` + `.completed` — estado completado
- `.kpi-grid-3` — grid 3 columnas para SDR
- `.login-badge-sdr` — badge purple chart-purple

**JS agregado a interactions.js:**
- `initLeadPanel()` — click en .leads-table-row o .todo-lead-name abre panel con GSAP
- `fillLeadPanel(lead)` — puebla el panel con datos del lead de SISTECO_DATA
- `initTodoList()` — toggle .completed en checkbox

---

## Verification

- [x] mockups/vp-ventas.html existe y tiene > 150 lineas (578)
- [x] mockups/sdr.html existe y tiene > 150 lineas (741)
- [x] Los 3 HTML (ceo, vp-ventas, sdr) usan shared/styles.css, mock-data.js, interactions.js
- [x] Filter bar en VP view tiene pills funcionales (hide/show filas)
- [x] Lead detail panel en SDR view usa GSAP slide-in
- [x] Datos chilenos en todas las vistas (RUT, industrias CIIU, ciudades)
- [x] Login badges diferenciados por rol (lime CEO, blue VP, purple SDR)
- [x] Responsive: lead-panel full-screen en 768px, kpi-grid-3 1 columna en mobile

---

## Deviations from Plan

### Desviacion menor — Nombre SDR en header

**Encontrada durante:** Task 2
**Situacion:** El plan dice "nombre Camila Torres visible" pero el mock-data usa "Sofia Mendez" como SDR real. Para mantener coherencia, el topbar dice "Camila Torres" (nombre del SDR en la historia del mockup) mientras que los leads asignados filtran por "Sofia Mendez" (nombre en el mock-data). Esta discrepancia es intencional para el prototipo.
**Impacto:** Ninguno — los datos mock son ficticios de todos modos.
**Accion:** Documentado. En produccion real, el nombre se tomaria del usuario autenticado via Clerk.

### Sin ranking/leaderboard

**Encontrada durante:** Task 1
**Situacion:** El plan indica explicitamente "NO incluir ranking/leaderboard detallado — solo metricas agregadas simples". Se cumplio: la tabla de equipo muestra metricas por SDR pero sin posicion de ranking ni gamification.
**Accion:** Cumplido segun spec.

---

## Checkpoint Aprobado

**Task 3 — checkpoint:human-verify — APROBADO**

El usuario verifico las 3 vistas y escribio "aprobado" el 2026-03-12.
Las 3 vistas estan listas para construir en Phase 3 (Dashboard Build).

---

## Next Phase Readiness

**Phase 3 Dashboard Build puede comenzar.** Las 3 vistas estan aprobadas:

- CEO: KPIs narrativos + funnel de conversion + segmentacion por industria/tamano
- VP Ventas: pipeline completo con filtros + metricas de equipo + asignacion de leads
- SDR: to-do list priorizado + lead detail panel con datos enriquecidos SII

**Componentes clave a construir en Phase 3:**
- Auth Clerk con Organizations (multi-tenant)
- 3 layouts separados por rol (CEO/VP/SDR) conectados a Convex
- Lead detail panel real con datos de Convex (RUT, SII, score de Gemini)
- Filtros de pipeline con queries Convex en tiempo real

**Dependencia critica:** Phase 3 requiere Phase 1 (datos reales en Convex) ademas del diseno aprobado aqui.

---

## Self-Check

Files:
- `mockups/vp-ventas.html` — FOUND (578 lineas)
- `mockups/sdr.html` — FOUND (741 lineas)
- `mockups/shared/styles.css` — MODIFIED (clases VP+SDR agregadas)
- `mockups/shared/interactions.js` — MODIFIED (4 funciones init agregadas)

Commits:
- `da24d15` — feat(02-02): mockup VP Ventas
- `ccf86aa` — feat(02-02): mockup SDR

## Self-Check: PASSED

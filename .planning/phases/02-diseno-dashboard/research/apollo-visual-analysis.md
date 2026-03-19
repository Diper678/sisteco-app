# Apollo.io Analytics — Analisis Visual para Sisteco

> Screenshots en `Visuales/apollo-analytics/` (52 capturas)
> Fecha: 2026-03-10

---

## 1. Patrones Visuales Identificados (de los screenshots)

### 1.1 KPI Cards — El patron mas fuerte de Apollo

**Screenshots:** `10-kpi-cards-prospecting.png`, `30-sales-dev-kpi-cards.png`, `36-email-engagement-kpis.png`, `39-call-engagement-kpis.png`

**Que hacen:**
- Fila horizontal de 3-5 KPI cards al tope del dashboard
- Cada card: label + numero grande + delta (flecha up/down con color verde/rojo)
- Delta muestra cambio desde periodo anterior ("From May 1")
- Badge de color: verde = mejora, rojo = deterioro
- Icono (i) para tooltip con definicion

**Lo que Sisteco debe adoptar:**
- El patron funciona perfectamente. Adoptarlo 1:1 pero con estetica Sisteco (warm, pills, bordes sutiles)
- AGREGAR interpretacion narrativa debajo ("Tus leads HOT subieron 15% — estas captando mejor a empresas de tecnologia")
- Esto es lo que Apollo NO tiene y que el CEO necesita

**Lo que Sisteco debe mejorar:**
- Apollo trunca labels ("# Accounts T...", "# Tasks Com...") — disenar cards con labels completos
- Apollo usa colores genericos (rojo/verde) — Sisteco puede usar su lime #c5ed36 para positivo

---

### 1.2 Funnel Charts — Conversion visual

**Screenshots:** `12-email-funnel.png`, `13-call-funnel.png`, `37-email-funnel-detailed.png`, `40-call-funnel-detailed.png`

**Que hacen:**
- Barras decrecientes de izquierda a derecha (100% → % final)
- Cada etapa: porcentaje arriba + numero absoluto
- Colores degradados del mismo tono (azul fuerte → azul claro)
- Etapas: Contacts → Emailed → Replied → Interested

**Adaptacion para Sisteco:**
- Pipeline funnel: Leads nuevos → Enriquecidos (SII) → Scored → HOT → Contactados → Convertidos
- Usar el mismo patron visual pero con colores Sisteco
- El funnel es perfecto para la vista CEO ("de 100 leads, 12 llegaron a HOT, 3 se convirtieron")
- QUERY NLP: "como va mi funnel" o "cuantos leads se convirtieron este mes"

---

### 1.3 Tablas Segmentadas — Demographics / Breakdown

**Screenshots:** `16-engaged-personas-email.png`, `17-engaged-titles-email.png`, `18-engaged-company-sizes-email.png`, `19-engaged-industries-email.png`

**Que hacen:**
- Bar chart horizontal con multiples metricas por categoria (colores distintos por metrica)
- Eje Y: dimension de segmentacion (persona, titulo, tamano empresa, industria)
- Eje X: conteo o porcentaje
- Leyenda al fondo con 4-5 colores

**Adaptacion para Sisteco:**
- Segmentar leads por: industria chilena (CIIU), tamano empresa (SII), ciudad, rubro
- "Que industrias tienen mas leads HOT" → bar chart horizontal
- "De que tamano son las empresas que mas convierten" → misma visualizacion
- DIFERENCIADOR: datos SII chilenos reales, no datos genericos internacionales

---

### 1.4 Deal Analytics — Pipeline Health

**Screenshots:** `20-deal-win-rate.png`, `21-deal-conversion-percentage.png`, `22-pipeline-deal-conversion.png`, `23-deals-by-stage-user.png`, `24-forecast-revenue-by-user.png`, `27-pipeline-dollar-value-monthly.png`

**Que hacen:**
- Bar charts horizontales para win rate por vendedor
- Bar charts de conversion por etapa (Lead → Sales Q → Meeting → Negotiation → Contract)
- Stacked bars por usuario y stage
- Line/area charts para valor monetario mensual
- Filtros: periodo + user/team + stage

**Adaptacion para Sisteco (MVP simplificado):**
- En MVP no hay deals/oportunidades formales — hay leads con estados
- Equivalente: Lead nuevo → Contactado → Reunion → Propuesta → Cliente
- Vista VP Ventas: leads por SDR por estado (stacked bar)
- Vista CEO: valor pipeline mensual (area chart) — si hay datos de ticket promedio
- FUTURO: Deal analytics completo cuando haya CRM integration

---

### 1.5 Team Performance / Leaderboards

**Screenshots:** `11-accounts-contacts-by-user.png`, `31-team-prospecting-by-user.png`, `32-team-calls-emails-by-user.png`, `33-tasks-by-user-status.png`, `34-deliverability-by-user.png`, `38-reps-effective-emails.png`, `41-reps-effective-calls.png`

**Que hacen:**
- Tablas con nombre de usuario como fila
- Columnas: metricas relevantes (emails sent, opened %, replied %, etc.)
- Ordenados por performance
- Algunos con bar charts horizontales superpuestos

**Adaptacion para Sisteco:**
- Vista VP Ventas (futuro): tabla de SDRs con leads asignados, contactados, convertidos
- En MVP: solo metricas agregadas del equipo (decision de Phase 2 Context)
- NOTA: Rendimiento individual por SDR es feature post-MVP (ver 02-CONTEXT.md Area 2)

---

### 1.6 Dashboard Management — CRUD

**Screenshots:** `01-dashboard-list-view.png`, `02-prebuilt-dashboards.png`, `50-create-dashboard-button.png`, `51-add-report-template.png`, `52-drag-drop-widgets.png`, `53-share-dashboard.png`, `54-share-permissions.png`

**Que hacen:**
- Lista de dashboards como tabla (nombre, creador, fecha)
- Filtros laterales: Starred, Created by Apollo, Owner, Folders
- Creacion: drag & drop widgets desde panel lateral
- Sharing: permisos granulares (Full access, Can edit, Can view)
- Templates pre-construidos por Apollo vs custom

**Adaptacion para Sisteco:**
- NO implementar custom dashboards en MVP — es over-engineering
- SI tener vistas pre-definidas por rol (CEO, VP, SDR) que "simplemente funcionan"
- La command bar reemplaza la necesidad de crear dashboards custom
- "Mostrame leads HOT de la ultima semana" = dashboard custom instantaneo via NLP
- FUTURO: permitir guardar queries frecuentes como "vistas guardadas"

---

### 1.7 Outbound/Inbound Dashboards (nuevos)

**Screenshots:** `45-labs-outbound-performance.png`, `46-waterfall-dashboard.png`, `47-outbound-dashboard.png`, `48-inbound-performance.png`

**Que hacen:**
- Layout mixto: KPI cards arriba + charts abajo
- Outbound: meetings scheduled + email/bounce rates + accounts/contacts touched
- Inbound: website visitors trend (line chart) + top companies + visitors by segment
- Waterfall: enrichment metrics (creditos usados, success rate por provider)

**Adaptacion para Sisteco:**
- Outbound: adaptar a metricas de pipeline activo (leads extraidos, enriquecidos, scored, notificados)
- Inbound: NO aplica en MVP (no hay website tracking)
- Waterfall: concepto interesante para mostrar "salud del pipeline" — cuantos leads pasan cada filtro

---

## 2. Estructura de Navegacion Apollo vs Sisteco

### Apollo (observado en screenshots)
```
Sidebar izquierdo (iconos):
├── Home
├── Search (lupa)
├── Engage (sequences)
├── Messages (email)
├── Calls (telefono)
├── Calendar
├── Conversations
├── Deals ($)
├── Enrich
├── Plays (lightning)
└── Analytics (chart icon) ← activo en screenshots
    ├── Overview tab
    ├── Dashboards tab ← lista de dashboards
    ├── Reports tab
    └── Goals tab

Breadcrumbs: Analytics > Dashboards > [Dashboard Name]
Topbar: Search Apollo + icons (telefono, notificaciones, avatar)
```

### Sisteco (propuesta command-bar-first)
```
Single page con command bar central:
├── KPIs del rol visible al cargar
├── Command bar: "Que quieres ver?"
│   ├── "como va mi funnel" → funnel inline
│   ├── "leads HOT esta semana" → tabla/cards inline
│   ├── "rendimiento del equipo" → leaderboard inline
│   ├── "leads por industria" → bar chart inline
│   └── "muestra el pipeline" → kanban inline
├── Resultados aparecen debajo del command bar
└── Panel lateral: lead detail (expandible)

NO hay:
- Sidebar con 12 secciones
- Breadcrumbs de 3 niveles
- Tabs dentro de tabs
- "Run" button para refrescar datos
```

**Ventaja Sisteco:** Toda la profundidad de Apollo (funnels, demographics, team performance, deal analytics) pero accesible con una sola pregunta en lenguaje natural, sin navegar menus.

---

## 3. Patrones Apollo que Sisteco DEBE Tener (features, no UI)

### Tier 1 — MVP (Phase 3 Build)
| Feature Apollo | Equivalente Sisteco | Query NLP |
|---------------|---------------------|-----------|
| KPI cards con delta | KPI cards + narrativa | "como vamos este mes" |
| Email/Lead funnel | Pipeline funnel | "como va mi funnel" |
| Leads by industry | Leads por rubro SII | "que rubros tienen mas leads HOT" |
| Leads by company size | Leads por tamano SII | "que tamano de empresas captamos" |
| Date range selector | Periodo en query | "leads de la ultima semana" |
| Export CSV | Export desde query | "exporta esto a CSV" |

### Tier 2 — Post-MVP
| Feature Apollo | Equivalente Sisteco | Query NLP |
|---------------|---------------------|-----------|
| Team performance table | Rendimiento por SDR | "como le va a cada vendedor" |
| Deal win rate | Conversion por etapa | "cual es nuestra tasa de cierre" |
| Goals + tracking | Metas de equipo | "vamos a cumplir la meta del mes" |
| Activity by week trends | Tendencias semanales | "tendencia de leads ultimas 4 semanas" |
| Deliverability scores | Salud del pipeline | "como esta la calidad de mis datos" |

### Tier 3 — Futuro
| Feature Apollo | Equivalente Sisteco | Query NLP |
|---------------|---------------------|-----------|
| Custom dashboards | Vistas guardadas | "guarda esta vista como 'mi reporte'" |
| Share dashboard | Compartir vista | "enviame esto por email" |
| Website visitors | (no aplica) | — |
| AI Assistant | Es el core de Sisteco | Ya es la interfaz principal |

---

## 4. Errores de UI en Apollo que Sisteco NO Debe Repetir

1. **Labels truncados** — "# Accounts T...", "# Tasks Com..." (screenshots 30). Usar labels completos o abreviaciones claras
2. **Boton "Run" manual** — Apollo requiere click en "Run" para actualizar datos. Sisteco: datos reactivos via Convex, siempre frescos
3. **Breadcrumbs de 3 niveles** — "Analytics > Dashboards > Prospecting Activity". Sisteco: flat, sin navegacion profunda
4. **Color monocromatico** — Todo azul. Sisteco: palette semantica (lime=positivo, rojo=alerta, gris=neutro)
5. **Sin narrativa** — Solo numeros. El CEO no sabe si 8 accounts touched es bueno o malo. Sisteco: "8 cuentas tocadas, 40% menos que la semana pasada. Revisa la asignacion de leads."
6. **Sidebar sobrecargada** — 12 iconos sin labels. Sisteco: command bar elimina la necesidad
7. **Sin mobile real** — Apollo no es responsive en analytics. Sisteco: command bar funciona naturalmente en mobile

---

## 5. Sintesis: El Punto de Equilibrio

**De Apollo tomamos:** La profundidad analitica. KPI cards, funnels, segmentacion demografica, team performance, export. Estas funcionalidades DEBEN existir en Sisteco.

**De Sisteco agregamos:** La accesibilidad. Todo lo anterior pero via lenguaje natural, sin menus, sin "Run", sin breadcrumbs. Con interpretacion narrativa que Apollo no tiene. Con datos chilenos reales (SII, RUT, rubro CIIU) que Apollo no puede ofrecer.

**El resultado:** La potencia analitica de Apollo + la simplicidad de Claude.ai + datos B2B unicos de Chile. Un dashboard que un CEO puede usar sin capacitacion, un VP puede gestionar su equipo con preguntas, y un SDR puede trabajar sus leads sin salir de la pantalla.

---

*Analisis visual completado: 2026-03-10*
*Screenshots: 52 capturas en Visuales/apollo-analytics/*
*Documentos de research: 4 archivos en .planning/phases/02-diseno-dashboard/research/*

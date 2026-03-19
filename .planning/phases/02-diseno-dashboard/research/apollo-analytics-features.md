# Apollo.io Analytics — Analisis Competitivo para Sisteco Dashboard

> Investigacion realizada: 2026-03-10
> Fuente: Apollo Knowledge Base (knowledge.apollo.io)
> Proposito: Referencia de diseno para el dashboard de Sisteco

---

## 1. Indice de Paginas Analizadas

| # | Articulo | URL | Relevancia |
|---|----------|-----|------------|
| 1 | Analytics Overview | https://knowledge.apollo.io/hc/en-us/articles/33574373762317-Analytics-Overview | Hub central de analytics |
| 2 | Use Analytics Dashboards | https://knowledge.apollo.io/hc/en-us/articles/4411230325517-Use-Analytics-Dashboards | Dashboards pre-construidos (14 tipos) |
| 3 | Use Analytics Reports | https://knowledge.apollo.io/hc/en-us/articles/4410826842381-Use-Analytics-Reports | Sistema de reportes custom |
| 4 | Access Email Analytics | https://knowledge.apollo.io/hc/en-us/articles/4425592135821-Access-Email-Analytics | Analytics de email desde multiples vistas |
| 5 | Report on Sequences | https://knowledge.apollo.io/hc/en-us/articles/9386141889549-Report-on-Sequences | Analytics de secuencias/cadencias |
| 6 | Set and Track Goals | https://knowledge.apollo.io/hc/en-us/articles/20676039270541-Set-and-Track-Goals | Sistema de metas y tracking |
| 7 | Report on Deals | https://knowledge.apollo.io/hc/en-us/articles/27459823138573-Report-on-Deals | Analytics de pipeline/deals |
| 8 | Use Salesforce Opportunity Analytics | https://knowledge.apollo.io/hc/en-us/articles/7086988183565-Use-Salesforce-Opportunity-Analytics-on-Apollo | Integracion CRM + analytics |
| 9 | Analyze Performance with AI Assistant | https://knowledge.apollo.io/hc/en-us/articles/43615390516621-Analyze-Your-Performance-with-the-AI-Assistant | IA conversacional para analytics |
| 10 | Use Website Visitors Data | https://knowledge.apollo.io/hc/en-us/articles/26595261473805-Use-Website-Visitors-Data | Tracking de visitantes web |
| 11 | Call Purposes & Dispositions | https://knowledge.apollo.io/hc/en-us/articles/5494331315853-Use-Purposes-and-Dispositions-to-Understand-Call-Outcomes | Categorias de llamadas para reportes |
| 12 | Build Outbound Process: Monitor Analytics | https://knowledge.apollo.io/hc/en-us/articles/5120295465357-Build-an-Outbound-Sales-Process-Monitor-Your-Analytics | Benchmarks y metodologia de analytics |

---

## 2. Arquitectura General de Analytics en Apollo

### 2.1 Estructura de Navegacion

Apollo organiza analytics en **4 secciones principales** accesibles desde el menu lateral:

```
Analytics (menu principal)
├── Overview         → Dashboard embebido por defecto + accesos rapidos
├── Dashboards       → Coleccion de dashboards (pre-built + custom)
├── Reports          → Reportes individuales (pre-built + custom)
└── Goals            → Metas de equipo con tracking de progreso
```

Ademas, analytics estan embebidos **contextualmente** en otras secciones:
- **Emails** > Analytics tab → Dashboard de email engagement
- **Sequences** > Analytics tab → Dashboard de performance de secuencias
- **Deals** > Analytics tab → Dashboard de pipeline/deals
- **Website Visitors** > Analytics → Dashboard de visitantes web
- **Calls** → Filtros por purpose/disposition para reportes

### 2.2 Jerarquia Dashboard > Report > Widget

- Un **Dashboard** es una coleccion de **Widgets**
- Cada **Widget** es un **Report** visualizado
- Los **Reports** son las unidades atomicas de datos (metricas + dimensiones + filtros + visualizacion)
- Los **Goals** son reports con un target numerico y alertas

### 2.3 Modelo de Acceso

- **Plan-gated**: Analytics avanzados requieren planes superiores
- **Permission-based**: Se requiere permiso especifico para acceder a analytics
- **Role-based sharing**: Dashboards se comparten con permisos (Full access / Can edit / Can view)
- **Team-based filtering**: Filtros por equipo/usuario en todos los dashboards

---

## 3. Desglose de Features por Area

### 3.1 Analytics Overview (Hub)

**Proposito:** Pagina de aterrizaje con acceso rapido a todo.

**Elementos UI:**
- Botones de accion: "Create dashboard", "Create report", "Create goal"
- Seccion "Recently used" (dashboards, reports, goals recientes)
- Dashboard embebido por defecto (configurable)
- Dropdown para seleccionar dashboard a mostrar
- Boton "Set as default" y "Favorite"
- AI Assistant ("Execute with AI") integrado directamente

**Patron clave:** La overview NO es un dashboard fijo — es un hub que muestra tu dashboard preferido + accesos rapidos.

### 3.2 Dashboards Pre-construidos (14 tipos)

Apollo ofrece **14 dashboards pre-construidos** organizados por caso de uso:

#### A) Prospecting Activity
- **Widgets:** # Accounts touched, contacts added to sequences, contacts changed stage (KPI cards con tendencia)
- **Tablas:** Accounts prospected by user, Contacts prospected by user
- **Funnels:** Email performance funnel, Call performance funnel
- **Patron visual:** KPI cards arriba → tablas de detalle por usuario → funnels de conversion

#### B) Meeting Insights
- **KPI Cards:** # Meetings scheduled, # Meetings rescheduled, # Meetings cancelled
- **Breakdown:** Meetings by meeting type
- **Patron visual:** KPI cards con numeros grandes y tendencia up/down

#### C) Most Engaged Email Demographic
- **Tablas de engagement por segmento:**
  - By persona (emails sent, interested, % open, % reply, % interested)
  - By contact title
  - By company size (# employees)
  - By industry
- **Patron visual:** Tablas con metricas absolutas + porcentajes lado a lado

#### D) Most Engaged Call Demographic
- **Misma estructura que email demographic pero para calls:**
  - By persona (calls dialed, connected, connected-positive, % connected, % positive)
  - By contact title
  - By company size
  - By industry

#### E) Website Visitor Trends
- **Line chart:** Daily visitor volume trend
- **Tablas ranking:** Top 10 pages visited, Top 10 companies that visited
- **Nota:** Data latency de hasta 7 dias

#### F) Deal Analytics (13 widgets)
- **KPI:** Deal win rate per user
- **Funnels:** Deals conversion as %, Deals conversion per stage
- **Pipeline:** Pipeline deal conversion as %, Pipeline deal conversion (absolute)
- **Heatmap/Table:** Number of deals by deal stage and user
- **Revenue:** User-specific deal stage-wise forecast revenue
- **Segmentacion:** Deal win rate by industry, by company size, by company revenue
- **Temporal:** Pipeline + closed deal dollar value by month, Deal weighted value by month, Number of deals by month
- **Patron visual:** La seccion mas rica — combina KPIs, funnels, tablas, y graficos temporales

#### G) Sales Development Activity
- **KPI Cards (5):** Accounts touched, contacts added to sequences, emails sent, calls logged, tasks completed
- **Tablas por usuario:** Team prospecting activity by user, Team calls & emails by user
- **Status table:** Tasks by user by status (scheduled, completed, skipped, overdue)
- **Score table:** Deliverability by user
- **Rankings:** Top 5 sequences, Top 5 email templates

#### H) Call Engagement (10 widgets)
- **KPI Cards (4):** Calls completed, calls logged, calls connected, average call duration
- **Funnel:** Call funnel (dialed → connected → connected-positive)
- **Leaderboard:** Reps with most effective calls
- **Temporal:** Call activity by week
- **Sequence analysis:** Most effective call sequences, Most effective call sequence step
- **Demographic:** Most engaged personas/titles/company sizes/industries with calls

#### I) Email Engagement (10 widgets)
- **KPI Cards (4):** Emails sent, emails opened, emails replied, % emails blocked (con tendencia)
- **Funnel:** Email funnel
- **Leaderboard:** Reps with most effective emails
- **Temporal:** Email activity by week
- **Template analysis:** Most effective email templates
- **Sequence analysis:** Most effective email sequences, Most effective email sequence step
- **Demographic:** Most engaged personas/company sizes/industries with emails

#### J) Deliverability Rates & Scores
- **Score table:** Deliverability score report (per user, last 90 days)
- **Weekly table:** Email delivery rates by week (sent, bounced, spam blocked, unsubscribed, opened, clicked, replied)
- **Ranking:** Most effective email sequences (by deliverability)

#### K) Apollo Labs Outbound Sequence Performance
- Dashboard integral que combina email engagement, call outcomes, task completion, pipeline health, sequencing activity, y website visitors

#### L) Waterfall Dashboard
- Metricas de enriquecimiento: credit usage, enrichment success by provider, team performance
- Filtros por usuario o data source

#### M) Outbound Dashboard
- Revenue outcomes de campanas GTM
- Multi-channel sequence performance
- Email outcomes, call sentiment over time, sequence performance

#### N) Inbound Performance
- Website visitors tracking → inbound funnel
- Forms submitted, meetings scheduled, visitors over time, visitors by revenue segment

### 3.3 Sistema de Reports (Custom)

**Estructura de un Report:**
1. **Metricas** — Que medir (emails sent, calls connected, deal win rate, etc.)
2. **Dimensiones** — Como agrupar (by user, by week, by persona, by industry, etc.)
3. **Filtros** — Como refinar (date range, users/teams, account stages, etc.)
4. **Visualizacion** — Como mostrar (table, chart, funnel, KPI card)

**Reports Pre-construidos por Apollo (categorias):**

| Categoria | Cantidad | Ejemplos |
|-----------|----------|----------|
| Activity | Multiples | Accounts prospected, contacts by stage, task completion |
| Email | 15+ | Email funnel, delivery rates, templates performance, bot tracking |
| Call | 10+ | Call funnel, call outcomes, rep effectiveness, sequence step analysis |
| Meeting | 5+ | Meetings scheduled/rescheduled/cancelled by type |
| Sequence | 10+ | Step success rates, sentiment stats, performance aggregate |
| Deal/Pipeline | 13+ | Win rate, conversion by stage, forecast revenue, leaderboard |
| Website | 3+ | Daily volume, top pages, top companies |
| Deliverability | 5+ | Score by user, delivery rates by week |

**Capacidades de Reports Custom:**
- Seleccion de metricas y dimensiones libre
- Multiples tipos de visualizacion por report
- Filtros avanzados con logica AND/OR
- Organizacion en folders
- Compartir con usuarios/equipos (Full access / Can edit / Can view)
- Export a CSV
- Copiar link de widget individual
- Duplicar reports

### 3.4 Goals (Metas)

**Templates de Goals:**
| Template | Tipo |
|----------|------|
| Email open rate | Rate goal |
| Email reply rate | Rate goal |
| Emails sent | Attainment goal |
| Forecasted revenue | Attainment goal |
| Quota attainment | Attainment goal (closed-won) |

**Features:**
- Asignacion por usuario individual o equipo
- Timeframe: monthly, quarterly, custom
- Organizacion por folders
- Visualizacion: actual vs. goal con progress bar
- **Alertas:** goal progress, goal met, goal off track
- **Canales de alerta:** Email, Slack
- **Frecuencia de alerta:** configurable
- Mapeo de CRM stages (Salesforce/HubSpot) para "meetings set" goals

### 3.5 Sequence Analytics (Embebido)

**Dashboard de Equipo (Sequences > Analytics):**

| Widget | Descripcion |
|--------|-------------|
| Highest performing sequences | Top sequences por replies/interest |
| Sequence step success rates | Performance por step (emails, opens, replies, calls) |
| Email sentiment stats | Positive vs negative replies |
| Email sentiment over time | Tendencia diaria de sentimiento |
| Email reply rate % over time | Tendencia de reply rate |
| Accounts sequenced and touched | Volumen de cuentas alcanzadas |
| Contacts sequenced and touched | Volumen de contactos alcanzados |
| Calls logged and connected | Volumen y tasa de conexion |
| Call performance | Detalle por sentimiento (positive/neutral/negative) |
| Call sentiments | Pie chart de distribucion de sentimiento |
| Sequence email performance (aggregate) | Tabla completa de deliverability |
| Website visitors views by page | Pie chart de paginas visitadas |

**Report Individual de Secuencia:**
- **Sequence funnel by contact:** delivered → opened → replied → interested (con % entre stages)
- **Sequence funnel by email:** Misma logica pero por email (no por contacto)
- **Most engaged audience:** By job title, # employees, industry, keywords (filtrable por interested/open/reply rate)
- **Audience details:** Breakdown por job title, seniority, industry, company size, keywords

**Estadisticas de Secuencia:**
- Active, Paused, Finished, Bounced, Not sent (por contacto)
- Email stats: Scheduled, Delivered, Open %, Click %, Reply %, Interested %, Opt out %
- Toggle "Include bots" para excluir bot opens/clicks

**Diagnosticos de Secuencia:**
- Domain setup (SPF, DKIM, DMARC)
- SendGrid/Mailgun health
- Tracking domain health
- Unverified contacts (con accion bulk de pause/remove)

### 3.6 Deals Analytics (Embebido)

**Dashboard de Deals (Deals > Analytics):**

| Widget | Descripcion |
|--------|-------------|
| Deals Stats | Win rate, deal count, amount won, weighted forecast, avg cycle length |
| Pipeline | Generated pipeline, weighted forecast, amount won, avg deal size |
| Deal Volume by Stages | Deals activos por stage (bar chart) |
| Avg Sales Cycle Length by Stage | Tiempo promedio por stage |
| Revenue Trends | Closed revenue temporal |
| Forecasted Revenue by Category | Pie chart: Pipeline, Closed, Omitted, Other |
| Deals Leaderboard | Ranking por pipeline owned + deals closed |
| Deal Amount Won by Rep | Revenue por rep |
| Activity by Rep | Heat map de engagement por deal stage |
| Deals for Follow-Up | At-risk deals con baja engagement/sentiment negativo |

### 3.7 Email Analytics (Embebido)

**Dashboard de Email (Emails > Analytics):**

| Widget | Descripcion |
|--------|-------------|
| Email Stats | KPI: sent, opened, replied, blocked |
| Email Funnel | Delivery → open → reply → interested |
| Reps with Most Effective Emails | Leaderboard por reply/interest rate |
| Email Activity by Week | Tendencia semanal |
| Most Effective Email Templates | Ranking de templates |
| Most Effective Email Sequences | Ranking de secuencias |
| Most Engaged Personas | Por job title |
| Most Engaged Company Sizes | Por # employees |
| Most Engaged Industries | Por industry |

### 3.8 AI Assistant para Analytics

**Capacidades:**
- Natural language queries sobre performance
- Analisis de deliverability con recomendaciones
- Comparacion de reps (emails sent, calls connected, etc.)
- Account engagement analysis
- Credit usage y billing monitoring

**Prompts sugeridos:**
- "Which sequences performed best in Q1?"
- "What are my team's average open and reply rates?"
- "Which reps booked the most meetings this quarter?"
- "Analyze my deliverability and spam-blocked rates"
- "Compare emails sent and calls connected between my SDR team members"

**Integracion:** Boton "Execute with AI" en la pagina de Analytics. Soporta contexto configurable (producto/servicio).

### 3.9 Website Visitors Analytics

**Dashboard (Website Visitors > Analytics):**
- Website Visitor Daily Trend (line chart)
- Top 10 pages (table)
- Top 10 company visitors (table)

**Filtros:**
- Time period
- Intent level
- Domains
- Page view count
- First-time visits

**Activity Snapshot (inline):** Hover sobre icono de bar graph → popup con total visitors, pages visited, visits per page.

---

## 4. Patrones UI Observados

### 4.1 Tipos de Visualizacion

| Tipo | Uso en Apollo | Ejemplo |
|------|--------------|---------|
| **KPI Card** | Metricas de alto nivel con tendencia (flecha up/down) | # Emails sent, # Calls connected |
| **Funnel** | Conversion entre stages | Email: delivered → opened → replied → interested |
| **Table** | Detalle multi-dimension | Reps with most effective emails (sent, opened %, replied %, interested %) |
| **Line Chart** | Tendencia temporal | Email activity by week, Website visitors daily trend |
| **Bar Chart** | Comparacion por categoria | Deal volume by stages, Number of deals by month |
| **Pie Chart** | Distribucion/composicion | Call sentiments, Forecasted revenue by category |
| **Heat Map** | Actividad multi-dimension | Activity by rep (across deal stages) |
| **Progress Bar** | Goal tracking | Actual vs. target con % |
| **Leaderboard** | Ranking de reps | Deals leaderboard, Reps with most effective calls |

### 4.2 Patron de Layout de Dashboard

```
┌─────────────────────────────────────────────────┐
│  Dashboard Title                [Timeframe ▼]   │
│                                 [+ Add filter]  │
├─────────────────────────────────────────────────┤
│  [KPI Card] [KPI Card] [KPI Card] [KPI Card]   │  ← Fila de KPIs
├─────────────────────────────────────────────────┤
│  ┌──────────────────┐ ┌──────────────────┐      │
│  │  Funnel Chart    │ │  Table/Chart     │      │  ← Fila de visualizacion
│  └──────────────────┘ └──────────────────┘      │
├─────────────────────────────────────────────────┤
│  ┌──────────────────┐ ┌──────────────────┐      │
│  │  Detail Table    │ │  Detail Table    │      │  ← Fila de detalle
│  └──────────────────┘ └──────────────────┘      │
├─────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐   │
│  │  Demographic / Segment Analysis Table    │   │  ← Fila de segmentacion
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 4.3 Patron de Filtros

**Filtros Globales del Dashboard:**
- Timeframe selector: Today, Current Week, Last 7 days, Last 30 days, Weekly, Monthly, Quarterly, All Time
- Add filter: por users/teams, account stages, y mas
- Los filtros del dashboard son "add-ons" que no sobreescriben filtros de reports subyacentes

**Filtros de Widget Individual:**
- Last 7 days, 4 weeks, 6 months, 12 months
- Menu "..." con View Report, Duplicate, Copy Link, Export to CSV

**Filtros de Reports:**
- Metricas seleccionables (que medir)
- Dimensiones seleccionables (como agrupar)
- Filtros multiples con logica combinable
- Date range independiente

### 4.4 Patron de Acciones por Widget

Cada widget tiene un menu "..." con:
1. **View Report** → Abrir el report completo
2. **Duplicate** → Crear copia del report
3. **Copy Link** → Compartir link directo
4. **Export to CSV** → Descargar datos

### 4.5 Patron de Navegacion Contextual

Apollo usa un patron de "analytics embebidos" donde cada seccion principal (Emails, Sequences, Deals, Website Visitors) tiene su propia tab "Analytics" con un dashboard relevante + boton "Go to Analytics" que lleva al hub principal.

```
Seccion → Tab "Analytics" → Dashboard embebido → "Go to Analytics" → Hub principal
```

---

## 5. Patrones de Organizacion de Datos

### 5.1 Dimensiones Principales (como se segmenta)

| Dimension | Donde se usa |
|-----------|-------------|
| **By User/Rep** | Todos los dashboards (performance individual) |
| **By Team** | Filtro global en dashboards |
| **By Time** | Weekly, monthly, quarterly, custom range |
| **By Persona** | Email/call demographic dashboards |
| **By Job Title** | Email/call engagement, sequence audience |
| **By Company Size** | Email/call engagement, deal analytics |
| **By Industry** | Email/call engagement, deal analytics |
| **By Company Revenue** | Deal analytics |
| **By Sequence** | Sequence analytics, email/call engagement |
| **By Sequence Step** | Sequence analytics |
| **By Email Template** | Email engagement |
| **By Deal Stage** | Deal analytics |
| **By Meeting Type** | Meeting insights |
| **By Domain** | Website visitors, deliverability |

### 5.2 Metricas Principales (que se mide)

**Email:**
- Sent, Delivered, Bounced, Opened, Clicked, Replied, Interested, Opted out, Spam blocked
- Open rate, Reply rate, Interest rate, Bounce rate, Deliverability score
- Bot opens (toggle para incluir/excluir)

**Calls:**
- Dialed, Completed, Logged, Connected, Connected-positive, Connected-neutral, Connected-negative
- Average call duration
- Connection rate, Connected-positive rate

**Deals:**
- Win rate, Deal count, Amount won, Weighted forecast, Pipeline value
- Average sales cycle length
- Conversion rate per stage
- Forecast revenue by category

**Meetings:**
- Scheduled, Rescheduled, Cancelled
- By meeting type

**Activity:**
- Accounts touched, Contacts added to sequences, Contacts changed stage
- Emails sent, Calls logged, Tasks completed

**Goals:**
- Actual vs. Target (attainment)
- Progress percentage
- On-track / Off-track status

### 5.3 Funnels (Patron de Conversion)

Apollo usa funnels consistentes:

**Email Funnel:** Delivered → Opened → Replied → Interested
**Call Funnel:** Dialed → Connected → Connected-positive
**Sequence Funnel:** Contacts/Emails → Delivered → Opened → Replied → Interested
**Deal Pipeline Funnel:** Stage 1 → Stage 2 → ... → Closed-Won

Cada step muestra: cantidad absoluta + % de conversion del step anterior.

---

## 6. Capacidades de Exportacion y Compartir

| Feature | Detalle |
|---------|---------|
| Export CSV | Por widget individual (menu "...") |
| Copy Link | Link directo a widget especifico |
| Share Dashboard | Con usuarios/equipos: Full access, Can edit, Can view |
| Share con Everyone | Visibility toggle para toda la empresa |
| Duplicate | Dashboards pre-built se pueden duplicar para personalizar |
| AI Assistant | Genera insights en natural language (no exportable directamente) |
| Goal Alerts | Email + Slack, configurable por frecuencia |

---

## 7. Benchmarks y Metricas de Referencia

Apollo comparte benchmarks utiles para equipos de ventas B2B:

| Metrica | Benchmark |
|---------|-----------|
| Email Open Rate | 30% - 50% |
| Email Reply Rate | 2% - 10% |
| Email Interest Rate | 0.2% - 2% |
| Meetings Set | ~20 per month (por rep) |
| Emails per Day (starting) | 200-500 por rep |
| Accounts Target | 100-1000 |
| Contacts per Account | 2-5 |
| Emails per Contact | 2-5 |

---

## 8. Takeaways Clave para Sisteco

### 8.1 Patrones a Adoptar

1. **Hub de Analytics con dashboard embebido:** La overview de Apollo como hub (no un dashboard fijo) es un patron excelente. Sisteco deberia tener un "home" de analytics que muestre el dashboard preferido del usuario + accesos rapidos.

2. **Analytics embebidos en contexto:** Cada seccion (leads, campanas, deals) deberia tener su propia tab "Analytics" con metricas relevantes, no solo un area centralizada. Reduce friction para que los vendedores vean datos sin salir de su flujo de trabajo.

3. **KPI Cards con tendencia:** El patron de cards de alto nivel con numero + flecha de tendencia (up/down vs periodo anterior) es efectivo para un vistazo rapido. Implementar en Sisteco.

4. **Funnels de conversion:** Email funnel y call funnel son la visualizacion mas util para diagnosticar donde se pierden leads. Sisteco deberia tener funnel de leads (nuevo → contactado → interesado → reunion → propuesta → cierre).

5. **Segmentacion demografica:** Apollo cruza engagement con industria, tamano de empresa, cargo. Sisteco deberia cruzar engagement con actividad economica SII, tamano empresa (SII), region, y tipo de decision-maker.

6. **Leaderboards de reps:** Patron simple y efectivo para motivar equipos. Ranking por meetings, deals closed, emails sent.

7. **Goals con alertas:** Sistema de metas con progress tracking y alertas (email/Discord en vez de Slack para Sisteco). Critico para management.

8. **Export CSV por widget:** Granular y util. Cada widget deberia ser exportable individualmente.

### 8.2 Patrones a Mejorar/Diferenciar

1. **Datos SII integrados:** Apollo no tiene datos fiscales. Sisteco puede cruzar analytics de engagement con datos del SII (actividad economica real, facturacion publica, numero de empleados real). Diferenciador unico.

2. **Compliance Ley 21.719 en analytics:** Mostrar metricas de compliance (consentimiento, bases legales, opt-outs) como parte del dashboard. Apollo no tiene esto.

3. **Simplicidad para PYME chilena:** Apollo es complejo (14 dashboards, 50+ reports). Sisteco deberia ofrecer 3-5 dashboards pre-construidos ultra-relevantes para el mercado chileno B2B, con complejidad progresiva.

4. **AI en espanol:** El AI assistant de Apollo es en ingles. Sisteco puede diferenciarse con AI en espanol que entienda contexto chileno (RUT, SII, jerga de ventas local).

5. **Alertas via Discord/WhatsApp:** Apollo usa Email + Slack. En Chile, WhatsApp y Discord son mas accesibles que Slack. Las alertas de goals y anomalias deberian ir por estos canales.

6. **Dashboard de "Salud del Pipeline" simplificado:** En vez de 13 widgets de deals como Apollo, ofrecer un unico dashboard de pipeline con los 5 indicadores mas criticos para una PYME: conversion rate, cycle time, forecast, deals at risk, y leaderboard.

### 8.3 Estructura Sugerida para Sisteco Dashboard v1

```
Sisteco Analytics
├── Home (Overview)
│   ├── Dashboard por defecto del usuario
│   ├── KPIs rapidos (leads nuevos, meetings, deals, revenue)
│   └── Accesos rapidos a reportes
│
├── Pipeline
│   ├── Funnel de conversion (stages configurables)
│   ├── Deals por stage y vendedor
│   ├── Revenue forecast
│   ├── Cycle time por stage
│   └── Deals at risk
│
├── Actividad
│   ├── Emails enviados/abiertos/respondidos
│   ├── Llamadas realizadas/conectadas
│   ├── Reuniones agendadas
│   ├── Leaderboard de equipo
│   └── Actividad semanal (tendencia)
│
├── Engagement
│   ├── Segmentacion por industria SII
│   ├── Segmentacion por tamano empresa
│   ├── Segmentacion por region
│   ├── Best performing templates/secuencias
│   └── Funnel de email + call
│
├── Metas
│   ├── Goals individuales y de equipo
│   ├── Progress tracking
│   └── Alertas (Discord/Email)
│
└── Compliance (diferenciador)
    ├── Estado de consentimientos
    ├── Opt-outs procesados
    └── Audit trail Ley 21.719
```

### 8.4 Prioridad de Implementacion

| Fase | Que construir | Referencia Apollo |
|------|--------------|-------------------|
| MVP | KPI cards + pipeline funnel + leaderboard | Prospecting Activity + Deal Analytics |
| v1.1 | Email/call analytics embebidos + tendencias | Email Engagement + Call Engagement |
| v1.2 | Goals + alertas Discord | Set and Track Goals |
| v1.3 | Segmentacion demografica con datos SII | Most Engaged Demographics |
| v2.0 | Reports custom + dashboards custom + AI assistant | Full Reports + AI Assistant |

---

## 9. Screenshots y Assets de Referencia

Todas las imagenes de Apollo estan alojadas en:
`https://storage.googleapis.com/apollo-public-assets/kb_images/`

Directorios clave:
- `use_analytics_dashboards/` — i1.png a i23.png (dashboards)
- `use_analytics_reports/` — i1.png a i18.png (reports)
- `analytics_overview_custom_dashboards/` — i48.png a i101.png (widgets detallados)
- `analytics_overview/` — i2.png (overview page)
- `track_team_goals/` — i20.png a i34.png (goals)
- `report_on_sequences/` — i2.png a i37.png (sequence analytics)
- `report_on_deals/` — i1.png a i2.png (deals analytics)
- `deals_overview/` — i32.png a i41.png (deal widgets)
- `access_email_analytics/` — i3.png a i10.png (email analytics)
- `analyze_your_performance_with_the_ai_assistant/` — i1.png (AI assistant)

Estas URLs son publicas y se pueden usar como referencia visual durante el diseno.

---

> **Nota:** Este analisis cubre las features documentadas en el knowledge base de Apollo al 2026-03-10.
> Apollo actualiza frecuentemente — la seccion de Deals Analytics estaba en beta al momento del scraping.
> Para el diseno de Sisteco, priorizar simplicidad sobre feature-parity con Apollo.

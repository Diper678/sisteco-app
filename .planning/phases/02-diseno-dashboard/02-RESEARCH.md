# Phase 2: Diseño Dashboard (Colaborativo) - Research

**Researched:** 2026-03-10
**Domain:** B2B SaaS Dashboard Design — Lead Management, Multi-Role UX, Command Bar, Static HTML Mockup Workflow
**Confidence:** HIGH (architecture patterns, command bar), MEDIUM (competitive references — web-only, no direct access to UIs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

| Decision | Detail |
|----------|--------|
| Estetica base | **Cowork** — warm minimal, bordes sutiles, pills, fondos calidos |
| SVGs hand-drawn | **Eliminados** — usar Lucide o iconos limpios |
| Command bar | **Si** — barra de busqueda inteligente tipo claude.ai para consultar datos de la app |
| Arquitectura UX | **Single-page** — KPIs en inicio, command bar carga contenido inline debajo |
| Modelo mental | Como **claude.ai** — escribes que quieres ver y la info aparece en contexto |
| Queries | **Set finito** — busquedas delimitadas que corresponden a datos reales de las automatizaciones |
| Investigacion previa | **Si** — benchmarkear 5-8 dashboards B2B SaaS reales antes de disenar |
| Dashboard desde cero | NO reutilizar skeleton SAAN dark mode |
| Multi-tenant | via Clerk Organizations |
| Multi-rol | CEO (observa), VP Ventas (asigna/gestiona), SDR (trabaja leads) |
| Formato mockups | **HTML estatico** en browser — archivos separados del proyecto principal |
| Nivel de fidelidad | Equilibrio — estructura + contenido real con estilo Sisteco aplicado |
| Frontend stack | Vanilla HTML/CSS/JS + GSAP 3.12.7 + Lucide 0.468.0 |
| Brand | #F8F7F5 bg, #c5ed36 accent, #111111 text, Sharp Grotesk headings, Source Sans 3 body |

### Claude's Discretion

Investigacion funcional de 5-8 dashboards B2B SaaS reales: que tienen, como estan estructurados, que los diferencia, que podemos adaptar para Sisteco.

### Deferred Ideas (OUT OF SCOPE)

| Idea | Fase sugerida |
|------|---------------|
| Rendimiento individual por SDR (ranking, conversion por persona) | Phase 3+ |
| Integracion directa con email/secuencias desde dashboard | Phase 3+ |
| Alertas in-app (badges, notificaciones) | Definir durante diseno visual Phase 2 |
| Acciones CEO | Phase 5+ |
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Login con Clerk (email + Google OAuth) | Auth UI patterns — login page fidelidad media, no bloquea mockup |
| DASH-02 | Vista de leads con filtros (score, industria, estado, fecha) | Lead list view + filter bar patterns documentados |
| DASH-03 | KPIs principales: leads nuevos, leads HOT, tasa conversion, pipeline value | KPI card con narrativa contextual — patron documentado |
| DASH-04 | Detalle de lead individual (datos enriquecidos, score breakdown, timeline) | Lead detail panel — slide-in right panel patron documentado |
| DASH-05 | Multi-tenant: cada cliente ve solo sus datos | Clerk Organizations — resuelto en Phase 1 infra, disenar indicador de org activa |
| DASH-06 | Responsive (funciona en movil para vendedores) | Mobile patterns documentados — card-based, bottom nav |
| DASH-07 | Dashboard NO usa suscripciones reactivas a tablas completas | No afecta diseño — afecta implementacion Phase 3 |
</phase_requirements>

---

## Summary

La investigacion revela que el mercado de dashboards B2B SaaS de lead management convergió en 2024-2025 hacia tres patrones dominantes: (1) **search-first / command-first UX** como puerta de entrada principal (Apollo.io, Attio, Linear), (2) **role-differentiated views** con la misma base de navegacion pero datos y layouts distintos por persona, y (3) **lead detail como panel lateral** (drawer pattern) en vez de pagina separada. Apollo.io, Attio, HubSpot y Pipedrive son las referencias mas directas para Sisteco dado su enfoque en lead management y pipeline B2B.

El concepto Cowork ya aprobado (warm minimal, command bar como centro, single-page) está directamente alineado con el SOTA del mercado 2025. No hay que inventar — se trata de adaptar patrones probados al contexto chile B2B con la identidad Sisteco.

**Recomendacion principal:** Usar Apollo.io como referencia principal de estructura (pipeline view, score badges, lead list), Attio como referencia de modernidad visual (clean, flexible views), Linear como referencia de command bar implementation, y HubSpot como referencia de role-based dashboards para CEO/VP/SDR.

---

## Dashboards de Referencia B2B SaaS (5 analizados)

### 1. Apollo.io — Referencia Principal para Lead Management

**Tipo:** All-in-one sales intelligence + engagement platform
**Mercado objetivo:** SMB a Enterprise B2B (principalmente startups y scale-ups)
**URL:** https://www.apollo.io

**Que tiene (funcionalidades):**
- Base de datos de 210M+ contactos con filtros avanzados (NAICS, SIC, keywords, industria)
- Lead scoring IA con priorización automática
- Analytics dashboard con pipeline health, email engagement, call outcomes
- Spreadsheet UI (2025) para ver/enriquecer miles de registros con feedback en tiempo real
- Modular widget library para homepage personalizada (Dynamic Page Framework)
- Sequences manager integrado en el mismo workflow de leads
- Chrome extension para LinkedIn y Gmail

**Que lo diferencia:**
- Unificación de prospecting + sequencing + analytics en un solo workspace
- Spreadsheet UI como innovación 2025: transforma enrichment en experiencia tipo Excel intuitiva
- Personalización de homepage con widgets a nivel usuario

**Estrategia UX clave:**
- All-in-one reduce switching entre herramientas
- Layout estructurado para guiar usuarios por tareas con clara jerarquia de acciones
- Curva de aprendizaje alta — complejidad real de una plataforma completa

**Pitfall documentado:**
- Feature overload causa curva de aprendizaje empinada para equipos nuevos
- Datos de contacto a veces desactualizados pese a verificación

**Para Sisteco:**
- Referencia directa para: lista de leads con score badges, filtros avanzados, pipeline health KPIs
- NO copiar: complejidad de navegacion, onboarding difícil, multiples capas de features

**Confianza:** MEDIUM (análisis basado en reviews y documentación pública, no acceso directo a UI 2025)

---

### 2. Attio — Referencia de UI Moderno y Flexibilidad

**Tipo:** CRM moderno con modelo relacional customizable
**Mercado objetivo:** B2B SaaS scale-ups, GTM teams
**URL:** https://attio.com

**Que tiene:**
- Vistas múltiples sobre el mismo dataset: table (spreadsheet), kanban (pipeline visual), board
- Atributos configurables en tarjetas kanban (elegir qué mostrar en cada card)
- Contact & company timelines con historial visual de interacciones
- Relationship analytics (quien del equipo tiene mejor conexión con cada cuenta)
- Automations + workflows con AI insights
- 250+ pantallas de UI de alta calidad disponibles públicamente en Figma

**Que lo diferencia:**
- "Feels like 2025" — velocidad y simplicidad como diferenciador clave
- Modelo de datos relacional customizable (no campos fijos)
- Diseño clean con densidad de información alta sin sensación de clutter
- AI insights integrados en el flujo principal, no como add-on

**Estrategia UX clave:**
- Flexibilidad total de vistas sobre el mismo dato (tabla ↔ kanban ↔ lista)
- Drag-and-drop nativo para pipeline stages
- Settings de vista inline (no modal separado)

**Para Sisteco:**
- Referencia directa para: card design de lead, atributos visibles en vista, switcher de vistas
- Inspiración de que "clean + rápido" es el diferenciador real frente a CRMs legacy
- Confianza: MEDIUM

---

### 3. HubSpot Sales Hub — Referencia de Role-Based Dashboards

**Tipo:** CRM all-in-one con foco en inbound + sales
**Mercado objetivo:** SMB a Enterprise, equipos de ventas estructurados
**URL:** https://www.hubspot.com

**Que tiene:**
- Dashboards diferenciados por rol: activity (SDR), strategic (VP/CEO), performance (managers)
- Sales workspace unificado: leads tab con owner assignment, filtros por rep
- Permisos jerárquicos: Super Admin ve todos los leads, rep ve solo sus leads asignados
- Pipeline con deal stages, win rate por usuario, conversion por etapa
- Analytics con comparativas de periodo (esta semana vs semana anterior)
- Templates de dashboard preconfigurados por tipo de usuario

**Dashboards por rol (confirmado):**
- **Activity Dashboard (SDR):** calls made, emails sent, demos booked, tasks
- **Performance Dashboard (VP):** quota attainment, team pipeline, stage conversion
- **Strategic Dashboard (CEO):** MRR, churn, pipeline value, QBR metrics

**Estrategia UX clave:**
- Role-based access con inheritance — Super Admin puede ver como cualquier usuario
- Lead aparece en sales workspace SOLO si tiene un owner asignado
- Progressive disclosure: metrics simplificadas en superficie, drill-down disponible

**Para Sisteco:**
- Referencia directa para: estructura de 3 vistas según rol, lógica de ownership de leads
- Pattern de "Super Admin ve todo" es análogo al CEO de Sisteco
- Confianza: HIGH (documentación oficial verificada)

---

### 4. Linear — Referencia de Command Bar y Keyboard-First UX

**Tipo:** Issue tracking y project management para equipos de ingeniería
**Mercado objetivo:** Equipos tech, startups de producto
**URL:** https://linear.app

**Que tiene:**
- Command menu global con Cmd+K — accesible desde cualquier parte de la app
- Keyboard-first: todas las acciones accesibles por teclado + mouse
- Atajos de dos teclas con patrones aprendibles (G→I = inbox, G→V = current cycle)
- Contextual menus que enseñan el shortcut al mismo tiempo que permiten la acción
- Búsqueda fuzzy que cubre tanto comandos como contenido (issues, proyectos)
- Navegación entre vistas con / para filtrar instantáneamente

**Estrategia UX clave:**
- El command bar es el único punto de entrada para TODAS las acciones
- "You can take actions in multiple ways: buttons, shortcuts, contextual menus, or by searching"
- La consistencia del patrón hace que el usuario aprenda rápido y gane velocidad

**Para Sisteco:**
- Referencia directa para: implementación del command bar, fuzzy search, slash commands
- Pattern de "mismo shortcut en toda la app" es crítico para el modelo mental de Sisteco
- El Cmd+K global + el `/` inline son patrones separados que coexisten (no uno reemplaza al otro)
- Confianza: HIGH (documentación oficial + artículos del equipo Linear)

---

### 5. Pipedrive — Referencia de Pipeline Visual Simple

**Tipo:** CRM centrado en pipeline visual para equipos de ventas SMB
**Mercado objetivo:** SMB, equipos de 5-50 personas
**URL:** https://www.pipedrive.com

**Que tiene:**
- Pipeline visual como pantalla principal — kanban con deal cards arrastrables
- Smart Contact Data: scrape automático de web para enriquecer contactos
- Visual cues con labels de colores para estado de deals
- App panels que permiten actualizar datos en tiempo real desde apps socias
- Deal score + lead temperature integrados en card view
- Leads inbox separado del pipeline de deals (diferenciación entre lead y deal)

**Que lo diferencia:**
- La visibilidad del pipeline como punto central reduce fricción de adopción
- "Fast learning curve" es parte del posicionamiento — claramente simple
- Integración de datos dinámicos de socios directamente en el CRM via App Panels

**Para Sisteco:**
- Referencia directa para: leads inbox vs pipeline view, visual cues de color/temperatura
- El concepto de "Leads inbox" (antes de asignar) vs "Pipeline" (asignado, en proceso) es relevante para el flujo VP → SDR
- Confianza: MEDIUM (análisis de reviews + documentación pública)

---

### 6. Cognism — Referencia de Simplicidad y Data Display

**Tipo:** Sales intelligence platform + B2B data provider
**Mercado objetivo:** Enterprise B2B sales teams, foco EMEA/US
**URL:** https://cognism.com

**Que tiene:**
- "Sales Companion" personalizado: datos y insights priorizados para el territorio del rep
- Filtros de búsqueda 65+ para prospecting
- Intent signals (Bombora-powered) integrados en la vista de lead
- Datos verificados de teléfono + email prominentemente visibles
- Chrome extension para LinkedIn que surfacea datos sin cambiar de contexto

**Que lo diferencia:**
- "Took me less than 10 minutes to understand how to use Cognism" — simplicidad como ventaja
- La personalización del Sales Companion es por rep individual, no genérica
- Compliance-first: GDPR/Ley privacidad en el core, no como afterthought

**Para Sisteco:**
- Referencia de simplicidad y tiempo-a-valor: el usuario debe entender la app en minutos
- Intent signals = equivalente al Gemini score de Sisteco — debe ser prominente y visible
- Compliance como feature visible, no oculto en footer
- Confianza: MEDIUM (análisis de reviews y comparaciones públicas)

---

## Standard Stack (para la fase de diseño)

### Core (mockup tools)
| Herramienta | Version | Propósito | Por qué |
|-------------|---------|-----------|---------|
| HTML5 + CSS3 | Native | Mockup files en browser | Decisión locked — evaluar en browser con estilos reales |
| GSAP | 3.12.7 | Animaciones de entrada, transiciones | Decisión locked — stack Sisteco estándar |
| Lucide Icons | 0.468.0 | Iconografía | Decisión locked — único sistema de iconos Sisteco |
| Source Sans 3 | Google Fonts | Body text | Decisión locked — brand Sisteco |
| Sharp Grotesk | Local .otf | Headings | Decisión locked — brand Sisteco |

### Design Tokens (ya definidos en app-design.md)
| Token | Valor | Uso |
|-------|-------|-----|
| `--bg-primary` | `#F8F7F5` | Fondo principal |
| `--accent` | `hsl(76, 82%, 57%)` = `#c5ed36` | CTAs, badges activos |
| `--bg-sidebar` | `#111111` | Sidebar dark |
| `--border` | `#e5e5e5` | Bordes sutiles |
| `--radius-lg` | `12px` | Cards |
| `--radius-pill` | `9999px` | Badges, pills |

**Instalación CDN para mockups:**
```html
<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">
<!-- Lucide -->
<script src="https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js"></script>
<!-- GSAP -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.7/dist/gsap.min.js"></script>
```

---

## Architecture Patterns

### Patron 1: Single-Page con Command Bar Central

**Que es:** Una sola URL base. El command bar (bottom, sticky) es el centro de toda interacción. Las vistas de datos se cargan inline debajo del command bar, no en páginas separadas.

**Cuando usar:** Para el workspace principal de Sisteco — es la decisión locked.

**Estructura de layout:**
```
┌────────────────────────────────────────────────────────┐
│ Sidebar (240px, dark, fixed)                           │
│  Logo / Nav items / User footer                        │
├────────────────────────────────────────────────────────┤
│ Main Content Area (flex: 1)                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Topbar (72px, glassmorphism, sticky)             │  │
│  │  Titulo de vista + rol badge + acciones          │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ KPI Zone (4 cards en grid, rol-dependiente)      │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Content Zone (lista de leads / pipeline / etc.)  │  │
│  │  — Cargado por command bar queries               │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Command Bar (sticky bottom, 72px)                │  │
│  │  [/] Escribe un comando...    [Enviar]            │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

**Patron de command bar (verified — Linear + Superhuman + Notion):**
```html
<div class="command-bar sticky-bottom">
  <div class="command-input-wrapper">
    <i data-lucide="terminal" class="command-icon"></i>
    <input
      type="text"
      placeholder="Escribe un comando o usa / para ver opciones..."
      id="commandInput"
    />
    <button class="btn-primary btn-send">
      <i data-lucide="send"></i>
    </button>
  </div>
  <!-- Slash menu — aparece al tipear "/" -->
  <div class="slash-menu" hidden>
    <div class="slash-category">Vistas</div>
    <div class="slash-item" data-command="leads">
      <i data-lucide="users"></i>
      <span>/leads</span>
      <small>Ver todos mis leads</small>
    </div>
    <!-- ... -->
  </div>
</div>
```

---

### Patron 2: Role-Based Dashboard Views

**Que es:** El mismo layout base (sidebar + topbar + command bar) pero con datos, KPIs y acciones distintos según el rol del usuario logueado. La persona del rol determina qué ve y qué puede hacer.

**Cuando usar:** Para las 3 vistas CEO / VP Ventas / SDR — es la decisión locked.

**Implementacion en mockup (datos hardcoded según vista):**
```html
<!-- En el mockup, simular con data attributes -->
<body data-role="ceo">   <!-- o "vp-ventas" o "sdr" -->
```

```css
/* KPI zone adapta según rol */
[data-role="ceo"]    .kpi-grid { grid-template-columns: repeat(4, 1fr); }
[data-role="sdr"]    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
[data-role="vp-ventas"] .kpi-grid { grid-template-columns: repeat(3, 1fr); }

/* Acciones del topbar cambian */
[data-role="ceo"]     .action-assign { display: none; }
[data-role="sdr"]     .action-view-all { display: none; }
```

**Contenido por rol (decisión locked):**

| Zona | CEO | VP Ventas | SDR |
|------|-----|-----------|-----|
| KPIs | Leads nuevos, HOT, conversion rate, pipeline value — con narrativa | Equipo total, leads sin asignar, estado pipeline, velocidad | Mis leads asignados, pendientes hoy, contactados esta semana, tasa respuesta |
| Vista principal | Activity feed del equipo (VP/SDR activos) | Lista de leads sin asignar + pipeline por SDR | To-do list de leads pendientes |
| Acciones disponibles | Solo lectura — ninguna acción | Asignar leads, cambiar estado pipeline | Marcar contactado, abrir panel lead, cambiar estado |
| Command bar queries | Solo consultas de overview | Consultas de equipo + asignación | Consultas de sus leads + acciones de contacto |

---

### Patron 3: Lead Detail Panel (Drawer Right)

**Que es:** Al hacer click en un lead de la lista, se desliza un panel desde la derecha (360px) con todos los datos del lead. La lista principal permanece visible detrás. No es una navegación a otra URL.

**Cuando usar:** En todas las vistas donde aparezcan leads — es la decisión locked.

**Estructura del panel:**
```
┌─────────────────────── Lead Detail Panel (360px) ───────────┐
│ Header: Nombre empresa + badge HOT/WARM + close [X]          │
├──────────────────────────────────────────────────────────────┤
│ Contact Info:                                                 │
│  • Nombre contacto + cargo                                    │
│  • Email [copiar] [abrir cliente]                            │
│  • LinkedIn URL [abrir] [Lucide:linkedin]                    │
│  • Teléfono (si disponible) [copiar]                         │
├──────────────────────────────────────────────────────────────┤
│ Company Info (datos SII + Firecrawl):                        │
│  • RUT empresa + actividad económica CIIU                     │
│  • Tamaño estimado + industria                               │
│  • Descripción scrapeada del sitio                           │
│  • Stack tecnológico detectado (si aplica)                   │
├──────────────────────────────────────────────────────────────┤
│ Score Breakdown:                                              │
│  • Puntaje total: 87/100 [badge HOT]                         │
│  • Breakdown: Fit 45/50 + Intent 42/50                       │
│  • Razón IA: "Alta coincidencia ICP. Empresa de 200+         │
│    empleados en manufactura. Web reciente menciona..."        │
├──────────────────────────────────────────────────────────────┤
│ Timeline:                                                     │
│  • 2026-03-10: Lead capturado de LinkedIn Sales Nav          │
│  • 2026-03-10: Score calculado por IA — HOT                  │
│  • 2026-03-10: Notificación enviada vía Discord             │
│  • 2026-03-11: Asignado a SDR María González (VP Ventas)     │
│  • 2026-03-12: Marcado como contactado (SDR)                 │
├──────────────────────────────────────────────────────────────┤
│ Acciones rápidas (según rol):                                │
│  [Marcar contactado] [Abrir LinkedIn] [Copiar email]          │
│  [Cambiar estado ▾]                                          │
└──────────────────────────────────────────────────────────────┘
```

**Animación GSAP (panel slide-in):**
```javascript
// Source: app-design.md GSAP patterns
function openLeadPanel(leadId) {
  const panel = document.getElementById('lead-panel');
  panel.removeAttribute('hidden');
  gsap.fromTo(panel,
    { x: 360, opacity: 0 },
    { x: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }
  );
}

function closeLeadPanel() {
  const panel = document.getElementById('lead-panel');
  gsap.to(panel, {
    x: 360, opacity: 0, duration: 0.3, ease: 'power2.in',
    onComplete: () => panel.setAttribute('hidden', '')
  });
}
```

---

### Patron 4: KPI Card con Narrativa Contextual

**Que es:** Una tarjeta de KPI que muestra el número grande + delta % + una frase corta de interpretación ("que significa esto"). No solo dato — contexto.

**Por qué:** Investigación confirma que "even a small phrase beside a graph can shift it from a visual to a narrative, transforming it from 'something happened' to 'here's why it matters'" (uxdesign.cc, 2025). Para el CEO de Sisteco que no opera el pipeline diariamente, la narrativa es crítica.

**Ejemplo de estructura HTML:**
```html
<div class="card card-kpi">
  <div class="kpi-header">
    <span class="kpi-label">Leads HOT esta semana</span>
    <i data-lucide="flame" class="kpi-icon text-warning"></i>
  </div>
  <div class="kpi-value-row">
    <span class="kpi-value">12</span>
    <span class="kpi-delta positive">+4 vs semana pasada</span>
  </div>
  <p class="kpi-narrative">
    Tu equipo tiene 12 prospectos con alta probabilidad de cerrar.
    Esto supera el promedio de las últimas 4 semanas (7.5).
  </p>
</div>
```

```css
.kpi-value {
  font-family: var(--font-heading);
  font-size: var(--text-4xl);
  font-weight: 700;
  letter-spacing: var(--tracking-tight);
  color: var(--text-primary);
}
.kpi-delta.positive { color: var(--success); font-size: var(--text-sm); }
.kpi-delta.negative { color: var(--error); font-size: var(--text-sm); }
.kpi-narrative {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: var(--space-2);
  line-height: var(--leading-normal);
  border-top: 1px solid var(--border-subtle);
  padding-top: var(--space-2);
}
```

---

### Patron 5: Lead List con Score Badges

**Que es:** Tabla/lista de leads con una fila por lead, que incluye score badge de color (HOT/WARM/NURTURE/SKIP), empresa, contacto, industria, y acciones inline.

**Pattern de score badge (temperatura):**
```html
<span class="badge badge-hot">HOT</span>    <!-- 80+ -->
<span class="badge badge-warm">WARM</span>  <!-- 50-79 -->
<span class="badge badge-nurture">NURTURE</span> <!-- 20-49 -->
<span class="badge badge-skip">SKIP</span>  <!-- <20 -->
```

```css
.badge-hot     { background: rgba(239,68,68,0.12); color: #dc2626; }
.badge-warm    { background: rgba(234,179,8,0.12);  color: #ca8a04; }
.badge-nurture { background: rgba(59,130,246,0.12); color: #2563eb; }
.badge-skip    { background: rgba(0,0,0,0.06);      color: #666666; }
```

**Fila de lead list (ejemplo):**
```html
<tr class="lead-row" data-lead-id="123" onclick="openLeadPanel('123')">
  <td>
    <span class="badge badge-hot">HOT</span>
    <span class="score-number">87</span>
  </td>
  <td>
    <div class="company-cell">
      <strong>Acero Pacífico S.A.</strong>
      <small>Manufactura · Santiago</small>
    </div>
  </td>
  <td>Roberto Sánchez — Gerente TI</td>
  <td><span class="badge badge-neutral">Sin asignar</span></td>
  <td class="actions-cell">
    <button class="btn-icon" title="Asignar">
      <i data-lucide="user-plus"></i>
    </button>
  </td>
</tr>
```

---

### Patron 6: SDR To-Do List View

**Que es:** Vista de trabajo del SDR que muestra sus leads asignados como una lista de tareas ordenadas por prioridad/score. No es analytics — es acción.

**Inspirado en:** HubSpot Activity Dashboard + Apollo Sequence Manager + Linear issue list

**Estructura:**
```
┌─────── Mis Leads — Pendientes (8) ──────────────────────┐
│ Filtros: [Todo] [HOT primero ✓] [Por fecha] [Contactados]│
├─────────────────────────────────────────────────────────┤
│ [HOT 87] Acero Pacífico S.A. — Roberto Sánchez          │
│ Asignado: hoy · Sin contactar · [Ver] [Contactado ✓]    │
├─────────────────────────────────────────────────────────┤
│ [HOT 82] Textil Norte Ltda — Carolina Vega              │
│ Asignado: ayer · Sin contactar · [Ver] [Contactado ✓]   │
├─────────────────────────────────────────────────────────┤
│ [WARM 68] Consultora Andina — Felipe Torres             │
│ Asignado: 2 días · Contactado 1 vez · [Ver] [Seguimiento]│
└─────────────────────────────────────────────────────────┘
```

**Principio clave:** El SDR no necesita filtrar ni buscar — sus leads ya están filtrados y ordenados por score descendente. La acción más importante está siempre visible (botón de marcar contactado).

---

### Patron 7: Filter Bar Horizontal

**Que es:** Barra de filtros horizontales con pills seleccionables. Estándar en Apollo.io, Attio, HubSpot.

```html
<div class="filter-bar">
  <button class="filter-pill active">Todos (47)</button>
  <button class="filter-pill">HOT (12)</button>
  <button class="filter-pill">WARM (23)</button>
  <button class="filter-pill">Sin asignar (18)</button>
  <div class="filter-separator"></div>
  <button class="filter-pill filter-dropdown">
    Industria <i data-lucide="chevron-down"></i>
  </button>
  <button class="filter-pill filter-dropdown">
    Fecha <i data-lucide="chevron-down"></i>
  </button>
</div>
```

```css
.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border);
}
.filter-pill {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: transparent;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.filter-pill.active,
.filter-pill:hover {
  background: var(--accent);
  color: var(--text-primary);
  border-color: var(--accent);
}
```

---

### Recommended Mockup File Structure

```
.planning/phases/02-diseno-dashboard/mockups/
├── ceo-dashboard.html          # Vista CEO — KPIs narrativos + activity feed
├── vp-ventas-dashboard.html    # Vista VP — pipeline + asignación + equipo
├── sdr-dashboard.html          # Vista SDR — to-do list + lead detail panel
├── lead-detail-panel.html      # Panel de detalle aislado para feedback
└── shared/
    ├── styles.css              # Design tokens Sisteco + componentes
    ├── mock-data.js            # Datos hardcoded chilenos (RUTs, empresas, etc.)
    └── interactions.js         # GSAP + slash menu + panel open/close
```

**Principio de separación:** Cada vista es un archivo HTML independiente. Los mockups NO dependen de un backend ni de Convex — los datos son hardcoded en `mock-data.js` con datos realistas chilenos.

---

## Don't Hand-Roll

| Problema | No construir | Usar en cambio | Por qué |
|----------|-------------|---------------|---------|
| Scoring visual | Sistema de puntos propio | Badge pill HOT/WARM/NURTURE/SKIP (ya validado en Phase 1) | El pipeline ya produce este output — la UI debe consumirlo directo |
| Charts de KPI | Canvas/SVG complejo | SVG inline simple + sparkline CSS | No es fase de build; en mockup basta con número + texto narrativo |
| Fuzzy search | Implementación de Levenshtein | Lista fija con `filter()` o librería mínima | El set de queries es finito — no necesitas Elasticsearch en mockup |
| Design system | Tokens CSS desde cero | `app-design.md` — ya tiene 200+ tokens definidos | Está documentado, probado, aprobado |
| Icon system | SVGs propios o Font Awesome | Lucide 0.468.0 (decisión locked) | Consistencia con resto del stack Sisteco |
| Animaciones | CSS transitions manuales | GSAP patterns de `app-design.md` | Ya documentado con timing y easing Sisteco |
| Command bar | Build completo desde cero | Pattern de `app-design.md` + interactions.js ligero | El set de comandos es finito y conocido |

**Insight clave:** Esta es una FASE DE DISEÑO, no de build. El anti-patrón principal es sobre-ingeniería en el mockup — agregar interactividad real cuando basta con transiciones CSS/GSAP que simulan el comportamiento.

---

## Common Pitfalls

### Pitfall 1: Mostrar Todo a Todos los Roles
**Que sale mal:** Un CEO ve los mismos detalles operacionales que un SDR. Información irrelevante genera ruido cognitivo y reduce confianza en la herramienta.
**Por qué pasa:** El diseñador conoce todos los datos disponibles y los incluye "por si acaso".
**Cómo evitar:** Diseñar cada vista empezando desde la pregunta "¿Qué decisión necesita tomar este rol HOY?". CEO: ¿está el pipeline sano?. VP: ¿hay leads sin asignar?. SDR: ¿a quién llamo primero?.
**Señales de alerta:** Más de 6 KPIs visibles en una vista, columnas en tabla que el rol nunca usaría.

### Pitfall 2: KPIs sin Contexto (Número Desnudo)
**Que sale mal:** "Leads HOT: 12" no dice nada. El CEO no sabe si es bueno o malo.
**Por qué pasa:** Dashboards que copian el modelo de BI (números grandes, sin narrativa).
**Cómo evitar:** Cada KPI en la vista CEO DEBE tener: número principal, delta vs período anterior, y una frase de 1 línea de interpretación.
**Señales de alerta:** KPI card que solo muestra el número y el label, sin comparativo ni narrativa.

### Pitfall 3: Lead Detail Demasiado Denso
**Que sale mal:** El panel de lead intenta mostrar 30 campos. El SDR no puede encontrar el teléfono rápido.
**Por qué pasa:** "Dar la mayor cantidad de información posible" (objetivo legítimo) mal implementado = dump de datos.
**Cómo evitar:** Jerarquía en el panel: (1) Nombre/empresa/badge — 3 segundos para identificar; (2) Datos de contacto — lo que el SDR necesita para actuar; (3) Datos de enriquecimiento — disponibles pero no dominantes; (4) Timeline — al fondo.
**Señales de alerta:** El email no es visible sin hacer scroll en el panel.

### Pitfall 4: Command Bar con Queries Abiertas Sin Guía
**Que sale mal:** El usuario no sabe qué puede preguntar. El command bar se queda vacío.
**Por qué pasa:** Interfaz que promete lenguaje natural sin indicar el vocabulario disponible.
**Cómo evitar:** El placeholder debe listar ejemplos reales: "Ejemplo: 'leads HOT esta semana' o '/leads industria:manufactura'". El slash menu debe aparecer siempre al escribir "/" con las opciones disponibles.
**Señales de alerta:** El placeholder dice solo "Escribe algo..." sin contexto.

### Pitfall 5: Mockup con Demasiada Interactividad
**Que sale mal:** Se invierte tiempo en hacer el mockup "funcionar de verdad" en lugar de validar el diseño. El mock se convierte en un prototipo de alta fidelidad que bloquea iteración rápida.
**Por qué pasa:** Tentación de "mientras hago el mockup, hago también la lógica real".
**Cómo evitar:** Datos hardcoded. Interacciones limitadas a: open/close del panel de lead, toggle de filtros, hover states. Nada que requiera fetch real o lógica de negocio.
**Señales de alerta:** El mockup importa Convex SDK o hace fetch a APIs reales.

### Pitfall 6: Responsive Olvidado hasta el Final
**Que sale mal:** El mockup desktop es perfecto. En mobile (donde los SDRs usan la app en el campo), la tabla de leads es inutilizable.
**Por qué pasa:** Diseño desktop-first sin verificar en 375px durante el proceso.
**Cómo evitar:** Verificar cada mockup en 375px (mobile) antes de darlo por aprobado. En mobile: tabla de leads se convierte en lista de cards, sidebar colapsa, command bar permanece visible abajo.
**Señales de alerta:** Tabla con 6+ columnas en un mockup mobile.

### Pitfall 7: Datos de Prueba Genéricos (no chilenos)
**Que sale mal:** El mockup usa empresas como "Acme Corp" o "Example Inc". El cliente chileno no puede evaluar si la información relevante está bien representada.
**Por qué pasa:** Datos placeholder por conveniencia.
**Cómo evitar:** Usar datos ficticios pero verosímiles para Chile: empresas como "Acero del Pacífico S.A.", "Textil Norte Ltda", nombres chilenos, RUTs con formato XX.XXX.XXX-X, industrias del SII (manufactura, servicios, retail), ciudades chilenas.
**Señales de alerta:** Cualquier dato en inglés o con formato no chileno en el mockup.

---

## Code Examples

### CSS Variables Master (del design system Sisteco — usar sin modificar)
```css
/* Source: .claude/skills/app-design.md section 15 */
:root {
  --bg-primary: #F8F7F5;
  --bg-surface: #FFFFFF;
  --bg-sidebar: #111111;
  --text-primary: #111111;
  --text-secondary: #666666;
  --accent: hsl(76, 82%, 57%); /* #c5ed36 */
  --accent-hover: hsl(76, 82%, 52%);
  --border: #e5e5e5;
  --border-subtle: #f0f0f0;
  --success: #22c55e;
  --warning: #eab308;
  --error: #ef4444;

  --font-heading: 'Sharp Grotesk', system-ui, sans-serif;
  --font-body: 'Source Sans 3', system-ui, sans-serif;

  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-pill: 9999px;

  --sidebar-width: 240px;
  --topbar-height: 72px;
  --panel-width: 360px;

  --ease-default: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### Layout Base (para todos los mockups)
```html
<!-- Source: app-design.md + patrones investigados -->
<!DOCTYPE html>
<html lang="es-CL">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sisteco — [Rol] Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../shared/styles.css">
</head>
<body data-role="[ceo|vp-ventas|sdr]">

  <!-- Sidebar dark (240px, fixed) -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <img src="../assets/sisteco-icon.png" alt="Sisteco" width="28">
      <span class="logo-wordmark">Sisteco</span>
    </div>
    <nav class="sidebar-nav">
      <a class="nav-item active" href="#"><i data-lucide="layout-dashboard"></i> Overview</a>
      <a class="nav-item" href="#"><i data-lucide="users"></i> Leads</a>
      <a class="nav-item" href="#"><i data-lucide="bar-chart-3"></i> Reportes</a>
      <a class="nav-item" href="#"><i data-lucide="settings"></i> Configuración</a>
    </nav>
    <div class="sidebar-user">
      <div class="user-avatar">JG</div>
      <div class="user-info">
        <strong>José González</strong>
        <small>[CEO | VP Ventas | SDR]</small>
      </div>
    </div>
  </aside>

  <!-- Main content -->
  <main class="main-content">

    <!-- Topbar glassmorphism -->
    <header class="topbar">
      <div class="topbar-title">
        <h1>Dashboard <span class="role-badge badge badge-neutral">[ROL]</span></h1>
      </div>
      <div class="topbar-actions">
        <button class="btn-icon" title="Refresh"><i data-lucide="refresh-cw"></i></button>
        <button class="btn-icon" title="Notificaciones"><i data-lucide="bell"></i></button>
      </div>
    </header>

    <!-- Content area -->
    <div class="content-area">
      <!-- KPI Grid — varía por rol -->
      <div class="kpi-grid">
        <!-- Insertar KPI cards aquí -->
      </div>

      <!-- Lead list / To-do / Activity feed — varía por rol -->
      <div class="view-content">
        <!-- Insertar contenido principal aquí -->
      </div>
    </div>

    <!-- Command Bar sticky bottom -->
    <div class="command-bar">
      <div class="command-input-wrapper">
        <i data-lucide="terminal"></i>
        <input type="text" placeholder="Escribe un comando o usa / para ver opciones... Ej: /leads HOT esta semana">
        <button class="btn-primary"><i data-lucide="send"></i></button>
      </div>
    </div>

  </main>

  <!-- Lead Detail Panel (hidden by default) -->
  <div class="lead-panel" id="lead-panel" hidden>
    <!-- Insertar contenido del panel aquí -->
    <button class="panel-close" onclick="closeLeadPanel()">
      <i data-lucide="x"></i>
    </button>
  </div>

  <script src="https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.7/dist/gsap.min.js"></script>
  <script src="../shared/interactions.js"></script>
  <script>lucide.createIcons();</script>
</body>
</html>
```

### GSAP Animations para Mockups
```javascript
// Source: app-design.md section 7

// Entrada de KPI cards (stagger)
gsap.from('.card-kpi', {
  y: 20, opacity: 0,
  duration: 0.5,
  stagger: 0.08,
  ease: 'power3.out',
  delay: 0.1
});

// Entrada de filas de lead list
gsap.from('.lead-row', {
  y: 12, opacity: 0,
  duration: 0.4,
  stagger: 0.04,
  ease: 'power2.out',
  delay: 0.3
});

// KPI count-up animation
document.querySelectorAll('.kpi-value[data-count]').forEach(el => {
  const target = parseInt(el.dataset.count);
  gsap.from(el, {
    textContent: 0,
    duration: 1.2,
    snap: { textContent: 1 },
    ease: 'power2.out',
    delay: 0.5,
    onUpdate: () => { el.textContent = Math.round(gsap.getProperty(el, 'textContent')); }
  });
});
```

---

## State of the Art (2025-2026)

| Enfoque anterior | Enfoque actual | Cuándo cambió | Impacto para Sisteco |
|-----------------|----------------|---------------|----------------------|
| Dashboard = página de analytics con muchos charts | Dashboard = workspace de trabajo con acceso rápido a datos | 2023-2024 | Confirma la dirección Cowork/command bar |
| Navegación por menú jerárquico | Command bar / Cmd+K como acceso universal | 2022-2024 (Linear, Notion) | Pattern ya seleccionado es SOTA |
| Roles con páginas completamente separadas | Misma base con datos diferenciados por rol | 2023-2025 | Implementar via CSS data-role attribute en mockup |
| KPI como número grande solo | KPI como número + delta + narrativa breve | 2024-2025 | CEO view necesita esta capa explícitamente |
| Lead detail = página separada (URL nueva) | Lead detail = panel lateral drawer | 2022-2024 (CRMs modernos) | Ya en decisiones locked — confirma la dirección |
| Filtros en sidebar vertical | Filter pills horizontales encima del contenido | 2023-2025 | Usar horizontal filter bar, no sidebar de filtros |
| Dark mode como feature premium | Warm neutral como estética premium | 2024-2025 | Cowork = SOTA. Decisión locked confirmada por mercado |
| Spreadsheet UI para datos masivos | Hybrid: tabla para listas, panel para detalle | 2024-2025 (Apollo) | Table + slide-in panel es el patrón dominante |

**Deprecated / a evitar:**
- Modal de página completa para detalle de lead (reemplazado por drawer panel)
- Sidebar de filtros vertical (reemplazado por filter pills horizontales)
- KPIs solo numéricos sin contexto comparativo
- Navegación con dropdowns anidados profundos

---

## Open Questions

1. **Alertas in-app: badge vs toast vs modal**
   - Lo que sabemos: definida como "pendiente de definir durante diseño visual" en CONTEXT.md
   - Lo que no está claro: si el SDR necesita alertas en tiempo real (Convex reactivo) o solo al cargar
   - Recomendación: incluir un toast notification en el mockup como opción A, y dejar que el usuario decida durante revisión

2. **Período selector en KPIs CEO**
   - Lo que sabemos: el CEO ve KPIs con comparativas
   - Lo que no está claro: ¿7 días, 30 días, trimestre? ¿El selector está en topbar o en cada card?
   - Recomendación: incluir un selector de período en el topbar (opciones: Esta semana / Este mes / Último trimestre) que afecta a todos los KPIs simultáneamente

3. **Estado de leads "en el pipeline" vs "descartados"**
   - Lo que sabemos: estados incluyen contactado, sin contactar, HOT/WARM/NURTURE/SKIP del scoring
   - Lo que no está claro: ¿hay un estado "descartado por VP" separado del SKIP del scoring IA?
   - Recomendación: incluir estado "Descartado" manual en el mockup — permite al VP limpiar el pipeline de leads que no valen la pena aunque tengan score WARM

4. **Mobile: ¿bottom command bar o top search?**
   - Lo que sabemos: responsive requerido (DASH-06)
   - Lo que no está claro: en mobile, el sticky bottom command bar compite con el teclado del sistema
   - Recomendación: en mobile, mover el command bar a la parte superior (como una search bar) y que el bottom sea navegación de tabs

---

## Validation Architecture

> nyquist_validation está habilitado en .planning/config.json

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Browser visual testing (manual) — no hay test runner para fase de diseño |
| Config file | N/A — mockups son HTML estático |
| Quick run command | `open .planning/phases/02-diseno-dashboard/mockups/ceo-dashboard.html` |
| Full review command | Abrir los 3 archivos de mockup en Chrome + revisar en DevTools mobile 375px |

### Phase Requirements → Test Map
| Req ID | Comportamiento | Tipo de Test | Comando | Archivo existe? |
|--------|---------------|-------------|---------|-----------------|
| DASH-01 | Pantalla de login con campos email + Google OAuth | Visual review | Abrir mockup en browser | ❌ Wave 0 |
| DASH-02 | Vista de leads con filtros funcionales (pills HOT/WARM/etc.) | Visual + interacción manual | Click en filter pills, verificar toggle state | ❌ Wave 0 |
| DASH-03 | 4 KPI cards con numero + delta + narrativa | Visual review | Verificar narrativa visible sin scroll | ❌ Wave 0 |
| DASH-04 | Click en lead → panel slide-in con todos los datos | Interacción manual | Click en fila → panel aparece con GSAP | ❌ Wave 0 |
| DASH-05 | Indicador de organización activa visible en sidebar/topbar | Visual review | Verificar org badge en sidebar | ❌ Wave 0 |
| DASH-06 | Layout funcional en 375px mobile | DevTools resize | Chrome DevTools → 375px → verificar sin scroll horizontal | ❌ Wave 0 |
| DASH-07 | No aplica a fase de diseño | N/A — implementación Phase 3 | N/A | N/A |

### Sampling Rate
- **Por cada mockup completado:** Abrir en browser + verificar en 375px mobile
- **Antes de presentar al usuario:** Los 3 mockups deben estar abiertos y sin errores de consola
- **Phase gate:** Usuario aprueba los 3 diseños antes de avanzar a Phase 3

### Wave 0 Gaps
- [ ] `mockups/ceo-dashboard.html` — cubre DASH-03 + DASH-05
- [ ] `mockups/vp-ventas-dashboard.html` — cubre DASH-02 + DASH-04
- [ ] `mockups/sdr-dashboard.html` — cubre DASH-02 + DASH-04 + DASH-06
- [ ] `mockups/shared/styles.css` — design tokens Sisteco
- [ ] `mockups/shared/mock-data.js` — datos ficticios chilenos
- [ ] `mockups/shared/interactions.js` — GSAP + slash menu + panel open/close

*(No hay test runner que instalar — los mockups son archivos HTML estáticos revisados visualmente)*

---

## Sources

### Primary (HIGH confidence)
- `.claude/skills/app-design.md` — Design System Sisteco completo con tokens CSS, componentes, patrones GSAP, investigación previa de Claude/Notion/Obsidian/Wispr
- `.planning/02-CONTEXT.md` — Todas las decisiones locked de las 4 áreas de discusión
- Linear docs: https://linear.app/docs/conceptual-model — Command bar keyboard-first patterns
- Superhuman blog: https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/ — Command palette design principles
- HubSpot knowledge: https://knowledge.hubspot.com/records/manage-leads — Role-based lead management, ownership patterns

### Secondary (MEDIUM confidence)
- Apollo.io release notes 2025: https://knowledge.apollo.io/hc/en-us/articles/34072157047309-Release-Notes-2025 — Spreadsheet UI, Dynamic Page Framework, widget library
- Attio platform: https://attio.com/help/reference/managing-your-data/views — Kanban/table/list views
- Orbix Studio guide: https://www.orbix.studio/blogs/saas-dashboard-design-b2b-optimization-guide — B2B SaaS dashboard patterns
- Onething Design: https://www.onething.design/post/b2b-saas-ux-design — B2B SaaS UX challenges 2026
- UX Collective (uxdesign.cc) — KPI narrative context patterns
- Maggie Appleton: https://maggieappleton.com/command-bar — Command bar history and patterns
- Purrweb CRM design: https://www.purrweb.com/blog/a-perfect-crm-8-key-elements-of-design/ — CRM UX elements

### Tertiary (LOW confidence — necesitan validación)
- Cognism vs Apollo.io UI comparison (inferido de reviews, no acceso directo a UI)
- Pipedrive detail panel patterns (documentación pública, no screenshots directos)
- INSIA SDR dashboard patterns (single source, empresa de BI)

---

## Metadata

**Confidence breakdown:**
- Standard stack (herramientas de mockup): HIGH — stack locked por decisión del usuario
- Architecture patterns (command bar, drawer, role-based): HIGH — verificados con Linear/HubSpot/Notion docs + app-design.md existente
- Reference dashboards (Apollo, Attio, Cognism): MEDIUM — análisis de reviews y docs públicos, sin acceso directo a UIs 2025
- Common pitfalls: HIGH — múltiples fuentes convergentes en los mismos problemas
- Code examples: HIGH — basados en app-design.md verificado + patrones GSAP documentados

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (estable — el diseño del mercado B2B SaaS no cambia mensualmente)

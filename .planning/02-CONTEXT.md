# Phase 2 Context: Diseno Dashboard (Colaborativo)

**Created:** 2026-03-10
**Phase goal:** Tener un diseno aprobado del dashboard que refleje el mercado actual de SaaS B2B, listo para construir
**Requirements:** DASH-01 a DASH-07 (definicion visual)

---

## Prior Decisions (from PROJECT.md / Phase 1)

- Dashboard desde cero — NO reutilizar skeleton SAAN dark mode
- Multi-tenant via Clerk Organizations (cada empresa ve solo sus datos)
- Multi-rol: CEO, VP Ventas, SDR — cada rol ve lo que necesita
- Convex como DB reactiva (leads, metricas, estados)
- Frontend vanilla HTML/CSS/JS + GSAP + Lucide
- Deploy via Vercel
- Datos reales del pipeline Phase 1 alimentan el dashboard

## Area 1: Punto de Partida del Diseno

### Decisions

| Decision | Detail |
|----------|--------|
| Estetica base | **Cowork** — warm minimal, bordes sutiles, pills, fondos calidos |
| SVGs hand-drawn | **Eliminados** — no quedaron bien, usar Lucide o iconos limpios |
| Command bar | **Si** — barra de busqueda inteligente tipo claude.ai para consultar datos de la app |
| Arquitectura UX | **Pagina limpia** — al entrar solo command bar + botones de queries frecuentes. Contenido carga on-demand debajo |
| Modelo mental | Como **claude.ai** — escribes que quieres ver y la info aparece en contexto. NO es un dashboard tradicional con todo visible |
| Queries | **Set finito** — busquedas delimitadas que corresponden a datos reales de las automatizaciones. Se muestran como botones tipo Cowork |
| Capa de inteligencia | La app **analiza** los datos, no solo los muestra. Interpreta, recomienda, explica tendencias. IA (Gemini) procesa los datos del pipeline |
| Nomenclatura | NO llamar "dashboard" — es una **interfaz de lenguaje natural** o **workspace de inteligencia de ventas** |
| Contenido exclusivo | **Un contenido a la vez** — click en boton reemplaza el anterior, no apila. Cada vista es un informe individual |
| Informe PDF | **Boton visible abajo-izquierda** — genera reporte PDF completo (KPIs, funnel, hot leads, equipo) para compartir con miembros de la empresa |
| Asistente conversacional | El command bar permite preguntas libres tipo "que puedo hacer con esto?" y la app responde con contexto util. Super informativo con toda la data de automatizaciones |
| Investigacion previa | **Si** — benchmarkear 5-8 dashboards B2B SaaS reales antes de disenar |

## Area 2: Contenido por Rol

### Decisions

| Decision | Detail |
|----------|--------|
| CEO KPIs | Cards numericas con deltas % + **interpretacion narrativa** ("que significa esto, como mejoro vs antes") |
| VP Ventas | Metricas **agregadas del equipo** en MVP. Rendimiento individual por SDR es feature futura |
| SDR | **To-do list** de leads pendientes + vista pipeline como guia de acciones a realizar |
| Layout por rol | **Misma pagina base** (command bar, estetica Cowork) pero **datos y layout distintos segun rol logueado** |
| Filosofia | La info accesible cambia segun login — jerarquia de acceso a datos |

## Area 3: Proceso de Diseno Colaborativo

### Decisions

| Decision | Detail |
|----------|--------|
| Formato de propuestas | **Mockups HTML estatico** en browser — archivos separados del proyecto principal |
| Investigacion de mercado | Claude investiga 5-8 dashboards B2B SaaS con enfoque **funcional**: que tienen, que los diferencia, por que los prefieren, estrategias, funcionalidades, configuracion |
| Referencias del usuario | El usuario aporta sus propias referencias cuando Claude indique el momento |
| Tipo de feedback | **Libre** — usuario da punteos de lo que quiere ver, participa activamente en el diseno |
| Nivel de fidelidad | **Equilibrio** — no wireframes grises puros ni estetica final prematura. Estructura + contenido real con estilo Sisteco aplicado para evaluar ambos juntos |
| Participacion | Usuario incorporado en el diseno — el da los punteos de lo que quiere ver |

### Preguntas de investigacion (guia para researcher)

Al investigar dashboards B2B SaaS, cubrir:
1. Que funcionalidades tienen
2. Que son (tipo de producto, mercado)
3. Que los diferencia en el mercado
4. Que los hace preferidos por usuarios
5. Cuales son sus estrategias de UX
6. Como estan configurados/estructurados
7. Que podemos inspirar para Sisteco

## Area 4: Nivel de Interactividad

### Decisions

| Decision | Detail |
|----------|--------|
| Jerarquia de acciones | **CEO** observa actividad de VP/SDR. **VP Ventas** asigna leads y marca estados. **SDR** interactua con sus leads asignados |
| Acciones en MVP | Si — asignar leads, marcar como contactado, cambiar estado. Acciones afectan Convex y workflows |
| Panel de lead expandido | Al hacer click en un lead, se abre **pantalla con datos expandidos**: info scrapeada, LinkedIn, email, telefono, informacion clave |
| Outreach SDR | Desde el panel expandido, el SDR usa la info para actuar: abrir LinkedIn, escribir email, llamar. Sisteco provee la data, el SDR ejecuta |
| Filosofia de datos | Dar a la empresa la **mayor cantidad de informacion posible** sobre cada lead |
| Alertas in-app | **Idea aceptada pero pendiente de definir** — se refinara durante el diseno visual |

### Jerarquia de permisos (MVP)

```
CEO
  - Ve: KPIs narrativos, actividad VP/SDR, metricas globales
  - Hace: Solo observa (lectura)

VP Ventas
  - Ve: Pipeline completo, metricas agregadas equipo, leads sin asignar
  - Hace: Asignar leads a SDRs, marcar estados, gestionar pipeline

SDR
  - Ve: Sus leads asignados, to-do list, datos expandidos de cada lead
  - Hace: Marcar contactado, abrir info de contacto, interactuar con sus leads
```

## Code Context (assets existentes relevantes)

| Asset | Relevancia para Phase 2 |
|-------|------------------------|
| Estetica Cowork (investigacion previa) | Base visual confirmada — warm minimal, pills, bordes sutiles |
| `vault/dashboard-v2-design.md` | Investigacion Cowork anterior, parcialmente reutilizable |
| Identidad Sisteco (BRAND_GUIDELINES.md) | Colores (#F8F7F5, #c5ed36, #111111), fonts (Sharp Grotesk, Source Sans 3), Lucide |
| Convex schema (leads, metricas) | Define que datos estan disponibles para mostrar en dashboard |
| Pipeline Phase 1 (workflows n8n) | Define que datos llegan: leads con scores, datos SII, clasificacion HOT/WARM/NURTURE/SKIP |

## Deferred Ideas

| Idea | Fase sugerida |
|------|---------------|
| Rendimiento individual por SDR (ranking, conversion por persona) | Phase 3+ o feature request |
| Integracion directa con email/secuencias desde dashboard | Phase 3+ (evaluar Lindy) |
| Alertas in-app (badges, notificaciones) | Definir durante diseno visual Phase 2 |
| Acciones CEO (aprobar presupuestos, etc.) | Phase 5+ cuando haya mas funcionalidad |

## Scope Boundary

Esta fase produce SOLO:
1. Investigacion de 5-8 dashboards B2B SaaS reales (analisis funcional)
2. Moodboard/referencias compartidas (Claude + usuario)
3. Mockups HTML estatico para 3 vistas: CEO, VP Ventas, SDR
4. Diseno visual aprobado listo para construir en Phase 3

NO incluye: codigo de produccion, integracion con Convex, auth, deploy, ni funcionalidad real.

---
*Context created: 2026-03-10*
*Areas discussed: Punto de partida, Contenido por rol, Proceso colaborativo, Interactividad*

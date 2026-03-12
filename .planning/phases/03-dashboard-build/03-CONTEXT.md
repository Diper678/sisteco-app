# Phase 3: Dashboard Build - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Construir el dashboard funcional multi-tenant multi-rol conectado a datos reales de Convex. Basado en los 3 mockups aprobados en Phase 2 (CEO, VP Ventas, SDR). Login via Clerk, deploy en Vercel, responsive en movil. NO incluye: compliance (Phase 4), pagos/onboarding (Phase 5), outreach automatizado, integraciones CRM.

</domain>

<decisions>
## Implementation Decisions

### Command bar con datos reales
- **Queries predefinidas por rol** — CEO ve KPIs/funnel/tendencias, VP ve pipeline/equipo/asignaciones, SDR ve sus leads/pendientes/HOT
- **Fallback Gemini** para queries no reconocidas — Gemini recibe solo datos del scope del rol (aislamiento de permisos)
- **Formato respuesta Gemini:** datos estructurados (mini-card con dato duro) + narrativa interpretativa debajo
- **Historial de queries:** ultimas 5 consultas del usuario, visibles al abrir el command bar
- **Botones de query dinamicos con badges** — mismos botones pero con indicadores contextuales ("Leads HOT (3 nuevos)", "Pipeline (12 activos)")
- **Comparacion temporal:** toggle vs semana anterior y mes anterior. Solo esos 2 periodos en MVP
- **Persistencia:** al recargar pagina, restaura la ultima vista/query que tenia abierta
- **Compartir:** NO hay boton separado — "Generar PDF" y "Copiar resumen" son queries dentro del command bar
- **Sin atajo de teclado** — command bar siempre visible, acceso solo por click
- **Sin match:** intenta Gemini como fallback antes de mostrar error

### Flujo de asignacion y acciones
- **Asignar leads:** select (checkboxes) + boton asignar en tabla del VP. Permite bulk assign
- **Bulk + individual:** VP puede seleccionar manualmente O filtrar (industria/score/estado) y asignar todos los filtrados a un SDR
- **4 estados de lead:** Sin asignar → Asignado → En progreso → Cerrado
- **3 subestados de cierre:** Ganado / Perdido / Descartado — permite medir conversion real
- **Cambio de estado:** click directo, sin nota obligatoria ni campo extra. Maxima velocidad
- **Pipeline value:** solo conteo de leads por estado en MVP, sin valor monetario estimado
- **Audit trail:** timeline en el panel del lead — "VP asigno a Maria (10 mar) → Maria marco contactado (11 mar)"
- **Reasignar:** VP puede reasignar lead a otro SDR, con dialogo de confirmacion
- **SDR no rechaza leads** en MVP — si no lo quiere, lo marca como Descartado via flujo normal
- **Lead Ganado:** solo actualiza KPIs del CEO, sin notificacion Discord extra
- **Notificacion al SDR:** solo dentro del dashboard (aparece en to-do list). Sin Discord/email

### Empty states y primera vez
- **0 leads:** pantalla limpia Cowork con mensaje "Tu pipeline esta vacio" + command bar activo con queries normales
- **Queries vacias:** mismos botones de siempre, al clickear muestran "Aun no hay datos. Proximo batch: [fecha]" con fecha estimada del proximo ciclo
- **Texto limpio** sin datos ficticios ni skeletons fantasma
- **Activacion del pipeline:** VP activa desde el dashboard (boton/query en command bar) que dispara workflow en n8n via API
- **Wizard ICP breve** antes de activar: 3-4 preguntas (industria, tamano, ubicacion, keywords) que configuran el PhantomBuster search
- **VP dual:** sin SDRs, el VP trabaja como SDR (ve leads directamente). Cuando invite equipo, cambia a vista de gestion
- **Crecimiento:** VP invita SDRs via Clerk Organizations. Puede reasignar leads que estaba trabajando al nuevo SDR

### Informe PDF
- **Acceso:** query del command bar ("Generar reporte PDF"), NO boton separado
- **Contenido:** resumen ejecutivo adaptado al rol — CEO ve KPIs+funnel, VP ve pipeline+equipo, SDR ve sus leads+pendientes
- **Formato:** branded con identidad Sisteco (logo, colores, tipografia). Profesional, compartible con directivos
- **Datos:** solo datos y graficos, sin insights de IA
- **Periodo:** el usuario elige rango (esta semana, este mes, ultimo trimestre)
- **Frecuencia:** feature core, uso semanal/mensual
- **On-demand en MVP**, envio automatico programado como feature futura
- **Ficha PDF de lead individual:** feature futura (no MVP)

### Experiencia movil
- **Responsive adaptado** — misma app web con layout adaptado via CSS. No PWA ni app nativa
- **Command bar mobile:** Claude decide la mejor UX (sticky top vs FAB + bottom sheet)
- **Tabla VP en movil:** lista simplificada vertical (nombre + score badge + estado). Tap para ver detalle
- **SDR en terreno:** acceso rapido a datos de contacto para copiar y usar en telefono/correo/WhatsApp
- **Datos de contacto:** tap para abrir (tel → dialer, email → correo, LinkedIn → app/web) + icono copiar al lado
- **Cambio de estado desde movil:** si, acciones basicas de campo disponibles

### Claude's Discretion
- Command bar mobile UX (sticky vs FAB + sheet)
- Diseno del PDF (layout, graficos, spacing)
- Exact implementation del fallback Gemini (prompt engineering, context window)
- Loading states y transiciones entre queries
- Skeleton/loading patterns
- Error handling para Convex/Gemini failures
- Exact ICP wizard fields and validation

</decisions>

<specifics>
## Specific Ideas

- Command bar filosofia "todo pasa por el command bar" — compartir, reportes, configuracion son queries, no botones separados
- VP Ventas como SDR dual es pragmatico para empresas chicas de Chile (CEO/VP/SDR puede ser la misma persona)
- Pipeline activation es self-service — el cliente no depende de Sisteco para empezar
- SDR en terreno necesita datos de contacto accesibles para copiar → WhatsApp, telefono, email
- Los mockups aprobados (Phase 2) son la referencia visual exacta: CEO (ceo.html), VP Ventas (vp-ventas.html), SDR (sdr.html)
- Estetica Cowork warm-minimal ya definida en styles.css con todos los design tokens
- Un contenido a la vez — click en query reemplaza el anterior, no apila

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mockups/shared/styles.css` — design system completo (tokens, tipografia, colores, componentes CSS). Reutilizable como base del dashboard real
- `mockups/shared/interactions.js` — Lucide init, GSAP animations, command bar logic, query button handlers. Estructura reutilizable
- `mockups/shared/mock-data.js` — estructura SISTECO_DATA define el shape de los datos. Guia para el schema Convex real
- `mockups/ceo.html`, `vp-ventas.html`, `sdr.html` — 3 vistas aprobadas como referencia de layout y contenido
- `mockups/shared/assets/` — logos, iconos, fuentes (Nasalization, icon-sisteco, logo-sisteco)

### Established Patterns
- Vanilla HTML/CSS/JS + GSAP 3.12.7 + Lucide 0.468.0 (no framework)
- GSAP animateBlockIn/animateBlockOut para transiciones de contenido
- Command bar con query buttons organizados por rol
- SISTECO_DATA como objeto global con datos mock → reemplazar por Convex queries
- CSS custom properties para design tokens (--bg-primary, --accent, etc.)
- Source Sans 3 (body) + Sharp Grotesk (headings) + Nasalization (logo only)

### Integration Points
- Convex DB: leads, metricas, organizaciones — HTTP Actions ya configurados
- Clerk: auth + Organizations para multi-tenant
- n8n: workflows de pipeline (PhantomBuster, SII, scoring) — activables via API
- Vercel: deploy target
- Gemini 2.5 Flash: fallback NL del command bar
- Resend: envio de reportes PDF (feature futura)
- Discord webhooks: ya configurados para alertas HOT leads (reutilizar infra)

</code_context>

<deferred>
## Deferred Ideas

- **Envio automatico de PDF programado** — feature post-MVP, n8n workflow + Resend
- **Ficha PDF de lead individual** — feature futura
- **Notificacion Discord al cerrar como Ganado** — evaluar post-MVP
- **SDR rechaza/devuelve lead asignado** — feature futura
- **Pipeline value en pesos (estimacion por lead)** — feature futura cuando haya datos de conversion
- **PWA instalable** — evaluar post-MVP si hay demanda mobile
- **Rendimiento individual por SDR (ranking)** — deferred from Phase 2
- **Integracion directa con email/secuencias desde dashboard** — deferred from Phase 2
- **Alertas in-app (badges, notificaciones)** — deferred from Phase 2

</deferred>

---

*Phase: 03-dashboard-build*
*Context gathered: 2026-03-12*

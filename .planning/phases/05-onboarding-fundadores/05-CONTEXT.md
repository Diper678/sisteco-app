# Phase 05 — Onboarding Clientes Fundadores

## Contexto del Pivote (2026-03-15)

Estas decisiones se tomaron bajo el modelo **workflows-first**:
- Sisteco entrega resultados (Sheet scored + CRM sync), el cliente no usa software
- El dashboard es secundario — el formulario y la Sheet son los puntos de contacto principales
- El trial NO es "prueba el software" sino "te entregamos leads reales de tu vertical scored"
- DPA se firma al pagar, no antes del trial
- Precios con IVA (19% Chile) siempre

## Decisiones Consolidadas

### Area 1 — Trial y primera entrega de valor

| # | Decision | Detalle |
|---|----------|---------|
| 1 | **Trial = 1 corrida del pipeline** | UNA sola corrida completa (PB + scoring + SII + Sheet). No recurrente. Entrega ~200-600 leads (~100 HOT). Suficiente para demostrar valor y potencialmente cerrar una venta durante el trial. |
| 2 | **Formulario ICP integrado** | Formulario unico que vive en landing page Y como link directo en outreach/automatizaciones. Mismo formulario siempre. Pregunta: sector/industria, mercado, tipo de clientes, CRM que usan, como almacenan leads, setup de correos, proceso actual de ventas. |
| 3 | **Datos van a Convex** | El formulario guarda respuestas en Convex. Estas personalizan el pipeline para la demo: busqueda PB, scoring ICP, vertical del cliente. |
| 4 | **14-15 dias de evaluacion** | Periodo para evaluar los resultados del batch. No se corre el pipeline de nuevo hasta que haya pago. Limite: max 1 corrida/semana si se extiende. |
| 5 | **White-glove setup** | Sisteco configura todo basado en las respuestas del formulario. El cliente NO configura nada. Dejar claro que "podemos hacer de todo". Setup personalizado segun CRM, correos, proceso del cliente. |
| 6 | **Precios con IVA** | Base ~$472, Crecimiento ~$949, Enterprise ~$2,142 USD (o equivalente CLP con IVA 19%). Nunca mostrar sin IVA. |
| 7 | **Conversion en trial = home run** | Si el cliente cierra una venta con los leads del trial, la conversion a pago es casi segura. Optimizar para que esto pase: priorizar leads HOT en la entrega, incluir datos de contacto listos para usar. |

### Area 2 — Flujo de pago (Reveniu)

| # | Decision | Detalle |
|---|----------|---------|
| 1 | **Link Reveniu integrado** | Links de checkout embebidos en dashboard y emails automaticos. NO envio manual por Felipe. 3 links ya configurados en .env (Base, Crecimiento, Enterprise). |
| 2 | **DPA se firma al pagar** | El trial NO requiere DPA firmado. DPA se presenta junto con el primer pago como parte del proceso de activacion. Simplifica el trial: menos friccion para empezar. |
| 3 | **7 dias de gracia en pago fallido** | Pipeline se pausa despues de 7 dias sin pago. Leads y Sheet se mantienen intactos en el estado que tenian. No se borran datos. Re-activacion al pagar. |
| 4 | **Exit-intent descuento** | En la pagina de precios: si el usuario sale o retrocede, popup con descuento atractivo (patron cart abandonment e-commerce). En pantalla de pago: si retrocede, oferta de descuento. Implementar en landing page con links Reveniu/dLocal. |

### Area 3 — Secuencia de provisioning

| # | Decision | Detalle |
|---|----------|---------|
| 1 | **Secuencia completa del journey** | 1) Prospecto llena formulario (landing/link) → Convex. 2) Crear Clerk org + acceso dashboard (inmediato, trial). 3) Sisteco configura pipeline segun respuestas. 4) Pipeline corre 1 vez → Sheet con leads scored. 5) 14-15 dias evaluacion (max 1 corrida/semana). 6) Pago → firma DPA + Reveniu. 7) Pipeline recurrente semanal activado. 8) Insertar tenantSheet row en Convex. |
| 2 | **Clerk org en el trial** | La cuenta Clerk se crea inmediatamente al llenar el formulario. El prospecto tiene acceso al dashboard desde el dia 1 del trial. |
| 3 | **Automatizacion maxima** | El provisioning debe ser lo mas automatizado posible. Script/workflow que: crea Sheet, configura PB search, corre pipeline, notifica al prospecto. Felipe supervisa pero no ejecuta manualmente cada paso. |
| 4 | **Limite 1 corrida/semana** | El pipeline tiene rate limit: maximo 1 corrida por semana por cliente. Previene abuso durante trial y controla costos de PB/Gemini. |
| 5 | **Entrega completa en trial** | Se entrega todo lo que salga de una corrida PB (~200-600 leads). No se limita artificialmente. De esos, ~100 seran HOT. La Sheet incluye scoring, datos SII, categorias. |
| 6 | **Sheet durante trial** | El entregable principal del trial es la Google Sheet con leads scored. El dashboard es accesible pero secundario. La Sheet es lo que el vendedor usa en el dia a dia. |
| 7 | **Formulario captura stack del cliente** | Ademas de ICP (sector, mercado, tipo cliente), el formulario pregunta: que CRM usan, como almacenan leads, setup de correos, proceso actual de ventas. Esto permite setup white-glove personalizado. |

### Area 4 — Terminos del programa fundadores

| # | Decision | Detalle |
|---|----------|---------|
| 1 | **Setup gratuito** | El setup completo (configuracion PB, Sheet, CRM sync, scoring) es gratis para fundadores. Este es el gancho principal. Valor de setup: significativo pero Sisteco lo absorbe para los primeros 5. |
| 2 | **Mensual sin contrato** | Sin compromiso minimo. Pueden cancelar cuando quieran. Soft incentivo para quedarse: mejoras continuas basadas en sus datos. |
| 3 | **Todos participan en caso de estudio** | TODOS los fundadores aceptan opt-in para caso de estudio. Sus datos se usan para mejorar Sisteco Y para mejorar su propia experiencia. Se coordina en todo: demo, web, automatizaciones. |
| 4 | **5 fundadores** | Programa cerrado a 5 clientes fundadores. Suficientes para validar, pocos para dar atencion personalizada real. |
| 5 | **Post-fundadores: atencion automatizada** | Despues de los 5 fundadores, la atencion pasa de white-glove a sistema de tickets. Notificaciones a Discord de Sisteco + almacenamiento en Notion. Cliente reporta problemas, Sisteco gestiona. El cliente nunca toca herramientas internas. |
| 6 | **Exit-intent en pricing** | Estrategia cart abandonment: popup con descuento cuando alguien sale de la pagina de precios o retrocede desde la pantalla de pago. Implementar en landing page con links Reveniu/dLocal. |

## Observaciones Estrategicas

1. **El trial ES la venta.** Si el cliente cierra un deal con los leads del trial, ya probo el valor. La conversion a pago es natural, no forzada.

2. **White-glove escala hasta 5.** Con 5 fundadores, Felipe puede manejar setup personalizado. Despues de 5, el provisioning debe ser semi-automatizado con scripts + tickets.

3. **El formulario es la pieza central.** Un formulario bien disenado que captura ICP + stack del cliente permite: personalizar el pipeline, hacer setup sin llamadas innecesarias, y demostrar que Sisteco "puede hacer de todo".

4. **Reveniu Starter no tiene API.** Los primeros 5 clientes se manejan con links de checkout. Para automatizar cobros (dunning, retries), necesitaremos dLocal Go o Reveniu Enterprise. Esto es post-5-fundadores.

5. **La Sheet es el producto.** En workflows-first, la Sheet con leads scored ES el entregable. El dashboard es un bonus. El trial entrega una Sheet real, no un mockup.

6. **Caso de estudio como flywheel.** Los 5 fundadores generan 5 casos de estudio reales. Estos son el argumento de venta para los siguientes 50 clientes.

## Infraestructura existente (de fases anteriores)

- **Convex schema:** Multi-tenant via orgId, tabla `users` con roles, tabla `tenantSheets`, tabla `icpProfiles`
- **Compliance:** opt-out, retencion 24/36 meses, ARCO-POL, blacklist global — todo listo
- **DPA template:** `docs/legal/DPA-template.md` completo con campos variables por cliente
- **T1 Lead Scoring Pipeline:** En n8n con checklist de setup por cliente
- **T2 SII Enrichment:** JSON listo para importar
- **Email (Resend):** Patron establecido en compliance, reutilizable para onboarding emails
- **Dashboard:** 3 vistas (CEO, VP, SDR) construidas con command bar
- **Reveniu links:** 3 links de checkout configurados en .env

## Lo que falta construir

- Tabla `subscriptions` en Convex (plan, status, trial dates, billing cycle)
- Tabla `trialRequests` o similar para el formulario de intake
- Formulario publico de intake (ICP + stack del cliente) → Convex
- Script de provisioning automatizado (crear Sheet, configurar PB, correr pipeline)
- Logica de trial en dashboard (estado trial, dias restantes, CTA de pago)
- Integracion links Reveniu en flujo automatico
- Email de bienvenida/onboarding via Resend
- Sistema de tickets post-fundadores (Discord + Notion)
- Exit-intent popup en landing page de precios
- DPA digital signing flow (al momento del pago)

## Siguiente Paso

→ `/gsd:plan-phase 5` o `/gsd:research-phase 5` para disenar la implementacion tecnica.

# Phase 04 — Compliance Basico Ley 21.719

## Contexto del Pivote (2026-03-15)

Estas decisiones se tomaron bajo el modelo **workflows-first**:
- Sisteco es **encargado de tratamiento** (data processor) para sus clientes
- El producto son workflows n8n + Google Sheets scored + CRM sync + alertas
- El dashboard es secundario — el cliente recibe resultados, no usa herramientas
- Los datos viven en 3 lugares: Convex (fuente verdad) + Sheets + CRM del cliente
- La ley entra en vigencia el 1 dic 2026 (~8.5 meses)

## Decisiones Consolidadas

### Area 1 — UX del Compliance (revisada post-pivote)

| # | Decision | Detalle |
|---|----------|---------|
| 1 | **Aviso compliance via DPA** | El mecanismo de transparencia para el tenant migra del dashboard al DPA firmado. Seccion dedicada en el contrato explica tratamiento de datos, derechos, y compliance. |
| 2 | **Link permanente en dashboard** | Secundario — si alguien entra al dashboard, sigue accesible. Pero el DPA es el canal principal. |
| 3 | **Opt-out via link en emails** | Cada comunicacion de outreach incluye link → formulario publico standalone. Vigente sin cambios. |
| 4 | **Email + verificacion para opt-out** | Lead pone email, recibe confirmacion, al confirmar se ejecuta. Sin cambios. |
| 5 | **Soft delete + propagacion a Sheets/CRM** | Datos se anonimizan en Convex. Se propaga eliminacion a Google Sheets (automatico) y CRM (notificacion al cliente). Blacklist para no re-importar. |
| 6 | **Politica publica + seccion en DPA** | sisteco.cl/privacidad (completa). Resumen dentro del DPA firmado (reemplaza resumen en dashboard). |
| 7 | **RAT en Convex + Obsidian** | Registro de Actividades de Tratamiento interno de Sisteco. No visible para tenants. Sin cambios. |

### Area 2 — Derechos del Titular

| # | Decision | Detalle |
|---|----------|---------|
| 1 | **ARCO-POL completo centralizado** | Sisteco gestiona TODAS las solicitudes como punto unico de contacto. Formulario publico en sisteco.cl/privacidad/derechos. Acceso, rectificacion, supresion, oposicion, portabilidad, limitacion. Sisteco ejecuta y notifica a cada tenant afectado. |
| 2 | **Pagina standalone para formulario** | `sisteco.cl/privacidad/derechos` — formulario simple: email, nombre, tipo de solicitud. Sin login. Verificacion por email. Separado de la politica de privacidad. |
| 3 | **Gestion hibrida (MVP)** | n8n hace triage automatico + busqueda de lead en todos los tenants. Presenta opciones al operador humano. Humano confirma, n8n ejecuta accion + notificaciones. Plazo: 15 dias habiles (ley permite 30). Migrar a full-auto cuando haya volumen. |
| 4 | **Opt-out global instantaneo** | Blacklist global en Convex. Al marcar opt-out: elimina/anonimiza de TODOS los tenants, borra de todas las Sheets activas (via API), para secuencias de outreach en curso, notifica a cada tenant afectado. El lead nunca puede ser re-importado por ningun tenant. |

### Area 3 — Retencion de Datos

| # | Decision | Detalle |
|---|----------|---------|
| 1 | **24 meses de retencion** | Default global para leads sin interaccion. Alineado con ICO (UK). Buen fit para ciclos de venta B2B largos en Chile. Sin diferenciacion por plan. |
| 2 | **Soft delete + hard delete a 30 dias** | Soft delete inmediato (no accesible via API ni sheets). Hard delete irreversible a los 30 dias. Periodo de gracia para errores operativos. |
| 3 | **Propagacion hibrida** | Sisteco borra automaticamente de lo que controla (Convex + Google Sheets que genera via API). Notifica al cliente para lo que no controla (su CRM). El DPA incluye obligacion del cliente de eliminar de su CRM cuando Sisteco notifique. |
| 4 | **Interaccion extiende con techo 36 meses** | Cualquier interaccion registrada reinicia el timer de retencion. Pero hay maximo absoluto de 36 meses desde recoleccion original. Despues se requiere renovar base legal (re-evaluar interes legitimo). |

### Area 4 — Compliance Visible para el Tenant

| # | Decision | Detalle |
|---|----------|---------|
| 1 | **Columna en sheet + reporte mensual** | Cada Google Sheet incluye columnas: estado_compliance, base_legal, fuente, fecha_expiracion. Reporte mensual automatizado (n8n): leads procesados, opt-outs, eliminados, estado general. |
| 2 | **DPA pre-onboarding obligatorio** | Sin DPA firmado, no se activa el servicio. Digital (DocuSign/HelloSign o similar). Incluye: tratamiento de datos, derechos, obligaciones del cliente, propagacion de eliminacion. |
| 3 | **Badge propio + certificacion oficial despues** | Badge "Cumple Ley 21.719" en sheets, reportes, landing, propuestas comerciales. Es declaracion de cumplimiento propio (no certificacion). Cuando APDP permita certificacion MPI (post dic 2026), actualizar a badge oficial. |
| 4 | **DPA con obligaciones + educacion breve** | DPA especifica: (1) no re-compartir sheets/datos con terceros sin base legal, (2) respetar opt-outs que Sisteco comunique, (3) eliminar de CRM cuando Sisteco notifique expiracion. Complemento: email/video de 5 min "Ley 21.719 para equipos de venta" en onboarding. |

## Observaciones Estrategicas

1. **Rol dual de Sisteco:** Responsable de la recoleccion (scraping/PhantomBuster) + encargado del procesamiento posterior para clientes. DPA con cada cliente es OBLIGATORIO.

2. **Formulario ARCO-POL es el UNICO punto de contacto** lead-Sisteco (ademas del opt-out en emails). Debe funcionar impecablemente.

3. **Compliance como argumento de venta:** "Si Apollo te da emails, TU eres responsable del compliance. Si Sisteco te da leads scored, el compliance ya esta resuelto."

4. **Riesgo Sheets:** Una vez entregada la sheet, Sisteco pierde control. El DPA y la columna fecha_expiracion mitigan esto. El cliente es responsable de lo que haga con los datos fuera de la plataforma.

5. **Educacion compliance como linea de negocio futura:** Concientizacion y capacitacion en compliance B2B es un vertical futuro de Sisteco, pero NO es prioridad cercana. Se desarrollara externamente cuando el core (workflows + compliance integrado) este estabilizado.

## Siguiente Paso

→ `/gsd:plan-phase 4` o `/gsd:research-phase 4` para disenar la implementacion tecnica.

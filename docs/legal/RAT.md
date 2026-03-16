# REGISTRO DE ACTIVIDADES DE TRATAMIENTO — SISTECO

Conforme Art. 16 Ley 21.719 | Actualizado: 2026-03-15

---

## Actividad 1: Pipeline de Prospeccion B2B

| Campo | Detalle |
|-------|---------|
| Responsable | Sisteco SpA (Felipe, contacto@sisteco.cl) |
| Proposito | Identificar y calificar prospectos B2B para oferta comercial de automatizacion de ventas |
| Categorias de titulares | Directivos y decisores de empresas con 50+ empleados en Chile |
| Categorias de datos | Nombre, cargo, empresa, email profesional, LinkedIn URL, RUT empresa, datos SII publicos |
| Categorias de destinatarios | Tenants (clientes Sisteco) que reciben leads scored via Google Sheets |
| Subprocesadores | Convex Inc. (USA), PhantomBuster (Francia), Firecrawl, Gemini (Google LLC) |
| Transferencias internacionales | USA — Convex, Vercel, Clerk, Resend, Google (SCCs); Francia — PhantomBuster (Adequacy EU) |
| Base legal | Interes legitimo (Art. 13 Ley 21.719) — ver test-ponderacion.md |
| Plazo de retencion | 24 meses sin interaccion. Interaccion extiende con techo maximo de 36 meses desde recoleccion original. |
| Medidas de seguridad | Cifrado TLS en transito + AES-256 en reposo (Convex), control de acceso JWT (Clerk), logs de auditoria |
| Opt-out | Convex tabla optOutBlacklist — global, persiste tras hard-delete |

---

## Actividad 2: Gestion de Clientes Contratantes

| Campo | Detalle |
|-------|---------|
| Responsable | Sisteco SpA |
| Proposito | Prestar el servicio contratado, facturacion, soporte tecnico |
| Categorias de titulares | Representantes legales y usuarios designados de empresas cliente |
| Categorias de datos | Nombre, cargo, email, telefono, RUT empresa, datos de pago (gestionados via Reveniu) |
| Categorias de destinatarios | Internos Sisteco (soporte, facturacion) |
| Subprocesadores | Convex Inc. (USA), Clerk Inc. (USA), Reveniu |
| Base legal | Ejecucion del contrato (Art. 12 Ley 21.719) |
| Plazo de retencion | Duracion del contrato + 6 anos (obligacion tributaria SII) |
| Medidas de seguridad | Cifrado TLS + AES-256, autenticacion Clerk, control de acceso por rol |

---

## Actividad 3: Scoring IA de Prospectos

| Campo | Detalle |
|-------|---------|
| Responsable | Sisteco SpA |
| Proposito | Calificar automaticamente leads segun fit con ICP del cliente (HOT/WARM/NURTURE/SKIP) |
| Sistema IA | Gemini 2.0 Flash (Google LLC) |
| Datos usados | Nombre, cargo, empresa, industria, tamano empresa, datos SII publicos |
| Decision automatizada | SI — genera categoria HOT/WARM/NURTURE/SKIP + score 0-100 |
| Logica del scoring | Ponderacion de industria (25%), tamano empresa (20%), senales de compra (25%), cargo (15%), tech fit (15%) |
| Intervencion humana | SI — CEO revisa todos los HOT leads antes de contacto. Titular puede solicitar explicacion del scoring. |
| Base legal | Interes legitimo (prospección comercial B2B) |
| EIPD | SI — ver EIPD-scoring-ia.md |
| Plazo de retencion | Mismo que Actividad 1 (24/36 meses) |
| Medidas de seguridad | Solo datos profesionales publicos enviados a Gemini. PII guard via allowlist de campos. No datos sensibles. |

---

## Actividad 4: Comunicaciones Comerciales

| Campo | Detalle |
|-------|---------|
| Responsable | Sisteco SpA + Tenants (co-responsables segun uso) |
| Proposito | Contactar a prospectos calificados con propuesta de valor del cliente contratante |
| Canal | Email via Resend (automatizado) + LinkedIn (manual SDR) |
| Datos usados | Email profesional, nombre, cargo (los minimos para personalizar el contacto) |
| Base legal | Interes legitimo (B2B). Prospeccion comercial a decisores de empresas medianas. |
| Opt-out | SI — en cada email: link en footer + mecanismo List-Unsubscribe RFC 8058 |
| Registro opt-outs | Convex tabla optOutBlacklist (global — elimina de todos los tenants) |
| Plazo de retencion | Hasta opt-out o 24 meses sin interaccion (techo 36 meses) |

---

## Actividad 5: Entrega de Datos a Clientes via Google Sheets

| Campo | Detalle |
|-------|---------|
| Responsable | Sisteco SpA (Encargado de tratamiento) |
| Proposito | Proveer leads scored al cliente contratante en formato estructurado (Google Sheets) |
| Categorias de datos | Datos de leads scored: nombre, cargo, empresa, email profesional, score, scoreCategory, scoreReasoning, base_legal, fuente, fecha_expiracion, estado_compliance |
| Destinatarios | Cliente contratante (Tenant) — empresa que contrato el servicio Sisteco |
| Base legal | Contrato (Art. 12 Ley 21.719) — obligacion de entrega del servicio contratado |
| Retencion en Sheets | Vigencia del contrato. Al termino: Sisteco notifica al cliente para eliminar la sheet o archivarla. |
| Obligaciones del cliente | Per DPA firmado: (1) no re-compartir con terceros sin base legal, (2) respetar opt-outs notificados por Sisteco, (3) eliminar de CRM cuando Sisteco notifique expiracion |
| Columnas compliance en sheet | estado_compliance, base_legal, fuente_datos, fecha_expiracion (informativas, no editables) |
| Medidas | DPA obligatorio pre-onboarding. Badge "Cumple Ley 21.719" en cada sheet entregada. |

---

## Actividad 6: Gestion de Solicitudes ARCO-POL

| Campo | Detalle |
|-------|---------|
| Responsable | Sisteco SpA (punto unico de contacto) |
| Proposito | Atender solicitudes de derechos del titular: Acceso, Rectificacion, Cancelacion/Supresion, Oposicion, Portabilidad, Limitacion |
| Canal de entrada | Formulario web: sisteco.cl/privacidad/derechos |
| Categorias de datos del solicitante | Email, nombre, tipo de solicitud, detalles (minimo necesario para identificar y responder) |
| Tratamiento interno | Verificacion de identidad via email. Busqueda en todos los tenants afectados. Ejecucion de la accion. Notificacion al solicitante. |
| Base legal | Obligacion legal (Art. 16+ Ley 21.719) |
| Plazo de atencion | 15 dias habiles (ley permite 30; Sisteco se compromete a 15) |
| Registro | Convex tabla arcoRequests. SLA tracking via fechaLimite. |
| Retencion del registro | 5 anos (conservacion para prueba de cumplimiento) |
| Medidas de seguridad | Verificacion por email antes de ejecutar cualquier accion. Token de un solo uso con expiracion 24h. |

---

## Resumen de Bases Legales

| Actividad | Base Legal | Art. Ley 21.719 |
|-----------|-----------|-----------------|
| Pipeline prospeccion | Interes legitimo | Art. 13 |
| Gestion clientes | Contrato | Art. 12 |
| Scoring IA | Interes legitimo | Art. 13 |
| Comunicaciones comerciales | Interes legitimo | Art. 13 |
| Entrega a clientes via Sheets | Contrato | Art. 12 |
| Gestion ARCO-POL | Obligacion legal | Art. 14 |

## Control de Versiones

| Version | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | 2026-03-15 | Documento inicial — 6 actividades. Adaptado a modelo workflows-first. |

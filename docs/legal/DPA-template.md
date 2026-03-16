# ACUERDO DE TRATAMIENTO DE DATOS PERSONALES (DPA)

Conforme a Ley 21.719 sobre Proteccion de Datos Personales (Chile)

**Entre:**
- **SISTECO SpA** ("Encargado") — Las Condes, Santiago de Chile. contacto@sisteco.cl
- **[EMPRESA CLIENTE]** ("Responsable") — RUT: [XX.XXX.XXX-X], representada por [NOMBRE], [CARGO]

**Fecha:** [FECHA]

> **Sisteco declara cumplimiento con Ley 21.719** — Badge "Cumple Ley 21.719" otorgado a este acuerdo.
> Este DPA entra en vigor antes de la activacion del servicio.

---

## 1. OBJETO

Este DPA regula el tratamiento de datos personales que el Responsable encomienda al Encargado en el contexto de los servicios de automatizacion de ventas B2B de Sisteco (pipeline de leads, scoring IA, Google Sheets scored, alertas de pipeline).

El DPA es parte integrante del Contrato de Servicio Sisteco y prevalece sobre este en materia de proteccion de datos.

---

## 2. DATOS TRATADOS

| Categoria | Tipos de datos | Proposito | Plazo de retencion |
|-----------|---------------|-----------|-------------------|
| Prospectos B2B | Nombre, cargo, email profesional, LinkedIn URL, empresa, RUT empresa | Pipeline de ventas del Responsable | 24 meses sin interaccion o hasta opt-out (techo maximo absoluto: 36 meses desde recoleccion) |
| Datos empresa (SII) | RUT empresa, giro, tamano, inicio de actividades | Scoring y calificacion de fit con ICP | Mismo plazo que prospectos |
| Interacciones | Estado contacto, fechas de contacto, respuestas, notas | Seguimiento del pipeline del Responsable | Mismo plazo que prospectos |
| Compliance | base_legal, fuente_datos, fecha_expiracion, complianceStatus | Cumplimiento Ley 21.719 | 5 anos (conservacion para prueba de cumplimiento) |

> **Retencion maxima:** 24 meses para prospectos sin interaccion. Nota: 36 meses maximo absoluto desde captacion original, incluso con interacciones.

**Datos que NO se tratan bajo este DPA:**
- Datos sensibles (salud, origen etnico, religion, opiniones politicas, afiliacion sindical)
- Datos de personas menores de 18 anos
- Datos financieros personales (solo datos empresariales SII, publicos)
- Datos de personas que no actuan en calidad profesional

---

## 3. INSTRUCCIONES DE TRATAMIENTO

El Encargado (Sisteco) tratara los datos unicamente:
- Para la prestacion del servicio contratado por el Responsable
- Conforme a las instrucciones documentadas del Responsable (ICP configurado en plataforma)
- Nunca para propositos propios del Encargado ni para otros clientes

---

## 4. SUBPROCESADORES (Subencargados)

El Responsable autoriza el uso de los siguientes subprocesadores:

| Proveedor | Pais | Proposito | Garantia legal |
|-----------|------|-----------|----------------|
| Convex Inc. | USA | Base de datos en la nube | Standard Contractual Clauses (SCC) |
| Vercel Inc. | USA | Hosting y serverless | SCC |
| Clerk Inc. | USA | Autenticacion | SCC |
| Resend Inc. | USA | Envio de emails de verificacion y opt-out | SCC |
| PhantomBuster | Francia | Prospeccion LinkedIn | Adequacy Decision EU + SCC Chile |
| Google LLC (Gemini) | USA | Scoring IA (solo datos profesionales publicos) | SCC |
| Google LLC (Sheets) | USA | Entrega de leads scored al Responsable | SCC |

Sisteco notificara al Responsable ante cualquier cambio de subprocesador con al menos 15 dias de anticipacion.

---

## 5. MEDIDAS DE SEGURIDAD

El Encargado implementa:
- Cifrado en transito: HTTPS/TLS 1.3
- Cifrado en reposo: Convex AES-256
- Control de acceso por roles: Clerk JWT, acceso minimo necesario
- Logs de acceso y auditoria: auditTrail en cada lead
- Aislamiento multi-tenant: orgId en todas las consultas; un cliente nunca ve datos de otro
- Sin acceso a datos de produccion desde entornos de desarrollo

---

## 6. DERECHOS DE LOS TITULARES

### 6.1 Gestion Centralizada por Sisteco (ARCO-POL)

**Sisteco gestiona TODAS las solicitudes como punto unico de contacto.**
Canal exclusivo: `sisteco.cl/privacidad/derechos`

El Responsable NO debe gestionar solicitudes de derechos de titulares de forma independiente. Si el Responsable recibe una solicitud directa, debe redirigirla inmediatamente a Sisteco via email a contacto@sisteco.cl.

Sisteco ejecuta las acciones y notifica al Responsable sobre los leads afectados.

| Derecho | Plazo de atencion Sisteco | Accion |
|---------|--------------------------|--------|
| Acceso | 5 dias habiles | Exportar datos del titular |
| Rectificacion | 5 dias habiles | Corregir datos incorrectos |
| Supresion ("derecho al olvido") | 10 dias habiles | Anonimizar en Convex + propagar a Sheets |
| Portabilidad | 5 dias habiles | Exportar en formato JSON/CSV |
| Oposicion | 10 dias habiles | Opt-out global instantaneo |
| Limitacion | 5 dias habiles | Marcar lead para no contactar |

Plazo maximo global: 15 dias habiles desde verificacion de identidad del solicitante.

### 6.2 Opt-out Global

Al ejercer oposicion/supresion, el email del titular se agrega a la tabla `optOutBlacklist` de Convex (blacklist global). El lead es:
1. Anonimizado en Convex (datos PII reemplazados por "[ELIMINADO]")
2. Eliminado de la(s) Google Sheet(s) activa(s) del Responsable (automatico via API)
3. Reportado al Responsable para eliminacion de su CRM

El Responsable no podra volver a importar ese email al sistema.

---

## 7. NOTIFICACION DE INCIDENTES

El Encargado notificara al Responsable dentro de las **72 horas** de conocer cualquier violacion de seguridad que afecte datos personales, incluyendo:
- Tipo y descripcion del incidente
- Datos afectados (categorias y volumen estimado)
- Tenants potencialmente afectados
- Medidas correctivas tomadas
- Contacto del responsable de seguridad de Sisteco

El Responsable notificara a la APDP si la violacion le afecta como Responsable del tratamiento.

---

## 8. AUDITORIAS

El Responsable podra solicitar auditorias de cumplimiento con 30 dias de aviso. El Encargado facilitara acceso a registros de auditoria y documentacion relevante (este DPA, RAT, EIPD).

---

## 9. RETORNO Y DESTRUCCION DE DATOS

Al termino del contrato, el Encargado:
- Entregara todos los datos del Responsable en formato exportable (JSON/CSV) dentro de 15 dias
- Eliminara todas las copias de los datos del Responsable dentro de 30 dias del termino
- Certificara la eliminacion por escrito al Responsable

---

## 10. OBLIGACIONES DEL CLIENTE (RESPONSABLE)

El Responsable se compromete expresamente a:

1. **No re-compartir datos:** El Responsable se obliga a no re-compartir las Google Sheets ni los datos de leads recibidos de Sisteco con terceros (otras empresas, proveedores, socios) sin tener una base legal propia y documentada para ello.

2. **Respetar opt-outs:** Cuando Sisteco notifique que un lead ha ejercido opt-out, el Responsable debe eliminar ese contacto de su CRM, listas de email y cualquier otro sistema propio donde lo tenga registrado, dentro de los 5 dias habiles siguientes a la notificacion.

3. **Respetar expiraciones:** Cuando Sisteco notifique que la fecha de expiracion de retencion de un lead ha llegado (24 meses sin interaccion o techo 36 meses), el Responsable debe eliminar ese contacto de su CRM, dentro de los 5 dias habiles siguientes.

4. **No contactar fuera de Sisteco:** No usar los datos de leads de Sisteco para campanas de marketing o contacto comercial fuera de la plataforma Sisteco sin base legal propia documentada.

5. **Redirigir solicitudes ARCO:** Si el Responsable recibe directamente una solicitud de derechos de un lead, debe redirigirla a Sisteco (contacto@sisteco.cl) dentro de las 48 horas.

---

## 11. LEY APLICABLE Y JURISDICCION

Este DPA se rige por la Ley 21.719 de la Republica de Chile y supletoriamente por el Codigo Civil. Cualquier controversia se somete a arbitraje conforme a las reglas del Centro de Arbitraje y Mediacion de Santiago (CAM Santiago).

---

## 12. VIGENCIA

Este DPA entra en vigor en la fecha de firma y se mantiene vigente durante toda la relacion contractual entre las partes, incluyendo el periodo de destruccion de datos post-termino.

---

FIRMA ENCARGADO (Sisteco):          FIRMA RESPONSABLE (Cliente):
_______________________             _______________________
Nombre:                             Nombre:
RUT:                                RUT:
Cargo:                              Cargo:
Fecha:                              Fecha:

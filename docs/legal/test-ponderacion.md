# TEST DE PONDERACION DE INTERES LEGITIMO — Prospeccion B2B Sisteco

Conforme Art. 13 Ley 21.719 sobre Proteccion de Datos Personales (Chile)
Fecha de evaluacion: 2026-03-15
Actividad de tratamiento: Prospeccion de leads B2B para oferta de servicios SaaS
Responsable del tratamiento: Sisteco SpA, contacto@sisteco.cl

---

## PASO 1 — IDENTIFICACION DEL INTERES LEGITIMO

**Interes de Sisteco:**
Sisteco tiene un interes comercial legitimo en identificar y contactar a empresas medianas chilenas (50+ empleados) que podrian beneficiarse de sus servicios de automatizacion de ventas B2B. La plataforma existe para resolver un problema real y verificable en el mercado: los equipos de ventas B2B chilenos carecen de infraestructura eficiente de prospeccion.

**Es el interes real y presente?**
SI — Sisteco opera activamente, tiene costos reales de operacion, y el MRR es el objetivo central del negocio. Sin prospeccion, no hay clientes. Sin clientes, no hay empresa.

**Se aplica este interes a esta actividad especifica?**
SI — El tratamiento de datos de contacto de directivos es directamente necesario para identificar y alcanzar a los tomadores de decision en empresas medianas chilenas.

**Interes de terceros beneficiados:**
Los tenants (clientes Sisteco) tambien tienen interes legitimo en recibir leads calificados. Los propios prospectos podrian beneficiarse de conocer soluciones relevantes para su empresa.

---

## PASO 2 — NECESIDAD DEL TRATAMIENTO

**Es el tratamiento necesario para el fin declarado?**
SI — no es posible identificar, calificar y contactar a decisores B2B sin acceder a datos profesionales de caracter publico (nombre, cargo, empresa, email profesional).

**Existe una alternativa igualmente efectiva y menos intrusiva?**
NO — las alternativas revisadas tienen ROI significativamente menor:
- Publicidad generica (Google Ads, LinkedIn Ads): 10x menor tasa de conversion. Sin personalizacion basada en datos publicos disponibles.
- Inbound exclusivo: requiere presupuesto de contenidos y SEO que no es viable en etapa actual.
- Referidos exclusivos: no escalable sin base de clientes previa.
- Formularios de contacto inbound: la empresa es desconocida; nadie llena formularios de empresas que no conocen.

**El tratamiento se limita a los datos minimos necesarios?**
SI — solo se tratan datos de caracter profesional y publico: nombre completo, cargo, empresa, email empresarial, LinkedIn URL, datos empresariales SII (todos publicos). NO se tratan: datos de vida privada, datos sensibles, datos familiares, ubicacion personal.

---

## PASO 3 — PONDERACION (prevalece el interes del titular?)

**Naturaleza de los datos tratados:**
- Todos de caracter profesional (no personal)
- Todos de origen publico (LinkedIn, SII, sitio web empresarial)
- Los titulares actuan en calidad de representantes de empresa, no como personas naturales en vida privada

**Impacto sobre los titulares:**
- BAJO: un email comercial B2B relevante es un impacto minimo
- No hay decision con efectos juridicos sobre el titular
- No hay datos sensibles (salud, politica, religion, etc.)
- El peor caso: un email irrelevante que el titular ignora o bloquea

**Expectativa razonable del titular:**
Un directivo (CEO, VP, Gerente Comercial) de una empresa con 50+ empleados puede razonablemente esperar recibir propuestas comerciales B2B de servicios relevantes para su empresa. Esta es una practica comercial ordinaria y esperada en el mercado B2B chileno.

**Equilibrio de intereses:**
| Factor | A favor del tratamiento | En contra |
|--------|------------------------|-----------|
| Naturaleza datos | Profesionales y publicos | — |
| Expectativa titular | Alta (B2B ordinario) | — |
| Impacto titular | Minimo (email comercial) | Posible incomodidad puntual |
| Interes Sisteco | Alto (necesario para operacion) | — |
| Alternativas | No existen igualmente efectivas | — |

**Conclusion del paso 3:**
El interes legitimo de Sisteco prevalece. El impacto sobre los titulares es minimo y proporcional. Los titulares actuan en su capacidad profesional, con datos publicos, en un contexto de contacto comercial ordinario.

---

## PASO 4 — SALVAGUARDAS IMPLEMENTADAS

Las siguientes salvaguardas reducen el impacto sobre los derechos de los titulares:

1. **Opt-out en primer contacto:** Cada primer email de prospeccion incluye instruccion clara para opt-out en el mismo mensaje, antes de cualquier seguimiento.

2. **Opt-out en todos los emails subsecuentes:** Footer con link de baja en cada email de outreach. Mecanismo List-Unsubscribe RFC 8058 en headers de email (baja con un click desde cliente de correo).

3. **Formulario web ARCO-POL:** `sisteco.cl/privacidad/derechos` — formulario publico sin login para ejercer todos los derechos. Disponible 24/7.

4. **Opt-out global e instantaneo:** Al hacer opt-out, el email se agrega a blacklist global en Convex (`optOutBlacklist`). Se eliminan datos de TODOS los tenants. Ninguna empresa cliente puede volver a recibir ese lead. El lead no puede ser re-importado por ninguna futura campana.

5. **Retencion maxima:** 24 meses sin interaccion (se soft-delete y anonimiza automaticamente). Techo maximo absoluto de 36 meses desde captacion original, incluso con interacciones. Despues del techo se requiere re-evaluar base legal.

6. **Datos minimos:** Solo datos profesionales publicos. Nunca datos sensibles ni de vida privada.

7. **Supervision humana en scoring:** Aunque el scoring es automatizado, un humano (CEO o VP) revisa los HOT leads antes de cualquier contacto. No hay decision totalmente automatizada.

8. **Titular puede solicitar explicacion del scoring:** Via formulario ARCO-POL, cualquier titular puede pedir la razon por la que recibio determinada puntuacion.

---

## CONCLUSION

**Decision:** INTERES LEGITIMO VALIDO para esta actividad de tratamiento.

**Razonamiento:** Los datos son de caracter profesional y publico, el impacto es minimo (contacto comercial puntual), los titulares actuan en capacidad representativa de empresa, existe expectativa razonable de recibir propuestas B2B relevantes, y se implementan salvaguardas robustas incluyendo opt-out inmediato y global.

**Vigencia de este test:** Este documento debe revisarse si cambia: (a) el tipo de datos tratados, (b) los medios de recoleccion, (c) el mercado objetivo, o (d) la normativa aplicable.

**Proxima revision obligatoria:** 2027-03-15 (o antes si hay cambio material en los puntos anteriores).

Firmado: Responsable del Tratamiento, Sisteco SpA — 2026-03-15

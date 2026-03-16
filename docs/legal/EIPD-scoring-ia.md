# EVALUACION DE IMPACTO EN LA PROTECCION DE DATOS (EIPD)

Sistema de Scoring IA — Gemini 2.0 Flash
Conforme Art. 15+ Ley 21.719 sobre Proteccion de Datos Personales (Chile)

Fecha: 2026-03-15 | Responsable: Sisteco SpA (contacto@sisteco.cl)

---

## 1. Descripcion del Sistema

Sisteco utiliza el modelo de lenguaje **Gemini 2.0 Flash** (Google LLC, USA) para evaluar automaticamente el nivel de ajuste de prospectos B2B con el Perfil de Cliente Ideal (ICP) configurado por cada cliente.

**Output del sistema:**
- Score numerico: 0 a 100
- Categoria: HOT (80-100) / WARM (60-79) / NURTURE (40-59) / SKIP (0-39)
- Razonamiento en texto (scoreReasoning): explicacion de los factores que determinaron el score

**Datos de entrada al modelo:**
- Nombre y cargo del prospecto (datos profesionales)
- Empresa (nombre, industria, tamano estimado)
- Datos empresariales SII (giro, inicio de actividades — datos publicos)
- ICP del cliente: criterios de industria, tamano, cargos objetivo, senales de compra

**Datos que NO se envian al modelo:**
- Email del prospecto
- LinkedIn URL
- Telefono
- Datos sensibles de ninguna categoria

---

## 2. Necesidad de la EIPD

Esta EIPD es obligatoria porque el sistema de scoring cumple los criterios de alto riesgo del Art. 15 Ley 21.719:

- **Tratamiento automatizado** que produce efectos significativos: la categoria HOT/WARM/NURTURE/SKIP determina si un prospecto recibe o no contacto comercial
- **Perfilado sistematico** de personas en funcion de su cargo y empresa
- **Escala**: el sistema procesa decenas o cientos de prospectos por campana

---

## 3. Evaluacion de Riesgos

| Riesgo | Probabilidad | Impacto | Nivel | Mitigacion |
|--------|-------------|---------|-------|------------|
| Discriminacion por industria/tamano | Baja | Medio | **Bajo** | Pesos calibrados y documentados. No usa datos protegidos (genero, etnia, etc.) |
| Error de clasificacion (falso negativo) | Media | Bajo | **Bajo** | CEO/VP revisa todos los HOT leads manualmente antes de contacto |
| Fuga de datos a Google | Baja | Bajo | **Muy Bajo** | Solo datos profesionales publicos enviados. Sin email ni datos de contacto personal. Google Gemini API tiene DPA y SCCs. |
| Sesgo contra ciertos cargos/industrias | Baja | Bajo | **Muy Bajo** | Pesos de scoring explicitamente documentados y auditables por el cliente |
| Fallo del modelo (respuesta invalida) | Baja | Bajo | **Muy Bajo** | Validacion de output: si el score es invalido, se usa score 0 por defecto (SKIP) |
| Re-identificacion en Gemini | Muy Baja | Bajo | **Muy Bajo** | No se envian identificadores directos (email, telefono). Solo datos profesionales de caracter publico. |

**Nivel de riesgo residual global: BAJO**

---

## 4. Salvaguardas Implementadas

1. **Datos minimos al modelo:** Solo campos necesarios para scoring. Email, telefono, LinkedIn URL excluidos del payload enviado a Gemini. PII guard via allowlist de campos en el codigo.

2. **Supervision humana obligatoria:** Ninguna decision de contacto es totalmente automatica. CEO o VP revisa todos los HOT leads antes de iniciar outreach. El score es una recomendacion, no una decision final.

3. **Pesos documentados y auditables:** Los pesos del scoring (industria 25%, tamano 20%, senales de compra 25%, cargo 15%, tech fit 15%) estan documentados en el sistema y pueden ser explicados al titular.

4. **Opt-out elimina del proceso:** Si un titular hace opt-out, es eliminado de todos los procesos de scoring y contacto, para todos los tenants.

5. **Contrato con Google (SCCs):** Google LLC firma Standard Contractual Clauses para transferencias internacionales. Los datos enviados a Gemini API se procesan segun los terminos de datos de Google Cloud.

6. **Sin datos sensibles:** El sistema fue disenado explicitamente para nunca procesar datos sensibles (salud, religion, politica, etnia, opinion sindical, etc.).

7. **Version estable del modelo:** Se usa Gemini 2.0 Flash (version estable, no experimental). Esto reduce el riesgo de comportamientos inesperados del modelo.

---

## 5. Conclusion

**Riesgo residual: BAJO**

El sistema de scoring IA es proporcional al proposito declarado (calificacion de prospectos B2B), usa datos minimos necesarios, excluye datos sensibles, incluye supervision humana obligatoria en las decisiones de mayor impacto, y cuenta con las salvaguardas tecnicas y contractuales adecuadas.

La EIPD concluye que el tratamiento puede continuar bajo las condiciones documentadas.

---

## 6. Derechos del Titular

Todo titular que sea prospecto en el sistema de scoring de Sisteco tiene derecho a:

1. **Solicitar explicacion del scoring:** El titular puede pedir que Sisteco explique por que recibio determinada puntuacion, que factores se consideraron, y que criterios del ICP se aplicaron.

2. **Oponerse al scoring:** El titular puede oponerse a que sus datos sean procesados por el sistema de scoring. Al hacerlo, sus datos se marcan con complianceStatus `opt_out` y se excluyen de futuros procesos de scoring.

3. **Solicitar revision humana:** Si el titular considera que el score es incorrecto o injusto, puede solicitar revision por un humano de Sisteco.

**Canal:** Formulario web en `sisteco.cl/privacidad/derechos` (ARCO-POL).
Sisteco responde en maximo 15 dias habiles.

---

## 7. Control de Versiones y Revision

| Version | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | 2026-03-15 | Documento inicial. Sistema: Gemini 2.0 Flash. |

**Proxima revision obligatoria:** 2027-03-15 (anual) o antes si:
- Cambia el modelo de IA utilizado
- Cambian los datos de entrada al modelo
- Se detecta un incidente de seguridad relacionado
- Cambia la normativa aplicable (reglamento APDP)

Aprobado: Responsable del Tratamiento, Sisteco SpA — 2026-03-15

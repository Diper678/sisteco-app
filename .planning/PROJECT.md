# SAASTRE — Metodología de Arcilla Inteligente para Ventas B2B

## What This Is

**SAASTRE** (Sales-As-A-Service Tailored Runtime Environment) es la metodología propietaria
de Sisteco para crear aplicaciones de ventas B2B que se comportan como **arcilla inteligente**:
totalmente adaptables a la necesidad específica de cada cliente dentro del dominio de ventas.

No construimos UN producto para todos — construimos un sistema que se moldea a cada negocio.
Cada cliente obtiene su propia aplicación configurada a su proceso de ventas, su industria,
su equipo y sus métricas. La infraestructura es compartida, la experiencia es única.

## Core Value

"Menos leads, más cierres" — Calidad sobre cantidad.

SAASTRE genera, enriquece y califica leads B2B usando datos exclusivos del mercado chileno,
y lo hace dentro de una aplicación que se adapta exactamente al negocio del cliente,
como arcilla que toma la forma que necesitas.

## Evolución Estratégica

### v1.0 — SAAN (2026-03-05 → 2026-03-09) ❌ Archivado
"Red de 9 agentes autónomos de ventas"
→ Inviable: competir con OpenAI/Microsoft/Google en infra de agentes con $65/mes.

### v2.0 — Vertical SaaS (2026-03-09 → 2026-03-27) ❌ Superado
"Capa de inteligencia B2B chilena — dashboard fijo multi-tenant"
→ Limitante: un producto rígido no captura la diversidad de procesos de ventas B2B.

### v3.0 — SAASTRE (2026-03-27 → actual) ✅ Activo
"Arcilla inteligente — cada cliente tiene SU aplicación de ventas"
→ Por qué: cada empresa vende diferente. Un dashboard genérico no sirve.
  La metodología SAASTRE crea aplicaciones ajustadas a cada necesidad.

### Por qué el pivote a SAASTRE:
1. Los procesos de ventas B2B son profundamente diferentes entre industrias y empresas
2. Un dashboard fijo obliga al cliente a adaptarse al software (anti-patrón)
3. La verdadera ventaja competitiva es ADAPTAR la solución, no vender una solución genérica
4. "Arcilla inteligente" = infraestructura compartida + configuración única por cliente
5. Modelo más rentable: cada instancia se configura, no se reconstruye
6. El foso defensivo se multiplica: datos chilenos + adaptabilidad + compliance local

## Metodología SAASTRE — 5 Capas

```
┌─────────────────────────────────────────────┐
│  5. EXPERIENCIA — Dashboard adaptado al rol │
├─────────────────────────────────────────────┤
│  4. INTELIGENCIA — Scoring + IA contextual  │
├─────────────────────────────────────────────┤
│  3. WORKFLOWS — Automatizaciones a medida   │
├─────────────────────────────────────────────┤
│  2. DATOS — Pipeline de enriquecimiento     │
├─────────────────────────────────────────────┤
│  1. INFRAESTRUCTURA — Convex + Clerk + n8n  │
└─────────────────────────────────────────────┘
```

Ver `docs/SAASTRE-METODOLOGIA.md` para detalle completo de cada capa.

## Requirements

### Validated (reutilizable de v1.0 y v2.0)

- ✅ Convex schema base (leads, métricas, subscriptions) — reutilizable
- ✅ n8n self-hosted en Railway — operativo
- ✅ Workflows de lead gen (PhantomBuster, LinkedIn Scoring, B2B Prospecting)
- ✅ HTTP Actions Convex (endpoints para n8n)
- ✅ Clerk multi-tenant multi-rol — operativo
- ✅ ICP Engine con scoring algorítmico
- ✅ Templates de outreach multi-touch
- ✅ Scripts de enriquecimiento (emails, SII, LinkedIn)

### Active (H1 2026: Q1-Q2)

**Catálogo de Componentes SAASTRE (PRIORIDAD 1)**
- [ ] Definir componentes base del catálogo (workflows, vistas, integraciones)
- [ ] Sistema de configuración por cliente (ICP, industry, roles, métricas)
- [ ] Motor de instanciación: de config → aplicación funcionando
- [ ] Templates de dashboard por vertical (tech, retail, servicios, fintech)
- [ ] Workflows componibles activables/desactivables por cliente

**Pipeline de Datos Adaptable (PRIORIDAD 2)**
- [ ] PhantomBuster + LinkedIn Search configurable por ICP del cliente
- [ ] SII: validación de empresas (RUT, actividad económica, tamaño)
- [ ] Gemini scoring con pesos ajustables por industria
- [ ] Fuentes de datos adicionales por vertical
- [ ] Datos enriquecidos llegan a Convex filtrados por organización

**Experiencia Moldeable (PRIORIDAD 3)**
- [ ] Dashboard CEO: KPIs configurables según lo que importa al negocio
- [ ] Dashboard VP Ventas: pipeline y métricas de equipo
- [ ] Dashboard SDR: leads del día con contexto de la industria
- [ ] Vistas custom por industria
- [ ] Responsive para vendedores en terreno

**Compliance Ley 21.719 (PRIORIDAD 4)**
- [ ] RAT documentado
- [ ] Aviso de privacidad en dashboard
- [ ] Mecanismo de opt-out funcional
- [ ] Base legal por tipo de dato

**Primeros Clientes SAASTRE (PRIORIDAD 5)**
- [ ] Proceso de descubrimiento (semana 1)
- [ ] Moldeado de instancia (semana 2)
- [ ] Go-live con datos reales (semana 3)
- [ ] Refinamiento continuo con feedback
- [ ] 3-10 clientes pagando con instancias únicas

### Out of Scope (por ahora)

| Feature | Razón |
|---------|-------|
| Agentes custom | Usar Lindy/plataformas existentes |
| Self-service configuration | 2027+ cuando la metodología esté madura |
| Mobile app nativa | Dashboard web responsive es suficiente |
| Expansión LATAM | Solo Chile en 2026 |
| API pública | 2028+ cuando haya masa crítica de datos |

## Context

**Proyecto SAASTRE:** Metodología de Sisteco para aplicaciones de ventas B2B adaptables.
- Landing page: sisteco.cl (Vercel + Convex)
- n8n: `primary-yelp-production.up.railway.app`
- Instancias: Convex multi-tenant + vanilla JS + Clerk
- Metodología: docs/SAASTRE-METODOLOGIA.md

**Herramientas disponibles:**
- Playwright CLI: testing E2E, auditorías
- Firecrawl: scraping y enriquecimiento
- n8n-mcp: gestión de workflows
- Lindy AI: agentes de ventas (evaluar integración)

**Visión a largo plazo:**
- 2026 H1: Metodología SAASTRE + primeros clientes Chile
- 2026 H2: Catálogo 20+ workflows + refinamiento con datos reales
- 2027: Self-service + expansión LATAM
- 2028+: API SAASTRE para terceros

## Constraints

- **Stack**: Convex + n8n + Vercel — no cambiar
- **AI**: Gemini (scoring), Claude (desarrollo), Lindy (agentes de ventas)
- **Legal**: Ley 21.719 compliance nativo
- **Presupuesto**: ~$65/mes infra + ~$178/mes lead gen tools
- **Sin Python**: Todo Node.js / JavaScript
- **Foco**: Revenue first — cada feature debe acercar a un cliente pagando
- **SAASTRE**: Cada cliente es una instancia configurada, no código custom

## Key Decisions

| Decision | Rationale | Fecha |
|----------|-----------|-------|
| Pivote SAAN → Vertical SaaS | No competir en agentes con big tech | 2026-03-09 |
| Pivote Vertical SaaS → SAASTRE | Dashboard fijo no captura diversidad de ventas B2B | 2026-03-27 |
| Arcilla inteligente como concepto | Adaptabilidad es el verdadero diferenciador | 2026-03-27 |
| Configuración sobre código custom | Escala sin reescribir por cada cliente | 2026-03-27 |
| 5 capas SAASTRE | Separación clara entre lo fijo y lo adaptable | 2026-03-27 |
| Datos B2B Chile como foso | Nadie tiene datos locales + compliance | En desarrollo |
| PhantomBuster como fuente principal | LinkedIn = mejor fuente B2B, ya configurado | Listo |
| Multi-tenant via Clerk Organizations | Aislamiento por org sin custom auth | 2026-03-09 |
| Compliance Ley 21.719 como diferenciador | Competidores internacionales no cumplen | En desarrollo |

---
*Last updated: 2026-03-27 — Pivote estratégico a SAASTRE (Arcilla Inteligente)*

# Pivote Sisteco: Vertical SaaS B2B Chile

**Fecha:** 2026-03-09
**Estado:** Aprobado
**Autor:** Equipo Sisteco (brainstorming colaborativo)

---

## Vision

Sisteco deja de ser una red de agentes autonomos (SAAN) y se convierte en una
plataforma vertical de inteligencia de leads B2B para Chile. El producto:
leads calificados aparecen en tu dashboard, enriquecidos con datos que ningun
competidor internacional tiene.

## Arquitectura del Producto

```
Fuentes de Datos          Pipeline (n8n)              Producto
-----------------     ---------------------     -----------------
PhantomBuster ----+   Extraccion LinkedIn  --+   Convex DB
Sales Navigator --+   Enriquecimiento SII  --+   (leads, scores,
Datos SII --------+   Scoring Gemini Flash --+    empresas)
                      Dedup + Compliance   --+       |
                                                     v
                                                Dashboard SaaS
                                                (multi-tenant,
                                                 multi-rol, RBAC)
```

## Roadmap en 3 Horizontes

### H1 — MVP Revenue (Ahora -> Q2 2026)

**Pipeline de datos (tecnico):**
- PhantomBuster + Sales Nav + SII -> leads reales en Convex
- Scoring Gemini 2.5 Flash Lite (HOT/WARM/NURTURE/SKIP)
- Compliance basico Ley 21.719 (RAT, opt-out, base legal)

**Dashboard (diseno colaborativo):**
1. Usuario investiga dashboards SaaS B2B actuales (Apollo, HubSpot, Attio, Folk, Clay)
2. Selecciona referencias visuales / moodboard
3. Wireframes colaborativos basados en referencias
4. Aprobacion visual del diseno
5. Build con datos reales de Convex

**Flujo paralelo:**
- Pipeline de datos avanza mientras se define el diseno
- Cuando convergen, el dashboard se construye con datos reales + diseno aprobado

**Roles del dashboard:**
- CEO: KPIs, ROI, metricas de alto nivel
- VP Ventas: pipeline, conversion, rendimiento del equipo
- SDR: leads asignados, scores, proximas acciones

**Meta:** 3-10 clientes fundadores pagando

### H2 — Diferenciacion Local (Q3-Q4 2026)

- Integraciones financieras: Fintoc, Open Finance, BCI APIs
- Enrichment avanzado: ChileCompra, CMF, Equifax/DICOM
- Compliance completo: MPI certification, portal ARCO-POL
- Meta: 30-60 clientes, foso tecnico construido

### H3 — Agentes + Escala (2027+)

- Lindy AI o similar para SDR automatizado
- Agent-as-a-service sobre la capa de datos
- Expansion Argentina
- Meta: 100+ clientes, preparar LATAM

## Reutilizacion del Trabajo SAAN

| Fase SAAN | Reutiliza | Como |
|-----------|-----------|------|
| Leads schema + CRUD (04-01) | 100% | Core del vertical |
| Multi-source discovery (04-02) | 100% | PhantomBuster + enrichment |
| AI Scoring + workflows (04-03) | 100% | Gemini scoring pipeline |
| Skill metacognition (04-04) | 0% | Concepto SAAN, no aplica |
| HTTP Layer (02) | Parcial | Endpoints Convex sirven |
| Monitor Agent (03) | Parcial | Health monitoring como infra |
| Finance Agent (05) | Pospuesto | Mover a H2 como modulo financiero |
| Agent Learning (06) | Eliminado | Concepto SAAN |

## Fuentes de Datos MVP

1. **PhantomBuster** — Extraccion automatizada de LinkedIn (3x/semana)
2. **LinkedIn Sales Navigator** — Busquedas segmentadas B2B Chile
3. **Datos SII** — Validacion RUT, rubro, tamano empresa (publico, gratuito)

## Principios de Diseno del Dashboard

- Desde cero (no sobre skeleton SAAN)
- Multi-tenant: cada empresa ve solo sus datos (Clerk org + Convex)
- Multi-rol: vistas por CEO, VP Ventas, SDR
- Mobile-first: vendedores lo usan en terreno
- Datos reales: conectado a Convex, no mockups
- Diseno definido por el usuario con referencias de mercado actual

## Que NO Se Construye (YAGNI)

- Agentes custom
- Agent-to-agent commerce
- Dashboard CEO tipo SAAN
- Integraciones financieras (hasta H2)
- Mobile app nativa (web responsive basta)
- Multi-idioma

## Stack Tecnico (sin cambios)

```
Frontend:     HTML/CSS/JS (vanilla) + GSAP + Lucide
Backend:      Vercel Serverless + Convex
DB:           Convex (reactiva)
Auth:         Clerk (Email + Google OAuth) — con organizations para multi-tenant
Workflows:    n8n self-hosted
AI Scoring:   Gemini 2.5 Flash Lite
Deploy:       npx vercel --prod
```

## Decisiones Clave

| Decision | Razon |
|----------|-------|
| Pivote de SAAN a Vertical SaaS | No competir en agentes con big tech |
| Reutilizar 100% de Leads Agent | Trabajo directamente aplicable al vertical |
| Dashboard desde cero | SAAN skeleton no refleja producto SaaS |
| Diseno colaborativo (usuario lidera) | El mercado define el UX, no la ingenieria |
| Agentes pospuestos a H3 | Revenue first, agentes despues de traccion |
| Fintechs/bancos en H2 | Primero clientes fundadores, despues foso tecnico |
| Ley 21.719 compliance basico en H1 | Diferenciador en ventas desde dia 1 |

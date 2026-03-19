# CLAUDE.md — Instrucciones para Claude Code en proyectos Sisteco

> Copia este archivo a la raiz de cualquier nuevo proyecto de Sisteco como `CLAUDE.md`.
> Claude Code lo lee automaticamente al inicio de cada sesion.

---

## Contexto de la empresa

**Sisteco** es una plataforma B2B SaaS de automatizacion de ventas para empresas medianas chilenas.
- **Mision:** Infraestructura inteligente para ventas B2B
- **Tagline:** "Menos leads, mas cierres"
- **Mercado:** Chile (50+ empleados) → LATAM (2027+)
- **Contacto:** contacto@sisteco.cl · +56 9 40065566 · Las Condes, Santiago de Chile

## Stack tecnologico estandar

```
Frontend:     HTML/CSS/JS (vanilla) + GSAP 3.12.7 + Lucide 0.468.0
Backend:      Vercel Serverless Functions
DB:           Convex (reactiva en la nube) — NO Supabase
Auth:         Clerk (Email + Google OAuth)
Email:        Resend
Pagos:        dLocal Go (API) / Reveniu (quick-start)
Workflows:    n8n self-hosted
AI/Scoring:   Google Gemini (workflows) · Claude Sonnet (desarrollo)
Deploy:       npx vercel --prod (sin git remote)
Dev local:    npm start → http://localhost:3000
```

## Sistema de planificacion: GSD

Usamos el sistema GSD (Get Shit Done) de Claude Code para todos los proyectos.
- **Iniciar proyecto:** `/gsd:new-project`
- **Ver estado:** `/gsd:progress`
- **Planificar fase:** `/gsd:plan-phase`
- **Ejecutar:** `/gsd:execute-phase`
- **Reanudar sesion:** `/gsd:resume-work`

## Identidad visual (nunca cambiar sin razon)

```
Fondo:       #F8F7F5 (warm white)
Texto:       #111111
Acento:      #c5ed36 (lime)
Hover:       #b3d82f
Borde:       #e5e5e5
Font heading: Sharp Grotesk
Font body:    Source Sans 3
Font logo:    Nasalization (SOLO para el wordmark "Sisteco")
Iconos:       Lucide 0.468.0
```

## Reglas de contenido

- NUNCA inventar testimonios, metricas o estadisticas
- NUNCA mencionar Claude/Gemini/Kimi en el frontend publico
- SIEMPRE usar "Ley 21.719" (no solo "GDPR") en contexto Chile
- SIEMPRE usar contacto Chile: contacto@sisteco.cl, +56 9 40065566, Santiago
- Metricas verificadas que SI se pueden usar:
  - 5-7x mas conversiones vs stack DIY
  - 21x mas conversiones respondiendo < 5 minutos
  - 78% de clientes compran del primer vendedor en responder
  - 391% ROI en automatizacion (Forrester/PolyAI)
  - 89% retencion omnicanal vs 33% monocanal

## Documentos de referencia en este proyecto

Ver carpeta `sisteco-knowledge/` para:
- `empresa/IDENTIDAD_MARCA.md` — Identidad, voz, tono, estadisticas
- `empresa/BRAND_GUIDELINES.md` — Sistema de diseno completo
- `empresa/VISION_AGENTES_AUTONOMOS.md` — Vision de largo plazo
- `financiero/ESTRATEGIA_FINANCIERA.md` — Precios, planes, margenes
- `tech-stack/STACK_COMPLETO.md` — Todo el stack tecnologico
- `tech-stack/ENV_SETUP.md` — Setup de variables de entorno
- `integraciones/WORKFLOWS_N8N.md` — Workflows construidos
- `skills/GSD_SKILLS.md` — Comandos GSD disponibles
- `skills/UI_UX_PRO_MAX.md` — Skill de diseno UI/UX (referencia general)
- `.claude/skills/app-design.md` — **Design System unificado de la app** (Brand + UI + Workspace + IA)
- `mcps/MCP_OVERVIEW.md` — MCPs disponibles (Firecrawl, Perplexity, n8n, Obsidian)
- `mcps/PLAYWRIGHT_CLI.md` — Playwright CLI (reemplazo de MCP, 4x menos tokens)
- `roadmap/ESTADO_ACTUAL.md` — Estado del proyecto (actualizar periodicamente)
- `roadmap/PROXIMOS_PASOS.md` — Que hacer primero

## Preferencias de trabajo

- Respuestas en espanol (es-CL)
- Uso de GSD para todas las tareas significativas
- Deploy via `npx vercel --prod` (no hay git remote en los proyectos de landing)
- Sin Python en este entorno — usar Node.js para scripts
- Herramienta de diseno visual: Gemini 3 en Antigravity IDE (cuando necesite diseno grafico)
- Claude Code: logica, APIs, CSS, HTML, arquitectura de sistemas

---

## Protocolo de Auto-Documentacion y Mejora Continua

> **OBLIGATORIO.** Ejecutar automaticamente al final de cada tarea significativa.
> El usuario NO debe pedirlo — es responsabilidad de Claude hacerlo siempre.

### Trigger: Cuando se activa

Se activa automaticamente cuando la sesion incluye cualquiera de:
- Crear o modificar un workflow (n8n, script, automatizacion)
- Implementar una integracion nueva (API, MCP, servicio externo)
- Configurar infraestructura (deploy, auth, DB, keys)
- Disenar o construir UI/UX (mockups, dashboard, landing)
- Resolver un bug o problema tecnico significativo
- Tomar una decision arquitectonica o estrategica
- Crear o modificar un skill de Claude Code
- Cualquier proceso que otro humano necesitaria documentar para replicar

### Paso 1: Clasificar el trabajo

```
EVALUAR al final de la tarea:
1. Es un proceso NUEVO? → Crear documentacion
2. Es una MEJORA a proceso existente? → Actualizar documentacion existente
3. Es trabajo rutinario sin proceso replicable? → No documentar (skip)
```

### Paso 2: Documentar en Memory Vault (Claude Code)

Segun `vault/skill-vault-manager.md` seccion 6, elegir archivo destino:
- Proceso/workflow → `vault/process-registry.md`
- Decision → `vault/decisions.md`
- Leccion aprendida → `vault/metacognition.md`
- Infraestructura → `vault/infrastructure.md`
- Skill nuevo/modificado → `vault/skills-catalog.md`

Formato estandar para procesos:
```
### [Nombre del Proceso]
- **Tipo:** workflow | integracion | deployment | design | data-pipeline | compliance | skill
- **Estado:** activo | draft | deprecado
- **Fecha:** YYYY-MM-DD
- **Que hace:** [1 linea]
- **Donde vive:** [path al codigo/config/workflow]
- **Dependencias:** [servicios, APIs, keys necesarias]
- **Nota Obsidian:** [path en vault Obsidian]
```

### Paso 3: Sincronizar a Obsidian

Usar el MCP de Obsidian para mantener la base de conocimiento sincronizada:

```
PARA procesos/workflows:
  → Buscar en Obsidian si existe nota del proceso (obsidian_search)
  → Si existe → obsidian_write_note mode:"append" con changelog
  → Si no existe → obsidian_create_note en la carpeta correcta:
    - procesos/     → Procesos y SOPs
    - integraciones/ → APIs e integraciones
    - Tech/         → Arquitectura tecnica
    - agentes/      → Workflows de agentes/AI
    - Logs/         → Diagnosticos y debugging
    - Sisteco/      → Decisiones estrategicas de empresa

PARA decisiones estrategicas:
  → Append a "estrategia/Resumen Estrategia 2026.md"

Tags Obsidian obligatorios:
  - #sisteco + #tipo (workflow, integracion, proceso, decision)
  - #fecha-YYYY-MM
  - #estado (activo, draft, deprecado)
```

### Paso 4: Auto-evaluacion

Al documentar, reflexionar brevemente:
```
- Este proceso podria hacerse mejor? → Anotar mejora en metacognition.md
- Hay un patron que se repite? → Abstraer como skill o template
- Algo que aprendi que no sabia? → Agregar a metacognition.md "Lecciones"
- Algo que supuse y resulto diferente? → Actualizar supuestos
```

### Reglas criticas

```
NO-1: NUNCA preguntar al usuario "quieres que documente esto?" — SOLO HACERLO
NO-2: NUNCA crear notas duplicadas — siempre buscar primero
NO-3: NUNCA documentar sin haber completado el trabajo (documenta resultados, no intenciones)
NO-4: NUNCA dejar Obsidian desincronizado del vault de memoria
SI-1: SI el proceso es nuevo y significativo, mencionarlo brevemente al usuario al final
SI-2: SI se mejoro un proceso existente, indicar que se actualizo la documentacion
SI-3: SI se detecta inconsistencia entre memoria y Obsidian, corregir silenciosamente
```

# Spec: Sistema de Agentes Sisteco v1.0
**Fecha:** 2026-03-19
**Autor:** Felipe + Claude
**Estado:** Aprobado — listo para implementación

---

## Problema

Tenemos 21 agentes especializados instalados globalmente pero ninguno integrado al flujo real de trabajo. No hay automatización, no hay slash commands, no hay pipeline de calidad. Los agentes existen pero no producen valor.

## Objetivo

Construir una capa de orquestación inteligente que:
1. Detecta contexto al iniciar sesión (token-eficiente)
2. Invoca agentes automáticamente según el tipo de trabajo
3. Expone slash commands explícitos por dominio
4. Corre un pipeline de calidad antes de cada deploy/commit
5. Captura y propaga la voz de Felipe como capa global

---

## Arquitectura General

```
~/.claude/  (GLOBAL — aplica a TODOS los proyectos)
├── CLAUDE.md          ← voz de Felipe, brand-voice rules globales
└── hooks/
    └── agent-dispatcher.js  ← SessionStart script (ligero, ~80 tokens output)

Landing Page/
├── CLAUDE.md          ← reglas de auto-invocación SEO + brand (proyecto)
└── .claude/
    └── skills/
        ├── seo-audit.md       ← /seo-audit (cluster SEO completo)
        ├── brand-check.md     ← /brand-check (voz Felipe en web)
        └── deploy-qa.md       ← /deploy-qa (pipeline pre-deploy)

The Agentic Company/
├── CLAUDE.md          ← reglas de auto-invocación ML + brand (proyecto, actualizar)
└── .claude/
    └── skills/
        ├── ml-review.md       ← /ml-review (AI/ML architecture review)
        ├── mlops-check.md     ← /mlops-check (workflows + infra)
        ├── brand-check.md     ← /brand-check (outreach + propuestas)
        └── deploy-qa.md       ← /deploy-qa (pipeline pre-commit)
```

### Separación de responsabilidades: global vs proyecto

| Capa | Archivo | Contenido |
|------|---------|-----------|
| Global | `~/.claude/CLAUDE.md` | Voz de Felipe, tono personal, vocabulario, reglas brand-voice universales |
| Proyecto | `Landing Page/CLAUDE.md` | Triggers de auto-invocación SEO; reglas específicas de copy web |
| Proyecto | `The Agentic Company/CLAUDE.md` | Triggers de auto-invocación ML/MLOps; reglas de outreach/propuestas |

La capa global NO contiene triggers de auto-invocación. Los triggers viven en el CLAUDE.md de cada proyecto para evitar que se disparen en proyectos donde no corresponden.

---

## Componente 1: SessionStart Dispatcher

**Archivo:** `C:/Users/Dell 5520/.claude/hooks/agent-dispatcher.js`
**Trigger:** Hook `SessionStart` en `~/.claude/settings.json` — se **agrega** como entrada adicional al array existente (no reemplaza el hook `gsd-check-update.js`)
**Costo:** ~80 tokens de output máximo
**Control:** Variable de entorno `AGENT_DISPATCHER_ENABLED` (default: `true`). Setear `false` para deshabilitar sin tocar el hook.

### settings.json — estructura del hook (appendear, no reemplazar)

```json
"SessionStart": [
  {
    "hooks": [
      { "type": "command", "command": "node \"C:/Users/Dell 5520/.claude/hooks/gsd-check-update.js\"" }
    ]
  },
  {
    "hooks": [
      { "type": "command", "command": "node \"C:/Users/Dell 5520/.claude/hooks/agent-dispatcher.js\"" }
    ]
  }
]
```

### Lógica del script

```javascript
// Detección de proyecto — usa process.cwd() (NO process.env.CLAUDE_CWD que no existe)
const cwd = process.cwd();

// Control de feature flag
if (process.env.AGENT_DISPATCHER_ENABLED === 'false') process.exit(0);

// Detectar proyecto
let proyecto = 'unknown';
if (cwd.includes('Landing Page')) proyecto = 'landing-page';
else if (cwd.includes('The Agentic Company')) proyecto = 'agentic-company';

// Leer git log --oneline -3 para inferir tipo de trabajo
// Inferir trabajo:
//   commits con .html/.css → trabajo = "contenido-web"
//   commits con .js/workflow/script/n8n → trabajo = "codigo-app"
//   commits con email/outreach/leads → trabajo = "outreach"
//   sin commits o repo nuevo → trabajo = "general"

// Output a stdout (~80 tokens):
// [CONTEXT] proyecto=<X> | trabajo=<Y> | branch=<Z>
// → Agentes prioritarios: <lista compacta>
// → Pipeline deploy: <lista compacta>
```

### Output de ejemplo (Landing Page, trabajo en HTML)

```
[CONTEXT] proyecto=landing-page | trabajo=contenido-web | branch=main
→ Agentes prioritarios: seo-keyword-strategist, brand-voice:quality-assurance, seo-meta-optimizer
→ Pipeline deploy: /seo-audit + /brand-check + /deploy-qa
```

### Output de ejemplo (Agentic Company, trabajo en scripts)

```
[CONTEXT] proyecto=agentic-company | trabajo=codigo-app | branch=master
→ Agentes prioritarios: mlops-engineer, superpowers:code-reviewer, nlp-engineer
→ Pipeline deploy: /ml-review + /brand-check + /deploy-qa
```

---

## Componente 2: Voz de Felipe (Global)

**Archivo:** `C:/Users/Dell 5520/.claude/CLAUDE.md` (nuevo, global)

Contiene ÚNICAMENTE reglas de voz y tono — NO triggers de auto-invocación:
- Tono de Felipe: directo, chileno, técnico pero accesible, sin florituras
- Vocabulario característico (palabras que Felipe usa / evita)
- Estilo de emails y outreach
- Reglas de brand-voice Sisteco aplicadas a comunicación personal

Claude lee este archivo en cada sesión de cualquier proyecto, haciendo que toda comunicación generada suene auténticamente a Felipe.

---

## Componente 3: Mapeo Agente → Invocación

Los agentes se invocan vía la herramienta `Agent` de Claude Code o vía `Skill` según tipo:

| Nombre en spec | Tipo | Invocación real |
|---------------|------|-----------------|
| `seo-keyword-strategist` | Agent subagent_type | `subagent_type: "seo-technical-optimization:seo-keyword-strategist"` |
| `seo-meta-optimizer` | Agent subagent_type | `subagent_type: "seo-technical-optimization:seo-meta-optimizer"` |
| `seo-structure-architect` | Agent subagent_type | `subagent_type: "seo-technical-optimization:seo-structure-architect"` |
| `seo-snippet-hunter` | Agent subagent_type | `subagent_type: "seo-technical-optimization:seo-snippet-hunter"` |
| `seo-authority-builder` | Agent subagent_type | `subagent_type: "seo-analysis-monitoring:seo-authority-builder"` |
| `seo-cannibalization-detector` | Agent subagent_type | `subagent_type: "seo-analysis-monitoring:seo-cannibalization-detector"` |
| `seo-content-auditor` | Agent subagent_type | `subagent_type: "seo-content-creation:seo-content-auditor"` |
| `brand-voice:quality-assurance` | Agent subagent_type | `subagent_type: "brand-voice:quality-assurance"` |
| `brand-voice:content-generation` | Agent subagent_type | `subagent_type: "brand-voice:content-generation"` |
| `brand-voice:conversation-analysis` | Agent subagent_type | `subagent_type: "brand-voice:conversation-analysis"` |
| `brand-voice:document-analysis` | Agent subagent_type | `subagent_type: "brand-voice:document-analysis"` |
| `ai-engineer` | Agent subagent_type | `subagent_type: "ai-ml-toolkit:ai-engineer"` |
| `ml-engineer` | Agent subagent_type | `subagent_type: "ai-ml-toolkit:ml-engineer"` |
| `mlops-engineer` | Agent subagent_type | `subagent_type: "ai-ml-toolkit:mlops-engineer"` |
| `nlp-engineer` | Agent subagent_type | `subagent_type: "ai-ml-toolkit:nlp-engineer"` |
| `computer-vision-engineer` | Agent subagent_type | `subagent_type: "ai-ml-toolkit:computer-vision-engineer"` |
| `superpowers:code-reviewer` | Skill | `Skill tool: "superpowers:code-reviewer"` |
| `security` | Skill | `Skill tool: "security"` |

---

## Componente 4: Slash Commands por Proyecto

### Landing Page

#### `/seo-audit`
Despacha en paralelo (todos como subagentes simultáneos):
- `seo-keyword-strategist` → densidad y variaciones semánticas
- `seo-meta-optimizer` → títulos, descriptions, URLs
- `seo-structure-architect` → jerarquía H1-H6, schema markup
- `seo-snippet-hunter` → featured snippets eligibility
- `seo-authority-builder` → E-E-A-T signals
- `seo-cannibalization-detector` → overlap entre páginas
- `seo-content-auditor` → calidad y completitud del contenido

Output: reporte consolidado con prioridad **Alta / Media / Baja** por issue.

#### `/brand-check`
Despacha en paralelo:
- `brand-voice:quality-assurance` → voz de Felipe consistente
- `brand-voice:content-generation` → sugerencias de mejora en tono

#### `/deploy-qa` (Landing Page)
Pipeline **secuencial**. Mecanismo de bloqueo: si un paso crítico falla, el skill imprime un bloque `STOP` y NO procede al siguiente paso ni ejecuta `npx vercel --prod`. El deploy solo se autoriza si todos los pasos críticos pasan.

```
Paso 1 [CRÍTICO]: seo-meta-optimizer
  → Si retorna issues de nivel "Alto": imprimir STOP, abortar pipeline
  → Si retorna solo issues "Medio/Bajo": continuar con advertencia
Paso 2: brand-voice:quality-assurance
  → Si retorna FAIL en voz Felipe: imprimir STOP, abortar pipeline
Paso 3: seo-authority-builder
  → Solo reporte, no bloquea
Paso 4: superpowers:code-reviewer
  → Si retorna errores críticos (JS roto, links muertos): imprimir STOP
→ Si todos OK: imprimir "DEPLOY AUTORIZADO ✓" y proceder
```

**Umbral issue crítico SEO:** cualquier meta title ausente, description ausente, o H1 duplicado.
**Umbral brand-voice:** `quality-assurance` retorna explícitamente `FAIL` (no solo advertencias).

### The Agentic Company

#### `/ml-review`
Despacha en paralelo:
- `ai-engineer` → arquitectura y decisiones de sistema AI
- `ml-engineer` → pipelines de training/serving
- `computer-vision-engineer` → condición de activación: archivos modificados contienen `.png`, `.jpg`, `image`, `vision`, `canvas`, `PIL`, `cv2`, o `sharp`. Si ninguna condición se cumple, este agente se omite.

#### `/mlops-check`
Despacha en paralelo:
- `mlops-engineer` → CI/CD ML, model versioning, monitoring
- `nlp-engineer` → condición de activación: archivos modificados contienen `email`, `outreach`, `text`, `nlp`, `prompt`, `leads`, o `scoring`. Si ninguna condición se cumple, se omite.

#### `/brand-check` (App)
Despacha en paralelo:
- `brand-voice:conversation-analysis` → revisa outreach emails generados
- `brand-voice:document-analysis` → revisa propuestas y documentos
- `brand-voice:quality-assurance` → voz de Felipe consistente

#### `/deploy-qa` (App)
Pipeline **secuencial** con mismo mecanismo de bloqueo que Landing Page:

```
Paso 1 [CRÍTICO]: superpowers:code-reviewer
  → Si retorna errores de sintaxis o tests fallidos: STOP
Paso 2 [CONDICIONAL]: mlops-engineer
  → Solo si git diff contiene archivos en n8n-workflows/, scripts/, o *.js con "workflow"
  → Si retorna riesgos de producción: STOP
Paso 3 [CONDICIONAL]: brand-voice:quality-assurance
  → Solo si git diff contiene archivos en email-previews/, outreach, o leads
  → Solo reporte, no bloquea
Paso 4 [CONDICIONAL]: security skill
  → Solo si git diff contiene .env, auth, API keys, o /api/
  → Si retorna vulnerabilidad crítica: STOP
→ Si todos OK: imprimir "COMMIT AUTORIZADO ✓"
```

---

## Componente 5: Invocación Automática

Claude invoca agentes sin que el usuario lo pida cuando detecta estas situaciones:

| Situación detectada | Agentes invocados automáticamente |
|--------------------|----------------------------------|
| Escribir copy para Landing Page | `brand-voice:content-generation` + `seo-keyword-strategist` |
| Editar HTML de página web (al terminar edición) | `seo-meta-optimizer` |
| Generar email de outreach | `brand-voice:conversation-analysis` + `nlp-engineer` |
| Modificar workflow n8n o script | `mlops-engineer` |
| Diseñar arquitectura AI/ML | `ai-engineer` |
| Crear propuesta comercial | `brand-voice:document-analysis` |
| Revisar leads o scoring | `ml-engineer` |

Las instrucciones de auto-invocación viven en el `CLAUDE.md` de **cada proyecto** (no en el global).

---

## Componente 6: AutoResearch Hook Point

Diseñado desde el principio. Activar con `AUTORESEARCH_ENABLED=true` cuando llegue el primer cliente pagante. Sin cambios de código.

```javascript
// En agent-dispatcher.js
const AUTORESEARCH_ACTIVE = process.env.AUTORESEARCH_ENABLED === 'true';

if (AUTORESEARCH_ACTIVE) {
  // Leer transcripciones de calls: autoresearch/transcripts/*.json
  // Leer performance de cold emails: autoresearch/outreach/performance.json
  // Output: 2-3 líneas adicionales al contexto de sesión con insights de voz real
}
```

Rutas de datos AutoResearch:
- Transcripciones: `C:/Users/Dell 5520/Documents/AgenticWorkflows/sisteco-autoresearch/transcripts/*.json`
- Performance outreach: `C:/Users/Dell 5520/Documents/AgenticWorkflows/sisteco-autoresearch/outreach/performance.json`

---

## Distribución de Archivos

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `~/.claude/CLAUDE.md` | NUEVO | Voz de Felipe global |
| `~/.claude/hooks/agent-dispatcher.js` | NUEVO | SessionStart script token-eficiente |
| `~/.claude/settings.json` | ACTUALIZAR | Appendear SessionStart dispatcher (no reemplazar gsd-check-update.js) |
| `Landing Page/CLAUDE.md` | NUEVO | CLAUDE.md raíz + triggers auto-invocación SEO |
| `Landing Page/.claude/skills/seo-audit.md` | NUEVO | Skill `/seo-audit` |
| `Landing Page/.claude/skills/brand-check.md` | NUEVO | Skill `/brand-check` |
| `Landing Page/.claude/skills/deploy-qa.md` | NUEVO | Skill `/deploy-qa` |
| `The Agentic Company/.claude/skills/ml-review.md` | NUEVO | Skill `/ml-review` |
| `The Agentic Company/.claude/skills/mlops-check.md` | NUEVO | Skill `/mlops-check` |
| `The Agentic Company/.claude/skills/brand-check.md` | NUEVO | Skill `/brand-check` |
| `The Agentic Company/.claude/skills/deploy-qa.md` | NUEVO | Skill `/deploy-qa` |
| `The Agentic Company/CLAUDE.md` | ACTUALIZAR | Agregar triggers auto-invocación ML |

**Total: 10 archivos nuevos + 2 actualizaciones**

---

## Criterios de Éxito (Medibles)

- [ ] Al abrir sesión, dispatcher produce output en < 3 segundos y ≤ 80 tokens
- [ ] `/seo-audit` produce reporte clasificado Alta/Media/Baja en < 2 minutos
- [ ] `/deploy-qa` imprime `STOP` si falta meta title, meta description, o H1 duplicado en Landing Page
- [ ] `/deploy-qa` imprime `STOP` si `superpowers:code-reviewer` reporta errores de sintaxis en App
- [ ] Emails de outreach generados pasan `/brand-check` sin cambios manuales
- [ ] `AGENT_DISPATCHER_ENABLED=false` deshabilita el dispatcher sin tocar settings.json
- [ ] `AUTORESEARCH_ENABLED=true` activa el hook point sin cambios de código

---

## Fases de Implementación

**Fase 1:** Dispatcher + voz Felipe global (`~/.claude/CLAUDE.md`) + settings.json update
**Fase 2:** `Landing Page/CLAUDE.md` + skills SEO completos (`/seo-audit`, `/brand-check`)
**Fase 3:** Skills ML/MLOps en The Agentic Company (`/ml-review`, `/mlops-check`, `/brand-check`)
**Fase 4:** Pipelines `/deploy-qa` en ambos proyectos
**Fase 5 (post-primer cliente):** AutoResearch hook point activado

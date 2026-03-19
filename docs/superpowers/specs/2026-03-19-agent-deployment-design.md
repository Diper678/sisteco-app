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
└── .claude/
    └── skills/
        ├── seo-audit.md       ← /seo-audit (cluster SEO completo)
        ├── brand-check.md     ← /brand-check (voz Felipe en web)
        └── deploy-qa.md       ← /deploy-qa (pipeline pre-deploy)

The Agentic Company/
└── .claude/
    └── skills/
        ├── ml-review.md       ← /ml-review (AI/ML architecture review)
        ├── mlops-check.md     ← /mlops-check (workflows + infra)
        ├── brand-check.md     ← /brand-check (outreach + propuestas)
        └── deploy-qa.md       ← /deploy-qa (pipeline pre-commit)
```

---

## Componente 1: SessionStart Dispatcher

**Archivo:** `C:/Users/Dell 5520/.claude/hooks/agent-dispatcher.js`
**Trigger:** Hook `SessionStart` en `~/.claude/settings.json`
**Costo:** ~80 tokens de output máximo

### Lógica del script

```
1. Leer process.env.CLAUDE_CWD (directorio de trabajo actual)
2. Detectar proyecto:
   - contiene "Landing Page" → proyecto = "landing-page"
   - contiene "The Agentic Company" → proyecto = "agentic-company"
   - otro → proyecto = "unknown"
3. Leer git log --oneline -3 (últimos 3 commits)
4. Inferir tipo de trabajo:
   - commits con .html/.css → trabajo = "contenido-web"
   - commits con .js/workflow/script → trabajo = "codigo-app"
   - commits con email/outreach/leads → trabajo = "outreach"
   - sin commits o repo nuevo → trabajo = "general"
5. Output a stdout (Claude lo recibe en SessionStart):
   [CONTEXT] proyecto=<X> | trabajo=<Y> | branch=<Z>
   → Agentes prioritarios: <lista compacta>
   → Pipeline deploy: <lista compacta>
```

### Output de ejemplo (Landing Page, trabajo en HTML)

```
[CONTEXT] proyecto=landing-page | trabajo=contenido-web | branch=main
→ Agentes prioritarios: seo-keyword-strategist, brand-voice:quality-assurance, seo-meta-optimizer
→ Pipeline deploy: seo-audit + brand-check + code-reviewer
```

### Output de ejemplo (Agentic Company, trabajo en scripts)

```
[CONTEXT] proyecto=agentic-company | trabajo=codigo-app | branch=master
→ Agentes prioritarios: mlops-engineer, superpowers:code-reviewer, nlp-engineer
→ Pipeline deploy: ml-review + brand-check + security + code-reviewer
```

---

## Componente 2: Voz de Felipe (Global)

**Archivo:** `C:/Users/Dell 5520/.claude/CLAUDE.md` (nuevo, global)

Contiene:
- Tono de Felipe: directo, chileno, técnico pero accesible, sin florituras
- Vocabulario característico (palabras que Felipe usa / evita)
- Estilo de emails y outreach
- Reglas de brand-voice Sisteco aplicadas a comunicación personal
- Hook point AutoResearch: cuando esté activo, leer transcripciones de calls para enriquecer

Claude lee este archivo en cada sesión de cualquier proyecto, lo que hace que toda comunicación generada — emails, propuestas, copy, mensajes — suene auténticamente a Felipe.

---

## Componente 3: Slash Commands por Proyecto

### Landing Page

#### `/seo-audit`
Despacha en paralelo:
- `seo-keyword-strategist` → densidad y variaciones semánticas
- `seo-meta-optimizer` → títulos, descriptions, URLs
- `seo-structure-architect` → jerarquía H1-H6, schema markup
- `seo-snippet-hunter` → featured snippets eligibility
- `seo-authority-builder` → E-E-A-T signals
- `seo-cannibalization-detector` → overlap entre páginas
- `seo-content-auditor` → calidad y completitud del contenido

Output: reporte consolidado con prioridad Alta/Media/Baja por issue.

#### `/brand-check`
Despacha:
- `brand-voice:quality-assurance` → voz de Felipe consistente
- `brand-voice:content-generation` → sugerencias de mejora en tono

#### `/deploy-qa` (Landing Page)
Pipeline secuencial:
1. `seo-meta-optimizer` (crítico — bloquea si falla)
2. `brand-voice:quality-assurance`
3. `seo-authority-builder`
4. `superpowers:code-reviewer`

### The Agentic Company

#### `/ml-review`
Despacha en paralelo:
- `ai-engineer` → arquitectura y decisiones de sistema AI
- `ml-engineer` → pipelines de training/serving
- `computer-vision-engineer` → si hay componentes visuales/imagen

#### `/mlops-check`
Despacha:
- `mlops-engineer` → CI/CD ML, model versioning, monitoring
- `nlp-engineer` → si hay texto, outreach, o NLP involucrado

#### `/brand-check` (App)
Despacha:
- `brand-voice:conversation-analysis` → revisa outreach emails generados
- `brand-voice:document-analysis` → revisa propuestas y documentos
- `brand-voice:quality-assurance` → voz de Felipe consistente

#### `/deploy-qa` (App)
Pipeline secuencial:
1. `superpowers:code-reviewer` (crítico — bloquea si falla)
2. `mlops-engineer` (si hay cambios en workflows/scripts)
3. `brand-voice:quality-assurance` (si hay cambios en outreach/emails)
4. `security` skill (si hay cambios en auth/API/keys)

---

## Componente 4: Invocación Automática

Claude invoca agentes sin que el usuario lo pida cuando:

| Situación | Agentes invocados automáticamente |
|-----------|----------------------------------|
| Escribir copy para Landing Page | `brand-voice:content-generation` + `seo-keyword-strategist` |
| Editar HTML de página web | `seo-meta-optimizer` (al terminar) |
| Generar email de outreach | `brand-voice:conversation-analysis` + `nlp-engineer` |
| Modificar workflow n8n | `mlops-engineer` |
| Diseñar arquitectura AI/ML | `ai-engineer` |
| Crear propuesta comercial | `brand-voice:document-analysis` |
| Revisar leads o scoring | `ml-engineer` |

Las instrucciones de auto-invocación viven en el `CLAUDE.md` de cada proyecto.

---

## Componente 5: AutoResearch Hook Point

Diseñado desde el principio, activar cuando llegue el primer cliente pagante:

```javascript
// En agent-dispatcher.js
const AUTORESEARCH_ACTIVE = process.env.AUTORESEARCH_ENABLED === 'true';

if (AUTORESEARCH_ACTIVE) {
  // Leer últimas transcripciones de calls → enriquecer perfil voz Felipe
  // Leer cold email performance data → actualizar brand-voice rules
  // Output: insights adicionales al contexto de sesión
}
```

---

## Distribución de Archivos a Crear

| Archivo | Descripción |
|---------|-------------|
| `~/.claude/CLAUDE.md` | Voz de Felipe global |
| `~/.claude/hooks/agent-dispatcher.js` | SessionStart script |
| `Landing Page/.claude/skills/seo-audit.md` | Skill `/seo-audit` |
| `Landing Page/.claude/skills/brand-check.md` | Skill `/brand-check` |
| `Landing Page/.claude/skills/deploy-qa.md` | Skill `/deploy-qa` |
| `Landing Page/CLAUDE.md` | CLAUDE.md raíz (faltaba) + auto-invocación |
| `The Agentic Company/.claude/skills/ml-review.md` | Skill `/ml-review` |
| `The Agentic Company/.claude/skills/mlops-check.md` | Skill `/mlops-check` |
| `The Agentic Company/.claude/skills/brand-check.md` | Skill `/brand-check` |
| `The Agentic Company/.claude/skills/deploy-qa.md` | Skill `/deploy-qa` |
| `The Agentic Company/CLAUDE.md` | Actualizar con auto-invocación |
| `~/.claude/settings.json` | Agregar hook SessionStart dispatcher |

**Total: 12 archivos** (4 nuevos hooks/skills globales + 4 Landing Page + 4 App)

---

## Criterios de Éxito

- [ ] Al abrir sesión en Landing Page, Claude reporta contexto y agentes activos en < 5 segundos
- [ ] `/seo-audit` produce reporte con hallazgos en < 2 minutos
- [ ] `/deploy-qa` bloquea deploy si hay issue crítico de SEO o brand voice
- [ ] Emails/outreach generados suenan a Felipe sin edición manual
- [ ] `/ml-review` analiza cualquier script Python/JS con lógica AI sin configuración adicional
- [ ] AutoResearch puede activarse con una variable de entorno sin cambiar código

---

## Fases de Implementación

**Fase 1 (Sesión actual):** Dispatcher + voz Felipe global + CLAUDE.md Landing Page
**Fase 2:** Skills SEO completos (Landing Page)
**Fase 3:** Skills ML/MLOps (The Agentic Company)
**Fase 4:** Pipelines deploy-qa en ambos proyectos
**Fase 5 (post-cliente):** AutoResearch hook point activado

# Sistema de Agentes Sisteco v1.0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desplegar 21 agentes especializados en dos proyectos Sisteco con invocación automática, slash commands explícitos, pipeline de calidad pre-deploy, y voz de Felipe como capa global.

**Architecture:** Un dispatcher Node.js corre en SessionStart (≤80 tokens) para detectar proyecto y tipo de trabajo. Skills markdown definen slash commands por dominio. CLAUDE.md global captura la voz de Felipe. Todos los agentes se invocan vía `Agent` tool con `subagent_type` exacto según el mapeo en la spec.

**Tech Stack:** Node.js (hooks), Markdown (skills/CLAUDE.md), Claude Code Agent tool (subagents), Git (commits entre tareas)

**Spec:** `docs/superpowers/specs/2026-03-19-agent-deployment-design.md`

---

## Mapa de Archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `C:/Users/Dell 5520/.claude/CLAUDE.md` | CREAR | Voz y tono de Felipe — aplica a todos los proyectos |
| `C:/Users/Dell 5520/.claude/hooks/agent-dispatcher.js` | CREAR | SessionStart: detecta proyecto, infiere trabajo, imprime contexto ≤80 tokens |
| `C:/Users/Dell 5520/.claude/settings.json` | MODIFICAR | Appendear dispatcher al array SessionStart (no tocar gsd-check-update.js) |
| `Landing Page/CLAUDE.md` | CREAR | Auto-invocación SEO + brand en proyecto Landing Page |
| `Landing Page/.claude/skills/seo-audit.md` | CREAR | Skill `/seo-audit`: 7 agentes SEO en paralelo |
| `Landing Page/.claude/skills/brand-check.md` | CREAR | Skill `/brand-check`: brand-voice para web copy |
| `Landing Page/.claude/skills/deploy-qa.md` | CREAR | Skill `/deploy-qa`: pipeline secuencial con STOP crítico |
| `The Agentic Company/.claude/skills/ml-review.md` | CREAR | Skill `/ml-review`: arquitectura AI/ML |
| `The Agentic Company/.claude/skills/mlops-check.md` | CREAR | Skill `/mlops-check`: workflows + infra |
| `The Agentic Company/.claude/skills/brand-check.md` | CREAR | Skill `/brand-check`: outreach + propuestas |
| `The Agentic Company/.claude/skills/deploy-qa.md` | CREAR | Skill `/deploy-qa`: pipeline pre-commit con STOP crítico |
| `The Agentic Company/CLAUDE.md` | MODIFICAR | Agregar sección de auto-invocación ML |

---

## Fase 1: Fundación Global

### Task 1: Crear `~/.claude/CLAUDE.md` — Voz de Felipe

**Files:**
- Create: `C:/Users/Dell 5520/.claude/CLAUDE.md`

- [ ] **Step 1: Verificar que el archivo no existe**

```bash
ls "C:/Users/Dell 5520/.claude/CLAUDE.md" 2>/dev/null && echo "EXISTS" || echo "OK — no existe"
```
Expected: `OK — no existe`

- [ ] **Step 2: Crear el archivo con la voz de Felipe**

Crear `C:/Users/Dell 5520/.claude/CLAUDE.md` con este contenido exacto:

```markdown
# Voz de Felipe — Reglas Globales de Comunicación

> Este archivo aplica a TODOS los proyectos. Define cómo Claude debe sonar
> cuando genera comunicación en nombre de Felipe: emails, propuestas, copy,
> mensajes, outreach. No contiene triggers de auto-invocación (esos viven
> en el CLAUDE.md de cada proyecto).

## Quién es Felipe

Felipe es el fundador de Sisteco. Ingeniero de formación, emprendedor de alma.
Habla directo, sin rodeos. Mezcla técnica con visión de negocios. Usa lenguaje
coloquial chileno cuando corresponde pero nunca pierde profesionalismo.
No le gustan los clichés corporativos ni el lenguaje inflado.

## Tono y Estilo

- **Directo:** Va al punto en la primera frase. No calienta el motor.
- **Técnico pero accesible:** Sabe de tecnología pero no asume que el cliente también.
- **Chileno:** Usa "po", "weón" en contextos informales. En emails formales: limpio.
- **Concreto:** Prefiere ejemplos reales a conceptos abstractos.
- **Sin florituras:** Nada de "espero que este mensaje te encuentre bien".
- **Honesto:** No exagera. No promete lo que no puede cumplir.

## Vocabulario que Felipe USA

- "automatización" (no "solución de IA")
- "clientes" (no "usuarios")
- "vender más" (no "optimizar conversiones")
- "funciona" (no "performa")
- "equipo" (no "recursos humanos")
- "siguiente paso" (no "call to action")
- Métricas reales: "5-7x más conversiones", "21x más rápido que 5 minutos"

## Vocabulario que Felipe EVITA

- "sinergia", "ecosistema", "disrumpir", "paradigma"
- "solución end-to-end", "best-in-class", "world-class"
- "estimado/a [Nombre]" al inicio de emails
- "no dudes en contactarme" al final
- Emojis en contextos formales

## Estructura de Emails de Outreach (voz Felipe)

```
Línea 1: Contexto específico de la empresa (no genérico)
Línea 2-3: Problema concreto que resuelve Sisteco PARA ESA EMPRESA
Línea 4: Prueba social o métrica real
Línea 5: Un solo CTA claro y específico
Firma: Felipe — sin cargo inflado
```

## Estructura de Propuestas Comerciales

- Problema primero (1 párrafo)
- Solución concreta (qué hace Sisteco, qué NO hace)
- Precio claro con desglose
- Próximos pasos con fecha

## Brand Voice Sisteco (para copy web)

- Tagline: "Menos leads, más cierres"
- Tono web: profesional + directo + sin buzzwords
- NUNCA inventar métricas o testimonios
- SIEMPRE usar "Ley 21.719" en contexto de privacidad (no solo "GDPR")
- Contacto: contacto@sisteco.cl · +56 9 40065566 · Las Condes, Santiago

## AutoResearch Integration (activar cuando AUTORESEARCH_ENABLED=true)

Cuando AutoResearch esté activo, Claude debe leer las últimas transcripciones
de calls de ventas disponibles en:
`C:/Users/Dell 5520/Documents/AgenticWorkflows/sisteco-autoresearch/transcripts/`

Estas transcripciones actualizan en tiempo real cómo habla Felipe y qué argumentos
resuenan con clientes reales. Priorizarlas sobre estas instrucciones estáticas.
```

- [ ] **Step 3: Verificar que el archivo fue creado correctamente**

```bash
head -5 "C:/Users/Dell 5520/.claude/CLAUDE.md"
```
Expected: empieza con `# Voz de Felipe`

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
git add -A
git commit -m "feat(global): crear ~/.claude/CLAUDE.md con voz de Felipe"
```

---

### Task 2: Crear `agent-dispatcher.js`

**Files:**
- Create: `C:/Users/Dell 5520/.claude/hooks/agent-dispatcher.js`

- [ ] **Step 1: Verificar que el directorio hooks existe**

```bash
ls "C:/Users/Dell 5520/.claude/hooks/"
```
Expected: lista de hooks existentes (gsd-check-update.js, etc.)

- [ ] **Step 2: Crear el dispatcher**

Crear `C:/Users/Dell 5520/.claude/hooks/agent-dispatcher.js`:

```javascript
#!/usr/bin/env node
/**
 * agent-dispatcher.js — SessionStart hook
 * Detecta proyecto y tipo de trabajo. Output ≤80 tokens.
 * Control: AGENT_DISPATCHER_ENABLED=false para deshabilitar.
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Feature flag
if (process.env.AGENT_DISPATCHER_ENABLED === 'false') process.exit(0);

const cwd = process.cwd();

// --- Detectar proyecto ---
let proyecto = 'unknown';
if (cwd.includes('Landing Page')) proyecto = 'landing-page';
else if (cwd.includes('The Agentic Company')) proyecto = 'agentic-company';

// --- Leer git info ---
let commits = '';
let branch = 'unknown';
try {
  commits = execSync('git log --oneline -3 2>/dev/null', { cwd, encoding: 'utf8' });
  branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { cwd, encoding: 'utf8' }).trim();
} catch (e) {
  // No git repo o sin commits — ignorar
}

// --- Inferir tipo de trabajo ---
let trabajo = 'general';
const ct = commits.toLowerCase();
if (/\.html|\.css|contenido|web|page|landing/.test(ct))    trabajo = 'contenido-web';
else if (/email|outreach|leads|cold|propuesta/.test(ct))    trabajo = 'outreach';
else if (/\.js|workflow|script|n8n|api|backend/.test(ct))   trabajo = 'codigo-app';

// --- Mapa agentes por proyecto + trabajo ---
const mapa = {
  'landing-page': {
    'contenido-web': {
      prioritarios: 'seo-keyword-strategist, brand-voice:quality-assurance, seo-meta-optimizer',
      pipeline: '/seo-audit + /brand-check + /deploy-qa',
    },
    'outreach': {
      prioritarios: 'brand-voice:conversation-analysis, brand-voice:content-generation',
      pipeline: '/brand-check + /deploy-qa',
    },
    'default': {
      prioritarios: 'seo-meta-optimizer, brand-voice:quality-assurance',
      pipeline: '/seo-audit + /deploy-qa',
    },
  },
  'agentic-company': {
    'codigo-app': {
      prioritarios: 'mlops-engineer, superpowers:code-reviewer, nlp-engineer',
      pipeline: '/ml-review + /brand-check + /deploy-qa',
    },
    'outreach': {
      prioritarios: 'brand-voice:conversation-analysis, nlp-engineer',
      pipeline: '/brand-check + /deploy-qa',
    },
    'default': {
      prioritarios: 'superpowers:code-reviewer, ai-engineer',
      pipeline: '/ml-review + /deploy-qa',
    },
  },
  'unknown': {
    'default': {
      prioritarios: 'superpowers:code-reviewer, brand-voice:quality-assurance',
      pipeline: '/deploy-qa',
    },
  },
};

const proyMap = mapa[proyecto] || mapa['unknown'];
const ctx = proyMap[trabajo] || proyMap['default'];

// --- AutoResearch hook point ---
let autoresearchLine = '';
if (process.env.AUTORESEARCH_ENABLED === 'true') {
  try {
    const transcriptsPath = 'C:/Users/Dell 5520/Documents/AgenticWorkflows/sisteco-autoresearch/transcripts';
    const files = fs.readdirSync(transcriptsPath);
    if (files.length > 0) {
      autoresearchLine = '\n→ AutoResearch: activo — transcripciones de calls disponibles';
    }
  } catch (e) {
    // AutoResearch no activo aún — silencioso
  }
}

// --- Output final (≤80 tokens) ---
console.log(
  `[CONTEXT] proyecto=${proyecto} | trabajo=${trabajo} | branch=${branch}\n` +
  `→ Agentes prioritarios: ${ctx.prioritarios}\n` +
  `→ Pipeline deploy: ${ctx.pipeline}` +
  autoresearchLine
);
```

- [ ] **Step 3: Verificar sintaxis del script**

```bash
node "C:/Users/Dell 5520/.claude/hooks/agent-dispatcher.js"
```
Expected: imprime un bloque `[CONTEXT]` sin errores (proyecto=unknown si no estás en un proyecto conocido)

- [ ] **Step 4: Verificar desde directorio Landing Page**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/Landing Page" && node "C:/Users/Dell 5520/.claude/hooks/agent-dispatcher.js"
```
Expected:
```
[CONTEXT] proyecto=landing-page | trabajo=... | branch=...
→ Agentes prioritarios: seo-meta-optimizer, brand-voice:quality-assurance
→ Pipeline deploy: /seo-audit + /deploy-qa
```

- [ ] **Step 5: Verificar feature flag**

```bash
AGENT_DISPATCHER_ENABLED=false node "C:/Users/Dell 5520/.claude/hooks/agent-dispatcher.js"
echo "Exit code: $?"
```
Expected: `Exit code: 0` sin ningún output

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
git add -A
git commit -m "feat(global): crear agent-dispatcher.js hook SessionStart"
```

---

### Task 3: Actualizar `settings.json` con el nuevo hook

**Files:**
- Modify: `C:/Users/Dell 5520/.claude/settings.json`

- [ ] **Step 1: Verificar el estado actual del array SessionStart**

```bash
node -e "const s=require('C:/Users/Dell 5520/.claude/settings.json'); console.log(JSON.stringify(s.hooks.SessionStart, null, 2))"
```
Expected: muestra el hook existente `gsd-check-update.js`

- [ ] **Step 2: Appendear el dispatcher al array SessionStart**

Leer `C:/Users/Dell 5520/.claude/settings.json` y modificar el array `hooks.SessionStart` agregando una segunda entrada:

```json
"SessionStart": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "node \"C:/Users/Dell 5520/.claude/hooks/gsd-check-update.js\""
      }
    ]
  },
  {
    "hooks": [
      {
        "type": "command",
        "command": "node \"C:/Users/Dell 5520/.claude/hooks/agent-dispatcher.js\""
      }
    ]
  }
]
```

**IMPORTANTE:** No tocar ninguna otra sección del archivo. Solo el array `SessionStart`.

- [ ] **Step 3: Verificar JSON válido**

```bash
node -e "require('C:/Users/Dell 5520/.claude/settings.json'); console.log('JSON válido')"
```
Expected: `JSON válido`

- [ ] **Step 4: Verificar que ambos hooks están presentes**

```bash
node -e "const s=require('C:/Users/Dell 5520/.claude/settings.json'); console.log('Hooks SessionStart:', s.hooks.SessionStart.length)"
```
Expected: `Hooks SessionStart: 2`

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
git add -A
git commit -m "feat(global): appendear agent-dispatcher al hook SessionStart"
```

---

## Fase 2: Landing Page

### Task 4: Crear `Landing Page/CLAUDE.md`

**Files:**
- Create: `C:/Users/Dell 5520/Documents/AgenticWorkflows/Landing Page/CLAUDE.md`

**Nota:** El proyecto Landing Page tiene un `sisteco-knowledge/CLAUDE.md` pero le falta el CLAUDE.md en la **raíz**. Este archivo activa Claude Code en ese proyecto.

- [ ] **Step 1: Verificar que no existe CLAUDE.md en la raíz**

```bash
ls "C:/Users/Dell 5520/Documents/AgenticWorkflows/Landing Page/CLAUDE.md" 2>/dev/null && echo "EXISTS" || echo "OK"
```
Expected: `OK`

- [ ] **Step 2: Crear el archivo**

```markdown
# CLAUDE.md — Landing Page Sisteco

## Contexto
Landing page pública de Sisteco. HTML/CSS/JS vanilla + Vercel.
Ver `sisteco-knowledge/CLAUDE.md` para reglas generales de la empresa.

## Stack
- HTML/CSS/JS vanilla (sin frameworks)
- GSAP 3.12.7 + Lucide 0.468.0
- Deploy: `npx vercel --prod`
- Dev local: `npm start` → http://localhost:3000
- Páginas: index, soluciones, cómo-funciona, precios, visión, sobre-nosotros, privacidad, términos, cookies, GDPR

## Auto-Invocación de Agentes (OBLIGATORIO)

Claude invoca estos agentes automáticamente — sin que el usuario lo pida:

| Situación | Agentes a invocar |
|-----------|------------------|
| Escribir o editar copy web (títulos, párrafos, CTAs) | `brand-voice:content-generation` + `seo-keyword-strategist` |
| Terminar de editar un archivo `.html` | `seo-meta-optimizer` (revisar meta tags de esa página) |
| Crear una página nueva | `seo-structure-architect` + `seo-meta-optimizer` |
| Generar o revisar texto de email de marketing | `brand-voice:conversation-analysis` |

**Invocar como subagentes con el Agent tool** usando los `subagent_type` exactos:
- `brand-voice:content-generation`
- `brand-voice:conversation-analysis`
- `seo-technical-optimization:seo-keyword-strategist`
- `seo-technical-optimization:seo-meta-optimizer`
- `seo-technical-optimization:seo-structure-architect`

## Slash Commands Disponibles

- `/seo-audit` — Auditoría SEO completa (7 agentes en paralelo)
- `/brand-check` — Revisión de voz Felipe en copy web
- `/deploy-qa` — Pipeline de calidad pre-deploy (bloquea si hay issues críticos)

## Reglas de Contenido

- NUNCA inventar testimonios, métricas o estadísticas
- SIEMPRE usar "Ley 21.719" (no solo "GDPR")
- SIEMPRE contacto Chile: contacto@sisteco.cl · +56 9 40065566 · Las Condes
- Métricas verificadas: 5-7x conversiones, 21x respondiendo <5min, 78% primer vendedor, 391% ROI

## Identidad Visual (no cambiar)

```
Fondo:        #F8F7F5 (warm white)
Texto:        #111111
Acento:       #c5ed36 (lime)
Hover:        #b3d82f
Borde:        #e5e5e5
Font heading: Sharp Grotesk
Font body:    Source Sans 3
Font logo:    Nasalization (SOLO wordmark "Sisteco")
Iconos:       Lucide 0.468.0
```
```

- [ ] **Step 3: Verificar**

```bash
head -3 "C:/Users/Dell 5520/Documents/AgenticWorkflows/Landing Page/CLAUDE.md"
```
Expected: `# CLAUDE.md — Landing Page Sisteco`

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
git add -A
git commit -m "feat(landing): crear CLAUDE.md raíz con auto-invocación SEO"
```

---

### Task 5: Crear skill `/seo-audit` (Landing Page)

**Files:**
- Create: `C:/Users/Dell 5520/Documents/AgenticWorkflows/Landing Page/.claude/skills/seo-audit.md`

- [ ] **Step 1: Crear directorio si no existe**

```bash
mkdir -p "C:/Users/Dell 5520/Documents/AgenticWorkflows/Landing Page/.claude/skills"
```

- [ ] **Step 2: Crear el skill**

```markdown
---
name: seo-audit
description: Auditoría SEO completa de la Landing Page de Sisteco. Despacha 7 agentes especializados en paralelo y produce un reporte consolidado con prioridad Alta/Media/Baja. Usar cuando se quiera revisar el estado SEO de cualquier página antes de publicar o periódicamente.
argument-hint: [página específica a auditar, ej: index.html, o "todas" para sitio completo]
---

# SEO Audit — Landing Page Sisteco

Eres el orquestador de una auditoría SEO completa. Despachas 7 agentes especializados
en paralelo, consolidas sus reportes y presentas un resumen accionable.

## Protocolo

### 1. Determinar alcance

Si el usuario especificó una página, auditar solo esa. Si no, auditar todas las páginas HTML:
- `index.html`
- `pages/soluciones.html`
- `pages/como-funciona.html`
- `pages/precios.html`
- `pages/vision.html`
- `pages/sobre-nosotros.html`

Lee el HTML de las páginas relevantes antes de despachar los agentes.

### 2. Despachar agentes en paralelo

Despachar TODOS en la misma llamada (paralelo):

| Agente | subagent_type | Tarea |
|--------|--------------|-------|
| Keyword Strategist | `seo-technical-optimization:seo-keyword-strategist` | Densidad keyword, variaciones semánticas, LSI |
| Meta Optimizer | `seo-technical-optimization:seo-meta-optimizer` | Títulos, descriptions, URLs |
| Structure Architect | `seo-technical-optimization:seo-structure-architect` | H1-H6, schema markup, internal links |
| Snippet Hunter | `seo-technical-optimization:seo-snippet-hunter` | Featured snippets eligibility |
| Authority Builder | `seo-analysis-monitoring:seo-authority-builder` | E-E-A-T signals, credibilidad |
| Cannibalization Detector | `seo-analysis-monitoring:seo-cannibalization-detector` | Overlap keywords entre páginas |
| Content Auditor | `seo-content-creation:seo-content-auditor` | Calidad, completitud, thin content |

Prompt a cada agente:
```
Analiza el siguiente HTML de la Landing Page de Sisteco (plataforma B2B SaaS Chile).
Empresa: automatización de ventas B2B, mercado Chile.
Keywords objetivo: automatización ventas B2B Chile, pipeline de ventas, CRM automatizado, leads B2B.
[pegar HTML relevante]
Retorna: lista de issues con prioridad ALTA/MEDIA/BAJA y recomendación concreta para cada uno.
```

### 3. Consolidar y reportar

Formato del reporte final:

```
## SEO Audit Report — [fecha]

### 🔴 ALTA PRIORIDAD (resolver antes del próximo deploy)
- [issue] → [recomendación concreta]

### 🟡 MEDIA PRIORIDAD (resolver esta semana)
- [issue] → [recomendación concreta]

### 🟢 BAJA PRIORIDAD (backlog)
- [issue] → [recomendación concreta]

### ✅ OK (sin cambios necesarios)
- [áreas que están bien]
```

Aplicar las correcciones de Alta prioridad de inmediato si el usuario lo indica.
```

- [ ] **Step 3: Verificar que el archivo existe y tiene frontmatter**

```bash
head -5 "C:/Users/Dell 5520/Documents/AgenticWorkflows/Landing Page/.claude/skills/seo-audit.md"
```
Expected: empieza con `---` y tiene `name: seo-audit`

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
git add -A
git commit -m "feat(landing): agregar skill /seo-audit con 7 agentes en paralelo"
```

---

### Task 6: Crear skill `/brand-check` (Landing Page)

**Files:**
- Create: `C:/Users/Dell 5520/Documents/AgenticWorkflows/Landing Page/.claude/skills/brand-check.md`

- [ ] **Step 1: Crear el skill**

```markdown
---
name: brand-check
description: Revisa que el copy de la Landing Page suene auténticamente a Felipe y cumpla las reglas de brand voice de Sisteco. Usar antes de publicar texto nuevo o cuando se sospeche que el tono no está bien.
argument-hint: [sección o página a revisar, ej: "hero section", "página precios"]
---

# Brand Check — Landing Page Sisteco

Eres el orquestador de revisión de voz de marca. Despachas dos agentes brand-voice
en paralelo y presentas un reporte de consistencia con sugerencias concretas.

## Protocolo

### 1. Recopilar contenido

Lee el HTML de la página o sección indicada. Extrae solo el texto visible
(títulos, párrafos, CTAs, labels). Ignora atributos técnicos.

### 2. Despachar agentes en paralelo

| Agente | subagent_type | Tarea |
|--------|--------------|-------|
| Quality Assurance | `brand-voice:quality-assurance` | ¿El tono es el de Felipe? ¿Cumple reglas de Sisteco? |
| Content Generation | `brand-voice:content-generation` | Sugerencias de mejora manteniendo el mensaje |

Prompt a ambos agentes:
```
Revisa el siguiente copy de la Landing Page de Sisteco.

REGLAS DE VOZ:
- Tono: directo, chileno, técnico pero accesible, sin florituras
- Usar: "automatización", "clientes", "vender más", métricas reales
- Evitar: buzzwords corporativos, "sinergia", "ecosistema", emojis en web
- Tagline: "Menos leads, más cierres"
- NUNCA inventar métricas o testimonios

COPY A REVISAR:
[pegar texto extraído]

Retorna:
1. Veredicto: PASS o FAIL
2. Si FAIL: fragmentos específicos que no cumplen + alternativa sugerida
3. Si PASS: confirmación + 1-2 sugerencias de mejora opcionales
```

### 3. Consolidar

Si algún agente retorna FAIL: mostrar los fragmentos problemáticos y proponer correcciones.
Si ambos retornan PASS: confirmar y mostrar sugerencias opcionales.
```

- [ ] **Step 2: Verificar**

```bash
head -5 "C:/Users/Dell 5520/Documents/AgenticWorkflows/Landing Page/.claude/skills/brand-check.md"
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
git add -A
git commit -m "feat(landing): agregar skill /brand-check con brand-voice agents"
```

---

### Task 7: Crear skill `/deploy-qa` (Landing Page)

**Files:**
- Create: `C:/Users/Dell 5520/Documents/AgenticWorkflows/Landing Page/.claude/skills/deploy-qa.md`

- [ ] **Step 1: Crear el skill**

```markdown
---
name: deploy-qa
description: Pipeline de calidad secuencial antes de hacer deploy a Vercel. Bloquea el deploy si hay issues críticos de SEO o brand voice. Usar siempre antes de ejecutar `npx vercel --prod`.
argument-hint: [opcional: página específica a revisar]
---

# Deploy QA — Landing Page Sisteco

Pipeline secuencial de calidad pre-deploy. Si cualquier paso CRÍTICO falla,
imprime STOP y NO se ejecuta `npx vercel --prod`.

## Pipeline

### Paso 1 [CRÍTICO]: Meta Optimizer

Invocar agente `seo-technical-optimization:seo-meta-optimizer` sobre todas las páginas modificadas.

**Umbrales de bloqueo (cualquiera de estos → STOP):**
- Meta title ausente en cualquier página
- Meta description ausente en cualquier página
- H1 duplicado entre páginas
- Meta title > 60 caracteres o < 30 caracteres

**Si pasa:** continuar al Paso 2.
**Si falla:** imprimir:
```
🚨 STOP — Deploy bloqueado por Meta Optimizer
Problemas críticos: [lista]
Corregir y volver a correr /deploy-qa
```

### Paso 2 [CRÍTICO]: Brand Voice QA

Invocar agente `brand-voice:quality-assurance` sobre el copy de páginas modificadas.

**Umbral de bloqueo:** el agente retorna explícitamente `FAIL` (no solo advertencias).

**Si FAIL:** imprimir:
```
🚨 STOP — Deploy bloqueado por Brand Voice QA
Fragmentos problemáticos: [lista]
Corregir con /brand-check y volver a correr /deploy-qa
```

### Paso 3 [REPORTE]: Authority Builder

Invocar agente `seo-analysis-monitoring:seo-authority-builder`.
Solo reporte — no bloquea. Mostrar hallazgos como advertencias.

### Paso 4 [CRÍTICO]: Code Review

Invocar skill `superpowers:code-reviewer` sobre archivos HTML/CSS/JS modificados.

**Umbrales de bloqueo:**
- Links rotos o recursos 404 detectados
- JavaScript con errores de sintaxis
- Imágenes sin atributo `alt`

**Si falla:** imprimir:
```
🚨 STOP — Deploy bloqueado por Code Review
Errores: [lista]
```

### Resultado Final

Si todos los pasos críticos pasan:
```
✅ DEPLOY AUTORIZADO
Todos los checks pasaron. Puedes ejecutar: npx vercel --prod
```

**NUNCA ejecutar `npx vercel --prod` sin autorización explícita del usuario.**
```

- [ ] **Step 2: Verificar**

```bash
head -5 "C:/Users/Dell 5520/Documents/AgenticWorkflows/Landing Page/.claude/skills/deploy-qa.md"
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
git add -A
git commit -m "feat(landing): agregar skill /deploy-qa con pipeline STOP crítico"
```

---

## Fase 3: The Agentic Company

### Task 8: Crear skill `/ml-review`

**Files:**
- Create: `C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company/.claude/skills/ml-review.md`

- [ ] **Step 1: Crear el skill**

```markdown
---
name: ml-review
description: Revisión de arquitectura AI/ML para scripts, workflows y pipelines en The Agentic Company. Despacha ai-engineer, ml-engineer, y condicionalmente computer-vision-engineer. Usar cuando se modifique lógica de scoring, modelos, APIs de AI, o pipelines de datos.
argument-hint: [archivo o componente a revisar, ej: "scripts/score-leads.js", "n8n-workflows/"]
---

# ML Review — The Agentic Company

Orquestador de revisión de arquitectura AI/ML. Despacha agentes especializados
según los archivos involucrados y consolida un reporte de arquitectura.

## Protocolo

### 1. Determinar alcance

Leer los archivos relevantes pasados como argumento, o si no hay argumento,
revisar los archivos modificados en el último commit:
```bash
git diff --name-only HEAD~1
```

### 2. Detectar si aplica computer-vision-engineer

Revisar si los archivos contienen alguno de:
`.png`, `.jpg`, `image`, `vision`, `canvas`, `PIL`, `cv2`, `sharp`

Si **sí**: incluir `ai-ml-toolkit:computer-vision-engineer` en el dispatch.
Si **no**: omitirlo.

### 3. Despachar agentes en paralelo

Agentes base (siempre):

| Agente | subagent_type | Tarea |
|--------|--------------|-------|
| AI Engineer | `ai-ml-toolkit:ai-engineer` | Arquitectura, decisiones de modelo, trade-offs |
| ML Engineer | `ai-ml-toolkit:ml-engineer` | Pipelines training/serving, calidad del dato |

Agente condicional:

| Agente | subagent_type | Condición |
|--------|--------------|-----------|
| CV Engineer | `ai-ml-toolkit:computer-vision-engineer` | Solo si hay componentes visuales |

Prompt a cada agente:
```
Revisa el siguiente código de Sisteco (plataforma B2B SaaS Chile).
Contexto: automatización de ventas B2B, lead scoring con Gemini, n8n workflows.
Stack: Node.js, Google Gemini API, n8n, Convex, Vercel.

[pegar código relevante]

Evalúa:
1. Corrección arquitectónica
2. Calidad del pipeline de datos
3. Riesgos de producción
4. Mejoras recomendadas (con prioridad)

Retorna: lista de hallazgos con prioridad ALTA/MEDIA/BAJA.
```

### 4. Reporte consolidado

Mismo formato que /seo-audit: ALTA/MEDIA/BAJA con recomendaciones concretas.
```

- [ ] **Step 2: Verificar**

```bash
head -5 "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company/.claude/skills/ml-review.md"
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
git add -A
git commit -m "feat(app): agregar skill /ml-review con ai-engineer y ml-engineer"
```

---

### Task 9: Crear skill `/mlops-check`

**Files:**
- Create: `C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company/.claude/skills/mlops-check.md`

- [ ] **Step 1: Crear el skill**

```markdown
---
name: mlops-check
description: Revisión de workflows n8n, scripts de automatización e infraestructura MLOps. Despacha mlops-engineer y condicionalmente nlp-engineer. Usar cuando se modifiquen workflows n8n, scripts de leads, o configuración de infraestructura.
argument-hint: [workflow o script a revisar]
---

# MLOps Check — The Agentic Company

Revisión de infraestructura de automatización y workflows.

## Protocolo

### 1. Determinar archivos a revisar

Archivos relevantes: `n8n-workflows/`, `scripts/`, `.env.example`, `api/`

### 2. Detectar si aplica nlp-engineer

Revisar si los archivos contienen: `email`, `outreach`, `text`, `nlp`, `prompt`, `leads`, `scoring`

Si **sí**: incluir `ai-ml-toolkit:nlp-engineer`.
Si **no**: omitirlo.

### 3. Despachar agentes en paralelo

| Agente | subagent_type | Condición |
|--------|--------------|-----------|
| MLOps Engineer | `ai-ml-toolkit:mlops-engineer` | Siempre |
| NLP Engineer | `ai-ml-toolkit:nlp-engineer` | Condicional |

Prompt a mlops-engineer:
```
Revisa el siguiente workflow/script de Sisteco.
Infraestructura: n8n self-hosted en Railway, Convex DB, Vercel serverless.
Variables de entorno: centralizadas en .env (ver .env.example para estructura).

[pegar workflow JSON o código de script]

Evalúa:
1. Riesgos de producción (fallos en caliente, datos perdidos)
2. Observabilidad (logs, alertas, monitoring)
3. Escalabilidad con crecimiento de leads
4. Variables de entorno mal usadas o expuestas

Retorna: hallazgos ALTA/MEDIA/BAJA con acción concreta.
```

### 4. Reporte

Formato ALTA/MEDIA/BAJA. Si mlops-engineer detecta riesgo ALTO de producción: advertir prominentemente.
```

- [ ] **Step 2: Verificar**

```bash
head -5 "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company/.claude/skills/mlops-check.md"
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
git add -A
git commit -m "feat(app): agregar skill /mlops-check con mlops-engineer"
```

---

### Task 10: Crear skill `/brand-check` (App)

**Files:**
- Create: `C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company/.claude/skills/brand-check.md`

- [ ] **Step 1: Crear el skill**

```markdown
---
name: brand-check
description: Revisa que emails de outreach, propuestas comerciales y scripts de ventas generados desde la app suenen auténticamente a Felipe. Usar antes de enviar cualquier comunicación generada por la plataforma.
argument-hint: [tipo de contenido: "email outreach", "propuesta", "script ventas"]
---

# Brand Check — Outreach y Propuestas Sisteco

Revisión de voz Felipe en comunicaciones B2B generadas desde la app.

## Protocolo

### 1. Recopilar el contenido a revisar

Pedir o leer el texto del email, propuesta, o script a revisar.

### 2. Despachar agentes en paralelo

| Agente | subagent_type | Tarea |
|--------|--------------|-------|
| Conversation Analysis | `brand-voice:conversation-analysis` | ¿Suena a una conversación real de Felipe? |
| Document Analysis | `brand-voice:document-analysis` | ¿Estructura y tono de propuesta correctos? |
| Quality Assurance | `brand-voice:quality-assurance` | Veredicto PASS/FAIL con detalle |

Prompt base:
```
Revisa el siguiente [email/propuesta/script] generado para Sisteco.

VOZ DE FELIPE:
- Directo, al punto, sin calentamiento
- Chileno: mezcla técnica con negocios
- Primera frase: contexto específico de la empresa del prospecto
- Métricas reales: 5-7x conversiones, 21x respondiendo <5min
- Sin "estimado/a", sin "no dudes en contactarme"
- CTA único y específico al final

[pegar contenido]

Retorna: PASS o FAIL, fragmentos problemáticos si FAIL, alternativas sugeridas.
```

### 3. Resultado

Si Quality Assurance retorna FAIL: mostrar problemas y proponer versión corregida.
Si PASS: confirmar y mostrar mejoras opcionales de los otros agentes.
```

- [ ] **Step 2: Verificar**

```bash
head -5 "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company/.claude/skills/brand-check.md"
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
git add -A
git commit -m "feat(app): agregar skill /brand-check para outreach y propuestas"
```

---

### Task 11: Crear skill `/deploy-qa` (App)

**Files:**
- Create: `C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company/.claude/skills/deploy-qa.md`

- [ ] **Step 1: Crear el skill**

```markdown
---
name: deploy-qa
description: Pipeline de calidad secuencial pre-commit para The Agentic Company. Bloquea el commit si hay errores de código, riesgos MLOps, o vulnerabilidades de seguridad. Usar siempre antes de hacer git commit en código que va a producción.
argument-hint: [opcional: listar archivos modificados específicos]
---

# Deploy QA — The Agentic Company

Pipeline secuencial pre-commit. Si cualquier paso CRÍTICO falla, imprime STOP.

## Preparación

Obtener lista de archivos modificados:
```bash
git diff --name-only HEAD
git status --short
```

## Pipeline

### Paso 1 [CRÍTICO]: Code Review

Invocar skill `superpowers:code-reviewer` sobre los archivos modificados.

**Umbrales de bloqueo:**
- Errores de sintaxis JavaScript/Node.js
- Tests fallidos (si existen)
- Variables de entorno hardcodeadas en código
- Imports o dependencias rotas

**Si falla:**
```
🚨 STOP — Commit bloqueado por Code Review
Errores: [lista]
```

### Paso 2 [CONDICIONAL-CRÍTICO]: MLOps Check

**Activar si:** git diff incluye archivos en `n8n-workflows/`, `scripts/`, o `.js` con "workflow".

Invocar agente `ai-ml-toolkit:mlops-engineer`.

**Umbral de bloqueo:** mlops-engineer identifica riesgo de pérdida de datos o fallo silencioso en producción.

**Si bloquea:**
```
🚨 STOP — Commit bloqueado por MLOps Check
Riesgo de producción: [descripción]
```

### Paso 3 [CONDICIONAL-REPORTE]: Brand QA

**Activar si:** git diff incluye archivos en `email-previews/`, o archivos con "outreach", "email", "leads" en el nombre.

Invocar agente `brand-voice:quality-assurance`. Solo reporte, no bloquea.

### Paso 4 [CONDICIONAL-CRÍTICO]: Security

**Activar si:** git diff incluye `.env`, archivos con "auth", "api", "key", "secret", o directorio `/api/`.

Invocar skill `security`.

**Umbral de bloqueo:** vulnerabilidad crítica (secreto expuesto, SQL injection, auth bypass).

**Si bloquea:**
```
🚨 STOP — Commit bloqueado por Security
Vulnerabilidad: [descripción]
```

### Resultado Final

Si todos los pasos críticos pasan:
```
✅ COMMIT AUTORIZADO
Checks pasados: [lista]
Puedes ejecutar: git commit -m "..."
```
```

- [ ] **Step 2: Verificar**

```bash
head -5 "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company/.claude/skills/deploy-qa.md"
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
git add -A
git commit -m "feat(app): agregar skill /deploy-qa con pipeline pre-commit"
```

---

### Task 12: Actualizar `The Agentic Company/CLAUDE.md`

**Files:**
- Modify: `C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company/CLAUDE.md`

- [ ] **Step 1: Leer el CLAUDE.md actual**

Leer el archivo para entender su estructura y encontrar el lugar correcto para agregar.

- [ ] **Step 2: Agregar sección de Auto-Invocación**

Agregar al final del archivo (antes de la última sección o al final):

```markdown
## Auto-Invocación de Agentes (OBLIGATORIO)

Claude invoca estos agentes automáticamente — sin que el usuario lo pida:

| Situación | Agentes a invocar |
|-----------|------------------|
| Modificar workflow n8n o script de automatización | `ai-ml-toolkit:mlops-engineer` |
| Diseñar o revisar arquitectura AI/ML | `ai-ml-toolkit:ai-engineer` |
| Generar email de outreach o propuesta comercial | `brand-voice:conversation-analysis` + `brand-voice:document-analysis` |
| Revisar lógica de scoring o leads | `ai-ml-toolkit:ml-engineer` |
| Código con texto, NLP, o procesamiento de lenguaje | `ai-ml-toolkit:nlp-engineer` |

**Invocar como subagentes con el Agent tool** usando los `subagent_type` exactos del mapeo en la spec.

## Slash Commands Disponibles

- `/ml-review` — Revisión arquitectura AI/ML (ai-engineer + ml-engineer)
- `/mlops-check` — Revisión workflows n8n + infraestructura
- `/brand-check` — Revisión voz Felipe en outreach y propuestas
- `/deploy-qa` — Pipeline pre-commit con STOP crítico
```

- [ ] **Step 3: Verificar que el CLAUDE.md sigue siendo válido**

```bash
head -10 "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company/CLAUDE.md"
```

- [ ] **Step 4: Commit final**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
git add -A
git commit -m "feat(app): agregar auto-invocación de agentes al CLAUDE.md principal"
```

---

## Verificación Final del Sistema

### Task 13: Smoke Test End-to-End

- [ ] **Test 1: Dispatcher desde Landing Page**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/Landing Page"
node "C:/Users/Dell 5520/.claude/hooks/agent-dispatcher.js"
```
Expected: output con `proyecto=landing-page`

- [ ] **Test 2: Dispatcher desde The Agentic Company**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
node "C:/Users/Dell 5520/.claude/hooks/agent-dispatcher.js"
```
Expected: output con `proyecto=agentic-company`

- [ ] **Test 3: Verificar skills Landing Page presentes**

```bash
ls "C:/Users/Dell 5520/Documents/AgenticWorkflows/Landing Page/.claude/skills/"
```
Expected: `seo-audit.md  brand-check.md  deploy-qa.md`

- [ ] **Test 4: Verificar skills App presentes**

```bash
ls "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company/.claude/skills/" | grep -E "ml-review|mlops-check|brand-check|deploy-qa"
```
Expected: los 4 archivos nuevos presentes

- [ ] **Test 5: Verificar settings.json tiene 2 hooks SessionStart**

```bash
node -e "const s=require('C:/Users/Dell 5520/.claude/settings.json'); console.log('SessionStart hooks:', s.hooks.SessionStart.length)"
```
Expected: `SessionStart hooks: 2`

- [ ] **Test 6: Verificar voz de Felipe global**

```bash
head -3 "C:/Users/Dell 5520/.claude/CLAUDE.md"
```
Expected: `# Voz de Felipe`

- [ ] **Step final: Commit de verificación**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
git add -A
git commit -m "chore: smoke tests completados — Sistema de Agentes Sisteco v1.0 operativo"
```

---

## Notas de Implementación

**Tokens del dispatcher:** El output del dispatcher es ~60-80 tokens. No afecta el context budget de manera significativa.

**Agentes en paralelo:** Siempre despachar múltiples agentes en la misma llamada usando múltiples bloques `Agent tool` en un solo mensaje. Esto maximiza eficiencia.

**AutoResearch:** Activar con `AUTORESEARCH_ENABLED=true` en `.env` cuando llegue el primer cliente pagante. Zero cambios de código.

**Skill files vs CLAUDE.md:** Los skills son invocados explícitamente por el usuario. Las reglas del CLAUDE.md son seguidas automáticamente por Claude. Los triggers de auto-invocación van en CLAUDE.md, los protocolos detallados van en skills.

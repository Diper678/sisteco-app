# Sisteco AutoResearch — Cold Email Module Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the autoresearch framework core + cold email optimization module that runs autonomously via GitHub Actions, A/B testing email copy against Instantly.ai metrics.

**Architecture:** A Node.js framework with 5 core scripts (harvest, analyze, deploy, notify, validate) orchestrated by 3 GitHub Actions workflows. Claude Code CLI generates challengers by reading program.md + accumulated knowledge. Instantly.ai API handles campaign creation and metric collection.

**Tech Stack:** Node.js 20, GitHub Actions, Instantly.ai API, Gemini 2.5 Flash API, Discord Webhooks, Claude Code CLI (`anthropics/claude-code-action@beta`)

**Spec:** `docs/superpowers/specs/2026-03-12-sisteco-autoresearch-design.md`

---

## File Map

### New Files (Create)

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies: dotenv |
| `.env.example` | Template with all required env vars |
| `.gitignore` | Node modules, .env, run logs |
| `framework/utils.js` | TSV parser, logger, run ID generator, config loader |
| `framework/harvest.js` | Fetch metrics from Instantly API per module |
| `framework/analyze.js` | Gemini Flash: compare baseline vs challenger, z-test |
| `framework/deploy.js` | Create Instantly campaigns via API |
| `framework/notify.js` | Discord webhook embeds |
| `framework/validate.js` | Verify challenger meets program.md constraints |
| `modules/cold-email/program.md` | Brief for Claude: goal, constraints, examples |
| `modules/cold-email/baseline.md` | Current email copy (the champion) |
| `modules/cold-email/challenger.md` | Generated copy (the challenger) — initially empty |
| `modules/cold-email/config.json` | Instantly API config, metrics, thresholds |
| `modules/cold-email/results.tsv` | Experiment log (header only initially) |
| `data/leads-pool.csv` | Lead pool for experiments (header + sample) |
| `knowledge/global-learnings.md` | Cross-module patterns (initially empty) |
| `knowledge/per-module/cold-email.md` | Cold email learnings (initially empty) |
| `.github/workflows/harvest-analyze.yml` | Cron every 4h: harvest + analyze |
| `.github/workflows/generate-challenger.yml` | Post-harvest: Claude Code generates |
| `.github/workflows/deploy-experiment.yml` | Post-generate: deploy + notify |
| `tests/utils.test.js` | Tests for TSV parser, run ID, config loader |
| `tests/analyze.test.js` | Tests for z-test, winner determination |
| `tests/validate.test.js` | Tests for constraint validation |
| `tests/notify.test.js` | Tests for Discord embed formatting |

---

## Chunk 1: Project Scaffolding + Framework Utils

### Task 1: Initialize repo and package.json

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create project directory and init**

This is a NEW repo, separate from The Agentic Company. Create it at a sibling directory.

```bash
mkdir -p "/c/Users/Dell 5520/Documents/AgenticWorkflows/sisteco-autoresearch"
cd "/c/Users/Dell 5520/Documents/AgenticWorkflows/sisteco-autoresearch"
git init
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "sisteco-autoresearch",
  "version": "1.0.0",
  "description": "Autonomous experimentation framework for Sisteco B2B sales optimization",
  "type": "module",
  "scripts": {
    "harvest": "node framework/harvest.js",
    "analyze": "node framework/analyze.js",
    "deploy": "node framework/deploy.js",
    "notify": "node framework/notify.js",
    "test": "node --test tests/*.test.js",
    "dry-run": "node framework/harvest.js --dry-run && node framework/analyze.js --dry-run"
  },
  "dependencies": {
    "dotenv": "^17.3.1"
  },
  "devDependencies": {},
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 3: Create .env.example**

```bash
# === Instantly.ai (Cold Email) ===
INSTANTLY_API_KEY=your_instantly_api_key

# === AI Models ===
GEMINI_API_KEY=your_gemini_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# === Notifications ===
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# === n8n (Lead Scoring module — future) ===
N8N_API_KEY=your_n8n_api_key
N8N_BASE_URL=https://primary-yelp-production.up.railway.app

# === Vercel (Landing Copy module — future) ===
VERCEL_TOKEN=your_vercel_token

# === Convex (Lead Scoring module — future) ===
CONVEX_DEPLOY_KEY=your_convex_key
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
.env
run.log
*.log
.DS_Store
# AutoResearch state files (generated at runtime)
.harvest-state.json
.deploy-state.json
.failures
modules/*/.harvest-state.json
modules/*/.deploy-state.json
modules/*/.failures
```

- [ ] **Step 5: Install dependencies and commit**

```bash
npm install
git add package.json package-lock.json .env.example .gitignore
git commit -m "chore: initialize sisteco-autoresearch project"
```

---

### Task 2: Build framework/utils.js (TDD)

**Files:**
- Create: `tests/utils.test.js`
- Create: `framework/utils.js`

- [ ] **Step 1: Write failing tests for utils**

```js
// tests/utils.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRunId,
  parseTsv,
  appendTsv,
  loadModuleConfig,
  formatTimestamp
} from '../framework/utils.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('generateRunId', () => {
  it('returns a string of format YYYYMMDD-HHMMSS-XXXX', () => {
    const id = generateRunId();
    assert.match(id, /^\d{8}-\d{6}-[a-z0-9]{4}$/);
  });

  it('generates unique IDs', () => {
    const a = generateRunId();
    const b = generateRunId();
    assert.notEqual(a, b);
  });
});

describe('parseTsv', () => {
  it('parses a TSV string into array of objects', () => {
    const tsv = 'run_id\treply_rate\tstatus\n001\t0.024\tbaseline\n002\t0.031\tkeep';
    const rows = parseTsv(tsv);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].run_id, '001');
    assert.equal(rows[0].reply_rate, '0.024');
    assert.equal(rows[1].status, 'keep');
  });

  it('returns empty array for header-only TSV', () => {
    const tsv = 'run_id\treply_rate\tstatus';
    const rows = parseTsv(tsv);
    assert.equal(rows.length, 0);
  });

  it('handles empty string', () => {
    const rows = parseTsv('');
    assert.equal(rows.length, 0);
  });
});

describe('appendTsv', () => {
  it('appends a row to an existing TSV file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsv-'));
    const filePath = path.join(tmpDir, 'results.tsv');
    fs.writeFileSync(filePath, 'run_id\treply_rate\tstatus\n');

    appendTsv(filePath, { run_id: '001', reply_rate: '0.024', status: 'baseline' });

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    assert.equal(lines.length, 2);
    assert.ok(lines[1].includes('001'));

    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('loadModuleConfig', () => {
  it('loads and parses a module config.json', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-'));
    const configPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      module: 'cold-email',
      provider: 'instantly'
    }));

    const config = loadModuleConfig(tmpDir);
    assert.equal(config.module, 'cold-email');
    assert.equal(config.provider, 'instantly');

    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('formatTimestamp', () => {
  it('formats a date as Chile timezone string', () => {
    const ts = formatTimestamp(new Date('2026-03-12T15:00:00Z'));
    assert.ok(typeof ts === 'string');
    assert.ok(ts.length > 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/utils.test.js
```
Expected: FAIL — module `../framework/utils.js` not found

- [ ] **Step 3: Implement utils.js**

```js
// framework/utils.js
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Generate a unique run ID: YYYYMMDD-HHMMSS-XXXX
 */
export function generateRunId() {
  const now = new Date();
  const date = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const rand = crypto.randomBytes(2).toString('hex');
  return `${date.slice(0, 8)}-${date.slice(8, 14)}-${rand}`;
}

/**
 * Parse a TSV string into an array of objects using header row as keys.
 */
export function parseTsv(tsvString) {
  const lines = tsvString.trim().split('\n').filter(l => l.length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const values = line.split('\t');
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

/**
 * Append a row to a TSV file. Row is an object matching the header columns.
 */
export function appendTsv(filePath, row) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const headers = content.trim().split('\n')[0].split('\t');
  const values = headers.map(h => row[h] ?? '');
  fs.appendFileSync(filePath, values.join('\t') + '\n');
}

/**
 * Load a module's config.json from its directory.
 */
export function loadModuleConfig(moduleDir) {
  const configPath = path.join(moduleDir, 'config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

/**
 * Format a Date as a Chile-timezone string.
 */
export function formatTimestamp(date = new Date()) {
  return date.toLocaleString('es-CL', { timeZone: 'America/Santiago' });
}

/**
 * Read a module's results.tsv and return parsed rows.
 */
export function readResults(moduleDir) {
  const resultsPath = path.join(moduleDir, 'results.tsv');
  if (!fs.existsSync(resultsPath)) return [];
  return parseTsv(fs.readFileSync(resultsPath, 'utf-8'));
}

/**
 * Get the path to a module directory.
 */
export function modulePath(moduleName) {
  return path.join(process.cwd(), 'modules', moduleName);
}

/**
 * Parse frontmatter from a markdown file.
 * Returns { meta: {}, body: string } or null if no frontmatter.
 * Shared by validate.js and deploy.js (DRY).
 */
export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;

  const meta = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return { meta, body: match[2].trim() };
}

/**
 * Simple logger with timestamps.
 */
export const log = {
  info: (msg) => console.log(`[${formatTimestamp()}] INFO: ${msg}`),
  warn: (msg) => console.warn(`[${formatTimestamp()}] WARN: ${msg}`),
  error: (msg) => console.error(`[${formatTimestamp()}] ERROR: ${msg}`),
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test tests/utils.test.js
```
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add framework/utils.js tests/utils.test.js
git commit -m "feat: add framework utils — TSV parser, run ID generator, config loader"
```

---

## Chunk 2: Cold Email Module Content

### Task 3: Create cold email module files

**Files:**
- Create: `modules/cold-email/program.md`
- Create: `modules/cold-email/baseline.md`
- Create: `modules/cold-email/challenger.md`
- Create: `modules/cold-email/config.json`
- Create: `modules/cold-email/results.tsv`
- Create: `data/leads-pool.csv`
- Create: `knowledge/global-learnings.md`
- Create: `knowledge/per-module/cold-email.md`

- [ ] **Step 1: Create program.md**

```markdown
## Cold Email Optimizer — Sisteco B2B Chile

**Goal:** Maximizar reply_rate de emails fríos B2B dirigidos a empresas medianas chilenas (50+ empleados).

**Producto:** Sisteco — plataforma de automatización de ventas B2B.
**Propuesta de valor:** Infraestructura inteligente que genera 5-7x más conversiones vs stack DIY.

### Tu Rol

Eres el controlador de un lazo de optimización continua. Tu trabajo:
1. Leer `results.tsv` para entender qué se ha probado y qué funcionó
2. Leer `knowledge/per-module/cold-email.md` para learnings acumulados
3. Leer `baseline.md` para ver el copy actual (el campeón)
4. Generar un nuevo `challenger.md` que modifique UNA variable del baseline
5. Explicar tu hipótesis en el commit message

### Variables que puedes modificar (una por challenger)
- **Subject line** — el asunto del email
- **Hook** — la primera oración (por qué le escribo)
- **Body** — el cuerpo del mensaje
- **CTA** — el call-to-action final
- **PS line** — línea post-firma (opcional)

### Constraints (NUNCA violar)
- Máximo 100 palabras por email
- Subject line ≤ 8 palabras
- DEBE incluir CTA con día/hora específica (ej: "¿el jueves a las 10?")
- NUNCA inventar métricas, testimonios o estadísticas
- NUNCA mencionar IA, Claude, o herramientas internas
- Idioma: español Chile (tutear, natural, sin jerga gringa)
- DEBE incluir opt-out: "Si no quieres recibir más emails, responde SALIR"
- Tono: profesional pero directo, como un colega que sabe algo útil

### Métricas (prioridad)
1. `reply_rate` — PRIMARY (higher is better)
2. `open_rate` — SECONDARY (indica calidad del subject)
3. `bounce_rate` — CONSTRAINT (must stay < 5%)

### Formato de challenger.md

```
---
subject: [subject line aquí]
variable_changed: [subject|hook|body|cta|ps_line]
hypothesis: [1 oración explicando por qué esto debería ganar]
---

[Cuerpo del email aquí. Usar {nombre} y {empresa} como placeholders.]
```

### Ejemplo de baseline exitoso

Subject: Pregunta rápida sobre {empresa}
Variable: hook personalizado por industria
Hypothesis: Mencionar la industria del lead genera relevancia inmediata

Hola {nombre},

Vi que {empresa} está en [industria] — justo el tipo de empresa donde Sisteco genera más impacto.

Ayudamos a equipos de venta B2B a conseguir 5-7x más conversiones automatizando el pipeline completo: desde el primer contacto hasta el cierre.

¿Te sirve una llamada de 15 min el jueves a las 10 para ver si aplica?

Un saludo,
Sebastián
Sisteco — Menos leads, más cierres

PD: Si no quieres recibir más emails, responde SALIR.
```

- [ ] **Step 2: Create baseline.md**

```markdown
---
subject: Pregunta rápida sobre {empresa}
variable_changed: initial
hypothesis: Baseline inicial — subject con nombre de empresa genera curiosidad
---

Hola {nombre},

Vi que {empresa} está creciendo en su industria — justo el tipo de empresa donde Sisteco genera más impacto.

Ayudamos a equipos de venta B2B a conseguir 5-7x más conversiones automatizando el pipeline completo: desde el primer contacto hasta el cierre.

¿Te sirve una llamada de 15 min el jueves a las 10 para ver si aplica?

Un saludo,
Sebastián
Sisteco — Menos leads, más cierres

PD: Si no quieres recibir más emails, responde SALIR.
```

- [ ] **Step 3: Create challenger.md (empty placeholder)**

```markdown
---
subject:
variable_changed:
hypothesis:
---

(Pending — will be generated by Claude Code on first run)
```

- [ ] **Step 4: Create config.json**

```json
{
  "module": "cold-email",
  "provider": "instantly",
  "api": {
    "base_url": "https://api.instantly.ai/api/v2",
    "auth_env": "INSTANTLY_API_KEY"
  },
  "experiment": {
    "leads_per_variant": 200,
    "split_ratio": 0.5,
    "min_sample_size": 200,
    "wait_hours": 72,
    "significance_level": 0.05
  },
  "circuit_breaker": {
    "max_consecutive_failures": 3,
    "paused": false
  },
  "metrics": {
    "primary": "reply_rate",
    "secondary": ["open_rate"],
    "constraints": {
      "bounce_rate": { "max": 0.05 }
    }
  },
  "notify": {
    "discord_env": "DISCORD_WEBHOOK_URL"
  }
}
```

- [ ] **Step 5: Create results.tsv (header only)**

```
run_id	reply_rate	open_rate	bounce_rate	sample_size	status	description
```

- [ ] **Step 6: Create leads-pool.csv (header + 3 sample rows)**

```csv
email,first_name,last_name,company,industry,position
demo1@example.com,Juan,Pérez,AcmeTech,Tecnología,Gerente Comercial
demo2@example.com,María,González,DataCorp,Servicios,Directora de Ventas
demo3@example.com,Carlos,Rodríguez,CloudSA,SaaS,VP Sales
```

> Note: Real leads will come from PhantomBuster pipeline. These are placeholders for testing.

- [ ] **Step 7: Create knowledge base initial files**

`knowledge/global-learnings.md`:
```markdown
# Global Learnings — Sisteco AutoResearch

> Patrones cross-módulo descubiertos por experimentación autónoma.
> Actualizado automáticamente cada 10 experimentos.

(No learnings yet — will accumulate as experiments run)
```

`knowledge/per-module/cold-email.md`:
```markdown
# Cold Email Learnings — B2B Chile

> Descubrimientos sobre qué funciona y qué no en cold email B2B Chile.
> Actualizado después de cada harvest.

## Lo que funciona
(Pending — will be populated after first experiments)

## Lo que NO funciona
(Pending)

## Hipótesis pendientes
- ¿Subject con pregunta vs afirmación?
- ¿Hook genérico vs personalizado por industria?
- ¿Email corto (< 50 palabras) vs medio (50-100)?
- ¿CTA con día específico vs "esta semana"?
```

- [ ] **Step 8: Commit**

```bash
git add modules/ data/ knowledge/
git commit -m "feat: add cold email module content — program.md, baseline, config, knowledge base"
```

---

## Chunk 3: Analyze + Validate (Core Logic with TDD)

### Task 4: Build framework/analyze.js (TDD)

**Files:**
- Create: `tests/analyze.test.js`
- Create: `framework/analyze.js`

- [ ] **Step 1: Write failing tests for z-test and analysis**

```js
// tests/analyze.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { zTestProportions, determineWinner, hasEnoughData } from '../framework/analyze.js';

describe('zTestProportions', () => {
  it('returns significant when proportions differ enough', () => {
    // 5% vs 2% with 200 samples each — clearly significant
    const result = zTestProportions(10, 200, 4, 200);
    assert.ok(result.significant);
    assert.ok(result.pValue < 0.05);
  });

  it('returns not significant for similar proportions', () => {
    // 2.5% vs 2.4% with 200 samples — too close
    const result = zTestProportions(5, 200, 5, 200);
    assert.ok(!result.significant);
  });

  it('handles zero successes', () => {
    const result = zTestProportions(0, 200, 5, 200);
    assert.ok(typeof result.significant === 'boolean');
  });
});

describe('determineWinner', () => {
  it('returns CHALLENGER_WINS when challenger is significantly better', () => {
    const baseline = { reply_rate: 0.024, sample_size: 200 };
    const challenger = { reply_rate: 0.05, sample_size: 200 };
    const result = determineWinner(baseline, challenger, 'reply_rate', 0.05);
    assert.equal(result.verdict, 'CHALLENGER_WINS');
  });

  it('returns BASELINE_HOLDS when no significant difference', () => {
    const baseline = { reply_rate: 0.024, sample_size: 200 };
    const challenger = { reply_rate: 0.025, sample_size: 200 };
    const result = determineWinner(baseline, challenger, 'reply_rate', 0.05);
    assert.equal(result.verdict, 'BASELINE_HOLDS');
  });

  it('returns BASELINE_HOLDS when challenger is worse', () => {
    const baseline = { reply_rate: 0.05, sample_size: 200 };
    const challenger = { reply_rate: 0.02, sample_size: 200 };
    const result = determineWinner(baseline, challenger, 'reply_rate', 0.05);
    assert.equal(result.verdict, 'BASELINE_HOLDS');
  });
});

describe('hasEnoughData', () => {
  it('returns true when both variants meet minimum sample size', () => {
    assert.ok(hasEnoughData(200, 200, 200));
  });

  it('returns false when either variant is below minimum', () => {
    assert.ok(!hasEnoughData(100, 200, 200));
    assert.ok(!hasEnoughData(200, 100, 200));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/analyze.test.js
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement analyze.js**

```js
// framework/analyze.js
import { readResults, loadModuleConfig, modulePath, appendTsv, generateRunId, log } from './utils.js';
import fs from 'fs';
import path from 'path';

/**
 * Two-proportion z-test.
 * Returns { zScore, pValue, significant }
 */
export function zTestProportions(successes1, n1, successes2, n2, alpha = 0.05) {
  const p1 = successes1 / n1;
  const p2 = successes2 / n2;
  const pPooled = (successes1 + successes2) / (n1 + n2);
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / n1 + 1 / n2));

  if (se === 0) return { zScore: 0, pValue: 1, significant: false };

  const z = (p1 - p2) / se;
  // Approximate two-tailed p-value using normal CDF
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));

  return { zScore: z, pValue, significant: pValue < alpha };
}

/**
 * Standard normal CDF approximation (Abramowitz & Stegun).
 */
function normalCdf(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

/**
 * Determine winner between baseline and challenger.
 */
export function determineWinner(baseline, challenger, metricKey, alpha = 0.05) {
  const bRate = Number(baseline[metricKey]);
  const cRate = Number(challenger[metricKey]);
  const bN = Number(baseline.sample_size);
  const cN = Number(challenger.sample_size);

  const bSuccesses = Math.round(bRate * bN);
  const cSuccesses = Math.round(cRate * cN);

  const test = zTestProportions(cSuccesses, cN, bSuccesses, bN, alpha);

  if (test.significant && cRate > bRate) {
    return { verdict: 'CHALLENGER_WINS', pValue: test.pValue, delta: cRate - bRate };
  }
  return { verdict: 'BASELINE_HOLDS', pValue: test.pValue, delta: cRate - bRate };
}

/**
 * Check if both variants have enough data for analysis.
 */
export function hasEnoughData(baselineN, challengerN, minSampleSize) {
  return baselineN >= minSampleSize && challengerN >= minSampleSize;
}

/**
 * Main analyze function — called from CLI.
 * Reads harvest data from a module state file, runs analysis, logs result.
 */
export async function analyzeModule(moduleName) {
  const modPath = modulePath(moduleName);
  const config = loadModuleConfig(modPath);
  const stateFile = path.join(modPath, '.harvest-state.json');

  if (!fs.existsSync(stateFile)) {
    log.info(`[${moduleName}] No harvest state — skipping analysis`);
    return null;
  }

  const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));

  if (!hasEnoughData(
    state.baseline_sample_size,
    state.challenger_sample_size,
    config.experiment.min_sample_size
  )) {
    log.info(`[${moduleName}] Insufficient data (baseline: ${state.baseline_sample_size}, challenger: ${state.challenger_sample_size}, need: ${config.experiment.min_sample_size})`);
    return { module: moduleName, verdict: 'INSUFFICIENT_DATA' };
  }

  const baseline = {
    [config.metrics.primary]: state.baseline_metrics[config.metrics.primary],
    sample_size: state.baseline_sample_size,
  };
  const challenger = {
    [config.metrics.primary]: state.challenger_metrics[config.metrics.primary],
    sample_size: state.challenger_sample_size,
  };

  const result = determineWinner(baseline, challenger, config.metrics.primary, config.experiment.significance_level);

  // Log to results.tsv
  const runId = generateRunId();
  appendTsv(path.join(modPath, 'results.tsv'), {
    run_id: runId,
    reply_rate: String(challenger[config.metrics.primary]),
    open_rate: String(state.challenger_metrics.open_rate || ''),
    bounce_rate: String(state.challenger_metrics.bounce_rate || ''),
    sample_size: String(state.challenger_sample_size),
    status: result.verdict === 'CHALLENGER_WINS' ? 'keep' : 'discard',
    description: state.challenger_description || '',
  });

  // If challenger wins, promote to baseline
  if (result.verdict === 'CHALLENGER_WINS') {
    const baselinePath = path.join(modPath, 'baseline.md');
    const challengerPath = path.join(modPath, 'challenger.md');
    const prevPath = path.join(modPath, 'baseline.prev.md');

    // Save current baseline as prev
    if (fs.existsSync(baselinePath)) {
      fs.copyFileSync(baselinePath, prevPath);
    }
    // Promote challenger to baseline
    fs.copyFileSync(challengerPath, baselinePath);
    log.info(`[${moduleName}] CHALLENGER WINS — promoted to baseline (Δ${(result.delta * 100).toFixed(2)}%)`);
  } else {
    log.info(`[${moduleName}] BASELINE HOLDS (p=${result.pValue.toFixed(4)})`);
  }

  // Clean up harvest state
  fs.unlinkSync(stateFile);

  return { module: moduleName, ...result, runId };
}

// CLI entry point — ESM-safe guard
const __isCliAnalyze = import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('analyze.js');
if (__isCliAnalyze) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const modules = args.includes('--all')
    ? ['cold-email']
    : args.filter(a => !a.startsWith('--'));

  if (dryRun) {
    log.info('DRY RUN — no files will be modified');
  }

  for (const mod of modules) {
    const result = await analyzeModule(mod);
    if (result) log.info(`[${mod}] Result: ${JSON.stringify(result)}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test tests/analyze.test.js
```
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add framework/analyze.js tests/analyze.test.js
git commit -m "feat: add analyze module — z-test for proportions, winner determination"
```

---

### Task 5: Build framework/validate.js (TDD)

**Files:**
- Create: `tests/validate.test.js`
- Create: `framework/validate.js`

- [ ] **Step 1: Write failing tests for validation**

```js
// tests/validate.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateChallenger } from '../framework/validate.js';

const validChallenger = `---
subject: Pregunta sobre {empresa}
variable_changed: subject
hypothesis: Subject más corto genera más aperturas
---

Hola {nombre},

Vi que {empresa} está creciendo. Sisteco ayuda a empresas como la tuya a automatizar ventas B2B.

¿Hablamos el jueves a las 10?

Sebastián

PD: Si no quieres recibir más emails, responde SALIR.`;

describe('validateChallenger', () => {
  it('passes for a valid challenger', () => {
    const result = validateChallenger(validChallenger);
    assert.ok(result.valid);
    assert.equal(result.errors.length, 0);
  });

  it('fails if subject is too long (> 8 words)', () => {
    const bad = validChallenger.replace(
      'subject: Pregunta sobre {empresa}',
      'subject: Esta es una línea de asunto muy larga que excede el límite'
    );
    const result = validateChallenger(bad);
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('subject')));
  });

  it('fails if body exceeds 100 words', () => {
    const longBody = 'palabra '.repeat(110);
    const bad = validChallenger.replace(
      'Vi que {empresa} está creciendo. Sisteco ayuda a empresas como la tuya a automatizar ventas B2B.',
      longBody
    );
    const result = validateChallenger(bad);
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('100')));
  });

  it('fails if opt-out is missing', () => {
    const bad = validChallenger.replace('PD: Si no quieres recibir más emails, responde SALIR.', '');
    const result = validateChallenger(bad);
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.toLowerCase().includes('opt-out') || e.toLowerCase().includes('salir')));
  });

  it('fails if no frontmatter', () => {
    const bad = 'Just a plain email without frontmatter';
    const result = validateChallenger(bad);
    assert.ok(!result.valid);
  });

  it('fails if variable_changed is missing', () => {
    const bad = validChallenger.replace('variable_changed: subject', 'variable_changed:');
    const result = validateChallenger(bad);
    assert.ok(!result.valid);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/validate.test.js
```
Expected: FAIL

- [ ] **Step 3: Implement validate.js**

```js
// framework/validate.js
import { parseFrontmatter } from './utils.js';

/**
 * Validate a challenger.md file against cold email constraints.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateChallenger(content) {
  const errors = [];

  const parsed = parseFrontmatter(content);
  if (!parsed) {
    return { valid: false, errors: ['Missing frontmatter (---...--- block)'] };
  }

  const { meta, body } = parsed;

  // Check required frontmatter fields
  if (!meta.subject || meta.subject.trim().length === 0) {
    errors.push('Missing or empty subject in frontmatter');
  }
  if (!meta.variable_changed || meta.variable_changed.trim().length === 0) {
    errors.push('Missing or empty variable_changed in frontmatter');
  }
  if (!meta.hypothesis || meta.hypothesis.trim().length === 0) {
    errors.push('Missing or empty hypothesis in frontmatter');
  }

  // Subject ≤ 8 words
  if (meta.subject) {
    const wordCount = meta.subject.trim().split(/\s+/).length;
    if (wordCount > 8) {
      errors.push(`subject exceeds 8 words (has ${wordCount})`);
    }
  }

  // Body ≤ 100 words
  const bodyWords = body.split(/\s+/).filter(w => w.length > 0).length;
  if (bodyWords > 100) {
    errors.push(`Body exceeds 100 words (has ${bodyWords})`);
  }

  // Must include opt-out
  const lowerBody = body.toLowerCase();
  if (!lowerBody.includes('salir') && !lowerBody.includes('opt-out') && !lowerBody.includes('desuscribir')) {
    errors.push('Missing opt-out/SALIR clause (Ley 21.719 compliance)');
  }

  // Valid variable_changed values
  const validVars = ['subject', 'hook', 'body', 'cta', 'ps_line', 'initial'];
  if (meta.variable_changed && !validVars.includes(meta.variable_changed.trim())) {
    errors.push(`Invalid variable_changed: "${meta.variable_changed}" — must be one of: ${validVars.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test tests/validate.test.js
```
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add framework/validate.js tests/validate.test.js
git commit -m "feat: add challenger validation — word count, subject, opt-out, frontmatter"
```

---

## Chunk 4: Harvest + Deploy + Notify (API Integrations)

### Task 6: Build framework/harvest.js

**Files:**
- Create: `framework/harvest.js`

- [ ] **Step 1: Implement harvest.js**

```js
// framework/harvest.js
import { loadModuleConfig, modulePath, log } from './utils.js';
import fs from 'fs';
import path from 'path';

/**
 * Fetch campaign analytics from Instantly API.
 * Docs: https://developer.instantly.ai/api
 */
async function harvestInstantly(config) {
  const apiKey = process.env[config.api.auth_env];
  if (!apiKey) throw new Error(`Missing env var: ${config.api.auth_env}`);

  const baseUrl = config.api.base_url;

  // List campaigns to find baseline and challenger
  // Instantly API v2 uses Bearer token auth (not query param)
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const res = await fetch(`${baseUrl}/campaigns?limit=10`, { headers });

  if (!res.ok) throw new Error(`Instantly API error: ${res.status} ${await res.text()}`);
  const campaigns = await res.json();

  // Find campaigns tagged with autoresearch
  const baseline = campaigns.data?.find(c => c.name?.includes('[AR-baseline]'));
  const challenger = campaigns.data?.find(c => c.name?.includes('[AR-challenger]'));

  if (!baseline || !challenger) {
    log.info('No active A/B campaigns found — skipping');
    return null;
  }

  // Get analytics for each
  const [baselineStats, challengerStats] = await Promise.all([
    fetchCampaignStats(baseUrl, apiKey, baseline.id),
    fetchCampaignStats(baseUrl, apiKey, challenger.id),
  ]);

  return {
    baseline_metrics: baselineStats,
    baseline_sample_size: baselineStats.total_sent || 0,
    challenger_metrics: challengerStats,
    challenger_sample_size: challengerStats.total_sent || 0,
    challenger_description: challenger.name?.replace('[AR-challenger] ', '') || '',
    harvested_at: new Date().toISOString(),
  };
}

async function fetchCampaignStats(baseUrl, apiKey, campaignId) {
  const res = await fetch(`${baseUrl}/campaigns/${campaignId}/analytics`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Stats error for ${campaignId}: ${res.status}`);
  const data = await res.json();

  const sent = data.total_sent || 0;
  return {
    total_sent: sent,
    reply_rate: sent > 0 ? (data.total_replies || 0) / sent : 0,
    open_rate: sent > 0 ? (data.total_opened || 0) / sent : 0,
    bounce_rate: sent > 0 ? (data.total_bounced || 0) / sent : 0,
  };
}

/**
 * Main harvest function for a module.
 */
export async function harvestModule(moduleName) {
  const modPath = modulePath(moduleName);
  const config = loadModuleConfig(modPath);

  // Check circuit breaker
  if (config.circuit_breaker?.paused) {
    log.warn(`[${moduleName}] Circuit breaker PAUSED — skipping`);
    return null;
  }

  // Check 72h elapsed since last deploy before harvesting (B2B replies take 3-5 days)
  const deployStateFile = path.join(modPath, '.deploy-state.json');
  if (fs.existsSync(deployStateFile)) {
    const deployState = JSON.parse(fs.readFileSync(deployStateFile, 'utf-8'));
    const deployedAt = new Date(deployState.deployed_at);
    const hoursElapsed = (Date.now() - deployedAt.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed < config.experiment.wait_hours) {
      log.info(`[${moduleName}] Only ${hoursElapsed.toFixed(1)}h since deploy (need ${config.experiment.wait_hours}h) — skipping`);
      return null;
    }
  }

  let state;
  try {
    if (config.provider === 'instantly') {
      state = await harvestInstantly(config);
    } else {
      log.warn(`[${moduleName}] Unknown provider: ${config.provider}`);
      return null;
    }
  } catch (err) {
    log.error(`[${moduleName}] Harvest failed: ${err.message}`);
    // Track consecutive failures for circuit breaker
    const failPath = path.join(modPath, '.failures');
    const failures = fs.existsSync(failPath) ? Number(fs.readFileSync(failPath, 'utf-8')) + 1 : 1;
    fs.writeFileSync(failPath, String(failures));

    if (failures >= config.circuit_breaker.max_consecutive_failures) {
      config.circuit_breaker.paused = true;
      fs.writeFileSync(path.join(modPath, 'config.json'), JSON.stringify(config, null, 2));
      log.error(`[${moduleName}] CIRCUIT BREAKER TRIPPED after ${failures} failures`);
    }
    return null;
  }

  if (!state) return null;

  // Reset failure counter on success
  const failPath = path.join(modPath, '.failures');
  if (fs.existsSync(failPath)) fs.unlinkSync(failPath);

  // Write harvest state for analyze.js to consume
  const stateFile = path.join(modPath, '.harvest-state.json');
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  log.info(`[${moduleName}] Harvest complete — baseline: ${state.baseline_sample_size} sent, challenger: ${state.challenger_sample_size} sent`);

  return state;
}

// CLI entry point — ESM-safe guard
const __isCliHarvest = import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('harvest.js');
if (__isCliHarvest) {
  const { config: dotenvConfig } = await import('dotenv');
  dotenvConfig();

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const modules = args.includes('--all')
    ? ['cold-email']
    : args.filter(a => !a.startsWith('--')).map(a => a.replace('--module=', '').replace('--module', '').trim()).filter(Boolean);

  if (modules.length === 0) modules.push('cold-email');

  for (const mod of modules) {
    if (dryRun) {
      log.info(`[DRY RUN] Would harvest: ${mod}`);
    } else {
      await harvestModule(mod);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add framework/harvest.js
git commit -m "feat: add harvest module — Instantly API integration with circuit breaker"
```

---

### Task 7: Build framework/deploy.js

**Files:**
- Create: `framework/deploy.js`

- [ ] **Step 1: Implement deploy.js**

```js
// framework/deploy.js
import { loadModuleConfig, modulePath, log, parseFrontmatter } from './utils.js';
import { validateChallenger } from './validate.js';
import fs from 'fs';
import path from 'path';

/**
 * Deploy A/B campaigns to Instantly.
 * Creates two campaigns: [AR-baseline] and [AR-challenger]
 */
async function deployInstantly(modPath, config) {
  const apiKey = process.env[config.api.auth_env];
  if (!apiKey) throw new Error(`Missing env var: ${config.api.auth_env}`);

  const baseUrl = config.api.base_url;

  // Read baseline and challenger content
  const baselineContent = fs.readFileSync(path.join(modPath, 'baseline.md'), 'utf-8');
  const challengerContent = fs.readFileSync(path.join(modPath, 'challenger.md'), 'utf-8');

  // Validate challenger before deploying
  const validation = validateChallenger(challengerContent);
  if (!validation.valid) {
    throw new Error(`Challenger validation failed: ${validation.errors.join('; ')}`);
  }

  // Parse email content from markdown
  const baselineEmail = parseEmailFromMd(baselineContent);
  const challengerEmail = parseEmailFromMd(challengerContent);

  // Read leads from pool
  const leadsPool = path.join(process.cwd(), 'data', 'leads-pool.csv');
  const leads = parseCsv(fs.readFileSync(leadsPool, 'utf-8'));
  const needed = config.experiment.leads_per_variant * 2;

  if (leads.length < needed) {
    throw new Error(`Not enough leads: need ${needed}, have ${leads.length}`);
  }

  // Split leads 50/50 — Fisher-Yates shuffle (unbiased)
  const shuffled = [...leads];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const baselineLeads = shuffled.slice(0, config.experiment.leads_per_variant);
  const challengerLeads = shuffled.slice(
    config.experiment.leads_per_variant,
    config.experiment.leads_per_variant * 2
  );

  // Create campaigns via Instantly API
  const [baselineCampaign, challengerCampaign] = await Promise.all([
    createInstantlyCampaign(baseUrl, apiKey, `[AR-baseline] ${baselineEmail.subject}`, baselineEmail, baselineLeads),
    createInstantlyCampaign(baseUrl, apiKey, `[AR-challenger] ${challengerEmail.subject}`, challengerEmail, challengerLeads),
  ]);

  log.info(`Deployed: baseline=${baselineCampaign.id}, challenger=${challengerCampaign.id}`);

  // Save deploy state
  const deployState = {
    deployed_at: new Date().toISOString(),
    baseline_campaign_id: baselineCampaign.id,
    challenger_campaign_id: challengerCampaign.id,
    leads_per_variant: config.experiment.leads_per_variant,
  };
  fs.writeFileSync(path.join(modPath, '.deploy-state.json'), JSON.stringify(deployState, null, 2));

  // Remove used leads from pool
  const usedEmails = new Set([...baselineLeads, ...challengerLeads].map(l => l.email));
  const remaining = leads.filter(l => !usedEmails.has(l.email));
  const header = 'email,first_name,last_name,company,industry,position';
  const csvContent = [header, ...remaining.map(l =>
    `${l.email},${l.first_name},${l.last_name},${l.company},${l.industry},${l.position}`
  )].join('\n');
  fs.writeFileSync(leadsPool, csvContent + '\n');
  log.info(`Leads pool: ${remaining.length} remaining (used ${needed})`);

  return deployState;
}

async function createInstantlyCampaign(baseUrl, apiKey, name, email, leads) {
  // Instantly API v2 uses Bearer token auth
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  // Create campaign
  const campRes = await fetch(`${baseUrl}/campaigns`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, subject: email.subject, body: email.body }),
  });
  if (!campRes.ok) throw new Error(`Create campaign failed: ${campRes.status}`);
  const campaign = await campRes.json();

  // Add leads to campaign
  const leadsRes = await fetch(`${baseUrl}/leads`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      campaign_id: campaign.id,
      leads: leads.map(l => ({
        email: l.email,
        first_name: l.first_name,
        last_name: l.last_name,
        company_name: l.company,
      })),
    }),
  });
  if (!leadsRes.ok) throw new Error(`Add leads failed: ${leadsRes.status}`);

  // Activate campaign
  const activateRes = await fetch(`${baseUrl}/campaigns/${campaign.id}/activate`, {
    method: 'POST',
    headers,
  });
  if (!activateRes.ok) log.warn(`Activate campaign warning: ${activateRes.status}`);

  return campaign;
}

function parseEmailFromMd(content) {
  const parsed = parseFrontmatter(content);
  if (!parsed) throw new Error('Invalid email markdown — missing frontmatter');
  return { subject: parsed.meta.subject || '', body: parsed.body };
}

function parseCsv(csvString) {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (values[i] || '').trim(); });
    return obj;
  });
}

/**
 * Main deploy function.
 */
export async function deployModule(moduleName) {
  const modPath = modulePath(moduleName);
  const config = loadModuleConfig(modPath);

  if (config.circuit_breaker?.paused) {
    log.warn(`[${moduleName}] Circuit breaker PAUSED — skipping deploy`);
    return null;
  }

  if (config.provider === 'instantly') {
    return deployInstantly(modPath, config);
  }

  log.warn(`[${moduleName}] Unknown provider: ${config.provider}`);
  return null;
}

// CLI entry point — ESM-safe guard
const __isCliDeploy = import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('deploy.js');
if (__isCliDeploy) {
  const { config: dotenvConfig } = await import('dotenv');
  dotenvConfig();

  const args = process.argv.slice(2);
  const modules = args.filter(a => !a.startsWith('--'));
  if (modules.length === 0) modules.push('cold-email');

  for (const mod of modules) {
    await deployModule(mod);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add framework/deploy.js
git commit -m "feat: add deploy module — Instantly campaign creation, lead splitting, validation gate"
```

---

### Task 8: Build framework/notify.js (TDD)

**Files:**
- Create: `tests/notify.test.js`
- Create: `framework/notify.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/notify.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildEmbed } from '../framework/notify.js';

describe('buildEmbed', () => {
  it('builds a CHALLENGER_WINS embed with green color', () => {
    const embed = buildEmbed({
      module: 'cold-email',
      verdict: 'CHALLENGER_WINS',
      delta: 0.015,
      pValue: 0.02,
      baselineMetric: 0.024,
      challengerMetric: 0.039,
      description: 'Hook personalizado por industria',
      runId: '20260312-100000-ab12',
    });
    assert.equal(embed.color, 0x00ff00);
    assert.ok(embed.title.includes('CHALLENGER WINS'));
    assert.ok(embed.description.includes('cold-email'));
  });

  it('builds a BASELINE_HOLDS embed with red color', () => {
    const embed = buildEmbed({
      module: 'cold-email',
      verdict: 'BASELINE_HOLDS',
      delta: -0.003,
      pValue: 0.45,
      baselineMetric: 0.024,
      challengerMetric: 0.021,
      description: 'Subject más corto',
      runId: '20260312-100000-ab12',
    });
    assert.equal(embed.color, 0xff4444);
    assert.ok(embed.title.includes('BASELINE HOLDS'));
  });

  it('builds an INSUFFICIENT_DATA embed with yellow color', () => {
    const embed = buildEmbed({
      module: 'cold-email',
      verdict: 'INSUFFICIENT_DATA',
    });
    assert.equal(embed.color, 0xffaa00);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/notify.test.js
```

- [ ] **Step 3: Implement notify.js**

```js
// framework/notify.js
import { log } from './utils.js';

/**
 * Build a Discord embed object for experiment results.
 */
export function buildEmbed(result) {
  const colors = {
    CHALLENGER_WINS: 0x00ff00,
    BASELINE_HOLDS: 0xff4444,
    INSUFFICIENT_DATA: 0xffaa00,
  };

  const icons = {
    CHALLENGER_WINS: '✅',
    BASELINE_HOLDS: '❌',
    INSUFFICIENT_DATA: '⏳',
  };

  const embed = {
    title: `${icons[result.verdict] || '🔬'} ${result.module} — ${result.verdict.replace(/_/g, ' ')}`,
    color: colors[result.verdict] || 0x888888,
    description: `Módulo: **${result.module}**`,
    fields: [],
    timestamp: new Date().toISOString(),
    footer: { text: 'Sisteco AutoResearch' },
  };

  if (result.verdict === 'CHALLENGER_WINS' || result.verdict === 'BASELINE_HOLDS') {
    embed.fields.push(
      { name: 'Baseline', value: `${(result.baselineMetric * 100).toFixed(2)}%`, inline: true },
      { name: 'Challenger', value: `${(result.challengerMetric * 100).toFixed(2)}%`, inline: true },
      { name: 'Delta', value: `${result.delta > 0 ? '+' : ''}${(result.delta * 100).toFixed(2)}%`, inline: true },
      { name: 'p-value', value: result.pValue.toFixed(4), inline: true },
      { name: 'Cambio', value: result.description || 'N/A', inline: false },
    );

    if (result.verdict === 'CHALLENGER_WINS') {
      embed.fields.push({ name: 'Acción', value: '🔄 Challenger promovido a nuevo baseline', inline: false });
    } else {
      embed.fields.push({ name: 'Acción', value: '🗑️ Challenger descartado', inline: false });
    }
  }

  if (result.runId) {
    embed.fields.push({ name: 'Run ID', value: `\`${result.runId}\``, inline: true });
  }

  return embed;
}

/**
 * Send a Discord webhook notification.
 */
export async function sendDiscordNotification(embed) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    log.warn('DISCORD_WEBHOOK_URL not set — skipping notification');
    return;
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'Sisteco AutoResearch',
      avatar_url: 'https://sisteco.cl/icon-sisteco.png',
      embeds: [embed],
    }),
  });

  if (!res.ok) {
    log.error(`Discord notification failed: ${res.status}`);
  } else {
    log.info('Discord notification sent');
  }
}

/**
 * Notify about all module results.
 */
export async function notifyAll(results) {
  for (const result of results) {
    if (!result) continue;
    const embed = buildEmbed(result);
    await sendDiscordNotification(embed);
  }
}

// CLI entry point — ESM-safe guard
const __isCliNotify = import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('notify.js');
if (__isCliNotify) {
  const { config: dotenvConfig } = await import('dotenv');
  dotenvConfig();

  log.info('Notify module ready — use via notifyAll() or import buildEmbed()');
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test tests/notify.test.js
```
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add framework/notify.js tests/notify.test.js
git commit -m "feat: add notify module — Discord webhook embeds for experiment results"
```

---

## Chunk 5: GitHub Actions Workflows

### Task 9: Create harvest-analyze workflow

**Files:**
- Create: `.github/workflows/harvest-analyze.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
# .github/workflows/harvest-analyze.yml
name: Harvest & Analyze

on:
  schedule:
    - cron: '0 */4 * * *'  # Every 4 hours
  workflow_dispatch:        # Manual trigger

jobs:
  harvest-analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Harvest metrics
        env:
          INSTANTLY_API_KEY: ${{ secrets.INSTANTLY_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: node framework/harvest.js --all

      - name: Analyze results
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: node framework/analyze.js --all

      - name: Commit results
        run: |
          git config user.name "sisteco-autoresearch[bot]"
          git config user.email "bot@sisteco.cl"
          git add -A
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            git commit -m "data: harvest & analyze $(date -u +%Y-%m-%d-%H%M)"
            git push
          fi

      - name: Trigger challenger generation
        if: success()
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.actions.createWorkflowDispatch({
              owner: context.repo.owner,
              repo: context.repo.repo,
              workflow_id: 'generate-challenger.yml',
              ref: 'main',
            });
```

- [ ] **Step 2: Commit**

```bash
mkdir -p .github/workflows
git add .github/workflows/harvest-analyze.yml
git commit -m "ci: add harvest-analyze workflow — cron every 4h"
```

---

### Task 10: Create generate-challenger workflow

**Files:**
- Create: `.github/workflows/generate-challenger.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
# .github/workflows/generate-challenger.yml
name: Generate Challenger

on:
  workflow_dispatch:

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate challenger via Claude Code
        uses: anthropics/claude-code-action@beta
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            You are the controller in a closed-loop optimization system for cold email B2B in Chile.

            READ these files carefully:
            1. modules/cold-email/program.md — your complete instructions
            2. modules/cold-email/results.tsv — history of all experiments
            3. modules/cold-email/baseline.md — current champion email
            4. knowledge/per-module/cold-email.md — accumulated learnings

            THEN:
            1. Analyze what has been tried and what worked
            2. Generate a new challenger by modifying ONE variable
            3. Write the result to modules/cold-email/challenger.md using the exact frontmatter format specified in program.md
            4. Update knowledge/per-module/cold-email.md with any new insights
            5. Commit with a descriptive message

            RULES:
            - Follow ALL constraints in program.md
            - Change only ONE variable per challenger
            - Be creative but grounded — no invented statistics
            - Write in Chilean Spanish (tutear, natural)
          allowed_tools: "Read,Write,Edit,Bash"
          max_turns: 10

      - name: Commit and push
        id: commit
        run: |
          git config user.name "sisteco-autoresearch[bot]"
          git config user.email "bot@sisteco.cl"
          git add -A
          if git diff --staged --quiet; then
            echo "No changes to commit"
            echo "has_changes=false" >> $GITHUB_OUTPUT
          else
            git commit -m "experiment: new challenger $(date -u +%Y-%m-%d-%H%M)"
            git push
            echo "has_changes=true" >> $GITHUB_OUTPUT
          fi

      - name: Trigger deploy
        if: steps.commit.outputs.has_changes == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.actions.createWorkflowDispatch({
              owner: context.repo.owner,
              repo: context.repo.repo,
              workflow_id: 'deploy-experiment.yml',
              ref: 'main',
            });
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/generate-challenger.yml
git commit -m "ci: add generate-challenger workflow — Claude Code generates copy variants"
```

---

### Task 11: Create deploy-experiment workflow

**Files:**
- Create: `.github/workflows/deploy-experiment.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
# .github/workflows/deploy-experiment.yml
name: Deploy Experiment

on:
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Validate challenger
        run: |
          node -e "
            import { validateChallenger } from './framework/validate.js';
            import fs from 'fs';
            const content = fs.readFileSync('modules/cold-email/challenger.md', 'utf-8');
            const result = validateChallenger(content);
            if (!result.valid) {
              console.error('Validation failed:', result.errors);
              process.exit(1);
            }
            console.log('Challenger validated successfully');
          "

      - name: Deploy to Instantly
        env:
          INSTANTLY_API_KEY: ${{ secrets.INSTANTLY_API_KEY }}
        run: node framework/deploy.js cold-email

      - name: Notify Discord
        env:
          DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
        run: |
          node -e "
            import { sendDiscordNotification } from './framework/notify.js';
            const embed = {
              title: '🚀 New Experiment Deployed',
              color: 0x58a6ff,
              description: 'Cold email A/B test deployed to Instantly',
              fields: [
                { name: 'Module', value: 'cold-email', inline: true },
                { name: 'Status', value: 'Active — awaiting results', inline: true },
              ],
              timestamp: new Date().toISOString(),
              footer: { text: 'Sisteco AutoResearch' },
            };
            await sendDiscordNotification(embed);
          "

      - name: Commit deploy state
        run: |
          git config user.name "sisteco-autoresearch[bot]"
          git config user.email "bot@sisteco.cl"
          git add -A
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            git commit -m "deploy: cold-email experiment $(date -u +%Y-%m-%d-%H%M)"
            git push
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy-experiment.yml
git commit -m "ci: add deploy-experiment workflow — Instantly deploy + Discord notify"
```

---

## Chunk 6: Push to GitHub + End-to-End Dry Run

### Task 12: Create GitHub repo and push

**Files:** None (git operations only)

- [ ] **Step 1: Create GitHub repo**

```bash
cd /c/Users/Dell\ 5520/Documents/AgenticWorkflows/sisteco-autoresearch
gh auth status  # Verify gh is authenticated
gh repo create sisteco-autoresearch --private --source=. --push
```

> If `gh auth` fails, run `gh auth login` first.

- [ ] **Step 2: Add GitHub secrets**

```bash
gh secret set INSTANTLY_API_KEY
gh secret set GEMINI_API_KEY
gh secret set ANTHROPIC_API_KEY
gh secret set DISCORD_WEBHOOK_URL
```

> Each command will prompt for the value interactively. Get values from your .env file in The Agentic Company project.

- [ ] **Step 3: Verify repo is pushed**

```bash
gh repo view --web  # Opens repo in browser
git log --oneline   # Should show all commits
```

---

### Task 13: Run all tests

- [ ] **Step 1: Run full test suite**

```bash
npm test
```
Expected: All tests pass (utils: 7, analyze: 7, validate: 6, notify: 3 = 23 total)

- [ ] **Step 2: Trigger dry run of harvest**

```bash
node framework/harvest.js --dry-run
```
Expected: Logs "Would harvest: cold-email" without making API calls

- [ ] **Step 3: Manually trigger harvest workflow in GitHub**

```bash
gh workflow run harvest-analyze.yml
gh run list --limit 1  # Check status
```

> This will likely show "No active A/B campaigns found" since no campaigns exist yet in Instantly. That's expected — the framework is ready, it just needs real data.

- [ ] **Step 4: Final commit with README**

Create a brief README.md:

```markdown
# Sisteco AutoResearch

Autonomous experimentation framework for B2B sales optimization.

## Architecture

Closed-loop control: Harvest → Analyze → Generate → Deploy → Notify

## Modules

- **cold-email** — A/B testing email copy via Instantly.ai
- **lead-scoring** — (planned) Prompt optimization for Gemini scoring
- **landing-copy** — (planned) Landing page conversion optimization

## Running

```bash
npm test              # Run tests
npm run harvest       # Harvest metrics
npm run analyze       # Analyze results
npm run deploy        # Deploy experiments
```

## Prerequisites

See `docs/superpowers/specs/2026-03-12-sisteco-autoresearch-design.md` Section 0.
```

```bash
git add README.md
git commit -m "docs: add README"
git push
```

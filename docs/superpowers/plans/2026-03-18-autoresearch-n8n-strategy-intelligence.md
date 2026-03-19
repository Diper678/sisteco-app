# Autoresearch: Migrar a n8n + Strategy Intelligence Layer

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar Instantly.ai con n8n como proveedor de envío de emails, y agregar una capa de Strategy Intelligence que aprende qué estrategia de apertura genera más respuestas por tipo de ICP.

**Architecture:** El framework existente tiene providers encapsulados en `deploy.js` y `harvest.js`. Se agrega un nuevo provider `n8n` en ambos archivos. La capa Strategy Intelligence (3 scripts nuevos) se ejecuta antes del deploy (tagging) y durante el harvest (update). Google Sheets (sólo lectura con API key pública) actúa como metrics store escribible por n8n.

**Tech Stack:** Node.js 20 ESM, `node:test`, `node:assert`, Google Sheets REST API v4 (no deps extra), n8n webhook, Amazon SES (vía n8n)

**Repo:** `C:/Users/Dell 5520/Documents/AgenticWorkflows/sisteco-autoresearch`

---

## Contexto de voz (CRÍTICO para Chunk D)

Felipe (fundador) habla así en emails reales:
- Párrafos de 2-3 oraciones máximo. Total: 60-90 palabras.
- Abre con contexto (quién los conectó, o algo específico que hicieron)
- Propuesta de valor framed como "creo que podemos…"
- CTA suave, siempre con "Sin compromiso"
- Cierre: "Saludos," o "Un Saludo," — nunca "Atentamente"
- NUNCA usar formato "5-7x" — escribir "cinco a siete veces más"
- NUNCA bullets, métricas frías, o lenguaje corporativo
- La firma dice "Felipe" (no "Sebastián")

---

## File Map

### Archivos a MODIFICAR

| Archivo | Cambio |
|---------|--------|
| `framework/deploy.js` | Agregar `deployN8n()`, cambiar switch |
| `framework/harvest.js` | Agregar `harvestGoogleSheets()`, cambiar switch |
| `modules/cold-email/config.json` | `provider: "n8n"`, agregar config Google Sheets |
| `modules/cold-email/program.md` | Agregar paso de strategy advisor, actualizar voz |
| `modules/cold-email/baseline.md` | Reescribir con voz real de Felipe |
| `.env.example` | Agregar `GOOGLE_API_KEY`, `GOOGLE_SHEETS_METRICS_ID`, `N8N_COLD_EMAIL_WEBHOOK` |

### Archivos a CREAR

| Archivo | Responsabilidad |
|---------|----------------|
| `framework/strategy-advisor.js` | Lee `performance.tsv` → retorna top estrategias para un ICP |
| `framework/strategy-tagger.js` | Incrementa `sent` en `performance.tsv` al hacer deploy |
| `framework/strategy-updater.js` | Recalcula `reply_rate` en `performance.tsv` post-harvest |
| `knowledge/strategies/registry.md` | Catálogo de 5 estrategias base con descripción |
| `knowledge/strategies/performance.tsv` | Métricas por estrategia × ICP type (seed data) |
| `tests/strategy-advisor.test.js` | Tests unitarios para strategy-advisor |
| `tests/strategy-tagger.test.js` | Tests unitarios para strategy-tagger |
| `tests/strategy-updater.test.js` | Tests unitarios para strategy-updater |
| `n8n/workflows/cold-email-sender.json` | Template workflow n8n (importable) |

---

## Chunk A — Reemplazar deploy.js: Instantly → n8n webhook

**Agente:** Trabajar únicamente en `framework/deploy.js`. No tocar otros archivos.

**Archivos:**
- Modify: `framework/deploy.js`
- Create: `tests/deploy.test.js`

### Interfaz que debe cumplir `deployN8n()`

```
INPUT config.json:
  provider: "n8n"
  n8n: { webhook_url_env: "N8N_COLD_EMAIL_WEBHOOK" }

POST a N8N_COLD_EMAIL_WEBHOOK con body:
{
  run_id: string,           // ej: "20260318-153000-a1b2"
  variant: "baseline"|"challenger",
  strategy_id: string,      // ej: "referral-bridge"
  email: { subject: string, body: string },
  leads: [{ email, first_name, last_name, company, industry, position }]
}

RESPONSE esperada de n8n:
{ accepted: number }        // cuántos leads aceptó

El deploy state que escribe en .deploy-state.json debe incluir:
{ deployed_at, variant_baseline: {run_id, accepted}, variant_challenger: {run_id, accepted}, strategy_id, leads_per_variant }
```

### Task A1: Crear tests failing

- [ ] **Step 1: Crear `tests/deploy.test.js` con tests para `buildN8nPayload()`**

```js
// tests/deploy.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildN8nPayload } from '../framework/deploy.js';

describe('buildN8nPayload', () => {
  it('builds correct payload structure', () => {
    const lead = { email: 'test@co.cl', first_name: 'Juan', last_name: 'Pérez', company: 'Empresa', industry: 'Tech', position: 'CEO' };
    const email = { subject: 'Hola', body: 'Cuerpo del email' };
    const payload = buildN8nPayload('run-001', 'baseline', 'pain-first', email, [lead]);

    assert.equal(payload.run_id, 'run-001');
    assert.equal(payload.variant, 'baseline');
    assert.equal(payload.strategy_id, 'pain-first');
    assert.equal(payload.email.subject, 'Hola');
    assert.equal(payload.leads.length, 1);
    assert.equal(payload.leads[0].email, 'test@co.cl');
  });

  it('personalizes body replacing {nombre} and {empresa}', () => {
    const lead = { email: 'a@b.cl', first_name: 'Ana', last_name: 'G', company: 'MiEmpresa', industry: 'X', position: 'Y' };
    const email = { subject: 'Test', body: 'Hola {nombre}, de {empresa}' };
    const payload = buildN8nPayload('r1', 'baseline', 's1', email, [lead]);
    assert.ok(payload.leads[0].personalized_body.includes('Ana'));
    assert.ok(payload.leads[0].personalized_body.includes('MiEmpresa'));
  });

  it('does NOT throw if strategy_id is empty string', () => {
    const lead = { email: 'x@y.cl', first_name: 'X', last_name: 'Y', company: 'Z', industry: 'A', position: 'B' };
    assert.doesNotThrow(() => buildN8nPayload('r1', 'baseline', '', { subject: 'S', body: 'B' }, [lead]));
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/sisteco-autoresearch"
node --test tests/deploy.test.js 2>&1 | head -20
```
Esperado: error `SyntaxError` o `not a function` (buildN8nPayload no existe aún)

### Task A2: Implementar `deployN8n()` y `buildN8nPayload()` en deploy.js

- [ ] **Step 3: Agregar `buildN8nPayload` y `deployN8n` a `framework/deploy.js`**

Agregar ANTES del export `deployModule`:

```js
/**
 * Build the payload sent to n8n webhook for one variant.
 * Personalizes body per-lead using {nombre}/{empresa} placeholders.
 */
export function buildN8nPayload(runId, variant, strategyId, email, leads) {
  return {
    run_id: runId,
    variant,
    strategy_id: strategyId,
    email: { subject: email.subject, body: email.body },
    leads: leads.map(l => ({
      ...l,
      personalized_body: email.body
        .replace(/\{nombre\}/g, l.first_name || '')
        .replace(/\{empresa\}/g, l.company || ''),
    })),
  };
}

/**
 * Deploy A/B experiment via n8n webhook.
 * POSTs baseline and challenger leads to n8n, which sends via SES.
 */
async function deployN8n(modPath, config) {
  const webhookUrl = process.env[config.n8n.webhook_url_env];
  if (!webhookUrl) throw new Error(`Missing env var: ${config.n8n.webhook_url_env}`);

  const baselineContent = fs.readFileSync(path.join(modPath, 'baseline.md'), 'utf-8');
  const challengerContent = fs.readFileSync(path.join(modPath, 'challenger.md'), 'utf-8');

  const validation = validateChallenger(challengerContent);
  if (!validation.valid) {
    throw new Error(`Challenger validation failed: ${validation.errors.join('; ')}`);
  }

  const baselineEmail = parseEmailFromMd(baselineContent);
  const challengerEmail = parseEmailFromMd(challengerContent);

  // Read strategy_id from challenger frontmatter (optional field)
  const parsed = parseFrontmatter(challengerContent);
  const strategyId = parsed?.meta?.strategy_id || '';

  const leadsPool = path.join(process.cwd(), 'data', 'leads-pool.csv');
  const leads = parseCsv(fs.readFileSync(leadsPool, 'utf-8'));
  const needed = config.experiment.leads_per_variant * 2;

  if (leads.length < needed) {
    throw new Error(`Not enough leads: need ${needed}, have ${leads.length}`);
  }

  // Fisher-Yates shuffle (unchanged from Instantly version)
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

  const { generateRunId } = await import('./utils.js');
  const baselineRunId = generateRunId();
  const challengerRunId = generateRunId();

  const [baselineRes, challengerRes] = await Promise.all([
    postToN8n(webhookUrl, buildN8nPayload(baselineRunId, 'baseline', strategyId, baselineEmail, baselineLeads)),
    postToN8n(webhookUrl, buildN8nPayload(challengerRunId, 'challenger', strategyId, challengerEmail, challengerLeads)),
  ]);

  log.info(`n8n accepted: baseline=${baselineRes.accepted}, challenger=${challengerRes.accepted}`);

  const deployState = {
    deployed_at: new Date().toISOString(),
    strategy_id: strategyId,
    leads_per_variant: config.experiment.leads_per_variant,
    variant_baseline: { run_id: baselineRunId, accepted: baselineRes.accepted },
    variant_challenger: { run_id: challengerRunId, accepted: challengerRes.accepted },
  };
  fs.writeFileSync(path.join(modPath, '.deploy-state.json'), JSON.stringify(deployState, null, 2));

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

async function postToN8n(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`n8n webhook error: ${res.status} ${await res.text()}`);
  return res.json();
}
```

- [ ] **Step 4: Actualizar el switch `deployModule()` para incluir `n8n`**

Buscar en `deploy.js` la función `deployModule` y cambiar:

```js
// ANTES:
  if (config.provider === 'instantly') {
    return deployInstantly(modPath, config);
  }
  log.warn(`[${moduleName}] Unknown provider: ${config.provider}`);
  return null;

// DESPUÉS:
  if (config.provider === 'instantly') {
    return deployInstantly(modPath, config);
  }
  if (config.provider === 'n8n') {
    return deployN8n(modPath, config);
  }
  log.warn(`[${moduleName}] Unknown provider: ${config.provider}`);
  return null;
```

- [ ] **Step 5: Correr tests**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/sisteco-autoresearch"
node --test tests/deploy.test.js 2>&1
```
Esperado: `3 passing`

- [ ] **Step 6: Correr suite completa para verificar no hay regresión**

```bash
node --test tests/*.test.js 2>&1
```
Esperado: todos los tests previos siguen pasando

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/sisteco-autoresearch"
git add framework/deploy.js tests/deploy.test.js
git commit -m "feat(deploy): add n8n webhook provider alongside Instantly"
```

---

## Chunk B — Reemplazar harvest.js: Instantly API → Google Sheets

**Agente:** Trabajar únicamente en `framework/harvest.js`. No tocar otros archivos.

**Archivos:**
- Modify: `framework/harvest.js`
- Create: `tests/harvest.test.js`

### Interfaz que debe cumplir `harvestGoogleSheets()`

```
Google Sheet "autoresearch-metrics", columnas:
  run_id | variant | strategy_id | lead_email | sent_at | replied | replied_at

Config en config.json:
  google_sheets: {
    sheet_id_env: "GOOGLE_SHEETS_METRICS_ID",
    api_key_env: "GOOGLE_API_KEY",
    range: "autoresearch-metrics!A:G"
  }

Retorna el mismo objeto que harvestInstantly():
{
  baseline_metrics: { total_sent, reply_rate, open_rate, bounce_rate },
  baseline_sample_size: number,
  challenger_metrics: { total_sent, reply_rate, open_rate, bounce_rate },
  challenger_sample_size: number,
  challenger_description: string,
  harvested_at: string (ISO)
}
```

### Task B1: Crear tests failing

- [ ] **Step 1: Crear `tests/harvest.test.js`**

```js
// tests/harvest.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetricsFromRows } from '../framework/harvest.js';

describe('computeMetricsFromRows', () => {
  const makeRow = (variant, replied) => ({
    run_id: 'r1', variant, strategy_id: 's1',
    lead_email: 'a@b.cl', sent_at: '2026-03-18T10:00:00Z',
    replied: replied ? 'true' : 'false', replied_at: ''
  });

  it('computes reply_rate for baseline', () => {
    const rows = [
      makeRow('baseline', false),
      makeRow('baseline', false),
      makeRow('baseline', true),
    ];
    const metrics = computeMetricsFromRows(rows, 'baseline');
    assert.equal(metrics.total_sent, 3);
    assert.ok(Math.abs(metrics.reply_rate - 1/3) < 0.001);
  });

  it('returns zero reply_rate when no replies', () => {
    const rows = [makeRow('challenger', false), makeRow('challenger', false)];
    const metrics = computeMetricsFromRows(rows, 'challenger');
    assert.equal(metrics.reply_rate, 0);
    assert.equal(metrics.total_sent, 2);
  });

  it('filters correctly by variant', () => {
    const rows = [makeRow('baseline', true), makeRow('challenger', false)];
    const bMetrics = computeMetricsFromRows(rows, 'baseline');
    const cMetrics = computeMetricsFromRows(rows, 'challenger');
    assert.equal(bMetrics.total_sent, 1);
    assert.equal(cMetrics.total_sent, 1);
    assert.equal(bMetrics.reply_rate, 1);
    assert.equal(cMetrics.reply_rate, 0);
  });

  it('returns zero metrics for empty rows', () => {
    const metrics = computeMetricsFromRows([], 'baseline');
    assert.equal(metrics.total_sent, 0);
    assert.equal(metrics.reply_rate, 0);
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/sisteco-autoresearch"
node --test tests/harvest.test.js 2>&1 | head -10
```
Esperado: `SyntaxError` o `not exported` (función no existe aún)

### Task B2: Implementar `harvestGoogleSheets()` y `computeMetricsFromRows()`

- [ ] **Step 3: Agregar las funciones en `framework/harvest.js`**

Agregar ANTES de `harvestModule`:

```js
/**
 * Compute reply_rate and total_sent for a given variant from sheet rows.
 * open_rate and bounce_rate are not available from simple IMAP tracking — return 0.
 * Exported for testing.
 */
export function computeMetricsFromRows(rows, variant) {
  const variantRows = rows.filter(r => r.variant === variant);
  const total_sent = variantRows.length;
  if (total_sent === 0) return { total_sent: 0, reply_rate: 0, open_rate: 0, bounce_rate: 0 };
  const replied = variantRows.filter(r => r.replied === 'true').length;
  return {
    total_sent,
    reply_rate: replied / total_sent,
    open_rate: 0,   // not tracked via IMAP
    bounce_rate: 0, // not tracked via IMAP
  };
}

/**
 * Fetch rows from Google Sheet via REST API v4.
 * Sheet must be publicly readable (share → "anyone with link can view").
 * Columns: run_id, variant, strategy_id, lead_email, sent_at, replied, replied_at
 */
async function fetchSheetRows(sheetId, apiKey, range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Sheets API error: ${res.status} ${await res.text()}`);
  const data = await res.json();

  const rawRows = data.values || [];
  if (rawRows.length < 2) return [];

  const headers = rawRows[0].map(h => h.toLowerCase().replace(/ /g, '_'));
  return rawRows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

/**
 * Harvest metrics for A/B experiment from Google Sheets.
 * n8n writes rows to the sheet when emails are sent/replied.
 */
async function harvestGoogleSheets(config) {
  const sheetId = process.env[config.google_sheets.sheet_id_env];
  const apiKey = process.env[config.google_sheets.api_key_env];
  if (!sheetId) throw new Error(`Missing env var: ${config.google_sheets.sheet_id_env}`);
  if (!apiKey) throw new Error(`Missing env var: ${config.google_sheets.api_key_env}`);

  const rows = await fetchSheetRows(sheetId, apiKey, config.google_sheets.range);

  if (rows.length === 0) {
    log.info('Google Sheets: no data rows yet — skipping');
    return null;
  }

  const baselineMetrics = computeMetricsFromRows(rows, 'baseline');
  const challengerMetrics = computeMetricsFromRows(rows, 'challenger');

  // challenger_description: from the most recent challenger row's strategy_id
  const challengerRows = rows.filter(r => r.variant === 'challenger');
  const challengerDescription = challengerRows.length > 0 ? (challengerRows[0].strategy_id || '') : '';

  return {
    baseline_metrics: baselineMetrics,
    baseline_sample_size: baselineMetrics.total_sent,
    challenger_metrics: challengerMetrics,
    challenger_sample_size: challengerMetrics.total_sent,
    challenger_description: challengerDescription,
    harvested_at: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Actualizar el switch en `harvestModule()` para incluir `n8n`**

Buscar el bloque `if (config.provider === 'instantly')` y reemplazar:

```js
// ANTES:
    if (config.provider === 'instantly') {
      state = await harvestInstantly(config);
    } else {
      log.warn(`[${moduleName}] Unknown provider: ${config.provider}`);
      return null;
    }

// DESPUÉS:
    if (config.provider === 'instantly') {
      state = await harvestInstantly(config);
    } else if (config.provider === 'n8n') {
      state = await harvestGoogleSheets(config);
    } else {
      log.warn(`[${moduleName}] Unknown provider: ${config.provider}`);
      return null;
    }
```

- [ ] **Step 5: Correr tests**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/sisteco-autoresearch"
node --test tests/harvest.test.js 2>&1
```
Esperado: `4 passing`

- [ ] **Step 6: Suite completa**

```bash
node --test tests/*.test.js 2>&1
```
Esperado: todos los tests pasan

- [ ] **Step 7: Commit**

```bash
git add framework/harvest.js tests/harvest.test.js
git commit -m "feat(harvest): add Google Sheets provider for n8n-based tracking"
```

---

## Chunk C — Strategy Intelligence Layer (3 scripts nuevos + datos)

**Agente:** Crear todos los archivos en `framework/strategy-*.js` y `knowledge/strategies/`. No modificar archivos existentes.

**Archivos:**
- Create: `framework/strategy-advisor.js`
- Create: `framework/strategy-tagger.js`
- Create: `framework/strategy-updater.js`
- Create: `knowledge/strategies/registry.md`
- Create: `knowledge/strategies/performance.tsv`
- Create: `tests/strategy-advisor.test.js`
- Create: `tests/strategy-tagger.test.js`
- Create: `tests/strategy-updater.test.js`

### Task C1: Crear `knowledge/strategies/registry.md`

- [ ] **Step 1: Crear registry.md**

```markdown
# Strategy Registry — Sisteco Cold Email

Cada estrategia define un ángulo/hook de apertura distinto. Claude elige la de mayor reply_rate
para el ICP dado antes de generar el email.

## Estrategias disponibles

### referral-bridge
**Descripción:** Abrir con la persona que hizo la conexión, luego proponer valor.
**Cuándo usar:** Siempre que haya un contacto mutuo que los conectó.
**Template de hook:** "[Nombre del referido] me comentó que habían conversado y que podía haber algo interesante para explorar juntos."

### gratitude-bridge
**Descripción:** Agradecer algo específico que hicieron (reportaron un bug, respondieron antes, etc.) y usar eso como puente.
**Cuándo usar:** Cuando hay un touchpoint previo (respuesta anterior, formulario, evento).
**Template de hook:** "Antes que nada, quiero agradecerte [acción específica]. Ya quedó [resultado] gracias a ti."

### pain-first
**Descripción:** Abrir con el dolor específico de su industria antes de mencionar Sisteco.
**Cuándo usar:** Cold sin contexto previo. Requiere conocer industria del prospecto.
**Template de hook:** "Vi que [empresa] está en [industria] — justamente donde el tiempo de respuesta a leads marca la diferencia entre cerrar o perder el negocio."

### social-proof-local
**Descripción:** Mencionar resultado concreto con una empresa chilena similar a la del prospecto.
**Cuándo usar:** Cuando existe un caso de éxito relevante en la misma industria.
**Template de hook:** "Trabajamos con [empresa similar en Chile] y [resultado concreto]. Creo que hay algo parecido que podemos hacer por [empresa]."

### direct-ask
**Descripción:** Ultra corto, una pregunta directa. Sin contexto, sin pitch.
**Cuándo usar:** CEOs/Gerentes muy ocupados. Cuando los anteriores no funcionaron para este ICP.
**Template de hook:** "¿Tienen resuelto cómo llegar primero a los leads que más les convienen?"
```

- [ ] **Step 2: Crear `knowledge/strategies/performance.tsv` con seed data**

```tsv
strategy_id	icp_type	sent	replied	reply_rate	last_updated
referral-bridge	agencia-marketing	0	0	0.000	2026-03-18
referral-bridge	consultora-ti	0	0	0.000	2026-03-18
gratitude-bridge	agencia-marketing	0	0	0.000	2026-03-18
gratitude-bridge	consultora-ti	0	0	0.000	2026-03-18
pain-first	agencia-marketing	0	0	0.000	2026-03-18
pain-first	consultora-ti	0	0	0.000	2026-03-18
pain-first	empresa-industrial	0	0	0.000	2026-03-18
social-proof-local	agencia-marketing	0	0	0.000	2026-03-18
social-proof-local	consultora-ti	0	0	0.000	2026-03-18
direct-ask	agencia-marketing	0	0	0.000	2026-03-18
direct-ask	consultora-ti	0	0	0.000	2026-03-18
direct-ask	empresa-industrial	0	0	0.000	2026-03-18
```

### Task C2: Crear `framework/strategy-advisor.js`

- [ ] **Step 3: Crear `tests/strategy-advisor.test.js` (tests failing)**

```js
// tests/strategy-advisor.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTopStrategies, getBestStrategy } from '../framework/strategy-advisor.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

function makeTempPerf(rows) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strat-'));
  const filePath = path.join(tmpDir, 'performance.tsv');
  const header = 'strategy_id\ticp_type\tsent\treplied\treply_rate\tlast_updated';
  const lines = rows.map(r => `${r.strategy_id}\t${r.icp_type}\t${r.sent}\t${r.replied}\t${r.reply_rate}\t2026-03-18`);
  fs.writeFileSync(filePath, [header, ...lines].join('\n') + '\n');
  return { tmpDir, filePath };
}

describe('getTopStrategies', () => {
  it('returns strategies sorted by reply_rate descending', () => {
    const { filePath, tmpDir } = makeTempPerf([
      { strategy_id: 'pain-first', icp_type: 'agencia-marketing', sent: 20, replied: 4, reply_rate: 0.20 },
      { strategy_id: 'direct-ask', icp_type: 'agencia-marketing', sent: 15, replied: 6, reply_rate: 0.40 },
      { strategy_id: 'referral-bridge', icp_type: 'agencia-marketing', sent: 10, replied: 3, reply_rate: 0.30 },
    ]);
    const top = getTopStrategies('agencia-marketing', 3, filePath);
    assert.equal(top[0].strategy_id, 'direct-ask');
    assert.equal(top[1].strategy_id, 'referral-bridge');
    assert.equal(top.length, 3);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('filters by icp_type', () => {
    const { filePath, tmpDir } = makeTempPerf([
      { strategy_id: 'pain-first', icp_type: 'agencia-marketing', sent: 10, replied: 3, reply_rate: 0.30 },
      { strategy_id: 'pain-first', icp_type: 'consultora-ti', sent: 5, replied: 1, reply_rate: 0.20 },
    ]);
    const top = getTopStrategies('consultora-ti', 5, filePath);
    assert.equal(top.length, 1);
    assert.equal(top[0].icp_type, 'consultora-ti');
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns all if limit > available', () => {
    const { filePath, tmpDir } = makeTempPerf([
      { strategy_id: 's1', icp_type: 'x', sent: 5, replied: 1, reply_rate: 0.20 },
    ]);
    const top = getTopStrategies('x', 10, filePath);
    assert.equal(top.length, 1);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns empty array if icp_type has no data', () => {
    const { filePath, tmpDir } = makeTempPerf([
      { strategy_id: 'pain-first', icp_type: 'agencia-marketing', sent: 10, replied: 3, reply_rate: 0.30 },
    ]);
    const top = getTopStrategies('no-such-icp', 3, filePath);
    assert.equal(top.length, 0);
    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('getBestStrategy', () => {
  it('returns the single best strategy_id for an ICP', () => {
    const { filePath, tmpDir } = makeTempPerf([
      { strategy_id: 'pain-first', icp_type: 'consultora-ti', sent: 20, replied: 4, reply_rate: 0.20 },
      { strategy_id: 'direct-ask', icp_type: 'consultora-ti', sent: 10, replied: 4, reply_rate: 0.40 },
    ]);
    const best = getBestStrategy('consultora-ti', filePath);
    assert.equal(best, 'direct-ask');
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns null if no data for ICP', () => {
    const { filePath, tmpDir } = makeTempPerf([]);
    const best = getBestStrategy('unknown', filePath);
    assert.equal(best, null);
    fs.rmSync(tmpDir, { recursive: true });
  });
});
```

- [ ] **Step 4: Verificar que los tests fallan**

```bash
node --test tests/strategy-advisor.test.js 2>&1 | head -5
```

- [ ] **Step 5: Crear `framework/strategy-advisor.js`**

```js
// framework/strategy-advisor.js
import fs from 'fs';
import path from 'path';
import { parseTsv } from './utils.js';

const DEFAULT_PERF_PATH = path.join(process.cwd(), 'knowledge', 'strategies', 'performance.tsv');

/**
 * Returns strategies for a given ICP type, sorted by reply_rate descending.
 * Strategies with 0 sent are included (bootstrapping), sorted last.
 *
 * @param {string} icpType - e.g. "agencia-marketing"
 * @param {number} limit - max results
 * @param {string} perfTsvPath - path to performance.tsv (defaults to knowledge/strategies/performance.tsv)
 * @returns {Array<{strategy_id, icp_type, sent, replied, reply_rate, last_updated}>}
 */
export function getTopStrategies(icpType, limit = 3, perfTsvPath = DEFAULT_PERF_PATH) {
  if (!fs.existsSync(perfTsvPath)) return [];

  const rows = parseTsv(fs.readFileSync(perfTsvPath, 'utf-8'))
    .filter(r => r.icp_type === icpType)
    .map(r => ({ ...r, reply_rate: Number(r.reply_rate), sent: Number(r.sent), replied: Number(r.replied) }))
    .sort((a, b) => {
      // Strategies with data first, then by reply_rate desc
      if (a.sent === 0 && b.sent > 0) return 1;
      if (b.sent === 0 && a.sent > 0) return -1;
      return b.reply_rate - a.reply_rate;
    });

  return rows.slice(0, limit);
}

/**
 * Returns the single best strategy_id for an ICP type, or null if no data.
 */
export function getBestStrategy(icpType, perfTsvPath = DEFAULT_PERF_PATH) {
  const top = getTopStrategies(icpType, 1, perfTsvPath);
  return top.length > 0 ? top[0].strategy_id : null;
}
```

- [ ] **Step 6: Correr tests**

```bash
node --test tests/strategy-advisor.test.js 2>&1
```
Esperado: `6 passing`

### Task C3: Crear `framework/strategy-tagger.js`

- [ ] **Step 7: Crear `tests/strategy-tagger.test.js`**

```js
// tests/strategy-tagger.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tagDeploy } from '../framework/strategy-tagger.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

function makeTempPerf(extraRows = []) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tagger-'));
  const filePath = path.join(tmpDir, 'performance.tsv');
  const header = 'strategy_id\ticp_type\tsent\treplied\treply_rate\tlast_updated';
  const base = [
    `pain-first\tagencia-marketing\t10\t2\t0.200\t2026-03-18`,
    `direct-ask\tagencia-marketing\t5\t1\t0.200\t2026-03-18`,
    ...extraRows,
  ];
  fs.writeFileSync(filePath, [header, ...base].join('\n') + '\n');
  return { tmpDir, filePath };
}

describe('tagDeploy', () => {
  it('increments sent count for matching strategy + icp_type', () => {
    const { filePath, tmpDir } = makeTempPerf();
    tagDeploy('pain-first', 'agencia-marketing', 20, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const painRow = lines.find(l => l.startsWith('pain-first\tagencia-marketing'));
    const sent = painRow.split('\t')[2];
    assert.equal(sent, '30'); // 10 + 20
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('does not affect other rows', () => {
    const { filePath, tmpDir } = makeTempPerf();
    tagDeploy('pain-first', 'agencia-marketing', 5, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const directRow = content.trim().split('\n').find(l => l.startsWith('direct-ask'));
    assert.equal(directRow.split('\t')[2], '5'); // unchanged
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates new row if strategy+icp_type not found', () => {
    const { filePath, tmpDir } = makeTempPerf();
    tagDeploy('referral-bridge', 'consultora-ti', 10, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes('referral-bridge\tconsultora-ti\t10'));
    fs.rmSync(tmpDir, { recursive: true });
  });
});
```

- [ ] **Step 8: Crear `framework/strategy-tagger.js`**

```js
// framework/strategy-tagger.js
import fs from 'fs';
import path from 'path';
import { parseTsv, formatTimestamp } from './utils.js';

const DEFAULT_PERF_PATH = path.join(process.cwd(), 'knowledge', 'strategies', 'performance.tsv');

/**
 * Record that `leadsCount` emails were sent for strategyId × icpType.
 * Increments the `sent` counter. If the row doesn't exist, creates it.
 *
 * Called by deploy.js after a successful deploy.
 */
export function tagDeploy(strategyId, icpType, leadsCount, perfTsvPath = DEFAULT_PERF_PATH) {
  if (!fs.existsSync(perfTsvPath)) {
    const header = 'strategy_id\ticp_type\tsent\treplied\treply_rate\tlast_updated\n';
    fs.writeFileSync(perfTsvPath, header);
  }

  const content = fs.readFileSync(perfTsvPath, 'utf-8');
  const lines = content.trim().split('\n');
  const header = lines[0];
  const dataLines = lines.slice(1);

  const rowIdx = dataLines.findIndex(l => {
    const [sid, icp] = l.split('\t');
    return sid === strategyId && icp === icpType;
  });

  const today = new Date().toISOString().slice(0, 10);

  if (rowIdx === -1) {
    // New row
    dataLines.push(`${strategyId}\t${icpType}\t${leadsCount}\t0\t0.000\t${today}`);
  } else {
    const parts = dataLines[rowIdx].split('\t');
    const newSent = Number(parts[2]) + leadsCount;
    const replied = Number(parts[3]);
    const newRate = newSent > 0 ? (replied / newSent).toFixed(3) : '0.000';
    dataLines[rowIdx] = `${strategyId}\t${icpType}\t${newSent}\t${replied}\t${newRate}\t${today}`;
  }

  fs.writeFileSync(perfTsvPath, [header, ...dataLines].join('\n') + '\n');
}
```

- [ ] **Step 9: Correr tests**

```bash
node --test tests/strategy-tagger.test.js 2>&1
```
Esperado: `3 passing`

### Task C4: Crear `framework/strategy-updater.js`

- [ ] **Step 10: Crear `tests/strategy-updater.test.js`**

```js
// tests/strategy-updater.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { updateFromHarvest } from '../framework/strategy-updater.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

function makeTempPerf() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'updater-'));
  const filePath = path.join(tmpDir, 'performance.tsv');
  const header = 'strategy_id\ticp_type\tsent\treplied\treply_rate\tlast_updated';
  const rows = [
    'pain-first\tagencia-marketing\t20\t2\t0.100\t2026-03-18',
    'direct-ask\tagencia-marketing\t10\t1\t0.100\t2026-03-18',
  ];
  fs.writeFileSync(filePath, [header, ...rows].join('\n') + '\n');
  return { tmpDir, filePath };
}

const makeSheetRow = (strategyId, replied) => ({
  strategy_id: strategyId,
  icp_type: 'agencia-marketing',
  variant: 'challenger',
  replied: replied ? 'true' : 'false',
});

describe('updateFromHarvest', () => {
  it('adds new replied count from sheet rows', () => {
    const { filePath, tmpDir } = makeTempPerf();
    const sheetRows = [
      makeSheetRow('pain-first', true),
      makeSheetRow('pain-first', true),
      makeSheetRow('pain-first', false),
    ];
    updateFromHarvest(sheetRows, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const painRow = content.trim().split('\n').find(l => l.startsWith('pain-first\tagencia-marketing'));
    const parts = painRow.split('\t');
    assert.equal(parts[3], '4'); // 2 original + 2 new
    assert.ok(Number(parts[4]) > 0.1); // reply_rate increased
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('does not update rows with no new replies', () => {
    const { filePath, tmpDir } = makeTempPerf();
    updateFromHarvest([], filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const painRow = content.trim().split('\n').find(l => l.startsWith('pain-first'));
    assert.equal(painRow.split('\t')[3], '2'); // unchanged
    fs.rmSync(tmpDir, { recursive: true });
  });
});
```

- [ ] **Step 11: Crear `framework/strategy-updater.js`**

```js
// framework/strategy-updater.js
import fs from 'fs';
import path from 'path';

const DEFAULT_PERF_PATH = path.join(process.cwd(), 'knowledge', 'strategies', 'performance.tsv');

/**
 * Update reply counts in performance.tsv based on Google Sheets harvest rows.
 * Adds new replies on top of existing replied count.
 *
 * Called by harvest.js after computing metrics.
 *
 * @param {Array} sheetRows - rows from Google Sheet with fields: strategy_id, icp_type, replied
 * @param {string} perfTsvPath - path to performance.tsv
 */
export function updateFromHarvest(sheetRows, perfTsvPath = DEFAULT_PERF_PATH) {
  if (!fs.existsSync(perfTsvPath) || sheetRows.length === 0) return;

  // Aggregate new replies per strategy+icp_type from sheet
  const newReplies = {};
  for (const row of sheetRows) {
    if (row.replied !== 'true') continue;
    const key = `${row.strategy_id}|${row.icp_type}`;
    newReplies[key] = (newReplies[key] || 0) + 1;
  }

  if (Object.keys(newReplies).length === 0) return;

  const content = fs.readFileSync(perfTsvPath, 'utf-8');
  const lines = content.trim().split('\n');
  const header = lines[0];
  const today = new Date().toISOString().slice(0, 10);

  const updatedLines = lines.slice(1).map(line => {
    const parts = line.split('\t');
    const key = `${parts[0]}|${parts[1]}`;
    if (!(key in newReplies)) return line;

    const sent = Number(parts[2]);
    const replied = Number(parts[3]) + newReplies[key];
    const rate = sent > 0 ? (replied / sent).toFixed(3) : '0.000';
    return `${parts[0]}\t${parts[1]}\t${sent}\t${replied}\t${rate}\t${today}`;
  });

  fs.writeFileSync(perfTsvPath, [header, ...updatedLines].join('\n') + '\n');
}
```

- [ ] **Step 12: Correr tests del Chunk C completo**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/sisteco-autoresearch"
node --test tests/strategy-advisor.test.js tests/strategy-tagger.test.js tests/strategy-updater.test.js 2>&1
```
Esperado: todos los tests pasan

- [ ] **Step 13: Suite completa**

```bash
node --test tests/*.test.js 2>&1
```

- [ ] **Step 14: Commit**

```bash
git add framework/strategy-advisor.js framework/strategy-tagger.js framework/strategy-updater.js \
        knowledge/strategies/registry.md knowledge/strategies/performance.tsv \
        tests/strategy-advisor.test.js tests/strategy-tagger.test.js tests/strategy-updater.test.js
git commit -m "feat(strategy): add Strategy Intelligence Layer — advisor, tagger, updater"
```

---

## Chunk D — Content + Config: voz real, n8n config, env vars

**Agente:** Actualizar archivos de contenido y configuración. No tocar archivos `.js`.

### Task D1: Actualizar `modules/cold-email/config.json`

- [ ] **Step 1: Reescribir `modules/cold-email/config.json`**

```json
{
  "module": "cold-email",
  "provider": "n8n",
  "n8n": {
    "webhook_url_env": "N8N_COLD_EMAIL_WEBHOOK"
  },
  "google_sheets": {
    "sheet_id_env": "GOOGLE_SHEETS_METRICS_ID",
    "api_key_env": "GOOGLE_API_KEY",
    "range": "autoresearch-metrics!A:G"
  },
  "experiment": {
    "leads_per_variant": 25,
    "split_ratio": 0.5,
    "min_sample_size": 25,
    "wait_hours": 72,
    "significance_level": 0.05
  },
  "circuit_breaker": {
    "max_consecutive_failures": 3,
    "paused": false
  },
  "metrics": {
    "primary": "reply_rate",
    "secondary": [],
    "constraints": {}
  },
  "notify": {
    "discord_env": "DISCORD_WEBHOOK_URL"
  }
}
```

Nota: `leads_per_variant` reducido de 200 a 25 para escala actual (pre-revenue, outreach personalizado).

### Task D2: Actualizar `.env.example`

- [ ] **Step 2: Agregar nuevas variables a `.env.example`**

Agregar estas líneas al archivo existente:

```bash
# === Google Sheets (Métricas autoresearch) ===
# Sheet debe ser pública (compartir → cualquiera con el link puede ver)
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SHEETS_METRICS_ID=your_sheet_id_here

# === n8n (Cold Email Sender Workflow) ===
N8N_COLD_EMAIL_WEBHOOK=https://primary-production-24f87.up.railway.app/webhook/cold-email-sender
```

### Task D3: Actualizar `modules/cold-email/baseline.md`

El baseline actual tiene voz incorrecta ("Sebastián", "5-7x", bullets implícitos). Reescribir con la voz real de Felipe:

- [ ] **Step 3: Reescribir `modules/cold-email/baseline.md`**

```markdown
---
subject: Pregunta rápida, {nombre}
variable_changed: initial
hypothesis: Baseline inicial — subject personalizado con nombre genera apertura, hook de curiosidad sin pitch agresivo
strategy_id: pain-first
---

Hola {nombre},

Vi que {empresa} opera en un mercado donde la velocidad de respuesta a un lead puede ser la diferencia entre cerrarlo o perderlo. Es justo donde Sisteco genera más impacto.

Automatizamos toda la parte de prospección y pipeline B2B para que tu equipo llegue primero a los clientes que más les convienen. Me gustaría mostrarte cómo funciona con un ejemplo concreto de tu industria.

¿Te sirve una llamada de 15 minutos el jueves a las 10? Sin compromiso.

Un saludo,
Felipe
Sisteco — Menos leads, más cierres

PD: Si no quieres recibir más emails, responde SALIR.
```

### Task D4: Actualizar `modules/cold-email/program.md`

- [ ] **Step 4: Reescribir `modules/cold-email/program.md`**

```markdown
## Cold Email Optimizer — Sisteco B2B Chile

**Goal:** Maximizar reply_rate de emails B2B a empresas medianas chilenas (50+ empleados).

**Producto:** Sisteco — automatización de ventas B2B.
**Propuesta de valor:** Que el equipo de ventas llegue primero a los leads que más les convienen.

---

### Tu Rol

Eres el controlador de un lazo de optimización. En cada ciclo:

1. Leer `results.tsv` para ver qué se ha probado
2. Leer `knowledge/per-module/cold-email.md` para learnings acumulados
3. Consultar `knowledge/strategies/performance.tsv` para ver qué estrategia tiene mejor reply_rate para el ICP objetivo
4. Leer `baseline.md` para ver el copy actual (el campeón)
5. Generar un nuevo `challenger.md` que modifique UNA variable

---

### Voz de Felipe (OBLIGATORIO)

Todos los emails suenan como Felipe Sisteco escribiendo a mano. Patrones:
- Párrafos de 2-3 oraciones. Total: 60-90 palabras máximo.
- Abre con contexto concreto (conexión mutua, algo que hicieron, o observación de su industria)
- Propuesta de valor: "creo que podemos…" — nunca una lista de features
- CTA suave: "¿te sirve una llamada…?" con día y hora específica
- Siempre: "Sin compromiso."
- Cierre: "Saludos," o "Un saludo," — nunca "Atentamente"
- Firma: "Felipe" (solo nombre de pila)

NUNCA usar:
- "5-7x" o cualquier formato con número-x — escribir "cinco a siete veces más"
- Bullets, listas, negritas dentro del cuerpo
- "ROI", "stack", "omnicanal" — hablar como persona, no como deck
- Testimonios o métricas inventadas

---

### Variables que puedes cambiar (UNA por challenger)

- **Subject line** — el asunto del email
- **Hook** — la primera oración
- **Body** — el cuerpo del mensaje
- **CTA** — el call-to-action
- **Strategy** — cambiar la estrategia base (ver `knowledge/strategies/registry.md`)

---

### Constraints (NUNCA violar)

- Máximo 100 palabras
- Subject line ≤ 8 palabras
- CTA con día/hora específica
- NUNCA inventar métricas o testimonios
- NUNCA mencionar IA, Claude, n8n, o herramientas internas
- Idioma: español Chile
- DEBE incluir: "Si no quieres recibir más emails, responde SALIR"

---

### Formato de challenger.md

```
---
subject: [subject line]
variable_changed: [subject|hook|body|cta|strategy]
strategy_id: [referral-bridge|gratitude-bridge|pain-first|social-proof-local|direct-ask]
hypothesis: [1 oración explicando por qué esto debería ganar]
---

[Cuerpo del email. Usar {nombre} y {empresa} como placeholders.]
```
```

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/sisteco-autoresearch"
git add modules/cold-email/config.json modules/cold-email/baseline.md \
        modules/cold-email/program.md .env.example
git commit -m "feat(content): update config to n8n provider, rewrite baseline with Felipe's real voice"
```

---

## Chunk E — n8n Workflow Template

**Agente:** Crear el archivo JSON del workflow n8n. No tocar ningún otro archivo.

**Archivo:**
- Create: `n8n/workflows/cold-email-sender.json`

### Task E1: Crear el template del workflow n8n

Este workflow recibe el webhook de `deploy.js` y envía los emails vía SMTP/SES.

- [ ] **Step 1: Crear `n8n/workflows/cold-email-sender.json`**

```json
{
  "name": "Autoresearch Cold Email Sender",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "cold-email-sender",
        "responseMode": "lastNode",
        "options": {}
      },
      "id": "webhook-trigger",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [240, 300]
    },
    {
      "parameters": {
        "jsCode": "// Expand each lead into individual items\nconst body = $input.first().json.body || $input.first().json;\nconst { run_id, variant, strategy_id, email, leads } = body;\n\nreturn leads.map(lead => ({\n  json: {\n    run_id,\n    variant,\n    strategy_id,\n    to: lead.email,\n    first_name: lead.first_name,\n    company: lead.company,\n    subject: email.subject.replace(/{nombre}/g, lead.first_name).replace(/{empresa}/g, lead.company),\n    body: lead.personalized_body || email.body,\n  }\n}));"
      },
      "id": "expand-leads",
      "name": "Expand Leads",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [460, 300]
    },
    {
      "parameters": {
        "fromEmail": "felipe@sisteco.cl",
        "toEmail": "={{ $json.to }}",
        "subject": "={{ $json.subject }}",
        "emailType": "text",
        "message": "={{ $json.body }}",
        "options": {
          "replyTo": "felipe@sisteco.cl"
        }
      },
      "id": "send-email",
      "name": "Send Email via SES",
      "type": "n8n-nodes-base.emailSend",
      "typeVersion": 2.1,
      "position": [680, 300],
      "credentials": {
        "smtp": {
          "id": "REPLACE_WITH_SES_CREDENTIAL_ID",
          "name": "Amazon SES SMTP"
        }
      }
    },
    {
      "parameters": {
        "operation": "append",
        "documentId": { "value": "={{ $env.GOOGLE_SHEETS_METRICS_ID }}" },
        "sheetName": { "value": "autoresearch-metrics" },
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "run_id": "={{ $('Expand Leads').item.json.run_id }}",
            "variant": "={{ $('Expand Leads').item.json.variant }}",
            "strategy_id": "={{ $('Expand Leads').item.json.strategy_id }}",
            "lead_email": "={{ $('Expand Leads').item.json.to }}",
            "sent_at": "={{ new Date().toISOString() }}",
            "replied": "false",
            "replied_at": ""
          }
        },
        "options": {}
      },
      "id": "log-to-sheets",
      "name": "Log to Google Sheet",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [900, 300],
      "credentials": {
        "googleSheetsOAuth2Api": {
          "id": "REPLACE_WITH_GOOGLE_CREDENTIAL_ID",
          "name": "Google Sheets"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "// Count accepted emails and return summary\nconst items = $input.all();\nreturn [{ json: { accepted: items.length } }];"
      },
      "id": "summary",
      "name": "Return Summary",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1120, 300]
    }
  ],
  "connections": {
    "Webhook": { "main": [[{ "node": "Expand Leads", "type": "main", "index": 0 }]] },
    "Expand Leads": { "main": [[{ "node": "Send Email via SES", "type": "main", "index": 0 }]] },
    "Send Email via SES": { "main": [[{ "node": "Log to Google Sheet", "type": "main", "index": 0 }]] },
    "Log to Google Sheet": { "main": [[{ "node": "Return Summary", "type": "main", "index": 0 }]] }
  },
  "settings": {
    "executionOrder": "v1"
  },
  "meta": {
    "description": "Receives deploy.js webhook → sends emails via SES → logs to Google Sheets. Import into n8n and replace credential IDs."
  }
}
```

- [ ] **Step 2: Crear `n8n/workflows/reply-watcher.json`**

```json
{
  "name": "Autoresearch Reply Watcher",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [{ "field": "minutes", "minutesInterval": 15 }]
        }
      },
      "id": "schedule",
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [240, 300]
    },
    {
      "parameters": {
        "mailbox": "INBOX",
        "limit": 20,
        "downloadAttachments": false,
        "options": {
          "allowUnauthorizedCerts": false,
          "markSeen": true
        },
        "filters": {
          "seen": false
        }
      },
      "id": "read-imap",
      "name": "Read IMAP",
      "type": "n8n-nodes-base.emailReadImap",
      "typeVersion": 2,
      "position": [460, 300],
      "credentials": {
        "imap": {
          "id": "REPLACE_WITH_IMAP_CREDENTIAL_ID",
          "name": "Sisteco IMAP"
        }
      }
    },
    {
      "parameters": {
        "conditions": {
          "options": { "caseSensitive": false },
          "conditions": [
            {
              "leftValue": "={{ $json.subject }}",
              "rightValue": "Re:",
              "operator": { "type": "string", "operation": "contains" }
            }
          ]
        }
      },
      "id": "filter-replies",
      "name": "Filter Replies Only",
      "type": "n8n-nodes-base.filter",
      "typeVersion": 2,
      "position": [680, 300]
    },
    {
      "parameters": {
        "operation": "update",
        "documentId": { "value": "={{ $env.GOOGLE_SHEETS_METRICS_ID }}" },
        "sheetName": { "value": "autoresearch-metrics" },
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "replied": "true",
            "replied_at": "={{ new Date().toISOString() }}"
          }
        },
        "where": {
          "values": [
            {
              "column": "lead_email",
              "value": "={{ $json.from.email || $json.from }}"
            }
          ]
        },
        "options": {}
      },
      "id": "update-sheet",
      "name": "Mark Replied in Sheet",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [900, 300],
      "credentials": {
        "googleSheetsOAuth2Api": {
          "id": "REPLACE_WITH_GOOGLE_CREDENTIAL_ID",
          "name": "Google Sheets"
        }
      }
    }
  ],
  "connections": {
    "Schedule Trigger": { "main": [[{ "node": "Read IMAP", "type": "main", "index": 0 }]] },
    "Read IMAP": { "main": [[{ "node": "Filter Replies Only", "type": "main", "index": 0 }]] },
    "Filter Replies Only": { "main": [[{ "node": "Mark Replied in Sheet", "type": "main", "index": 0 }]] }
  },
  "settings": { "executionOrder": "v1" },
  "meta": {
    "description": "Polls IMAP every 15 min → detects replies → marks replied=true in Google Sheet. Import into n8n."
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/sisteco-autoresearch"
git add n8n/
git commit -m "feat(n8n): add importable workflow templates for email sender + reply watcher"
```

---

## Setup manual post-implementación (no automatizable)

Una vez que los chunks A-E estén completos, Felipe debe hacer esto manualmente:

### 1. Crear Google Sheet de métricas

1. Ir a `sheets.google.com` → crear nueva hoja
2. Renombrar la primera tab: `autoresearch-metrics`
3. Fila 1 (headers): `run_id | variant | strategy_id | lead_email | sent_at | replied | replied_at`
4. Compartir → "Cualquiera con el link puede ver" (lectura pública para API key)
5. Copiar el Sheet ID de la URL → poner en `.env` como `GOOGLE_SHEETS_METRICS_ID`

### 2. Obtener Google API Key (sólo lectura)

1. Ir a `console.cloud.google.com` → credenciales → crear API Key
2. Restringir a "Google Sheets API" para el sheet ID específico
3. Poner en `.env` como `GOOGLE_API_KEY`

### 3. Importar workflows en n8n

1. n8n → Workflows → Import → subir `n8n/workflows/cold-email-sender.json`
2. Configurar credencial SMTP (Amazon SES):
   - Server: `email-smtp.sa-east-1.amazonaws.com`
   - Port: 587
   - User/Pass: desde AWS IAM (SMTP credentials)
3. Configurar credencial Google Sheets OAuth2
4. Reemplazar los `REPLACE_WITH_*_CREDENTIAL_ID` en los nodos
5. Activar el webhook → copiar la URL → poner en `.env` como `N8N_COLD_EMAIL_WEBHOOK`
6. Importar y activar `reply-watcher.json` también

---

## Orden de ejecución de los chunks

Los chunks **A, B, C, D, E** son **completamente independientes entre sí** y pueden ejecutarse en paralelo.

```
PARALELO (lanzar los 5 al mismo tiempo):
  [Agente A] → deploy.js
  [Agente B] → harvest.js
  [Agente C] → strategy intelligence (3 scripts + knowledge)
  [Agente D] → content + config
  [Agente E] → n8n workflow JSONs

SECUENCIAL FINAL:
  → Correr suite completa: node --test tests/*.test.js
  → Verificar que todos los tests pasan
  → Commit final de integración
```

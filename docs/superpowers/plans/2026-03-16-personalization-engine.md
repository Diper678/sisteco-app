# Personalization Engine Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a message personalization engine that generates LinkedIn connection notes, follow-up messages, and cold emails tailored per lead using 3 tiers (Claude/Gemini/Templates), outputting in Felipe's voice (Chilean B2B tuteo profesional).

**Architecture:** Node.js CLI script (`scripts/personalize-messages.js`) with 3 personalization tiers determined by ICP score. Template library in `templates/outreach/`. Validation layer checks output quality before use. Can be called standalone (CLI) or via n8n webhook.

**Tech Stack:** Node.js, Claude API (Sonnet), Gemini 2.5 Flash API (existing keys), dotenv, https module (no extra deps).

**Spec:** `docs/superpowers/specs/2026-03-16-linkedin-automation-prospecting-design.md` sections 8.1-8.7

---

## File Structure

```
scripts/
  personalize-messages.js     # Main engine — CLI + programmatic API

templates/outreach/
  linkedin/
    connection-note.md        # Template with {variables} for connection notes
    follow-up-1.md            # Value message template
    follow-up-2.md            # CTA message template
  email/
    touch-1-intro.md          # Email 1: Introduction
    touch-2-value.md          # Email 2: Value insight
    touch-3-casestudy.md      # Email 3: Case study / metric
    touch-4-directask.md      # Email 4: Direct ask
    touch-5-breakup.md        # Email 5: Breakup
  industry-hooks.json         # Industry-specific hooks and metrics
  role-angles.json            # Role-specific angles and CTAs
  voice-rules.json            # Felipe's voice rules + blacklisted phrases

tests/
  test-personalize.js         # Test suite for personalization engine
```

---

## Chunk 1: Template Library + Voice Rules

### Task 1: Create industry hooks data

**Files:**
- Create: `templates/outreach/industry-hooks.json`

- [ ] **Step 1: Create the industry hooks file**

```json
{
  "information technology": {
    "hook_es": "automatizar el pipeline de ventas tech",
    "pain_es": "ciclo de venta largo, muchos leads frios",
    "metric": "5-7x mas conversiones vs stack DIY",
    "question": "Cuantos de tus leads realmente responden?"
  },
  "financial services": {
    "hook_es": "compliance y ventas no son opuestos",
    "pain_es": "regulacion frena adopcion tech",
    "metric": "89% retencion omnicanal vs 33% monocanal",
    "question": "Tu equipo esta respondiendo en menos de 5 minutos?"
  },
  "insurance": {
    "hook_es": "tus agentes deberian vender, no prospectar",
    "pain_es": "agentes pierden tiempo en leads no calificados",
    "metric": "78% de clientes compran del primer vendedor en responder",
    "question": "Cuanto tiempo pasa entre que llega un lead y alguien lo contacta?"
  },
  "management consulting": {
    "hook_es": "mas reuniones sin contratar un SDR",
    "pain_es": "necesitan leads constantes pero no tienen SDR",
    "metric": "21x mas conversiones respondiendo < 5 minutos",
    "question": "Como estas generando pipeline hoy?"
  },
  "mining": {
    "hook_es": "pipeline predecible para ciclos largos",
    "pain_es": "ciclos largos, relaciones clave",
    "metric": "391% ROI en automatizacion (Forrester/PolyAI)",
    "question": "Tu equipo comercial tiene visibilidad del pipeline completo?"
  },
  "telecommunications": {
    "hook_es": "escalar sin escalar el equipo",
    "pain_es": "alta competencia, necesitan velocidad",
    "metric": "5-7x mas conversiones vs stack DIY",
    "question": "Cuanto cuesta cada lead que no contactas a tiempo?"
  },
  "_default": {
    "hook_es": "automatizar la prospeccion B2B",
    "pain_es": "prospeccion manual consume tiempo del equipo de ventas",
    "metric": "5-7x mas conversiones vs stack DIY",
    "question": "Tu equipo de ventas pasa mas tiempo prospectando o cerrando?"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add templates/outreach/industry-hooks.json
git commit -m "feat: add industry hooks for outreach personalization"
```

---

### Task 2: Create role angles data

**Files:**
- Create: `templates/outreach/role-angles.json`

- [ ] **Step 1: Create the role angles file**

```json
{
  "ceo": {
    "match": "\\b(ceo|presidente|fundador|founder|owner|co-founder|gerente general|general manager)\\b",
    "angle_es": "ROI y vision de largo plazo",
    "cta_es": "15 min para mostrarte los numeros",
    "value_es": "resultado macro para la empresa"
  },
  "cto": {
    "match": "\\b(cto|director (de )?tecnologia|chief technology|vp (of )?engineering|gerente (de )?ti|head of (tech|engineering))\\b",
    "angle_es": "stack, integraciones, data",
    "cta_es": "te muestro la arquitectura en 15 min",
    "value_es": "integracion con tu stack actual sin rehacer nada"
  },
  "sales_director": {
    "match": "\\b(director comercial|vp (of )?sales|chief revenue|cro|head of sales|director (de )?ventas)\\b",
    "angle_es": "pipeline, conversion, velocidad",
    "cta_es": "tengo data de conversion que te va a interesar",
    "value_es": "leads calificados que tu equipo solo tiene que cerrar"
  },
  "sales_manager": {
    "match": "\\b(gerente (de )?ventas|sales manager|jefe (de )?ventas|subgerente (de )?ventas)\\b",
    "angle_es": "operaciones, eficiencia, leads calificados",
    "cta_es": "tu equipo solo habla con los que quieren comprar",
    "value_es": "automatizar la prospeccion para que vendas mas"
  },
  "bizdev": {
    "match": "\\b(business development|desarrollo (de )?negocios|growth|expansion)\\b",
    "angle_es": "expansion y nuevos mercados",
    "cta_es": "automatiza la prospeccion y enfocate en cerrar",
    "value_es": "pipeline predecible sin esfuerzo manual"
  },
  "digital_transformation": {
    "match": "\\b(transformacion digital|digital transformation|innovacion|innovation|digitalizacion)\\b",
    "angle_es": "IA aplicada a ventas B2B",
    "cta_es": "te muestro como la IA ya esta cambiando ventas B2B en Chile",
    "value_es": "automatizacion inteligente del proceso comercial"
  },
  "_default": {
    "match": ".*",
    "angle_es": "eficiencia en ventas B2B",
    "cta_es": "15 minutos para mostrarte como funciona",
    "value_es": "mas cierres con menos esfuerzo manual"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add templates/outreach/role-angles.json
git commit -m "feat: add role angles for outreach personalization"
```

---

### Task 3: Create voice rules

**Files:**
- Create: `templates/outreach/voice-rules.json`

- [ ] **Step 1: Create the voice rules file**

```json
{
  "voice": "Felipe, fundador de Sisteco. Tuteo profesional chileno.",
  "language": "es-CL",
  "formality": "tu (never usted)",
  "signature": "Felipe Martinez\nSisteco — Santiago, Chile\ncontacto@sisteco.cl | +56 9 40065566",
  "blacklist_phrases": [
    "espero que te encuentres bien",
    "espero que estes bien",
    "no dudes en",
    "me permito",
    "estimado/a",
    "distinguido/a",
    "de antemano",
    "quedo atento",
    "sin otro particular",
    "aprovecho la oportunidad",
    "es un placer",
    "me complace",
    "le saluda",
    "por medio de la presente",
    "agradecer de antemano",
    "solucion innovadora",
    "herramienta integral",
    "plataforma de vanguardia"
  ],
  "approved_metrics": [
    "5-7x mas conversiones vs stack DIY",
    "21x mas conversiones respondiendo < 5 minutos",
    "78% de clientes compran del primer vendedor en responder",
    "391% ROI en automatizacion (Forrester/PolyAI)",
    "89% retencion omnicanal vs 33% monocanal"
  ],
  "constraints": {
    "linkedin_connection_note_max_chars": 300,
    "linkedin_message_max_chars": 500,
    "email_body_max_words": 100,
    "email_subject_max_chars": 60
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add templates/outreach/voice-rules.json
git commit -m "feat: add voice rules for Felipe's outreach tone"
```

---

### Task 4: Create LinkedIn templates

**Files:**
- Create: `templates/outreach/linkedin/connection-note.md`
- Create: `templates/outreach/linkedin/follow-up-1.md`
- Create: `templates/outreach/linkedin/follow-up-2.md`

- [ ] **Step 1: Create connection note template**

Write to `templates/outreach/linkedin/connection-note.md`:

```markdown
Hola {firstName}, vi que lideras {roleArea} en {company}. En Sisteco ayudamos a equipos de ventas B2B a {industryHook}. {question} — {firstName}, hablamos?
```

- [ ] **Step 2: Create follow-up 1 (value) template**

Write to `templates/outreach/linkedin/follow-up-1.md`:

```markdown
{firstName}, gracias por conectar.

Te comparto un dato: {metric}.

En Sisteco estamos ayudando a empresas {industryContext} a automatizar su prospeccion B2B — {valueProp}.

Si te interesa, te cuento mas en 15 min.

Felipe
```

- [ ] **Step 3: Create follow-up 2 (CTA) template**

Write to `templates/outreach/linkedin/follow-up-2.md`:

```markdown
{firstName}, se que el tiempo es limitado. Solo queria saber: {directQuestion}

Si tiene sentido, {cta}. Si no, sin problema — quedo como contacto por si en algun momento te sirve.

Felipe
```

- [ ] **Step 4: Commit**

```bash
git add templates/outreach/linkedin/
git commit -m "feat: add LinkedIn outreach message templates"
```

---

### Task 5: Create email sequence templates

**Files:**
- Create: `templates/outreach/email/touch-1-intro.md`
- Create: `templates/outreach/email/touch-2-value.md`
- Create: `templates/outreach/email/touch-3-casestudy.md`
- Create: `templates/outreach/email/touch-4-directask.md`
- Create: `templates/outreach/email/touch-5-breakup.md`

- [ ] **Step 1: Create Touch 1 (Intro)**

Write to `templates/outreach/email/touch-1-intro.md`:

```markdown
---
subject: "{company} + automatizacion B2B"
---

{firstName}, te escribo porque vi tu perfil en LinkedIn y me llamo la atencion lo que estan haciendo en {company}.

{personalHook}

En Sisteco automatizamos la prospeccion B2B para que tu equipo de ventas solo hable con los leads que realmente quieren comprar. {metric}.

{cta}?

Felipe Martinez
Sisteco — Santiago, Chile
```

- [ ] **Step 2: Create Touch 2 (Value)**

Write to `templates/outreach/email/touch-2-value.md`:

```markdown
---
subject: "dato rapido sobre {industryName}"
---

{firstName}, un dato que me parecio relevante para {company}:

{metric}

La mayoria de los equipos de ventas en {industryName} pierden tiempo en leads frios. {valueProp}.

Si te interesa ver como funciona, {cta}.

Felipe
```

- [ ] **Step 3: Create Touch 3 (Case Study)**

Write to `templates/outreach/email/touch-3-casestudy.md`:

```markdown
---
subject: "{metricShort} en 30 dias"
---

{firstName}, corto y al punto:

Empresas B2B en Chile que automatizan su pipeline de ventas estan viendo {metric}. La diferencia: responder rapido y solo a los leads correctos.

{industrySpecificInsight}

15 minutos para mostrarte como? {cta}.

Felipe
```

- [ ] **Step 4: Create Touch 4 (Direct Ask)**

Write to `templates/outreach/email/touch-4-directask.md`:

```markdown
---
subject: "{firstName}, una pregunta"
---

{firstName}, te lo pregunto directo: {directQuestion}

Si la respuesta es si, te muestro en 15 minutos como lo resolvemos. Si no, todo bien — no insisto mas.

{cta}?

Felipe
```

- [ ] **Step 5: Create Touch 5 (Breakup)**

Write to `templates/outreach/email/touch-5-breakup.md`:

```markdown
---
subject: "ultima vez que escribo"
---

{firstName}, entiendo que no es el momento o que esto no te interesa. Sin drama.

Solo queria dejarte el dato: {metric}. Si en algun momento quieres explorar como automatizar ventas B2B, estoy a un mensaje de distancia.

Exito con {company}.

Felipe
```

- [ ] **Step 6: Commit**

```bash
git add templates/outreach/email/
git commit -m "feat: add 5-touch cold email sequence templates"
```

---

## Chunk 2: Personalization Engine Core

### Task 6: Build the personalization engine script

**Files:**
- Create: `scripts/personalize-messages.js`

- [ ] **Step 1: Write the test file**

Create `tests/test-personalize.js`:

```javascript
#!/usr/bin/env node
/**
 * test-personalize.js — Tests for personalization engine
 */
const assert = require('assert');
const path = require('path');

// We'll test the engine module functions directly
// For now, just test data loading and template filling
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'outreach');

function test(name, fn) {
  try { fn(); console.log(`  PASS: ${name}`); }
  catch (e) { console.log(`  FAIL: ${name} — ${e.message}`); process.exitCode = 1; }
}

console.log('Personalization Engine Tests\n');

// Test 1: Data files exist and parse
test('industry-hooks.json loads and has _default', () => {
  const hooks = require(path.join(TEMPLATES_DIR, 'industry-hooks.json'));
  assert(hooks._default, 'missing _default');
  assert(hooks._default.hook_es, 'missing hook_es');
  assert(hooks['information technology'], 'missing IT industry');
});

test('role-angles.json loads and has _default', () => {
  const roles = require(path.join(TEMPLATES_DIR, 'role-angles.json'));
  assert(roles._default, 'missing _default');
  assert(roles.ceo, 'missing ceo');
  assert(roles.ceo.match, 'missing match regex');
});

test('voice-rules.json loads with constraints', () => {
  const voice = require(path.join(TEMPLATES_DIR, 'voice-rules.json'));
  assert(voice.blacklist_phrases.length > 10, 'too few blacklist phrases');
  assert(voice.constraints.linkedin_connection_note_max_chars === 300, 'wrong max chars');
  assert(voice.approved_metrics.length >= 5, 'too few approved metrics');
});

// Test 2: Template files exist
const fs = require('fs');
test('LinkedIn templates exist', () => {
  assert(fs.existsSync(path.join(TEMPLATES_DIR, 'linkedin', 'connection-note.md')));
  assert(fs.existsSync(path.join(TEMPLATES_DIR, 'linkedin', 'follow-up-1.md')));
  assert(fs.existsSync(path.join(TEMPLATES_DIR, 'linkedin', 'follow-up-2.md')));
});

test('Email templates exist (5 touches)', () => {
  for (let i = 1; i <= 5; i++) {
    const names = ['intro', 'value', 'casestudy', 'directask', 'breakup'];
    assert(fs.existsSync(path.join(TEMPLATES_DIR, 'email', `touch-${i}-${names[i-1]}.md`)));
  }
});

// Test 3: Role matching
test('role matching regex works', () => {
  const roles = require(path.join(TEMPLATES_DIR, 'role-angles.json'));
  const ceoRegex = new RegExp(roles.ceo.match, 'i');
  assert(ceoRegex.test('CEO y Fundador'), 'should match CEO');
  assert(ceoRegex.test('Gerente General'), 'should match Gerente General');
  assert(!ceoRegex.test('Analista Junior'), 'should not match Analista');
});

// Test 4: Blacklist detection
test('blacklist detection works', () => {
  const voice = require(path.join(TEMPLATES_DIR, 'voice-rules.json'));
  const text = 'Espero que te encuentres bien, estimado cliente';
  const found = voice.blacklist_phrases.filter(phrase =>
    text.toLowerCase().includes(phrase.toLowerCase())
  );
  assert(found.length >= 1, 'should detect blacklisted phrases');
});

console.log('\nDone.');
```

- [ ] **Step 2: Run tests to verify data files**

```bash
node tests/test-personalize.js
```

Expected: All PASS (once template files from Tasks 1-5 are created).

- [ ] **Step 3: Commit test file**

```bash
git add tests/test-personalize.js
git commit -m "test: add personalization engine test suite"
```

---

### Task 7: Build personalize-messages.js — Core engine

**Files:**
- Create: `scripts/personalize-messages.js`

- [ ] **Step 1: Write the engine**

```javascript
#!/usr/bin/env node
/**
 * personalize-messages.js — Multi-tier message personalization for B2B outreach
 *
 * Tiers:
 *   Tier 1 (HOT, ICP >= 80): Claude Sonnet — full personalization
 *   Tier 2 (WARM, ICP 50-79): Gemini 2.5 Flash — template + AI variables
 *   Tier 3 (NURTURE, ICP 30-49): Deterministic template fill
 *
 * Usage:
 *   node scripts/personalize-messages.js generate --lead '{"firstName":"Juan",...}'
 *   node scripts/personalize-messages.js batch --input pb-leads-enriched.json --limit 10
 *   node scripts/personalize-messages.js preview --lead '{"firstName":"Juan",...}'
 *   node scripts/personalize-messages.js validate --text "mensaje a validar"
 *
 * Environment:
 *   CLAUDE_API_KEY or ANTHROPIC_API_KEY  — For Tier 1 (HOT leads)
 *   GEMINI_API_KEY                        — For Tier 2 (WARM leads)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'outreach');
const ROOT = path.join(__dirname, '..');

// --- Load data ---

const industryHooks = require(path.join(TEMPLATES_DIR, 'industry-hooks.json'));
const roleAngles = require(path.join(TEMPLATES_DIR, 'role-angles.json'));
const voiceRules = require(path.join(TEMPLATES_DIR, 'voice-rules.json'));

// --- Helpers ---

function matchIndustry(industry) {
  const key = (industry || '').toLowerCase();
  for (const [k, v] of Object.entries(industryHooks)) {
    if (k !== '_default' && key.includes(k)) return v;
  }
  return industryHooks._default;
}

function matchRole(headline) {
  const text = (headline || '').toLowerCase();
  for (const [k, v] of Object.entries(roleAngles)) {
    if (k === '_default') continue;
    try {
      if (new RegExp(v.match, 'i').test(text)) return { key: k, ...v };
    } catch { continue; }
  }
  return { key: '_default', ...roleAngles._default };
}

function fillTemplate(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  return result.trim();
}

function loadTemplate(category, name) {
  const filePath = path.join(TEMPLATES_DIR, category, name);
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

function validate(text, type) {
  const issues = [];
  const constraints = voiceRules.constraints;

  // Length checks
  if (type === 'connection_note' && text.length > constraints.linkedin_connection_note_max_chars) {
    issues.push(`Too long: ${text.length}/${constraints.linkedin_connection_note_max_chars} chars`);
  }
  if (type === 'linkedin_message' && text.length > constraints.linkedin_message_max_chars) {
    issues.push(`Too long: ${text.length}/${constraints.linkedin_message_max_chars} chars`);
  }
  if (type === 'email_body') {
    const wordCount = text.split(/\s+/).length;
    if (wordCount > constraints.email_body_max_words) {
      issues.push(`Too long: ${wordCount}/${constraints.email_body_max_words} words`);
    }
  }

  // Blacklist check
  const blacklisted = voiceRules.blacklist_phrases.filter(phrase =>
    text.toLowerCase().includes(phrase.toLowerCase())
  );
  if (blacklisted.length > 0) {
    issues.push(`Blacklisted phrases: ${blacklisted.join(', ')}`);
  }

  // Unresolved variables
  const unresolvedVars = text.match(/\{[a-zA-Z]+\}/g);
  if (unresolvedVars) {
    issues.push(`Unresolved variables: ${unresolvedVars.join(', ')}`);
  }

  return { valid: issues.length === 0, issues };
}

// --- Tier 3: Deterministic Templates ---

function personalizeTier3(lead, messageType) {
  const ind = matchIndustry(lead.industry);
  const role = matchRole(lead.headline || lead.jobTitle);

  const vars = {
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    company: lead.company || '',
    roleArea: role.angle_es,
    industryHook: ind.hook_es,
    industryName: lead.industry || 'tu industria',
    industryContext: `en ${lead.industry || 'B2B'}`,
    industrySpecificInsight: ind.pain_es,
    question: ind.question,
    metric: ind.metric,
    metricShort: (ind.metric || '').split(' ').slice(0, 4).join(' '),
    valueProp: role.value_es,
    directQuestion: `tu equipo de ventas pierde tiempo prospectando en vez de cerrando?`,
    cta: role.cta_es,
    personalHook: `Me llamo la atencion tu rol como ${lead.jobTitle || 'lider'} en ${lead.company || 'tu empresa'}.`,
  };

  if (messageType === 'connection_note') {
    const tpl = loadTemplate('linkedin', 'connection-note.md');
    return { text: fillTemplate(tpl, vars), tier: 3 };
  }
  if (messageType === 'follow_up_1') {
    const tpl = loadTemplate('linkedin', 'follow-up-1.md');
    return { text: fillTemplate(tpl, vars), tier: 3 };
  }
  if (messageType === 'follow_up_2') {
    const tpl = loadTemplate('linkedin', 'follow-up-2.md');
    return { text: fillTemplate(tpl, vars), tier: 3 };
  }
  if (messageType.startsWith('email_touch_')) {
    const touchNum = messageType.replace('email_touch_', '');
    const names = { '1': 'touch-1-intro.md', '2': 'touch-2-value.md', '3': 'touch-3-casestudy.md', '4': 'touch-4-directask.md', '5': 'touch-5-breakup.md' };
    const tpl = loadTemplate('email', names[touchNum] || names['1']);
    // Extract subject from frontmatter
    const subjectMatch = tpl.match(/^---\nsubject: "(.+?)"\n---/);
    const subject = subjectMatch ? fillTemplate(subjectMatch[1], vars) : `${vars.company} + automatizacion B2B`;
    const body = fillTemplate(tpl.replace(/^---[\s\S]*?---\n/, ''), vars);
    return { subject, text: body, tier: 3 };
  }

  return { text: '', tier: 3 };
}

// --- Tier 2: Gemini Flash ---

const GEMINI_KEYS = (process.env.GEMINI_API_KEY || '').split(',').filter(Boolean);
// Fallback to the keys from score-leads.js if env not set
if (GEMINI_KEYS.length === 0) {
  console.warn('Warning: GEMINI_API_KEY not set in .env — Tier 2 will fall back to Tier 3');
}
const allGeminiKeys = GEMINI_KEYS;
let geminiKeyIdx = 0;
function nextGeminiKey() {
  const key = allGeminiKeys[geminiKeyIdx % allGeminiKeys.length];
  geminiKeyIdx++;
  return key;
}

function geminiRequest(prompt, key) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
    });
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          resolve(text.trim());
        } catch { resolve(''); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function personalizeTier2(lead, messageType) {
  // Start with Tier 3 as base
  const base = personalizeTier3(lead, messageType);
  const ind = matchIndustry(lead.industry);
  const role = matchRole(lead.headline || lead.jobTitle);

  const prompt = `Eres Felipe, fundador de Sisteco, una empresa de automatizacion de ventas B2B en Chile.
Reescribe el siguiente mensaje de outreach para que suene mas natural y personalizado.
Usa tuteo profesional chileno. NO uses frases como "espero que te encuentres bien" o "estimado".
Mantén el largo similar al original. Incluye la metrica "${ind.metric}" si es relevante.

Lead: ${lead.firstName} ${lead.lastName}, ${lead.jobTitle || lead.headline || ''} en ${lead.company}
Industria: ${lead.industry || 'B2B'}

Mensaje original:
${base.text}

Reescribe el mensaje (solo el texto, sin explicaciones):`;

  try {
    const key = nextGeminiKey();
    const improved = await geminiRequest(prompt, key);
    if (improved && improved.length > 20) {
      return { text: improved, subject: base.subject, tier: 2 };
    }
  } catch { /* fallback to tier 3 */ }

  return base;
}

// --- Tier 1: Claude Sonnet ---

function claudeRequest(systemPrompt, userPrompt) {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) return Promise.resolve('');

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.content?.[0]?.text || '';
          resolve(text.trim());
        } catch { resolve(''); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function personalizeTier1(lead, messageType) {
  const ind = matchIndustry(lead.industry);
  const role = matchRole(lead.headline || lead.jobTitle);
  const bio = lead.additionalInfo || '';

  const systemPrompt = `Eres Felipe Martinez, fundador de Sisteco, una plataforma de automatizacion de ventas B2B en Chile.
Tu tono es directo, data-driven, tuteo profesional chileno. Nunca suenas como IA.

REGLAS ESTRICTAS:
- Tuteo siempre (tu, no usted)
- NUNCA usar: "espero que te encuentres bien", "estimado", "me permito", "no dudes en"
- NUNCA inventar metricas o testimonios
- Metricas APROBADAS que puedes usar: ${voiceRules.approved_metrics.join(' | ')}
- Suena como un colega que te manda un mensaje, no como un vendedor
- CTA siempre con dia/hora especifica ("15 min el martes?")
- Corto y directo. Sin relleno.`;

  const typeInstructions = {
    connection_note: `Escribe una nota de conexion de LinkedIn (MAX 300 caracteres). Debe mencionar algo especifico del lead.`,
    follow_up_1: `Escribe un primer mensaje de seguimiento en LinkedIn (MAX 500 chars). Entrega valor: un insight o metrica relevante a su industria.`,
    follow_up_2: `Escribe un segundo mensaje de LinkedIn (MAX 400 chars). CTA directo: proponer reunion de 15 min.`,
    email_touch_1: `Escribe el primer email frio (MAX 80 palabras + subject line). Intro + hook personalizado.`,
    email_touch_2: `Escribe el segundo email (MAX 100 palabras + subject line). Valor: insight o metrica relevante.`,
    email_touch_3: `Escribe el tercer email (MAX 100 palabras + subject line). Mini caso de estudio con metrica real.`,
    email_touch_4: `Escribe el cuarto email (MAX 60 palabras + subject line). Pregunta directa, sin rodeos.`,
    email_touch_5: `Escribe el quinto email (MAX 50 palabras + subject line). Breakup: ultimo intento, tono amigable.`,
  };

  const userPrompt = `Lead:
- Nombre: ${lead.firstName} ${lead.lastName}
- Cargo: ${lead.jobTitle || lead.headline || 'N/A'}
- Empresa: ${lead.company}
- Industria: ${lead.industry || 'N/A'}
- Ubicacion: ${lead.location || 'Chile'}
${bio ? `- Bio LinkedIn: ${bio.slice(0, 500)}` : ''}

Industria hook: ${ind.hook_es}
Role angle: ${role.angle_es}
CTA sugerido: ${role.cta_es}

${typeInstructions[messageType] || typeInstructions.connection_note}

${messageType.startsWith('email_') ? 'Formato: primera linea = Subject: "...", luego linea vacia, luego el body.' : ''}

Escribe SOLO el mensaje, sin explicaciones ni comillas:`;

  try {
    const result = await claudeRequest(systemPrompt, userPrompt);
    if (result && result.length > 20) {
      // Parse subject from email responses
      if (messageType.startsWith('email_')) {
        const subjectMatch = result.match(/^Subject:\s*"?(.+?)"?\s*\n/i);
        const subject = subjectMatch ? subjectMatch[1] : `${lead.company} + automatizacion B2B`;
        const body = result.replace(/^Subject:\s*.+?\n\s*/, '');
        return { subject, text: body, tier: 1 };
      }
      return { text: result, tier: 1 };
    }
  } catch { /* fallback */ }

  // Fallback to Tier 2
  return personalizeTier2(lead, messageType);
}

// --- Main Personalization Function ---

async function personalize(lead, messageType) {
  const score = lead.score || lead.icpScore || lead._icpScore || 0;
  if (score === 0) console.warn(`  Warning: No ICP score for ${lead.firstName} ${lead.lastName} — defaulting to Tier 3`);

  let result;
  if (score >= 80) {
    result = await personalizeTier1(lead, messageType);
  } else if (score >= 50) {
    result = await personalizeTier2(lead, messageType);
  } else {
    result = personalizeTier3(lead, messageType);
  }

  // Validate
  const validationType = messageType === 'connection_note' ? 'connection_note'
    : messageType.startsWith('follow_up') ? 'linkedin_message'
    : messageType.startsWith('email_') ? 'email_body'
    : 'email_body';
  const validation = validate(result.text, validationType);

  // Post-process: truncate if too long, strip blacklisted phrases
  if (!validation.valid) {
    const constraints = voiceRules.constraints;
    let text = result.text;
    // Truncate over-length
    if (validationType === 'connection_note' && text.length > constraints.linkedin_connection_note_max_chars) {
      text = text.slice(0, constraints.linkedin_connection_note_max_chars - 3) + '...';
    }
    // Strip blacklisted phrases
    for (const phrase of voiceRules.blacklist_phrases) {
      text = text.replace(new RegExp(phrase, 'gi'), '').replace(/\s{2,}/g, ' ');
    }
    result.text = text.trim();
  }

  return { ...result, validation, messageType, leadName: `${lead.firstName} ${lead.lastName}` };
}

// --- CLI Commands ---

async function cmdGenerate(leadJson) {
  const lead = typeof leadJson === 'string' ? JSON.parse(leadJson) : leadJson;
  const types = ['connection_note', 'follow_up_1', 'follow_up_2',
    'email_touch_1', 'email_touch_2', 'email_touch_3', 'email_touch_4', 'email_touch_5'];

  console.log(`\nGenerating messages for: ${lead.firstName} ${lead.lastName} @ ${lead.company}`);
  console.log(`ICP Score: ${lead.icpScore || lead._icpScore || 'N/A'} → Tier ${(lead.icpScore || 0) >= 80 ? 1 : (lead.icpScore || 0) >= 50 ? 2 : 3}\n`);

  for (const type of types) {
    const result = await personalize(lead, type);
    const label = type.replace(/_/g, ' ').toUpperCase();
    console.log(`--- ${label} (Tier ${result.tier}) ---`);
    if (result.subject) console.log(`Subject: ${result.subject}`);
    console.log(result.text);
    if (!result.validation.valid) {
      console.log(`⚠ Issues: ${result.validation.issues.join('; ')}`);
    }
    console.log('');
  }
}

async function cmdBatch(inputFile, limit) {
  const leads = JSON.parse(fs.readFileSync(path.join(ROOT, inputFile), 'utf-8'));
  const batch = leads
    .filter(l => l.firstName && l.company)
    .slice(0, limit || 10);

  const listsDir = path.join(ROOT, 'leads-lists');
  if (!fs.existsSync(listsDir)) fs.mkdirSync(listsDir, { recursive: true });
  const outputPath = path.join(listsDir, 'personalized-messages.json');
  const results = [];

  for (let i = 0; i < batch.length; i++) {
    const lead = batch[i];
    console.log(`[${i + 1}/${batch.length}] ${lead.firstName} ${lead.lastName} @ ${lead.company}`);

    const messages = {};
    const allTypes = ['connection_note', 'follow_up_1', 'follow_up_2',
      'email_touch_1', 'email_touch_2', 'email_touch_3', 'email_touch_4', 'email_touch_5'];
    for (const type of allTypes) {
      messages[type] = await personalize(lead, type);
      await new Promise(r => setTimeout(r, 500)); // rate limit
    }

    results.push({
      leadId: lead.linkedinProfileUrl || lead.profileUrl || '',
      fullName: lead.fullName,
      company: lead.company,
      tier: messages.connection_note.tier,
      messages
    });
  }

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nSaved ${results.length} personalized lead messages to: ${outputPath}`);
}

async function cmdPreview(leadJson) {
  const lead = typeof leadJson === 'string' ? JSON.parse(leadJson) : leadJson;
  const result = await personalize(lead, 'connection_note');
  console.log(`\nPreview (Tier ${result.tier}, ${result.text.length} chars):`);
  console.log(result.text);
  console.log(`\nValidation: ${result.validation.valid ? 'PASS' : 'FAIL — ' + result.validation.issues.join('; ')}`);
}

function cmdValidate(text) {
  const result = validate(text, 'email_body');
  console.log(`Validation: ${result.valid ? 'PASS' : 'FAIL'}`);
  if (!result.valid) result.issues.forEach(i => console.log(`  - ${i}`));
}

// --- CLI ---
async function main() {
  const cmd = process.argv[2];
  const args = process.argv.slice(3);

  function getFlag(name) {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 ? args[idx + 1] : null;
  }

  switch (cmd) {
    case 'generate':
      await cmdGenerate(getFlag('lead'));
      break;
    case 'batch':
      await cmdBatch(getFlag('input') || 'pb-leads-enriched.json', parseInt(getFlag('limit') || '10'));
      break;
    case 'preview':
      await cmdPreview(getFlag('lead'));
      break;
    case 'validate':
      cmdValidate(args.join(' '));
      break;
    default:
      console.log(`
personalize-messages.js — Multi-tier outreach personalization

Commands:
  generate --lead '{...}'     Generate all messages for a lead (JSON)
  batch --input FILE --limit N  Batch generate for N leads from enriched JSON
  preview --lead '{...}'      Quick preview of connection note
  validate TEXT               Validate text against voice rules

Tiers:
  Tier 1 (HOT, ICP >= 80):    Claude Sonnet — full AI personalization
  Tier 2 (WARM, ICP 50-79):   Gemini Flash — template + AI rewrite
  Tier 3 (NURTURE, ICP 30-49): Deterministic template fill

Environment:
  CLAUDE_API_KEY / ANTHROPIC_API_KEY  For Tier 1
  GEMINI_API_KEY                       For Tier 2
      `);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

// Export for programmatic use
module.exports = { personalize, validate, matchIndustry, matchRole, fillTemplate };
```

- [ ] **Step 2: Run the test suite**

```bash
node tests/test-personalize.js
```

Expected: All PASS

- [ ] **Step 3: Test Tier 3 with a real lead**

Create a test file `tests/sample-lead-hot.json`:
```json
{"firstName":"Cesar","lastName":"Carrasco","company":"Primus","jobTitle":"CEO","industry":"Information Technology","headline":"CEO | Primus","score":100,"additionalInfo":"Lider en soluciones tecnologicas para empresas chilenas"}
```

Then run:
```bash
node scripts/personalize-messages.js generate --lead-file tests/sample-lead-hot.json
```

Note: Also add `--lead-file` support to `cmdGenerate`:
```javascript
// In main(), add to the generate case:
const leadFile = getFlag('lead-file');
const leadData = leadFile
  ? fs.readFileSync(path.join(ROOT, leadFile), 'utf-8')
  : getFlag('lead');
await cmdGenerate(leadData);
```

Expected: 8 personalized messages generated using Tier 3 templates (or Tier 1 if CLAUDE_API_KEY set)

- [ ] **Step 4: Commit**

```bash
git add scripts/personalize-messages.js tests/test-personalize.js
git commit -m "feat: build multi-tier personalization engine (Claude/Gemini/Templates)"
```

---

### Task 8: Integration test with real enriched data

**Files:**
- Read: `pb-leads-enriched.json`

- [ ] **Step 1: Run batch personalization on 5 real leads**

```bash
node scripts/personalize-messages.js batch --input pb-leads-enriched.json --limit 5
```

Expected: Creates `leads-lists/personalized-messages.json` with 5 leads, each with connection_note + follow_up_1 + follow_up_2 + email_touch_1

- [ ] **Step 2: Review output quality**

Read `leads-lists/personalized-messages.json` and verify:
- Messages are in Spanish (es-CL)
- No blacklisted phrases
- Connection notes <= 300 chars
- Messages reference the lead's actual company and industry
- CTA is present in follow-up messages

- [ ] **Step 3: Final commit**

```bash
git add leads-lists/personalized-messages.json
git commit -m "test: verify personalization engine with real lead data"
```

---

## Execution Notes

**Dependencies:** This plan requires NO new npm packages. Uses Node.js built-in `https` module for API calls.

**API Keys:** Tier 3 (templates) works with zero API keys. Tier 2 needs `GEMINI_API_KEY` (already in .env). Tier 1 needs `CLAUDE_API_KEY` or `ANTHROPIC_API_KEY` (optional — falls back to Tier 2).

**Next plan:** After this plan is executed, proceed with `2026-03-16-linkedin-outreach.md` which depends on the personalization engine being functional.

#!/usr/bin/env node
/**
 * personalize-messages.js — Multi-tier message personalization for B2B outreach
 *
 * Tiers:
 *   Tier 1 (HOT, ICP >= 80): Claude Sonnet — full personalization
 *   Tier 2 (WARM, ICP 50-79): Gemini 2.5 Flash — template + AI variables
 *   Tier 3 (NURTURE, ICP < 50 or no score): Deterministic template fill
 *
 * Usage:
 *   node scripts/personalize-messages.js generate --lead '{"firstName":"Juan",...}'
 *   node scripts/personalize-messages.js generate --lead-file tests/sample-lead-hot.json
 *   node scripts/personalize-messages.js batch --input pb-leads-enriched.json --limit 10
 *   node scripts/personalize-messages.js preview --lead '{"firstName":"Juan",...}'
 *   node scripts/personalize-messages.js validate --text "mensaje a validar"
 *
 * Environment (read from .env — NO hardcoded keys):
 *   CLAUDE_API_KEY or ANTHROPIC_API_KEY  — For Tier 1 (HOT leads)
 *   GEMINI_API_KEY                        — For Tier 2 (WARM leads), supports _2, _3, etc.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'outreach');
const ROOT = path.join(__dirname, '..');

// --- Load data ---

const industryHooks = require(path.join(TEMPLATES_DIR, 'industry-hooks.json'));
const roleAngles = require(path.join(TEMPLATES_DIR, 'role-angles.json'));
const voiceRules = require(path.join(TEMPLATES_DIR, 'voice-rules.json'));

// --- API Key Management ---

// Collect all Gemini keys from env (GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3, ...)
const allGeminiKeys = [];
if (process.env.GEMINI_API_KEY) allGeminiKeys.push(process.env.GEMINI_API_KEY);
for (let i = 2; i <= 10; i++) {
  const key = process.env[`GEMINI_API_KEY_${i}`];
  if (key) allGeminiKeys.push(key);
}
if (allGeminiKeys.length === 0) {
  console.warn('Warning: GEMINI_API_KEY not set in .env -- Tier 2 will fall back to Tier 3');
}

const claudeApiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '';
if (!claudeApiKey) {
  console.warn('Warning: CLAUDE_API_KEY/ANTHROPIC_API_KEY not set -- Tier 1 will fall back to Tier 2');
}

let geminiKeyIdx = 0;
function nextGeminiKey() {
  if (allGeminiKeys.length === 0) return '';
  const key = allGeminiKeys[geminiKeyIdx % allGeminiKeys.length];
  geminiKeyIdx++;
  return key;
}

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
  // Normalize line endings (Windows \r\n -> \n) for consistent regex matching
  return fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
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
    const wordCount = text.split(/\s+/).filter(Boolean).length;
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

/**
 * Post-process text: truncate if over length, strip blacklisted phrases.
 * Mutates nothing — returns cleaned text.
 */
function postProcess(text, validationType) {
  let cleaned = text;
  const constraints = voiceRules.constraints;

  // Truncate over-length content
  if (validationType === 'connection_note' && cleaned.length > constraints.linkedin_connection_note_max_chars) {
    cleaned = cleaned.slice(0, constraints.linkedin_connection_note_max_chars - 3).trimEnd() + '...';
  }
  if (validationType === 'linkedin_message' && cleaned.length > constraints.linkedin_message_max_chars) {
    cleaned = cleaned.slice(0, constraints.linkedin_message_max_chars - 3).trimEnd() + '...';
  }

  // Strip blacklisted phrases (case-insensitive)
  for (const phrase of voiceRules.blacklist_phrases) {
    cleaned = cleaned.replace(new RegExp(phrase, 'gi'), '').replace(/\s{2,}/g, ' ');
  }

  return cleaned.trim();
}

// --- Tier 3: Deterministic Templates ---

function personalizeTier3(lead, messageType) {
  const ind = matchIndustry(lead.industry);
  const role = matchRole(lead.headline || lead.jobTitle);

  const vars = {
    firstName: (lead.firstName || '').trim(),
    lastName: (lead.lastName || '').trim(),
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
    directQuestion: 'tu equipo de ventas pierde tiempo prospectando en vez de cerrando?',
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
    const names = {
      '1': 'touch-1-intro.md',
      '2': 'touch-2-value.md',
      '3': 'touch-3-casestudy.md',
      '4': 'touch-4-directask.md',
      '5': 'touch-5-breakup.md'
    };
    const tpl = loadTemplate('email', names[touchNum] || names['1']);
    // Extract subject from frontmatter
    const subjectMatch = tpl.match(/^---\nsubject: "(.+?)"\n---/);
    const subject = subjectMatch ? fillTemplate(subjectMatch[1], vars) : `${vars.company} + automatizacion B2B`;
    const body = fillTemplate(tpl.replace(/^---[\s\S]*?---\n/, ''), vars);
    return { subject, text: body, tier: 3 };
  }

  return { text: '', tier: 3 };
}

// --- Tier 2: Gemini 2.5 Flash ---

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
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'Gemini API error'));
            return;
          }
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          resolve(text.trim());
        } catch (e) { resolve(''); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Gemini request timeout')); });
    req.write(body);
    req.end();
  });
}

async function personalizeTier2(lead, messageType) {
  // Start with Tier 3 as base
  const base = personalizeTier3(lead, messageType);

  if (allGeminiKeys.length === 0) return base;

  const ind = matchIndustry(lead.industry);
  const role = matchRole(lead.headline || lead.jobTitle);

  const prompt = `Eres Felipe, fundador de Sisteco, una empresa de automatizacion de ventas B2B en Chile.
Reescribe el siguiente mensaje de outreach para que suene mas natural y personalizado.
Usa tuteo profesional chileno. NO uses frases como "espero que te encuentres bien" o "estimado".
Manten el largo similar al original. Incluye la metrica "${ind.metric}" si es relevante.

Lead: ${(lead.firstName || '').trim()} ${(lead.lastName || '').trim()}, ${lead.jobTitle || lead.headline || ''} en ${lead.company}
Industria: ${lead.industry || 'B2B'}

Mensaje original:
${base.text}

Reescribe el mensaje (solo el texto, sin explicaciones ni comillas):`;

  try {
    const key = nextGeminiKey();
    let improved = await geminiRequest(prompt, key);
    if (improved && improved.length > 20) {
      // Strip any subject line Gemini may inject into the rewritten body
      improved = improved.replace(/^(subject|asunto):\s*.+?\n\s*/gi, '').trim();
      return { text: improved, subject: base.subject, tier: 2 };
    }
  } catch (e) {
    // Tier 2 failed, fall back to Tier 3
    if (process.env.DEBUG) console.warn(`  Tier 2 fallback: ${e.message}`);
  }

  return base;
}

// --- Tier 1: Claude Sonnet ---

function claudeRequest(systemPrompt, userPrompt) {
  if (!claudeApiKey) return Promise.resolve('');

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
        'x-api-key': claudeApiKey,
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
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Claude request timeout')); });
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
    connection_note: 'Escribe una nota de conexion de LinkedIn (MAX 300 caracteres). Debe mencionar algo especifico del lead.',
    follow_up_1: 'Escribe un primer mensaje de seguimiento en LinkedIn (MAX 500 chars). Entrega valor: un insight o metrica relevante a su industria.',
    follow_up_2: 'Escribe un segundo mensaje de LinkedIn (MAX 400 chars). CTA directo: proponer reunion de 15 min.',
    email_touch_1: 'Escribe el primer email frio (MAX 80 palabras + subject line). Intro + hook personalizado.',
    email_touch_2: 'Escribe el segundo email (MAX 100 palabras + subject line). Valor: insight o metrica relevante.',
    email_touch_3: 'Escribe el tercer email (MAX 100 palabras + subject line). Mini caso de estudio con metrica real.',
    email_touch_4: 'Escribe el cuarto email (MAX 60 palabras + subject line). Pregunta directa, sin rodeos.',
    email_touch_5: 'Escribe el quinto email (MAX 50 palabras + subject line). Breakup: ultimo intento, tono amigable.',
  };

  const userPrompt = `Lead:
- Nombre: ${(lead.firstName || '').trim()} ${(lead.lastName || '').trim()}
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
  } catch (e) {
    if (process.env.DEBUG) console.warn(`  Tier 1 fallback: ${e.message}`);
  }

  // Fallback to Tier 2
  return personalizeTier2(lead, messageType);
}

// --- Main Personalization Function ---

async function personalize(lead, messageType) {
  // Review fix: use lead.score || lead.icpScore || lead._icpScore || 0
  const score = lead.score || lead.icpScore || lead._icpScore || 0;
  if (score === 0 && process.env.DEBUG) {
    console.warn(`  Warning: No ICP score for ${lead.firstName} ${lead.lastName} -- defaulting to Tier 3`);
  }

  let result;
  if (score >= 80) {
    result = await personalizeTier1(lead, messageType);
  } else if (score >= 50) {
    result = await personalizeTier2(lead, messageType);
  } else {
    result = personalizeTier3(lead, messageType);
  }

  // Determine validation type
  const validationType = messageType === 'connection_note' ? 'connection_note'
    : messageType.startsWith('follow_up') ? 'linkedin_message'
    : messageType.startsWith('email_') ? 'email_body'
    : 'email_body';

  // Validate before post-processing
  const preValidation = validate(result.text, validationType);

  // Review fix: Post-process (truncate + strip blacklist) instead of just reporting
  if (!preValidation.valid) {
    result.text = postProcess(result.text, validationType);
  }

  // Re-validate after post-processing
  const validation = validate(result.text, validationType);

  return { ...result, validation, messageType, leadName: `${(lead.firstName || '').trim()} ${(lead.lastName || '').trim()}` };
}

// --- All 8 message types ---
const ALL_MESSAGE_TYPES = [
  'connection_note', 'follow_up_1', 'follow_up_2',
  'email_touch_1', 'email_touch_2', 'email_touch_3', 'email_touch_4', 'email_touch_5'
];

// --- CLI Commands ---

async function cmdGenerate(leadJson) {
  const lead = typeof leadJson === 'string' ? JSON.parse(leadJson) : leadJson;
  const score = lead.score || lead.icpScore || lead._icpScore || 0;

  console.log(`\nGenerating messages for: ${(lead.firstName || '').trim()} ${(lead.lastName || '').trim()} @ ${lead.company}`);
  console.log(`ICP Score: ${score || 'N/A'} --> Tier ${score >= 80 ? 1 : score >= 50 ? 2 : 3}\n`);

  // Review fix: Batch generates ALL 8 message types (not just 4)
  for (const type of ALL_MESSAGE_TYPES) {
    const result = await personalize(lead, type);
    const label = type.replace(/_/g, ' ').toUpperCase();
    console.log(`--- ${label} (Tier ${result.tier}) ---`);
    if (result.subject) console.log(`Subject: ${result.subject}`);
    console.log(result.text);
    if (!result.validation.valid) {
      console.log(`[!] Remaining issues: ${result.validation.issues.join('; ')}`);
    }
    console.log('');
  }
}

async function cmdBatch(inputFile, limit) {
  const inputPath = path.isAbsolute(inputFile) ? inputFile : path.join(ROOT, inputFile);
  const leads = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const batch = leads
    .filter(l => l.firstName && l.company)
    .slice(0, limit || 10);

  // Review fix: mkdirSync guard for output directory
  const listsDir = path.join(ROOT, 'leads-lists');
  if (!fs.existsSync(listsDir)) fs.mkdirSync(listsDir, { recursive: true });
  const outputPath = path.join(listsDir, 'personalized-messages.json');
  const results = [];

  console.log(`\nBatch personalization: ${batch.length} leads from ${inputFile}\n`);

  for (let i = 0; i < batch.length; i++) {
    const lead = batch[i];
    const score = lead.score || lead.icpScore || lead._icpScore || 0;
    const tier = score >= 80 ? 1 : score >= 50 ? 2 : 3;
    console.log(`[${i + 1}/${batch.length}] ${(lead.firstName || '').trim()} ${(lead.lastName || '').trim()} @ ${lead.company} (Tier ${tier})`);

    const messages = {};
    // Review fix: generates ALL 8 message types
    for (const type of ALL_MESSAGE_TYPES) {
      messages[type] = await personalize(lead, type);
      // Rate limit: 500ms between API calls to avoid quota issues
      if (tier <= 2) await new Promise(r => setTimeout(r, 500));
    }

    results.push({
      leadId: lead.linkedinProfileUrl || lead.profileUrl || '',
      fullName: lead.fullName || `${(lead.firstName || '').trim()} ${(lead.lastName || '').trim()}`,
      company: lead.company,
      industry: lead.industry || '',
      tier: messages.connection_note.tier,
      messages
    });
  }

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nSaved ${results.length} personalized lead messages to: ${outputPath}`);
  console.log(`Each lead has ${ALL_MESSAGE_TYPES.length} message types.`);
}

async function cmdPreview(leadJson) {
  const lead = typeof leadJson === 'string' ? JSON.parse(leadJson) : leadJson;
  const result = await personalize(lead, 'connection_note');
  console.log(`\nPreview (Tier ${result.tier}, ${result.text.length} chars):`);
  console.log(result.text);
  console.log(`\nValidation: ${result.validation.valid ? 'PASS' : 'FAIL -- ' + result.validation.issues.join('; ')}`);
}

function cmdValidate(text) {
  const result = validate(text, 'email_body');
  console.log(`Validation: ${result.valid ? 'PASS' : 'FAIL'}`);
  if (!result.valid) result.issues.forEach(i => console.log(`  - ${i}`));
}

// --- CLI Entry ---

async function main() {
  const cmd = process.argv[2];
  const args = process.argv.slice(3);

  function getFlag(name) {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 ? args[idx + 1] : null;
  }

  switch (cmd) {
    case 'generate': {
      // Review fix: --lead-file flag support (avoids Windows shell quoting issues)
      const leadFile = getFlag('lead-file');
      let leadData;
      if (leadFile) {
        const leadFilePath = path.isAbsolute(leadFile) ? leadFile : path.join(ROOT, leadFile);
        leadData = fs.readFileSync(leadFilePath, 'utf-8');
      } else {
        leadData = getFlag('lead');
      }
      if (!leadData) {
        console.error('Error: provide --lead JSON or --lead-file path');
        process.exit(1);
      }
      await cmdGenerate(leadData);
      break;
    }
    case 'batch':
      await cmdBatch(getFlag('input') || 'pb-leads-enriched.json', parseInt(getFlag('limit') || '10'));
      break;
    case 'preview': {
      const leadFile = getFlag('lead-file');
      let leadData;
      if (leadFile) {
        const leadFilePath = path.isAbsolute(leadFile) ? leadFile : path.join(ROOT, leadFile);
        leadData = fs.readFileSync(leadFilePath, 'utf-8');
      } else {
        leadData = getFlag('lead');
      }
      if (!leadData) {
        console.error('Error: provide --lead JSON or --lead-file path');
        process.exit(1);
      }
      await cmdPreview(leadData);
      break;
    }
    case 'validate':
      cmdValidate(args.join(' '));
      break;
    default:
      console.log(`
personalize-messages.js -- Multi-tier outreach personalization

Commands:
  generate --lead '{...}'            Generate all 8 messages for a lead (JSON)
  generate --lead-file FILE          Generate from JSON file (avoids shell quoting)
  batch --input FILE --limit N       Batch generate for N leads from enriched JSON
  preview --lead '{...}'             Quick preview of connection note
  preview --lead-file FILE           Preview from JSON file
  validate TEXT                      Validate text against voice rules

Message Types (8 total):
  LinkedIn: connection_note, follow_up_1, follow_up_2
  Email:    email_touch_1 through email_touch_5

Tiers:
  Tier 1 (HOT, ICP >= 80):    Claude Sonnet -- full AI personalization
  Tier 2 (WARM, ICP 50-79):   Gemini 2.5 Flash -- template + AI rewrite
  Tier 3 (NURTURE, ICP < 50): Deterministic template fill

Environment:
  CLAUDE_API_KEY / ANTHROPIC_API_KEY  For Tier 1
  GEMINI_API_KEY (+ _2, _3, etc.)    For Tier 2
      `);
  }
}

// Only run CLI if this is the main module
if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

// Export for programmatic use and testing
module.exports = { personalize, validate, matchIndustry, matchRole, fillTemplate, postProcess };

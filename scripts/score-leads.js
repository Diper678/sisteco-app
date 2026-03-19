#!/usr/bin/env node
/**
 * score-leads.js — Score leads with Gemini AI in batches
 * Uses key rotation across multiple Gemini API keys
 * Batches 10 leads per request for efficiency
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

// Soporta rotacion de keys via GEMINI_API_KEYS (comma-separated) o GEMINI_API_KEY
const GEMINI_KEYS = process.env.GEMINI_API_KEYS
  ? process.env.GEMINI_API_KEYS.split(',').map(k => k.trim())
  : [process.env.GEMINI_API_KEY].filter(Boolean);

let keyIndex = 0;
function nextKey() {
  const key = GEMINI_KEYS[keyIndex % GEMINI_KEYS.length];
  keyIndex++;
  return key;
}

const TARGET_INDUSTRIES = ['information technology', 'computer software', 'saas', 'fintech',
  'financial services', 'banking', 'professional services', 'management consulting',
  'logistics', 'supply chain', 'manufacturing', 'industrial', 'mechanical',
  'industrial automation', 'telecommunications'];

const HIGH_CARGO_RE = /\b(ceo|cro|cto|cfo|chief|presidente|fundador|founder|owner|co-founder|vp |vice\s*president|vicepresidente|director|gerente|manager|gerenta)\b/i;

function priorityScore(lead) {
  let s = 0;
  const h = (lead.headline || '').toLowerCase();
  const ind = (lead.industry || '').toLowerCase();
  const loc = (lead.location || '').toLowerCase();

  // Location
  if (loc.includes('chile') || loc.includes('santiago')) s += 30;

  // Cargo
  if (/\b(ceo|cro|cto|director|vp |vice\s*president)\b/.test(h)) s += 40;
  else if (/\b(gerente|manager)\b/.test(h)) s += 30;

  // Industry
  if (TARGET_INDUSTRIES.some(t => ind.includes(t))) s += 30;

  // Has company URL (enrichable)
  if (lead.companyUrl) s += 5;

  return s;
}

function callGemini(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
    });

    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
            resolve(JSON.parse(parsed.candidates[0].content.parts[0].text));
          } else if (parsed.error) {
            reject(new Error(parsed.error.message || 'Gemini API error'));
          } else {
            reject(new Error('No content in Gemini response'));
          }
        } catch (e) {
          reject(new Error('Parse error: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function buildBatchPrompt(leads) {
  const leadsText = leads.map((l, i) => {
    return `Lead ${i + 1}:
- Nombre: ${l.fullName || ((l.firstName || '') + ' ' + (l.lastName || '')).trim()}
- Cargo: ${l.headline || l.jobTitle || '-'}
- Empresa: ${l.company || l.companyName || '-'}
- Industria: ${l.industry || 'No disponible'}
- Ubicacion: ${l.location || 'Chile'}
- LinkedIn: ${l.profileUrl || '-'}`;
  }).join('\n\n');

  return `Eres un experto en ventas B2B en Chile. Evalua estos ${leads.length} leads para Sisteco, una plataforma SaaS de automatizacion de ventas B2B.

ICP Sisteco:
- Ubicacion: Chile
- Tamano empresa: 50-500 empleados
- Industrias objetivo: SaaS, Fintech, Servicios Profesionales, IT, Manufactura, Logistica, Telecomunicaciones
- Cargos objetivo: Director Comercial, Gerente de Ventas, VP Sales, CEO, CRO, Head of Sales
- Senales positivas: uso de CRM, equipo de ventas 5+, etapa de crecimiento, empresa B2B
- Tech stack positivo: HubSpot, Salesforce, Pipedrive (indica madurez CRM)
- Tech stack negativo: CRM custom (dificil de desplazar)

${leadsText}

Responde con un JSON array. Para CADA lead, incluye:
{
  "leadIndex": <numero del lead>,
  "score": <0-100>,
  "category": "<HOT|WARM|NURTURE|SKIP>",
  "reasoning": "<1-2 oraciones en espanol>",
  "signals": ["<senales positivas>"],
  "risks": ["<riesgos>"],
  "suggested_approach": "<como contactar>",
  "confidence": <0.0-1.0>
}

Categorias: HOT (80-100), WARM (50-79), NURTURE (20-49), SKIP (0-19).
Responde SOLO el JSON array, sin texto adicional.`;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const N = parseInt(process.argv[2]) || 150;
  const cacheFile = path.join(process.env.TEMP || '/tmp', 'sisteco', 'pb-leads-latest.json');

  if (!fs.existsSync(cacheFile)) {
    console.error('ERROR: No hay cache de leads. Ejecuta /pb-leads fetch primero.');
    process.exit(1);
  }

  const allLeads = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));

  // Prioritize leads
  const ranked = allLeads
    .map(l => ({ ...l, _priority: priorityScore(l) }))
    .sort((a, b) => b._priority - a._priority)
    .slice(0, N);

  console.log(`\n## Scoring ${ranked.length} leads con Gemini AI\n`);
  console.log(`Priorizados por ICP fit (ubicacion + cargo + industria)`);
  console.log(`Usando ${GEMINI_KEYS.length} API keys en rotacion\n`);

  const BATCH_SIZE = 10;
  const batches = [];
  for (let i = 0; i < ranked.length; i += BATCH_SIZE) {
    batches.push(ranked.slice(i, i + BATCH_SIZE));
  }

  const allResults = [];
  let errors = 0;

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const key = nextKey();
    process.stderr.write(`  Batch ${b + 1}/${batches.length} (${batch.length} leads, key ${(keyIndex - 1) % GEMINI_KEYS.length + 1})...`);

    try {
      const prompt = buildBatchPrompt(batch);
      const results = await callGemini(prompt, key);
      const arr = Array.isArray(results) ? results : [results];

      arr.forEach((r, i) => {
        const lead = batch[r.leadIndex ? r.leadIndex - 1 : i];
        allResults.push({
          name: lead.fullName || ((lead.firstName || '') + ' ' + (lead.lastName || '')).trim(),
          cargo: (lead.headline || lead.jobTitle || '-').substring(0, 50),
          empresa: lead.company || lead.companyName || '-',
          industria: lead.industry || '-',
          ubicacion: (lead.location || '-').substring(0, 30),
          linkedin: lead.profileUrl || '-',
          score: r.score || 0,
          category: r.category || 'SKIP',
          reasoning: r.reasoning || '-',
          signals: r.signals || [],
          risks: r.risks || [],
          suggested_approach: r.suggested_approach || '-',
          confidence: r.confidence || 0,
        });
      });

      process.stderr.write(` OK (${arr.length} scored)\n`);
    } catch (e) {
      process.stderr.write(` ERROR: ${e.message}\n`);
      errors++;
      // Add unscored
      batch.forEach(lead => {
        allResults.push({
          name: lead.fullName || ((lead.firstName || '') + ' ' + (lead.lastName || '')).trim(),
          cargo: (lead.headline || '-').substring(0, 50),
          empresa: lead.company || '-',
          industria: lead.industry || '-',
          ubicacion: (lead.location || '-').substring(0, 30),
          linkedin: lead.profileUrl || '-',
          score: -1,
          category: 'ERROR',
          reasoning: e.message,
          signals: [],
          risks: [],
          suggested_approach: '-',
          confidence: 0,
        });
      });
    }

    // Rate limit: wait between batches
    if (b < batches.length - 1) await sleep(2000);
  }

  // Sort by score descending
  allResults.sort((a, b) => b.score - a.score);

  // Save results
  const outFile = path.join(process.env.TEMP || '/tmp', 'sisteco', 'pb-leads-scored.json');
  fs.writeFileSync(outFile, JSON.stringify(allResults, null, 2));

  // Output summary
  const hot = allResults.filter(r => r.category === 'HOT');
  const warm = allResults.filter(r => r.category === 'WARM');
  const nurture = allResults.filter(r => r.category === 'NURTURE');
  const skip = allResults.filter(r => r.category === 'SKIP');
  const errored = allResults.filter(r => r.category === 'ERROR');

  console.log(`\n### Resumen de scoring\n`);
  console.log(`| Categoria | Count | % |`);
  console.log(`|-----------|-------|---|`);
  if (hot.length) console.log(`| **HOT** (80-100) | **${hot.length}** | ${Math.round(hot.length / allResults.length * 100)}% |`);
  if (warm.length) console.log(`| WARM (50-79) | ${warm.length} | ${Math.round(warm.length / allResults.length * 100)}% |`);
  if (nurture.length) console.log(`| NURTURE (20-49) | ${nurture.length} | ${Math.round(nurture.length / allResults.length * 100)}% |`);
  if (skip.length) console.log(`| SKIP (0-19) | ${skip.length} | ${Math.round(skip.length / allResults.length * 100)}% |`);
  if (errored.length) console.log(`| ERROR | ${errored.length} | ${Math.round(errored.length / allResults.length * 100)}% |`);
  console.log(`| **Total** | **${allResults.length}** | 100% |`);

  if (hot.length > 0) {
    console.log(`\n### HOT Leads (${hot.length})\n`);
    console.log(`| # | Score | Nombre | Cargo | Empresa | Industria | Razon |`);
    console.log(`|---|-------|--------|-------|---------|-----------|-------|`);
    hot.forEach((r, i) => {
      console.log(`| ${i + 1} | ${r.score} | ${r.name} | ${r.cargo} | ${r.empresa} | ${r.industria} | ${r.reasoning.substring(0, 60)} |`);
    });
  }

  if (warm.length > 0) {
    console.log(`\n### WARM Leads (top 20 de ${warm.length})\n`);
    console.log(`| # | Score | Nombre | Cargo | Empresa | Industria |`);
    console.log(`|---|-------|--------|-------|---------|-----------|`);
    warm.slice(0, 20).forEach((r, i) => {
      console.log(`| ${i + 1} | ${r.score} | ${r.name} | ${r.cargo} | ${r.empresa} | ${r.industria} |`);
    });
  }

  console.log(`\n*Resultados guardados en: ${outFile}*`);
  if (errors > 0) console.log(`*${errors} batches con error — reintentar con /pb-leads score*`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });

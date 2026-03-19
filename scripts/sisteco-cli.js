#!/usr/bin/env node
/**
 * sisteco-cli.js — CLI unificado para operaciones de Sisteco
 *
 * Controla n8n workflows, pipeline de leads y APIs desde terminal.
 * Sin dependencias externas — puro Node.js fetch (Node 18+).
 *
 * Uso:
 *   node scripts/sisteco-cli.js <comando> [subcomando] [flags]
 *
 * Comandos disponibles:
 *
 *   LEADS
 *   ─────
 *   leads status              → Estado del pipeline (Convex + n8n executions)
 *   leads prospect [flags]    → Lanzar PhantomBuster LinkedIn scrape
 *   leads enqueue [flags]     → Encolar HOT leads para email sequences
 *   leads pipeline            → Run completo: prospect → enrich → score
 *
 *   WORKFLOW (n8n)
 *   ──────────────
 *   workflow list             → Listar todos los workflows de n8n
 *   workflow run <nombre>     → Disparar workflow via webhook/API
 *   workflow status [id]      → Estado de ejecuciones recientes
 *   workflow logs <id>        → Ver output de una ejecución específica
 *
 *   WEBHOOK
 *   ───────
 *   webhook fire <path> [body]  → POST a un webhook de n8n manualmente
 *   webhook list                → Listar webhooks activos (desde workflow list)
 *
 *   API (Bruno)
 *   ───────────
 *   api test [coleccion]      → Correr colección Bruno (requiere bru CLI)
 *   api test gemini           → Test Gemini API
 *   api test convex           → Test Convex API
 *
 * Flags globales:
 *   --dry-run     No ejecutar acciones reales, solo mostrar qué haría
 *   --json        Output en JSON (para pipelines / scripting)
 *   --verbose     Output detallado
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Config ───────────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const lines = readFileSync(resolve(ROOT, '.env'), 'utf-8').split('\n');
    const env = {};
    for (const line of lines) {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    return env;
  } catch {
    return {};
  }
}

const ENV = loadEnv();

const CFG = {
  n8nUrl:        ENV.N8N_URL        || 'https://primary-production-24f87.up.railway.app',
  n8nKey:        ENV.N8N_API_KEY    || '',
  n8nWebhook:    ENV.N8N_WEBHOOK_URL || 'https://primary-production-24f87.up.railway.app/webhook',
  pbKey:         ENV.PHANTOMBUSTER_API_KEY || '',
  pbAgentId:     ENV.PB_LINKEDIN_AGENT_ID  || '',
  convexUrl:     ENV.CONVEX_SITE_URL || ENV.CONVEX_URL || '',
  convexSecret:  ENV.SAAN_API_SECRET || '',
  geminiKey:     ENV.GEMINI_API_KEY  || '',
};

// Workflows conocidos de Sisteco (nombre → webhook path + ID de n8n)
// IDs verificados 2026-03-19 via sisteco workflow list
const KNOWN_WORKFLOWS = {
  // Lead discovery / prospecting
  'prospect':       { id: 'iuB6QGc885kyOfUG', webhook: 'saan-leads-discover-pb',    desc: 'LinkedIn scrape via PhantomBuster' },
  'prospect-pb':    { id: 'iuB6QGc885kyOfUG', webhook: 'saan-leads-discover-pb',    desc: 'LinkedIn scrape via PhantomBuster' },
  'prospect-fc':    { id: 'ZSNrDM6HrxuQoXfC', webhook: 'saan-leads-discover-fc',    desc: 'Lead discovery via Firecrawl Search' },
  'prospect-sn':    { id: 'Hi0bdqkvV4QRPBWt', webhook: 'saan-leads-discover-sn',    desc: 'LinkedIn Sales Navigator scrape' },
  'prospect-dir':   { id: 'I1WoaKZ4HVjXy7I9', webhook: 'saan-leads-discover-dir',   desc: 'Directorios via ScrapingBee' },
  // Enrichment
  'enrich':         { id: 'ILENhV4q5NWeXNhq', webhook: 'saan-leads-enrich',         desc: 'Enriquecimiento web con Firecrawl' },
  'enrich-sii':     { id: 'IU9b7jYbqbKS0tNn', webhook: 'saan-leads-enrich-sii',     desc: 'Enriquecimiento SII Chile' },
  // Scoring
  'score':          { id: 'w362fELZQEKJZ885', webhook: 'saan-leads-score',           desc: 'Scoring IA con Gemini' },
  'lead-scoring':   { id: 'dLrpslRLhoIjMh6Y', webhook: 'lead-scoring',              desc: 'Lead Scoring Pipeline (Phantom+Gemini)' },
  // Outreach
  'outreach':       { id: '0GupYny80oeyAD34', webhook: 'saan-leads-outreach',        desc: 'SDR outreach con Claude' },
  'email-sequence': { id: 'AIi6a0ICfXCQnhaY', webhook: 'hot-lead-enqueue',           desc: 'Secuencia 5 emails B2B automatizada' },
  'hot-lead':       { id: 'AIi6a0ICfXCQnhaY', webhook: 'hot-lead-enqueue',           desc: 'Encolar HOT lead para email sequence' },
  // Notificaciones
  'notify-hot':     { id: '0YJ9XXo6GgZue1JX', webhook: 'saan-leads-notify-hot',      desc: 'Notificar HOT lead via Telegram' },
  // Inteligencia / análisis
  'intel':          { id: 'PXKP9mIPphfY80RI', webhook: 'sisteco-intel',              desc: 'Inteligencia competitiva Firecrawl' },
  'sii-enrich':     { id: 'Vw5pQImiFzxcboD9', webhook: 'sii-enrich-multi',           desc: 'Enriquecimiento SII multi-cliente' },
  // Orquestador
  'orchestrator':   { id: '7HN6rtIuoktEYh0w', webhook: 'saan-orchestrator',          desc: 'Orquestador principal SAAN' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {
  dryRun:  args.includes('--dry-run'),
  json:    args.includes('--json'),
  verbose: args.includes('--verbose') || args.includes('-v'),
};
const positional = args.filter(a => !a.startsWith('--') && !a.startsWith('-'));

function getFlag(name, defaultVal) {
  const idx = args.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (idx < 0) return defaultVal;
  const a = args[idx];
  if (a.includes('=')) return a.split('=').slice(1).join('=');
  return args[idx + 1] !== undefined && !args[idx + 1].startsWith('--') ? args[idx + 1] : defaultVal;
}

function log(...msgs) {
  if (!flags.json) console.log(...msgs);
}

function logVerbose(...msgs) {
  if (!flags.json && flags.verbose) console.log('  ›', ...msgs);
}

function out(data) {
  if (flags.json) console.log(JSON.stringify(data, null, 2));
}

function hr(char = '─', len = 60) {
  return char.repeat(len);
}

function badge(status) {
  const map = {
    'success': '✅', 'running': '🔄', 'error': '❌', 'waiting': '⏳',
    'active': '🟢', 'inactive': '⚪', 'HOT': '🔥', 'WARM': '🟡',
    'NURTURE': '🌱', 'SKIP': '⏭',
  };
  return (map[status] || '•') + ' ' + status;
}

// ── n8n API ──────────────────────────────────────────────────────────────────

async function n8nRequest(path, method = 'GET', body = null) {
  if (!CFG.n8nKey) {
    throw new Error('N8N_API_KEY not set in .env');
  }
  const url = `${CFG.n8nUrl}/api/v1${path}`;
  logVerbose(`${method} ${url}`);

  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': CFG.n8nKey,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`n8n API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function n8nWebhookFire(path, body = {}) {
  const url = `${CFG.n8nWebhook}/${path}`;
  logVerbose(`POST ${url}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Webhook ${res.status}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, status: res.status };
  }
}

// ── PhantomBuster API ────────────────────────────────────────────────────────

async function pbLaunch(searchUrl, numberOfProfiles = 25) {
  const res = await fetch('https://api.phantombuster.com/api/v2/agents/launch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Phantombuster-Key': CFG.pbKey,
    },
    body: JSON.stringify({
      id: CFG.pbAgentId,
      argument: {
        searchUrl,
        numberOfProfiles,
        extractDefaultUrl: true,
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`PhantomBuster ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function pbStatus() {
  const res = await fetch(
    `https://api.phantombuster.com/api/v2/agents/fetch?id=${CFG.pbAgentId}`,
    { headers: { 'X-Phantombuster-Key': CFG.pbKey } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`PhantomBuster ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ── Subcomandos ───────────────────────────────────────────────────────────────

async function cmdWorkflowList() {
  log('\n📋 Workflows en n8n\n' + hr());
  const data = await n8nRequest('/workflows?limit=50');
  const workflows = data.data || [];

  if (flags.json) { out(workflows); return; }

  if (workflows.length === 0) {
    log('No hay workflows. ¿Está n8n corriendo?');
    return;
  }

  // Agrupar activos/inactivos
  const active = workflows.filter(w => w.active);
  const inactive = workflows.filter(w => !w.active);

  for (const w of active) {
    console.log(`🟢 [${w.id}] ${w.name}`);
  }
  for (const w of inactive) {
    console.log(`⚪ [${w.id}] ${w.name}`);
  }

  log(`\nTotal: ${workflows.length} (${active.length} activos, ${inactive.length} inactivos)`);
  log('\nTip: sisteco workflow status → ver ejecuciones recientes');
}

async function cmdWorkflowStatus(workflowId) {
  log('\n⚡ Ejecuciones recientes\n' + hr());

  const query = workflowId ? `?workflowId=${workflowId}&limit=10` : '?limit=15';
  const data = await n8nRequest(`/executions${query}`);
  const execs = data.data || [];

  if (flags.json) { out(execs); return; }

  if (execs.length === 0) {
    log('No hay ejecuciones recientes.');
    return;
  }

  for (const e of execs) {
    const started = e.startedAt ? new Date(e.startedAt).toLocaleString('es-CL') : 'pending';
    const duration = e.stoppedAt && e.startedAt
      ? Math.round((new Date(e.stoppedAt) - new Date(e.startedAt)) / 1000) + 's'
      : '-';
    const statusIcon = { success: '✅', error: '❌', running: '🔄', waiting: '⏳' }[e.status] || '•';
    console.log(`${statusIcon} [${e.id}] ${(e.workflowData?.name || 'workflow').padEnd(45)} ${started} (${duration})`);
  }

  log(`\nTip: sisteco workflow logs <id> → ver output detallado`);
}

async function cmdWorkflowLogs(execId) {
  if (!execId) {
    log('❌ Falta el ID de ejecución. Uso: sisteco workflow logs <id>');
    return;
  }
  const data = await n8nRequest(`/executions/${execId}`);
  if (flags.json) { out(data); return; }

  log(`\n📄 Ejecución #${execId}\n` + hr());
  log(`Workflow:  ${data.workflowData?.name || '-'}`);
  log(`Status:    ${badge(data.status)}`);
  log(`Started:   ${data.startedAt ? new Date(data.startedAt).toLocaleString('es-CL') : '-'}`);
  log(`Finished:  ${data.stoppedAt ? new Date(data.stoppedAt).toLocaleString('es-CL') : 'en progreso'}`);

  if (data.data?.resultData?.error) {
    log(`\n❌ Error: ${data.data.resultData.error.message}`);
  }

  const nodes = data.data?.resultData?.runData;
  if (nodes && flags.verbose) {
    log('\nNodos ejecutados:');
    for (const [nodeName, runs] of Object.entries(nodes)) {
      const run = runs?.[0];
      const items = run?.data?.main?.[0]?.length || 0;
      const err = run?.error?.message || '';
      log(`  • ${nodeName}: ${items} items ${err ? '❌ ' + err : '✅'}`);
    }
  }
}

async function cmdWorkflowRun(name) {
  if (!name) {
    log('❌ Falta el nombre del workflow. Uso: sisteco workflow run <nombre>');
    log('\nWorkflows conocidos: ' + Object.keys(KNOWN_WORKFLOWS).join(', '));
    return;
  }

  const known = KNOWN_WORKFLOWS[name.toLowerCase()];
  const webhookPath = known?.webhook || name;

  if (flags.dryRun) {
    log(`[dry-run] POST ${CFG.n8nWebhook}/${webhookPath}`);
    return;
  }

  log(`\n🚀 Disparando workflow: ${name}`);
  if (known) log(`   ${known.desc}`);

  try {
    const result = await n8nWebhookFire(webhookPath);
    log('✅ Workflow iniciado');
    if (flags.verbose) log('   Respuesta:', JSON.stringify(result));
    if (flags.json) out({ triggered: true, webhook: webhookPath, response: result });
  } catch (e) {
    log(`❌ Error: ${e.message}`);
    log('\nTip: Verifica que el workflow tenga un nodo Webhook activo con ese path.');
  }
}

async function cmdWebhookFire(path, bodyStr) {
  if (!path) {
    log('❌ Falta el path. Uso: sisteco webhook fire <path> [json-body]');
    log('\nEjemplos:');
    log('  sisteco webhook fire hot-lead-enqueue');
    log('  sisteco webhook fire lead-scoring \'{"leadId":"abc123"}\'');
    return;
  }

  let body = {};
  if (bodyStr) {
    try { body = JSON.parse(bodyStr); } catch { body = { raw: bodyStr }; }
  }

  if (flags.dryRun) {
    log(`[dry-run] POST ${CFG.n8nWebhook}/${path}`);
    log('  Body:', JSON.stringify(body, null, 2));
    return;
  }

  log(`\n🔔 Firing webhook: ${path}`);
  const result = await n8nWebhookFire(path, body);
  log('✅ Webhook respondió');
  if (flags.json) out(result);
  else if (flags.verbose) log('  Respuesta:', JSON.stringify(result, null, 2));
}

async function cmdLeadsProspect() {
  const searchUrl = getFlag('url', 'https://www.linkedin.com/search/results/people/?keywords=Director%20Comercial%20Chile&geoUrn=%5B%22104621616%22%5D&origin=GLOBAL_SEARCH_HEADER');
  const count = parseInt(getFlag('count', '25'));

  if (!CFG.pbKey || !CFG.pbAgentId) {
    log('❌ PHANTOMBUSTER_API_KEY o PB_LINKEDIN_AGENT_ID no configurado en .env');
    return;
  }

  if (flags.dryRun) {
    log(`[dry-run] Lanzaría PhantomBuster agent ${CFG.pbAgentId}`);
    log(`  URL: ${searchUrl}`);
    log(`  Perfiles: ${count}`);
    return;
  }

  log('\n🔍 Lanzando PhantomBuster LinkedIn Search\n' + hr());
  log(`URL: ${searchUrl}`);
  log(`Perfiles: ${count}`);

  // Intentar via n8n webhook primero (mantiene estado en memoria del agente)
  log('\n→ Intentando via n8n webhook...');
  try {
    const result = await n8nWebhookFire('saan-leads-discover', { searchUrl, numberOfProfiles: count });
    log('✅ Workflow de prospección iniciado en n8n');
    log('   El agente actualizará el estado en Convex automáticamente.');
    log('\nTip: sisteco workflow status → ver progreso');
    if (flags.json) out({ method: 'n8n', result });
    return;
  } catch (e) {
    logVerbose(`n8n webhook no disponible (${e.message}), usando PhantomBuster directo`);
  }

  // Fallback: llamada directa a PB API
  log('→ Fallback: llamada directa a PhantomBuster API...');
  try {
    const result = await pbLaunch(searchUrl, count);
    log(`✅ PhantomBuster lanzado (containerId: ${result.containerId || 'N/A'})`);
    log('   Los resultados estarán disponibles en ~3-5 minutos.');
    log('\nTip: sisteco leads prospect-status → ver estado del phantom');
    if (flags.json) out({ method: 'direct', result });
  } catch (e) {
    log(`❌ Error PhantomBuster: ${e.message}`);
  }
}

async function cmdLeadsProspectStatus() {
  if (!CFG.pbKey) {
    log('❌ PHANTOMBUSTER_API_KEY no configurado');
    return;
  }
  log('\n📊 Estado PhantomBuster\n' + hr());
  const data = await pbStatus();
  if (flags.json) { out(data); return; }

  log(`Agent:    ${data.name || CFG.pbAgentId}`);
  log(`Status:   ${badge(data.status || 'unknown')}`);
  log(`Last run: ${data.lastEndTime ? new Date(data.lastEndTime).toLocaleString('es-CL') : 'never'}`);
  if (data.nbBonusExecutions !== undefined) {
    log(`Credits:  ${data.nbBonusExecutions} bonus / ${data.nbMonthlyExecutions} monthly`);
  }
}

async function cmdLeadsEnqueue() {
  const minScore = parseInt(getFlag('min-score', '70'));
  const limit = parseInt(getFlag('limit', '20'));
  const dryRun = flags.dryRun ? '--dry-run' : '';
  const allEmails = args.includes('--all-emails') ? '--all-emails' : '';

  log('\n📨 Encolando HOT leads para email sequences\n' + hr());
  log(`Config: min-score=${minScore} | limit=${limit} | dry-run=${flags.dryRun}\n`);

  const scriptFlags = [
    dryRun,
    allEmails,
    minScore !== 70 ? `--min-score ${minScore}` : '',
    limit !== 20 ? `--limit ${limit}` : '',
  ].filter(Boolean).join(' ');

  try {
    const result = execSync(
      `node scripts/enqueue-hot-leads.js ${scriptFlags}`,
      { cwd: ROOT, encoding: 'utf-8', stdio: 'inherit' }
    );
  } catch (e) {
    // exit code != 0 handled by the script itself
  }
}

async function cmdLeadsStatus() {
  log('\n📊 Pipeline de Prospeccion — Estado\n' + hr());

  // Ejecuciones recientes de n8n
  log('\n⚡ Últimas ejecuciones n8n:');
  try {
    const data = await n8nRequest('/executions?limit=10');
    const execs = data.data || [];
    if (execs.length === 0) {
      log('   No hay ejecuciones recientes.');
    } else {
      for (const e of execs.slice(0, 5)) {
        const started = e.startedAt ? new Date(e.startedAt).toLocaleString('es-CL') : '-';
        const icon = { success: '✅', error: '❌', running: '🔄' }[e.status] || '•';
        log(`   ${icon} ${(e.workflowData?.name || 'workflow').padEnd(42)} ${started}`);
      }
    }
  } catch (e) {
    log(`   ⚠️  No se pudo conectar a n8n: ${e.message}`);
  }

  // Estado PhantomBuster
  log('\n🔍 PhantomBuster:');
  try {
    const pb = await pbStatus();
    const lastRun = pb.lastEndTime ? new Date(pb.lastEndTime).toLocaleString('es-CL') : 'nunca';
    log(`   Status: ${pb.status || 'unknown'} | Último run: ${lastRun}`);
  } catch (e) {
    log(`   ⚠️  ${e.message}`);
  }

  // Leads locales
  log('\n📁 Leads locales (listas):');
  const listFiles = [
    ['list-a-verified-email.json', 'Lista A (SMTP verified)'],
    ['list-b-guessed-email.json',  'Lista B (guessed email)'],
  ];
  for (const [file, label] of listFiles) {
    try {
      const data = JSON.parse(readFileSync(resolve(ROOT, 'leads-lists', file), 'utf-8'));
      const count = Array.isArray(data) ? data.length : (data.leads?.length || 0);
      log(`   ${label.padEnd(30)} ${count} leads`);
    } catch {
      log(`   ${label.padEnd(30)} (no disponible)`);
    }
  }

  log('\n' + hr());
  log('Acciones:');
  log('  sisteco leads prospect           → Lanzar nuevo scrape LinkedIn');
  log('  sisteco leads enqueue --dry-run  → Preview HOT leads para encolar');
  log('  sisteco workflow list            → Ver todos los workflows n8n');
  log('  sisteco api test gemini          → Verificar API Gemini');
}

async function cmdApiTest(collection) {
  const geminiKey = CFG.geminiKey;

  // Map shortnames to folder names
  const collectionMap = {
    'gemini':       'gemini-api/',
    'convex':       'convex-api/',
    'firecrawl':    'firecrawl-api/',
    'phantombuster': 'phantombuster-api/',
    'all':          '',
  };

  const folder = collectionMap[collection?.toLowerCase()] ?? (collection || '');

  const cmd = geminiKey
    ? `bash scripts/bru-run.sh "${folder}" development`
    : `cd bruno-collections && bru run ${folder} --env development`;

  if (flags.dryRun) {
    log(`[dry-run] ${cmd}`);
    return;
  }

  log(`\n🧪 Corriendo tests Bruno: ${folder || 'todas las colecciones'}\n` + hr());

  try {
    execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: 'inherit' });
  } catch {
    // exit code != 0 = test failures, already printed by bru
  }
}

// ── Help ─────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
Sisteco CLI — Control de operaciones desde terminal
Versión 1.0 | n8n: ${CFG.n8nUrl}

USO:
  node scripts/sisteco-cli.js <grupo> <accion> [flags]

LEADS
  leads status                   Estado del pipeline (n8n + PB + listas locales)
  leads prospect                 Lanzar LinkedIn scrape via PhantomBuster
    --url <linkedin_search_url>  URL de búsqueda LinkedIn (default: ICP Chile)
    --count <n>                  Nº perfiles a extraer (default: 25)
  leads prospect-status          Estado del último phantom
  leads enqueue                  Encolar HOT leads para email sequences
    --dry-run                    Preview sin encolar
    --min-score <n>              Score mínimo (default: 70)
    --limit <n>                  Máximo de leads a encolar (default: 20)
    --all-emails                 Incluir emails guessed (no solo smtp-verified)

WORKFLOW (gestión de n8n)
  workflow list                  Listar todos los workflows
  workflow run <nombre>          Disparar workflow por nombre conocido
  workflow status [id]           Ejecuciones recientes (o una específica)
  workflow logs <id>             Output detallado de una ejecución

  Nombres de workflow conocidos:
    prospect   → LinkedIn scrape via PhantomBuster
    enrich     → Enriquecimiento web con Firecrawl
    score      → Scoring IA con Gemini
    outreach   → SDR outreach con Claude
    hot-lead   → Encolar HOT lead para email sequence

WEBHOOK
  webhook fire <path> [body]     POST manual a webhook n8n
    Ejemplos:
    sisteco webhook fire hot-lead-enqueue
    sisteco webhook fire lead-scoring '{"leadId":"abc"}'

API (testing con Bruno)
  api test [coleccion]           Correr colección Bruno
    Colecciones: gemini, convex, firecrawl, phantombuster, all

FLAGS GLOBALES
  --dry-run     No ejecutar, solo mostrar qué haría
  --json        Output en JSON
  --verbose     Output detallado
`);
}

// ── Router ────────────────────────────────────────────────────────────────────

async function main() {
  const [group, action, ...rest] = positional;

  if (!group || group === 'help' || group === '--help' || group === '-h') {
    printHelp();
    return;
  }

  try {
    switch (`${group}:${action}`) {
      // Leads
      case 'leads:status':          return await cmdLeadsStatus();
      case 'leads:prospect':        return await cmdLeadsProspect();
      case 'leads:prospect-status': return await cmdLeadsProspectStatus();
      case 'leads:enqueue':         return await cmdLeadsEnqueue();

      // Workflow
      case 'workflow:list':         return await cmdWorkflowList();
      case 'workflow:status':       return await cmdWorkflowStatus(rest[0]);
      case 'workflow:logs':         return await cmdWorkflowLogs(rest[0]);
      case 'workflow:run':          return await cmdWorkflowRun(rest[0] || action);

      // Webhook
      case 'webhook:fire':          return await cmdWebhookFire(rest[0], rest[1]);
      case 'webhook:list':          return await cmdWorkflowList(); // misma info

      // API / Bruno
      case 'api:test':              return await cmdApiTest(rest[0]);

      default:
        // Atajos sin group
        if (group === 'list')    return await cmdWorkflowList();
        if (group === 'status')  return await cmdLeadsStatus();
        if (group === 'test')    return await cmdApiTest(action);

        console.error(`❌ Comando desconocido: ${group} ${action || ''}`);
        console.error('   Usa: sisteco help');
        process.exit(1);
    }
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    if (flags.verbose) console.error(err.stack);
    process.exit(1);
  }
}

main();

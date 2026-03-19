#!/usr/bin/env node
/**
 * add-webhook-triggers.js
 *
 * Agrega nodos Webhook a los workflows de n8n clave de Sisteco para que
 * puedan ser disparados desde sisteco-cli.js sin entrar a la UI de n8n.
 *
 * Workflows modificados:
 *   1. SAAN Leads Discover — PhantomBuster LinkedIn  (iuB6QGc885kyOfUG)
 *   2. SAAN Leads Enrich — Firecrawl Scrape          (ILENhV4q5NWeXNhq)
 *   3. SAAN Leads Score AI (Gemini)                  (w362fELZQEKJZ885)
 *   4. B2B Prospecting - Secuencia 5 Emails          (AIi6a0ICfXCQnhaY)
 *
 * Cada workflow recibe:
 *   - Un nodo "🔗 CLI Webhook" que escucha en el path configurado
 *   - El nodo conecta al mismo target que el Schedule Trigger original
 *   - El workflow queda ACTIVADO al terminar
 *
 * Uso:
 *   node scripts/add-webhook-triggers.js [--dry-run] [--no-activate]
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Config ────────────────────────────────────────────────────────────────────

function loadEnv() {
  const lines = readFileSync(resolve(ROOT, '.env'), 'utf-8').split('\n');
  const env = {};
  for (const line of lines) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const ENV = loadEnv();
const N8N = ENV.N8N_URL || 'https://primary-production-24f87.up.railway.app';
const KEY = ENV.N8N_API_KEY;

const args = process.argv.slice(2);
const DRY_RUN   = args.includes('--dry-run');
const NO_ACTIVATE = args.includes('--no-activate');

if (!KEY) {
  console.error('❌ N8N_API_KEY no configurado en .env');
  process.exit(1);
}

// ── Workflows a modificar ─────────────────────────────────────────────────────
// connectTo: nombre del nodo al que conectar el webhook (el primer nodo real del flujo)

const WORKFLOWS = [
  {
    id:          'iuB6QGc885kyOfUG',
    name:        'SAAN Leads Discover — PhantomBuster LinkedIn',
    webhookPath: 'saan-leads-discover-pb',
    connectTo:   'Set Config',        // primer nodo real tras el schedule trigger
    nodeId:      'webhook-cli-prospect',
    position:    [0, -200],
  },
  {
    id:          'ILENhV4q5NWeXNhq',
    name:        'SAAN Leads Enrich — Firecrawl Scrape',
    webhookPath: 'saan-leads-enrich',
    connectTo:   'Set Config',
    nodeId:      'webhook-cli-enrich',
    position:    [0, -200],
  },
  {
    id:          'w362fELZQEKJZ885',
    name:        'SAAN Leads Score AI (Gemini)',
    webhookPath: 'saan-leads-score',
    connectTo:   'Set Config',
    nodeId:      'webhook-cli-score',
    position:    [0, -200],
  },
  {
    id:          'AIi6a0ICfXCQnhaY',
    name:        'B2B Prospecting - Secuencia 5 Emails',
    webhookPath: 'saan-leads-enqueue',
    connectTo:   '📋 Leer Prospectos Nuevos',  // primer nodo del flujo de check
    nodeId:      'webhook-cli-enqueue',
    position:    [-220, 300],
  },
];

// ── n8n API helpers ───────────────────────────────────────────────────────────

async function n8nGet(path) {
  const r = await fetch(`${N8N}/api/v1${path}`, {
    headers: { 'X-N8N-API-KEY': KEY },
  });
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

async function n8nPut(path, body) {
  const r = await fetch(`${N8N}/api/v1${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': KEY },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PUT ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

async function n8nActivate(id) {
  const r = await fetch(`${N8N}/api/v1/workflows/${id}/activate`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': KEY },
  });
  if (!r.ok) throw new Error(`ACTIVATE ${id} → ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── Core: agregar nodo webhook a un workflow ──────────────────────────────────

function buildWebhookNode(cfg) {
  return {
    id:          cfg.nodeId,
    name:        '🔗 CLI Webhook',
    type:        'n8n-nodes-base.webhook',
    typeVersion: 2,
    position:    cfg.position,
    parameters: {
      path:         cfg.webhookPath,
      httpMethod:   'POST',
      responseMode: 'onReceived',
      responseData: 'firstEntryJson',
      options:      {},
    },
    webhookId: cfg.nodeId,
  };
}

async function processWorkflow(cfg) {
  console.log(`\n── ${cfg.name}`);
  console.log(`   ID: ${cfg.id} | Webhook path: ${cfg.webhookPath}`);

  // 1. Fetch current workflow
  const wf = await n8nGet(`/workflows/${cfg.id}`);

  // 2. Check if webhook already exists (idempotent)
  const existingWebhook = wf.nodes.find(
    n => n.type === 'n8n-nodes-base.webhook' &&
         n.parameters?.path === cfg.webhookPath
  );
  if (existingWebhook) {
    console.log(`   ✅ Webhook "${cfg.webhookPath}" ya existe (id: ${existingWebhook.id})`);

    if (!wf.active && !DRY_RUN && !NO_ACTIVATE) {
      await n8nActivate(cfg.id);
      console.log(`   🟢 Activado`);
    } else if (wf.active) {
      console.log(`   🟢 Ya estaba activo`);
    }
    return { status: 'already_exists', id: cfg.id };
  }

  // 3. Verify connectTo node exists
  const targetNode = wf.nodes.find(n => n.name === cfg.connectTo);
  if (!targetNode) {
    throw new Error(`Nodo "${cfg.connectTo}" no encontrado en el workflow`);
  }

  // 4. Build the new webhook node
  const webhookNode = buildWebhookNode(cfg);

  // 5. Add to nodes array
  const updatedNodes = [...wf.nodes, webhookNode];

  // 6. Add to connections (webhook → connectTo)
  const updatedConnections = {
    ...wf.connections,
    [webhookNode.name]: {
      main: [[{ node: cfg.connectTo, type: 'main', index: 0 }]],
    },
  };

  // 7. Build PUT body (n8n requires full workflow object)
  const putBody = {
    name:        wf.name,
    nodes:       updatedNodes,
    connections: updatedConnections,
    settings:    wf.settings || {},
    staticData:  wf.staticData || null,
  };

  if (DRY_RUN) {
    console.log(`   [dry-run] Agregaría nodo "🔗 CLI Webhook" → conecta a "${cfg.connectTo}"`);
    console.log(`   [dry-run] POST ${N8N}/webhook/${cfg.webhookPath}`);
    return { status: 'dry_run', id: cfg.id };
  }

  // 8. PUT updated workflow
  const updated = await n8nPut(`/workflows/${cfg.id}`, putBody);
  console.log(`   ✅ Nodo webhook agregado`);
  console.log(`   URL: ${N8N}/webhook/${cfg.webhookPath}`);

  // 9. Activate
  if (!NO_ACTIVATE) {
    await n8nActivate(cfg.id);
    console.log(`   🟢 Workflow activado`);
  } else {
    console.log(`   ⚪ Workflow NO activado (--no-activate)`);
  }

  return { status: 'updated', id: cfg.id, webhookUrl: `${N8N}/webhook/${cfg.webhookPath}` };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔧 Sisteco — Agregar Webhook Triggers a Workflows n8n');
  console.log('═'.repeat(60));
  if (DRY_RUN) console.log('⚠️  MODO DRY-RUN — no se harán cambios reales\n');

  const results = [];
  const errors  = [];

  for (const cfg of WORKFLOWS) {
    try {
      const r = await processWorkflow(cfg);
      results.push(r);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      errors.push({ id: cfg.id, name: cfg.name, error: err.message });
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\nResultado: ${results.length} OK, ${errors.length} errores\n`);

  if (results.some(r => r.status === 'updated' || r.status === 'already_exists')) {
    console.log('Webhooks disponibles:');
    for (const cfg of WORKFLOWS) {
      const hasError = errors.find(e => e.id === cfg.id);
      if (!hasError) {
        console.log(`  ✅ ${cfg.webhookPath.padEnd(30)} → POST ${N8N}/webhook/${cfg.webhookPath}`);
      }
    }
    console.log('\nComandos CLI ahora disponibles:');
    console.log('  node scripts/sisteco-cli.js workflow run prospect');
    console.log('  node scripts/sisteco-cli.js workflow run enrich');
    console.log('  node scripts/sisteco-cli.js workflow run score');
    console.log('  node scripts/sisteco-cli.js webhook fire saan-leads-enqueue');
  }

  if (errors.length > 0) {
    console.log('\nErrores:');
    errors.forEach(e => console.log(`  ❌ [${e.id}] ${e.name}: ${e.error}`));
  }
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * n8n-env-migrate.js — Migrate hardcoded secrets to $env references in n8n workflow
 *
 * Targets: Workflow "Sisteco — Lead Scoring Pipeline" (ID: dLrpslRLhoIjMh6Y)
 * Node:    "Client Config" (Set node with JSON output)
 *
 * Prerequisites (do these BEFORE running this script):
 *   1. Set N8N_ALLOW_ENVIRONMENT_VARIABLES=true in Railway
 *   2. Add all env vars (PB_API_KEY, GEMINI_API_KEY, etc.) in Railway
 *   3. Redeploy n8n on Railway
 *
 * Usage:
 *   node scripts/n8n-env-migrate.js              Apply migration (replace hardcoded → $env)
 *   node scripts/n8n-env-migrate.js --dry-run     Preview changes without saving
 *   node scripts/n8n-env-migrate.js --revert      Restore hardcoded values (rollback)
 *   node scripts/n8n-env-migrate.js --check       Check current state of Client Config node
 *
 * See docs/SETUP-N8N-ENV-VARS.md for the full setup guide.
 */

const https = require('https');

// ============================================
// CONFIG
// ============================================
const N8N_URL = process.env.N8N_HOST || 'https://primary-production-24f87.up.railway.app';
const N8N_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'dLrpslRLhoIjMh6Y';
const CONFIG_NODE_NAME = 'Client Config';

// ============================================
// Hardcoded values (for --revert) and their env var mappings
// ============================================
const SECRET_MAP = {
  pbApiKey:        { envVar: 'PB_API_KEY',            hardcoded: '4g2SqzX1xS45348lUTaaRYhF87uLc8o64HObs4QhJRA' },
  pbAgentId:       { envVar: 'PB_AGENT_ID',           hardcoded: '510547627503326' },
  geminiApiKey:    { envVar: 'GEMINI_API_KEY',         hardcoded: 'AIzaSyAPcSOj_9Tfq-Ri6S0fqD0wdecKmxbUes0' },
  discordWebhook:  { envVar: 'DISCORD_WEBHOOK_URL',    hardcoded: 'https://discord.com/api/webhooks/1481104963974205632/i8IFEDwk-slBycyia_7h86wvBJo1sRZLdMRxYnNC3GMTKz0ypCSM00ZDhgTdGSx-dDG-' },
  sheetId:         { envVar: 'LEADS_SHEET_ID',         hardcoded: '1o9edhOg3LJxUx25x8Ecs3zAOrkhbtXlps5uCjGXVdVI' },
};

// Non-secret config values (always stay as literals)
const STATIC_CONFIG = {
  clientName: 'Sisteco',
  hotThreshold: 80,
  warmThreshold: 50,
  useGemini: true,
};

// ============================================
// HTTP helper (same pattern as other n8n scripts)
// ============================================
function apiRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(apiPath, N8N_URL);
    const payload = body ? JSON.stringify(body) : null;

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'X-N8N-API-KEY': N8N_KEY,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ============================================
// Build the JSON config object for each mode
// ============================================

/**
 * Build the config object using $env references (for migration).
 * Returns an n8n expression string (prefixed with "=") that resolves at runtime.
 */
function buildEnvConfig() {
  const obj = {};
  for (const [key, mapping] of Object.entries(SECRET_MAP)) {
    obj[key] = `{{ $env.${mapping.envVar} }}`;
  }
  Object.assign(obj, STATIC_CONFIG);
  return obj;
}

/**
 * Build the config object using hardcoded values (for revert).
 */
function buildHardcodedConfig() {
  const obj = {};
  for (const [key, mapping] of Object.entries(SECRET_MAP)) {
    obj[key] = mapping.hardcoded;
  }
  Object.assign(obj, STATIC_CONFIG);
  return obj;
}

// ============================================
// Find and update the Client Config node
// ============================================

/**
 * Find the Client Config node in the workflow nodes array.
 * Looks for a Set node named "Client Config" that has a jsonOutput parameter.
 */
function findConfigNode(nodes) {
  return nodes.find((n) => {
    // Match by name
    if (n.name === CONFIG_NODE_NAME) return true;
    // Fallback: match by name containing "Client Config" (case insensitive)
    if (n.name && n.name.toLowerCase().includes('client config')) return true;
    return false;
  });
}

/**
 * Extract the current JSON config from the node parameters.
 * n8n Set nodes store JSON output in different places depending on version:
 *   - v3.x: parameters.assignments.assignments[] (individual key-value pairs)
 *   - Code node: parameters.jsCode (JavaScript string)
 *   - Set node (old): parameters.values.string[] or parameters.options.jsonOutput
 */
function getCurrentConfig(node) {
  const params = node.parameters || {};

  // Case 1: jsonOutput as a string (expression or literal JSON)
  if (params.jsonOutput !== undefined) {
    const raw = params.jsonOutput;
    // If it starts with "=", it's an n8n expression
    const jsonStr = typeof raw === 'string' && raw.startsWith('=') ? raw.slice(1) : raw;
    try {
      return { type: 'jsonOutput', value: jsonStr, parsed: JSON.parse(jsonStr) };
    } catch {
      return { type: 'jsonOutput', value: jsonStr, parsed: null };
    }
  }

  // Case 2: jsCode in a Code node
  if (params.jsCode !== undefined) {
    return { type: 'jsCode', value: params.jsCode, parsed: null };
  }

  // Case 3: Set node v3 assignments
  if (params.assignments?.assignments) {
    const obj = {};
    for (const a of params.assignments.assignments) {
      obj[a.name] = a.value;
    }
    return { type: 'assignments', value: params.assignments, parsed: obj };
  }

  // Case 4: options.rawJson (Set node with "Specify Manually" → JSON)
  if (params.options?.rawJson !== undefined) {
    const raw = params.options.rawJson;
    const jsonStr = typeof raw === 'string' && raw.startsWith('=') ? raw.slice(1) : raw;
    try {
      return { type: 'rawJson', value: jsonStr, parsed: JSON.parse(jsonStr) };
    } catch {
      return { type: 'rawJson', value: jsonStr, parsed: null };
    }
  }

  return { type: 'unknown', value: null, parsed: null };
}

/**
 * Apply the new config to the node.
 * Returns the modified node.
 */
function applyConfig(node, configObj, configType) {
  const jsonString = JSON.stringify(configObj, null, 2);

  // n8n expressions in JSON output need the "=" prefix so n8n evaluates them
  const hasExpressions = jsonString.includes('$env.');
  const outputValue = hasExpressions ? `=${jsonString}` : jsonString;

  const updatedNode = JSON.parse(JSON.stringify(node)); // deep clone

  switch (configType) {
    case 'jsonOutput':
      updatedNode.parameters.jsonOutput = outputValue;
      break;

    case 'rawJson':
      if (!updatedNode.parameters.options) updatedNode.parameters.options = {};
      updatedNode.parameters.options.rawJson = outputValue;
      break;

    case 'jsCode':
      // For Code nodes, wrap in a return statement
      updatedNode.parameters.jsCode = `return [{ json: ${jsonString} }];`;
      break;

    case 'assignments':
      // Convert to individual assignments
      updatedNode.parameters.assignments = {
        assignments: Object.entries(configObj).map(([name, value]) => ({
          id: name,
          name,
          value: hasExpressions && typeof value === 'string' && value.includes('$env.')
            ? `={{ ${value.replace(/\{\{\s*/, '').replace(/\s*\}\}/, '')} }}`
            : value,
          type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string',
        })),
      };
      break;

    default:
      // Fallback: set as jsonOutput
      updatedNode.parameters.jsonOutput = outputValue;
      break;
  }

  return updatedNode;
}

// ============================================
// Printing helpers
// ============================================

function printSummary(action, configObj, secretMap) {
  const divider = '─'.repeat(60);
  console.log(`\n${divider}`);
  console.log(`  Accion: ${action}`);
  console.log(`  Workflow: Sisteco — Lead Scoring Pipeline`);
  console.log(`  Workflow ID: ${WORKFLOW_ID}`);
  console.log(`  Nodo: ${CONFIG_NODE_NAME}`);
  console.log(divider);

  console.log('\n  Campos modificados:');
  for (const [key, mapping] of Object.entries(secretMap)) {
    const val = configObj[key];
    const display = typeof val === 'string' && val.includes('$env.')
      ? val
      : maskSecret(val);
    console.log(`    ${key}: ${display}`);
  }

  console.log('\n  Campos estaticos (sin cambio):');
  for (const [key, val] of Object.entries(STATIC_CONFIG)) {
    console.log(`    ${key}: ${val}`);
  }
  console.log('');
}

function maskSecret(value) {
  if (typeof value !== 'string') return String(value);
  if (value.length <= 8) return '****';
  return value.slice(0, 4) + '...' + value.slice(-4);
}

function printCurrentState(currentConfig) {
  const divider = '─'.repeat(60);
  console.log(`\n${divider}`);
  console.log('  Estado actual del nodo Client Config');
  console.log(divider);
  console.log(`  Tipo de almacenamiento: ${currentConfig.type}`);

  if (currentConfig.parsed) {
    console.log('\n  Valores actuales:');
    for (const [key, val] of Object.entries(currentConfig.parsed)) {
      const isEnvRef = typeof val === 'string' && val.includes('$env.');
      const display = isEnvRef ? val : maskSecret(val);
      const tag = isEnvRef ? ' [ENV]' : ' [HARDCODED]';
      console.log(`    ${key}: ${display}${tag}`);
    }
  } else {
    console.log('\n  Valor raw:');
    console.log(`    ${currentConfig.value}`);
  }
  console.log('');
}

// ============================================
// Main
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const revert = args.includes('--revert');
  const check = args.includes('--check');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
n8n-env-migrate.js — Migrate Client Config secrets to Railway env vars

Usage:
  node scripts/n8n-env-migrate.js              Apply migration (hardcoded → $env)
  node scripts/n8n-env-migrate.js --dry-run    Preview changes without saving
  node scripts/n8n-env-migrate.js --revert     Restore hardcoded values (rollback)
  node scripts/n8n-env-migrate.js --check      Show current state of Client Config

Prerequisites:
  1. Set N8N_ALLOW_ENVIRONMENT_VARIABLES=true in Railway
  2. Add all env vars in Railway (PB_API_KEY, GEMINI_API_KEY, etc.)
  3. Redeploy n8n

See docs/SETUP-N8N-ENV-VARS.md for the full guide.
    `);
    process.exit(0);
  }

  // Step 1: Fetch the workflow
  console.log('\nFetching workflow...');
  const wfRes = await apiRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);

  if (wfRes.status !== 200) {
    console.error(`ERROR: No se pudo obtener el workflow (HTTP ${wfRes.status})`);
    console.error(`Respuesta: ${JSON.stringify(wfRes.data)}`);
    process.exit(1);
  }

  const wf = wfRes.data;
  console.log(`  Workflow: ${wf.name} (${wf.nodes.length} nodos)`);

  // Step 2: Find the Client Config node
  const configNode = findConfigNode(wf.nodes);
  if (!configNode) {
    console.error(`\nERROR: No se encontro el nodo "${CONFIG_NODE_NAME}" en el workflow.`);
    console.error('Nodos disponibles:');
    wf.nodes.forEach((n) => console.error(`  - ${n.name} (${n.type})`));
    process.exit(1);
  }

  console.log(`  Nodo encontrado: "${configNode.name}" (tipo: ${configNode.type})`);

  // Step 3: Read current config
  const currentConfig = getCurrentConfig(configNode);
  console.log(`  Tipo de config: ${currentConfig.type}`);

  // --check mode: just show current state and exit
  if (check) {
    printCurrentState(currentConfig);
    process.exit(0);
  }

  // Step 4: Build new config
  const newConfig = revert ? buildHardcodedConfig() : buildEnvConfig();
  const action = revert ? 'REVERT (restaurar hardcoded)' : 'MIGRATE (mover a $env)';
  const actionShort = revert ? 'revert' : 'migrate';

  // Step 5: Preview
  printSummary(action, newConfig, SECRET_MAP);

  if (dryRun) {
    console.log('  [DRY RUN] No se guardo ningun cambio.\n');
    console.log('  Para aplicar, ejecutar sin --dry-run:');
    console.log(`  node scripts/n8n-env-migrate.js${revert ? ' --revert' : ''}\n`);
    process.exit(0);
  }

  // Step 6: Apply changes to the node
  const updatedNode = applyConfig(configNode, newConfig, currentConfig.type);

  // Replace the node in the workflow
  const nodeIndex = wf.nodes.findIndex((n) => n.name === configNode.name);
  wf.nodes[nodeIndex] = updatedNode;

  // Step 7: Save via PUT
  console.log('Guardando workflow...');
  const updateRes = await apiRequest('PUT', `/api/v1/workflows/${WORKFLOW_ID}`, {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {},
  });

  if (updateRes.status === 200) {
    console.log(`  OK: Workflow actualizado exitosamente.`);
    console.log(`\n  Accion completada: ${actionShort}`);
    if (!revert) {
      console.log('  Los secretos ahora se leen de variables de entorno de Railway.');
      console.log('  Para revertir: node scripts/n8n-env-migrate.js --revert');
    } else {
      console.log('  Los secretos estan hardcodeados nuevamente en el nodo.');
      console.log('  Para migrar: node scripts/n8n-env-migrate.js');
    }
    console.log('');
  } else {
    console.error(`\nERROR: No se pudo guardar el workflow (HTTP ${updateRes.status})`);
    console.error(`Respuesta: ${JSON.stringify(updateRes.data)}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\nError fatal: ${err.message}`);
  process.exit(1);
});

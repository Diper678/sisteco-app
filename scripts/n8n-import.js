#!/usr/bin/env node
/**
 * n8n-import.js — Import workflow JSON files to n8n instance via REST API
 *
 * Usage:
 *   node scripts/n8n-import.js <file.json>           Import one workflow
 *   node scripts/n8n-import.js --all                  Import all pipeline workflows
 *   node scripts/n8n-import.js --list                 List workflows in n8n
 *   node scripts/n8n-import.js --variables            Show/set n8n variables
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const N8N_URL = process.env.N8N_HOST || 'https://primary-production-24f87.up.railway.app';
const N8N_KEY = process.env.N8N_API_KEY;

const WFDIR = path.join(__dirname, '..', '..', 'SAAN', 'n8n-workflows');

// All workflows to import (pipeline first, then support, then legacy)
const PIPELINE_WORKFLOWS = [
  // Core pipeline (import in this order)
  'saan-leads-enrich.json',
  'saan-leads-enrich-sii.json',
  'saan-leads-score-ai.json',
  'saan-leads-notify-hot.json',
  'saan-leads-discover-firecrawl.json',
  'saan-leads-discover-phantombuster.json',
  'saan-leads-discover-sales-navigator.json',
  'saan-leads-discover-scrapingbee.json',
  // Outreach & intelligence
  'saan-leads-sdr-outreach.json',
  'saan-leads-skill-metacognition.json',
  // Orchestration
  'saan-orchestrator.json',
  'saan-skill-runner.json',
  // Finance
  'saan-finance-invoice-automation.json',
  // Monitoring
  'saan-monitor-heartbeat.json',
  'saan-monitor-daily-report.json',
  // Legacy (absorbed but kept as reference)
  'saan-leads-linkedin-scoring.json',
  'saan-leads-b2b-prospecting.json',
];

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
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
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

async function importWorkflow(filePath) {
  const wf = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {}
  };

  const res = await apiRequest('POST', '/api/v1/workflows', payload);

  if (res.status === 200 || res.status === 201) {
    console.log(`  OK: ${res.data.name} (ID: ${res.data.id}, ${res.data.nodes?.length} nodes)`);
    return res.data;
  } else {
    console.error(`  FAIL: ${wf.name} — ${JSON.stringify(res.data.message || res.data)}`);
    return null;
  }
}

async function listWorkflows() {
  const res = await apiRequest('GET', '/api/v1/workflows');
  if (res.data?.data) {
    console.log(`\n=== Workflows en n8n (${res.data.data.length}) ===\n`);
    res.data.data.forEach(w => {
      console.log(`  ${w.active ? 'ACTIVO  ' : 'INACTIVO'} | ${w.id} | ${w.name}`);
    });
  }
}

async function importAll() {
  console.log('\n=== Importando Pipeline de Leads ===\n');
  const results = [];
  for (const file of PIPELINE_WORKFLOWS) {
    const filePath = path.join(WFDIR, file);
    if (!fs.existsSync(filePath)) {
      console.error(`  SKIP: ${file} — no existe`);
      continue;
    }
    process.stdout.write(`  Importing ${file}...`);
    const result = await importWorkflow(filePath);
    if (result) results.push(result);
  }
  console.log(`\n=== ${results.length}/${PIPELINE_WORKFLOWS.length} workflows importados ===\n`);
  return results;
}

// CLI
const args = process.argv.slice(2);

(async () => {
  if (args[0] === '--list') {
    await listWorkflows();
  } else if (args[0] === '--all') {
    await importAll();
    await listWorkflows();
  } else if (args[0]) {
    const filePath = path.resolve(args[0]);
    console.log(`Importing: ${filePath}`);
    await importWorkflow(filePath);
  } else {
    console.log(`
n8n-import.js — Import workflows to n8n

Usage:
  node scripts/n8n-import.js <file.json>   Import one workflow
  node scripts/n8n-import.js --all         Import all pipeline workflows
  node scripts/n8n-import.js --list        List workflows in n8n
    `);
  }
})();

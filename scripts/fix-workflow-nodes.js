#!/usr/bin/env node
/**
 * fix-workflow-nodes.js — Fix Parse PB Response and Split Leads nodes
 * Fixes the $input and $() references that were stripped by bash escaping
 */

const https = require('https');

const N8N_URL = process.env.N8N_HOST || 'https://primary-production-24f87.up.railway.app';
const N8N_KEY = process.env.N8N_API_KEY;
const WF_ID = 'dLrpslRLhoIjMh6Y';

// Correct code for Parse PB Response
const PARSE_PB_CODE = `// PB returns resultObject as stringified array of leads (not a URL)
const data = $input.first().json.data || $input.first().json;
const resultObject = typeof data.resultObject === 'string'
  ? JSON.parse(data.resultObject)
  : data.resultObject;

const config = $('Client Config').first().json;

// resultObject IS the leads array directly
const leads = Array.isArray(resultObject) ? resultObject : [];

// Filter out errored leads (Out of network, etc)
const validLeads = leads.filter(l => !l.error && (l.fullName || l.profileUrl));

return [{
  json: {
    leads: validLeads,
    totalRaw: leads.length,
    totalValid: validLeads.length,
    agentStatus: data.agentStatus || 'unknown',
    config: config
  }
}];`;

// Correct code for Split Leads
const SPLIT_LEADS_CODE = `// Pass leads through to ICP scoring (already parsed from PB)
const input = $input.first().json;
const leads = input.leads || [];

if (leads.length === 0) {
  return [{ json: { error: 'No leads found', totalRaw: input.totalRaw || 0 } }];
}

// Return leads as individual items for scoring
return leads.map(lead => ({ json: lead }));`;

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
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('Fetching workflow...');
  const wfRes = await apiRequest('GET', `/api/v1/workflows/${WF_ID}`);
  const wf = wfRes.data;

  let fixed = 0;
  for (const node of wf.nodes) {
    if (node.name === 'Parse PB Response') {
      node.parameters.jsCode = PARSE_PB_CODE;
      fixed++;
      console.log('  Fixed: Parse PB Response ($input + $() restored)');
    }
    if (node.name === 'Split Leads') {
      node.parameters.jsCode = SPLIT_LEADS_CODE;
      fixed++;
      console.log('  Fixed: Split Leads ($input restored)');
    }
  }

  if (fixed === 0) {
    console.log('No nodes to fix!');
    return;
  }

  console.log('Saving workflow...');
  const saveRes = await apiRequest('PUT', `/api/v1/workflows/${WF_ID}`, {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {}
  });

  if (saveRes.status === 200) {
    console.log(`Workflow saved OK — ${fixed} nodes fixed`);
  } else {
    console.error('Save failed:', JSON.stringify(saveRes.data).substring(0, 300));
  }
}

main().catch(e => console.error('Error:', e.message));

#!/usr/bin/env node
/**
 * pb-test-extraction.js — Test de extracción PhantomBuster LinkedIn Search
 *
 * Lanza un phantom manualmente y muestra los resultados.
 * Soporta múltiples phantoms por nombre o ID.
 *
 * Usage:
 *   node scripts/pb-test-extraction.js                    # Lanza phantom por defecto (ventas)
 *   node scripts/pb-test-extraction.js --agent td         # Lanza phantom "Transformación Digital"
 *   node scripts/pb-test-extraction.js --agent ventas     # Lanza phantom "Gerente de Ventas"
 *   node scripts/pb-test-extraction.js --agent <ID>       # Lanza phantom por ID directo
 *   node scripts/pb-test-extraction.js --status           # Estado del phantom activo
 *   node scripts/pb-test-extraction.js --output           # Último output del phantom activo
 *   node scripts/pb-test-extraction.js --all              # Lanza TODOS los phantoms secuencialmente
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ── Registro de Phantoms ──────────────────────────────────────────────────────
const PHANTOMS = {
  ventas: {
    id: process.env.PB_LINKEDIN_AGENT_ID || '510547627503326',
    name: 'Gerente de Ventas',
    keyword: 'Gerente de Ventas Chile',
    outputFile: 'pb-raw-ventas.json',
  },
  td: {
    id: process.env.PB_TD_AGENT_ID || '1153354836325554',
    name: 'Transformación Digital',
    keyword: 'Ingeniero Transformación Digital Chile',
    outputFile: 'pb-raw-transformacion-digital.json',
  },
};

const PB_KEY = process.env.PHANTOMBUSTER_API_KEY;

if (!PB_KEY) {
  console.error('❌ PHANTOMBUSTER_API_KEY no configurado en .env');
  process.exit(1);
}

// Resolve which phantom to use
function resolveAgent(args) {
  const agentIdx = args.indexOf('--agent');
  if (agentIdx !== -1 && args[agentIdx + 1]) {
    const key = args[agentIdx + 1].toLowerCase();
    if (PHANTOMS[key]) return PHANTOMS[key];
    // Try as direct ID
    return { id: args[agentIdx + 1], name: 'Custom', keyword: 'custom', outputFile: `pb-raw-${args[agentIdx + 1]}.json` };
  }
  return PHANTOMS.ventas; // default
}

const args = process.argv.slice(2);
const PB_AGENT = resolveAgent(args);
const PB_AGENT_ID = PB_AGENT.id;

function pbRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.phantombuster.com',
      path: `/api/v2/${path}`,
      method,
      headers: {
        'X-Phantombuster-Key': PB_KEY,
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

async function getAgentStatus() {
  console.log(`\n📡 Consultando PhantomBuster agent ${PB_AGENT_ID}...\n`);

  const res = await pbRequest('GET', `agents/fetch?id=${PB_AGENT_ID}`);
  if (res.status !== 200) {
    console.error('❌ Error:', JSON.stringify(res.data));
    return null;
  }

  const agent = res.data;
  console.log(`  Nombre: ${agent.name}`);
  console.log(`  Tipo:   ${agent.scriptName || agent.script || 'N/A'}`);
  console.log(`  Estado: ${agent.lastStatus || 'never run'}`);
  console.log(`  Último run: ${agent.lastEndMessage || 'N/A'}`);
  console.log(`  Launched: ${agent.launchType || 'N/A'}`);

  return agent;
}

async function getLastOutput() {
  console.log(`\n📄 Último output del phantom...\n`);

  const res = await pbRequest('GET', `agents/fetch-output?id=${PB_AGENT_ID}`);
  if (res.status !== 200) {
    console.error('❌ Error:', JSON.stringify(res.data));
    return;
  }

  const { resultObject, status, output } = res.data;

  console.log(`  Status: ${status}`);

  if (!resultObject) {
    console.log('  No hay resultObject (el phantom no ha producido datos)');
    if (output) {
      console.log(`\n  Console output (últimas 500 chars):`);
      console.log(`  ${(output || '').slice(-500)}`);
    }
    return;
  }

  let profiles;
  try {
    profiles = typeof resultObject === 'string' ? JSON.parse(resultObject) : resultObject;
  } catch (e) {
    console.log('  resultObject no es JSON válido');
    console.log(`  Raw: ${String(resultObject).substring(0, 500)}`);
    return;
  }

  if (Array.isArray(profiles)) {
    console.log(`  Perfiles extraídos: ${profiles.length}\n`);
    // Show first 5
    profiles.slice(0, 5).forEach((p, i) => {
      console.log(`  --- Lead ${i + 1} ---`);
      console.log(`  Nombre:   ${p.firstName || ''} ${p.lastName || ''}`);
      console.log(`  Empresa:  ${p.companyName || p.company || p.defaultCompanyName || 'N/A'}`);
      console.log(`  Cargo:    ${p.title || p.jobTitle || p.occupation || 'N/A'}`);
      console.log(`  LinkedIn: ${p.linkedInProfileUrl || p.linkedinUrl || p.profileUrl || 'N/A'}`);
      console.log(`  Location: ${p.location || p.geoRegion || 'N/A'}`);
      console.log(`  Industry: ${p.industry || p.companyIndustry || 'N/A'}`);
      console.log(`  Email:    ${p.email || 'N/A'}`);
      console.log();
    });
    if (profiles.length > 5) {
      console.log(`  ... y ${profiles.length - 5} más\n`);
    }
  } else {
    console.log('  Output:', JSON.stringify(profiles).substring(0, 500));
  }
}

async function launchAndWait() {
  console.log(`\n🚀 Lanzando phantom ${PB_AGENT_ID}...\n`);

  const launchRes = await pbRequest('POST', 'agents/launch', { id: PB_AGENT_ID });
  if (launchRes.status !== 200) {
    console.error('❌ Error al lanzar:', JSON.stringify(launchRes.data));
    return;
  }

  console.log('  ✅ Phantom lanzado. Esperando resultados...');

  // Poll for completion
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 15000)); // Wait 15 seconds between checks
    process.stdout.write(`  ⏳ Check ${i + 1}/${maxAttempts}...`);

    const statusRes = await pbRequest('GET', `agents/fetch-output?id=${PB_AGENT_ID}`);
    const status = statusRes.data?.status;
    console.log(` ${status}`);

    if (status === 'finished') {
      console.log('\n  ✅ Phantom terminado!\n');
      await getLastOutput();
      return;
    }

    if (status === 'error' || status === 'crashed') {
      console.error(`\n  ❌ Phantom falló: ${status}`);
      console.error(`  Mensaje: ${statusRes.data?.output?.slice(-300) || 'N/A'}`);
      return;
    }
  }

  console.log(`\n  ⚠ Timeout: el phantom no terminó después de ${maxAttempts * 15}s`);
}

async function launchAllPhantoms() {
  console.log('\n🔄 Lanzando TODOS los phantoms secuencialmente...\n');
  for (const [key, phantom] of Object.entries(PHANTOMS)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 Phantom: ${phantom.name} (${key}) — ID: ${phantom.id}`);
    console.log(`${'='.repeat(60)}`);

    // Check status first
    const statusRes = await pbRequest('GET', `agents/fetch-output?id=${phantom.id}`);
    if (statusRes.data?.status === 'running') {
      console.log(`  ⚠ Ya está corriendo, saltando...`);
      continue;
    }

    // Launch
    const launchRes = await pbRequest('POST', 'agents/launch', { id: phantom.id });
    if (launchRes.status !== 200) {
      console.error(`  ❌ Error al lanzar: ${JSON.stringify(launchRes.data)}`);
      continue;
    }
    console.log(`  ✅ Lanzado. Esperando resultados...`);

    // Poll
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 15000));
      const out = await pbRequest('GET', `agents/fetch-output?id=${phantom.id}`);
      const status = out.data?.status;
      process.stdout.write(`  ⏳ Check ${i + 1}/20... ${status}`);

      if (status === 'finished') {
        console.log(' ✅');
        // Save output
        const profiles = typeof out.data.resultObject === 'string'
          ? JSON.parse(out.data.resultObject) : out.data.resultObject;
        if (Array.isArray(profiles)) {
          const outPath = path.join(__dirname, '..', phantom.outputFile);
          fs.writeFileSync(outPath, JSON.stringify({ status: 'finished', resultObject: profiles, agentId: phantom.id, keyword: phantom.keyword }, null, 2));
          console.log(`  📁 ${profiles.length} perfiles → ${phantom.outputFile}`);
        }
        break;
      }
      if (status === 'error' || status === 'crashed') {
        console.log(' ❌');
        break;
      }
      console.log('');
    }
  }
}

async function main() {
  console.log(`\n🎯 Phantom activo: ${PB_AGENT.name} (${PB_AGENT.keyword})`);
  console.log(`   ID: ${PB_AGENT_ID}\n`);

  if (args.includes('--all')) {
    await launchAllPhantoms();
  } else if (args.includes('--status')) {
    await getAgentStatus();
  } else if (args.includes('--output')) {
    await getLastOutput();
  } else {
    await getAgentStatus();
    await launchAndWait();
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

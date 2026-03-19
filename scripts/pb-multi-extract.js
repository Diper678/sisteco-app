#!/usr/bin/env node
/**
 * pb-multi-extract.js — Orquestador multi-phantom para pipeline de leads
 *
 * Lanza todos los phantoms configurados, guarda resultados por separado,
 * y genera un archivo consolidado listo para scoring.
 *
 * Usage:
 *   node scripts/pb-multi-extract.js              # Lanza todos, espera, consolida
 *   node scripts/pb-multi-extract.js --status      # Estado de todos los phantoms
 *   node scripts/pb-multi-extract.js --collect      # Solo recoger outputs existentes (no lanzar)
 *   node scripts/pb-multi-extract.js --only td      # Solo un phantom específico
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PB_KEY = process.env.PHANTOMBUSTER_API_KEY;

const PHANTOMS = [
  {
    key: 'ventas',
    id: process.env.PB_LINKEDIN_AGENT_ID || '510547627503326',
    name: 'Gerente de Ventas',
    keyword: 'Gerente de Ventas Chile',
    outputFile: 'pb-raw-ventas.json',
  },
  {
    key: 'td',
    id: process.env.PB_TD_AGENT_ID || '1153354836325554',
    name: 'Transformación Digital',
    keyword: 'Ingeniero Transformación Digital Chile',
    outputFile: 'pb-raw-transformacion-digital.json',
  },
];

const ROOT = path.join(__dirname, '..');

function pbRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.phantombuster.com',
      path: `/api/v2/${apiPath}`,
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

async function getStatus(phantom) {
  const res = await pbRequest('GET', `agents/fetch-output?id=${phantom.id}`);
  return res.data;
}

async function collectOutput(phantom) {
  const res = await getStatus(phantom);
  if (res.status !== 'finished' || !res.resultObject) return null;

  const profiles = typeof res.resultObject === 'string'
    ? JSON.parse(res.resultObject) : res.resultObject;

  if (!Array.isArray(profiles)) return null;

  // Tag each profile with source phantom
  const tagged = profiles.map(p => ({
    ...p,
    _source: phantom.key,
    _sourceKeyword: phantom.keyword,
    _sourcePhantomId: phantom.id,
  }));

  // Save individual file
  const outPath = path.join(ROOT, phantom.outputFile);
  fs.writeFileSync(outPath, JSON.stringify({
    status: 'finished',
    agentId: phantom.id,
    keyword: phantom.keyword,
    extractedAt: new Date().toISOString(),
    count: tagged.length,
    resultObject: tagged,
  }, null, 2));

  return tagged;
}

async function showStatus() {
  console.log('\n📊 Estado de todos los phantoms\n');
  console.log('| Phantom | ID | Estado | Perfiles |');
  console.log('|---------|-----|--------|----------|');

  for (const phantom of PHANTOMS) {
    const res = await getStatus(phantom);
    let profileCount = '-';
    if (res.resultObject) {
      const profiles = typeof res.resultObject === 'string'
        ? JSON.parse(res.resultObject) : res.resultObject;
      if (Array.isArray(profiles)) profileCount = profiles.length;
    }
    console.log(`| ${phantom.name} | ${phantom.id} | ${res.status || 'never run'} | ${profileCount} |`);
  }
}

async function launchAndCollect(phantoms) {
  const allProfiles = [];

  for (const phantom of phantoms) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🎯 ${phantom.name} (${phantom.keyword})`);
    console.log(`   ID: ${phantom.id}`);
    console.log(`${'─'.repeat(60)}`);

    // Check if already running or finished
    const status = await getStatus(phantom);

    if (status.status === 'running') {
      console.log('  ⏳ Ya está corriendo. Esperando...');
    } else if (status.status === 'finished' && status.resultObject) {
      // Check if output is recent (last 2 hours)
      console.log('  📋 Tiene output reciente. Recolectando...');
      const profiles = await collectOutput(phantom);
      if (profiles) {
        allProfiles.push(...profiles);
        console.log(`  ✅ ${profiles.length} perfiles recolectados de ${phantom.outputFile}`);
        continue;
      }
    } else {
      // Launch
      console.log('  🚀 Lanzando phantom...');
      const launchRes = await pbRequest('POST', 'agents/launch', { id: phantom.id });
      if (launchRes.status !== 200) {
        console.error(`  ❌ Error: ${JSON.stringify(launchRes.data)}`);
        // If max parallel reached, try to collect existing output
        if (launchRes.data?.error?.includes('parallel')) {
          console.log('  ↩ Límite paralelo alcanzado. Intentando recolectar output existente...');
          const profiles = await collectOutput(phantom);
          if (profiles) {
            allProfiles.push(...profiles);
            console.log(`  ✅ ${profiles.length} perfiles recolectados`);
          }
        }
        continue;
      }
      console.log('  ✅ Lanzado.');
    }

    // Poll for completion
    let collected = false;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 20000)); // 20s
      const out = await getStatus(phantom);
      process.stdout.write(`  ⏳ Check ${i + 1}/25... ${out.status}`);

      if (out.status === 'finished') {
        console.log(' ✅');
        const profiles = await collectOutput(phantom);
        if (profiles) {
          allProfiles.push(...profiles);
          console.log(`  📁 ${profiles.length} perfiles → ${phantom.outputFile}`);
          collected = true;
        }
        break;
      }
      if (out.status === 'error' || out.status === 'crashed') {
        console.log(' ❌');
        console.error(`  Output: ${(out.output || '').slice(-200)}`);
        break;
      }
      console.log('');
    }

    if (!collected) {
      console.log(`  ⚠ No se pudo recolectar output de ${phantom.name}`);
    }
  }

  return allProfiles;
}

function consolidate(allProfiles) {
  if (allProfiles.length === 0) {
    console.log('\n⚠ No hay perfiles para consolidar.');
    return;
  }

  // Dedup by LinkedIn URL
  const seen = new Set();
  const unique = allProfiles.filter(p => {
    const url = p.linkedInProfileUrl || p.profileUrl || p.linkedinUrl || '';
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  const dupes = allProfiles.length - unique.length;

  // Save consolidated file
  const consolidatedPath = path.join(ROOT, 'pb-leads-latest.json');
  fs.writeFileSync(consolidatedPath, JSON.stringify(unique, null, 2));

  // Also save to cache for score-leads.js
  const cacheDir = path.join(process.env.TEMP || '/tmp', 'sisteco');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'pb-leads-latest.json'), JSON.stringify(unique, null, 2));

  // Summary by source
  const bySrc = {};
  unique.forEach(p => {
    const src = p._source || 'unknown';
    bySrc[src] = (bySrc[src] || 0) + 1;
  });

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 CONSOLIDADO`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`Total perfiles: ${allProfiles.length}`);
  console.log(`Duplicados removidos: ${dupes}`);
  console.log(`Perfiles únicos: ${unique.length}`);
  console.log(`\nPor fuente:`);
  for (const [src, count] of Object.entries(bySrc)) {
    const phantom = PHANTOMS.find(p => p.key === src);
    console.log(`  ${phantom ? phantom.name : src}: ${count}`);
  }
  console.log(`\n📁 Guardado en: pb-leads-latest.json`);
  console.log(`📁 Cache scoring: ${path.join(cacheDir, 'pb-leads-latest.json')}`);
  console.log(`\n💡 Siguiente paso: node scripts/score-leads.js`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--status')) {
    await showStatus();
    return;
  }

  // Filter phantoms if --only specified
  let targetPhantoms = PHANTOMS;
  const onlyIdx = args.indexOf('--only');
  if (onlyIdx !== -1 && args[onlyIdx + 1]) {
    const key = args[onlyIdx + 1].toLowerCase();
    const found = PHANTOMS.find(p => p.key === key);
    if (!found) {
      console.error(`❌ Phantom "${key}" no encontrado. Disponibles: ${PHANTOMS.map(p => p.key).join(', ')}`);
      process.exit(1);
    }
    targetPhantoms = [found];
  }

  console.log(`\n🔄 Pipeline multi-phantom — ${targetPhantoms.length} phantom(s)`);
  console.log(`   Phantoms: ${targetPhantoms.map(p => `${p.name} (${p.key})`).join(', ')}\n`);

  let allProfiles;

  if (args.includes('--collect')) {
    // Just collect existing outputs
    allProfiles = [];
    for (const phantom of targetPhantoms) {
      const profiles = await collectOutput(phantom);
      if (profiles) {
        allProfiles.push(...profiles);
        console.log(`✅ ${phantom.name}: ${profiles.length} perfiles`);
      } else {
        console.log(`⚠ ${phantom.name}: sin output disponible`);
      }
    }
  } else {
    allProfiles = await launchAndCollect(targetPhantoms);
  }

  consolidate(allProfiles);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

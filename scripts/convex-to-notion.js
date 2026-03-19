#!/usr/bin/env node
/**
 * convex-to-notion.js — Sync UNIFICADO de todas las fuentes de leads a Notion
 *
 * Fuentes:
 *   1. PhantomBuster enriched (pb-leads-enriched.json) — 869 leads LinkedIn
 *   2. Verified emails (leads-lists/list-a-verified-email.json) — 196 con SMTP ok
 *   3. Landing page Convex (fine-cod-99) — formularios web
 *
 * Dedup: LinkedIn URL > email > nombre+empresa
 * Prioridad: verified email > PB enriched > landing page
 *
 * Usage:
 *   node scripts/convex-to-notion.js              # Sync todo
 *   node scripts/convex-to-notion.js --dry-run     # Preview
 *   node scripts/convex-to-notion.js --only-pb     # Solo PhantomBuster
 *   node scripts/convex-to-notion.js --only-landing # Solo landing page
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';

// ============================================
// CONFIG
// ============================================
const LANDING_CONVEX_URL = process.env.LANDING_CONVEX_URL || 'https://fine-cod-99.convex.cloud';
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DB_ID = process.env.NOTION_DATABASE_ID;
const DRY_RUN = process.argv.includes('--dry-run');
const ONLY_PB = process.argv.includes('--only-pb');
const ONLY_LANDING = process.argv.includes('--only-landing');

if (!NOTION_API_KEY || !NOTION_DB_ID) {
  console.error('NOTION_API_KEY y NOTION_DATABASE_ID requeridos en .env');
  process.exit(1);
}

const NOTION_HEADERS = {
  'Authorization': `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

// ============================================
// Notion API helpers
// ============================================
async function notionRequest(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: NOTION_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function getExistingPages() {
  const byKey = new Map(); // linkedin or email → page id
  let hasMore = true;
  let cursor = undefined;

  while (hasMore) {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await notionRequest(
      `https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, 'POST', body
    );
    if (res.status !== 200) { console.error('Notion query error:', res.data?.message); break; }

    for (const page of (res.data.results || [])) {
      const linkedin = page.properties['LinkedIn']?.url;
      const email = page.properties['Email']?.email;
      if (linkedin) byKey.set(`li:${linkedin.toLowerCase()}`, page.id);
      if (email) byKey.set(`em:${email.toLowerCase()}`, page.id);
    }
    hasMore = res.data.has_more;
    cursor = res.data.next_cursor;
  }
  return byKey;
}

function buildProperties(data) {
  const props = {};

  props['Nombre'] = { title: [{ text: { content: (data.fullName || data.companyName || data.email || 'Sin nombre').substring(0, 100) } }] };

  if (data.email) props['Email'] = { email: data.email };
  if (data.company) props['Empresa'] = { rich_text: [{ text: { content: data.company.substring(0, 100) } }] };
  if (data.jobTitle) props['Cargo'] = { rich_text: [{ text: { content: data.jobTitle.substring(0, 100) } }] };
  if (data.linkedinUrl) props['LinkedIn'] = { url: data.linkedinUrl };
  if (data.location) props['Ubicación'] = { rich_text: [{ text: { content: data.location.substring(0, 100) } }] };
  if (data.industry) props['Industria'] = { rich_text: [{ text: { content: data.industry.substring(0, 100) } }] };
  if (data.phone) props['Teléfono'] = { phone_number: data.phone };
  if (data.source) props['Fuente'] = { select: { name: data.source.substring(0, 50) } };
  if (data.status) props['Estado'] = { select: { name: data.status.substring(0, 50) } };

  return props;
}

async function upsertPage(data, existingMap) {
  const props = buildProperties(data);

  // Find existing by LinkedIn or email
  let existingId = null;
  if (data.linkedinUrl) existingId = existingMap.get(`li:${data.linkedinUrl.toLowerCase()}`);
  if (!existingId && data.email) existingId = existingMap.get(`em:${data.email.toLowerCase()}`);

  if (DRY_RUN) return existingId ? 'updated' : 'created';

  let res;
  if (existingId) {
    res = await notionRequest(`https://api.notion.com/v1/pages/${existingId}`, 'PATCH', { properties: props });
  } else {
    res = await notionRequest('https://api.notion.com/v1/pages', 'POST', {
      parent: { database_id: NOTION_DB_ID }, properties: props,
    });
  }

  if (res.status === 200) {
    // Register new keys
    if (!existingId && res.data.id) {
      if (data.linkedinUrl) existingMap.set(`li:${data.linkedinUrl.toLowerCase()}`, res.data.id);
      if (data.email) existingMap.set(`em:${data.email.toLowerCase()}`, res.data.id);
    }
    return existingId ? 'updated' : 'created';
  }

  // Retry minimal
  const minProps = { 'Nombre': props['Nombre'] };
  if (data.email) minProps['Email'] = { email: data.email };
  const retry = existingId
    ? await notionRequest(`https://api.notion.com/v1/pages/${existingId}`, 'PATCH', { properties: minProps })
    : await notionRequest('https://api.notion.com/v1/pages', 'POST', { parent: { database_id: NOTION_DB_ID }, properties: minProps });

  if (retry.status === 200) return existingId ? 'updated' : 'created';
  return 'error';
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ============================================
// Data loaders
// ============================================
function loadPhantomBusterLeads() {
  const merged = new Map();

  // 1. Load enriched leads (869)
  const enrichedPath = 'pb-leads-enriched.json';
  if (existsSync(enrichedPath)) {
    const data = JSON.parse(readFileSync(enrichedPath, 'utf8'));
    for (const lead of data) {
      const key = lead.linkedinProfileUrl?.toLowerCase() || lead.emailBestGuess?.toLowerCase() || lead.fullName?.toLowerCase();
      if (!key) continue;
      merged.set(key, {
        fullName: lead.fullName,
        email: lead.emailBestGuess || null,
        company: lead.company,
        jobTitle: lead.jobTitle,
        linkedinUrl: lead.linkedinProfileUrl,
        location: lead.location,
        industry: lead.industry,
        source: 'phantombuster',
        status: 'prospecto',
      });
    }
  }

  // 2. Overlay verified emails (196) — these have confirmed emails
  const verifiedPath = 'leads-lists/list-a-verified-email.json';
  if (existsSync(verifiedPath)) {
    const data = JSON.parse(readFileSync(verifiedPath, 'utf8'));
    for (const lead of data) {
      const key = lead.linkedinProfileUrl?.toLowerCase() || lead.email?.toLowerCase() || lead.fullName?.toLowerCase();
      if (!key) continue;
      const existing = merged.get(key) || {};
      merged.set(key, {
        ...existing,
        fullName: lead.fullName || existing.fullName,
        email: lead.email || existing.email, // verified email takes priority
        company: lead.company || existing.company,
        jobTitle: lead.jobTitle || existing.jobTitle,
        linkedinUrl: lead.linkedinProfileUrl || existing.linkedinUrl,
        location: lead.location || existing.location,
        industry: lead.industry || existing.industry,
        source: 'phantombuster_verified',
        status: 'email_verificado',
      });
    }
  }

  return [...merged.values()];
}

async function loadLandingPageLeads() {
  const convex = new ConvexHttpClient(LANDING_CONVEX_URL);
  const api = anyApi;

  const [leads, demos, subs] = await Promise.all([
    convex.query(api.leads.listAll, {}),
    convex.query(api.demoRequests.listAll, {}),
    convex.query(api.subscriptions.listAll, {}),
  ]);

  const merged = new Map();

  for (const lead of leads) {
    if (!lead.email) continue;
    merged.set(lead.email.toLowerCase(), {
      fullName: null,
      email: lead.email,
      company: null,
      source: lead.source || 'landing',
      status: 'lead',
    });
  }

  for (const demo of demos) {
    if (!demo.email) continue;
    const key = demo.email.toLowerCase();
    const existing = merged.get(key) || { email: demo.email };
    merged.set(key, {
      ...existing,
      company: demo.companyName || existing.company,
      phone: demo.phone || existing.phone,
      source: 'demo_request',
      status: demo.status || 'demo_pending',
    });
  }

  for (const sub of subs) {
    if (!sub.email) continue;
    const key = sub.email.toLowerCase();
    const existing = merged.get(key) || { email: sub.email };
    merged.set(key, {
      ...existing,
      company: sub.companyName || existing.company,
      source: `suscriptor_${sub.plan || 'unknown'}`,
      status: sub.status || 'active',
    });
  }

  return [...merged.values()];
}

// ============================================
// Main
// ============================================
async function main() {
  console.log('\nSisteco — Sync Unificado a Notion');
  console.log('=================================\n');
  if (DRY_RUN) console.log('*** DRY RUN ***\n');

  // 1. Existing pages
  console.log('1. Leyendo Notion existente...');
  const existingMap = await getExistingPages();
  console.log(`   ${existingMap.size} registros existentes\n`);

  // 2. Load all sources
  let allLeads = [];

  if (!ONLY_LANDING) {
    console.log('2a. Cargando PhantomBuster leads...');
    const pbLeads = loadPhantomBusterLeads();
    console.log(`    ${pbLeads.length} leads de PhantomBuster`);
    allLeads.push(...pbLeads);
  }

  if (!ONLY_PB) {
    console.log('2b. Cargando Landing Page (Convex)...');
    const landingLeads = await loadLandingPageLeads();
    console.log(`    ${landingLeads.length} leads de Landing Page`);
    allLeads.push(...landingLeads);
  }

  // Dedup final by email/linkedin
  const deduped = new Map();
  for (const lead of allLeads) {
    const key = lead.linkedinUrl?.toLowerCase() || lead.email?.toLowerCase();
    if (!key) continue;
    const existing = deduped.get(key);
    if (existing) {
      // Merge: keep richer data
      deduped.set(key, {
        ...existing,
        fullName: lead.fullName || existing.fullName,
        email: lead.email || existing.email,
        company: lead.company || existing.company,
        jobTitle: lead.jobTitle || existing.jobTitle,
        linkedinUrl: lead.linkedinUrl || existing.linkedinUrl,
        location: lead.location || existing.location,
        industry: lead.industry || existing.industry,
        phone: lead.phone || existing.phone,
        // Keep higher-priority source
        source: lead.source.includes('verified') ? lead.source
          : lead.source.includes('suscriptor') ? lead.source
          : lead.source.includes('demo') ? lead.source
          : existing.source || lead.source,
        status: lead.status.includes('verificado') ? lead.status
          : lead.status === 'active' ? lead.status
          : existing.status || lead.status,
      });
    } else {
      deduped.set(key, lead);
    }
  }

  console.log(`\n   Total unico: ${deduped.size} leads\n`);

  // 3. Sync
  console.log('3. Sincronizando a Notion...');
  let created = 0, updated = 0, errors = 0;
  let count = 0;

  for (const [, data] of deduped) {
    const result = await upsertPage(data, existingMap);
    if (result === 'created') created++;
    else if (result === 'updated') updated++;
    else errors++;

    count++;
    if (count % 50 === 0) process.stdout.write(` [${count}/${deduped.size}]`);
    else process.stdout.write(result === 'created' ? '+' : result === 'updated' ? 'U' : '!');

    if (!DRY_RUN) await delay(350);
  }

  console.log('\n');
  console.log('=================================');
  console.log(`Creados:      ${created}`);
  console.log(`Actualizados: ${updated}`);
  console.log(`Errores:      ${errors}`);
  console.log(`Total:        ${deduped.size}`);
  console.log('=================================\n');
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});

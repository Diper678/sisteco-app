#!/usr/bin/env node
/**
 * notion-sync.js — Sincroniza leads de Convex a Notion
 *
 * Lee leads de Convex y los crea/actualiza en una base de datos de Notion.
 * Deduplicación por linkedinUrl o email+empresa.
 *
 * Usage:
 *   node scripts/notion-sync.js                    # Sync todos los leads nuevos
 *   node scripts/notion-sync.js --all              # Sync TODOS los leads
 *   node scripts/notion-sync.js --status scored    # Solo leads scored
 *   node scripts/notion-sync.js --category HOT     # Solo leads HOT
 *
 * Requiere:
 *   NOTION_API_KEY=secret_xxxxx
 *   NOTION_DATABASE_ID=xxxxx
 *   CONVEX_SITE_URL=https://animated-pika-122.convex.cloud
 *   SAAN_API_SECRET=saan-prod-2026-xyz789
 */

const https = require('https');
const { URL } = require('url');

// ============================================
// CONFIG — from .env
// ============================================
require('dotenv').config();

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DB_ID = process.env.NOTION_DATABASE_ID;
const CONVEX_URL = process.env.CONVEX_SITE_URL || 'https://animated-pika-122.convex.cloud';
const CONVEX_SECRET = process.env.SAAN_API_SECRET || 'saan-prod-2026-xyz789';

if (!NOTION_API_KEY) {
  console.error('❌ NOTION_API_KEY no configurado en .env');
  console.error('   1. Ve a https://www.notion.so/my-integrations');
  console.error('   2. Crea una integración interna');
  console.error('   3. Copia el "Internal Integration Secret"');
  console.error('   4. Agrégalo a .env: NOTION_API_KEY=secret_xxxxx');
  process.exit(1);
}

if (!NOTION_DB_ID) {
  console.error('❌ NOTION_DATABASE_ID no configurado en .env');
  console.error('   1. Abre tu base de datos de contactos en Notion');
  console.error('   2. La URL tiene formato: notion.so/xxxxx?v=yyyyy');
  console.error('   3. El ID es la parte "xxxxx" (32 chars)');
  console.error('   4. Agrégalo a .env: NOTION_DATABASE_ID=xxxxx');
  process.exit(1);
}

// ============================================
// HTTP helpers
// ============================================
function httpRequest(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body ? JSON.stringify(body) : null;

    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
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

// ============================================
// Convex API
// ============================================
async function fetchLeadsFromConvex(filters = {}) {
  const args = {};
  if (filters.status) args.status = filters.status;
  if (filters.category) args.scoreCategory = filters.category;

  // Try to get leads with the appropriate function
  const functionName = filters.status
    ? (filters.status === 'new' ? 'leads:getLeadsToEnrich' : 'leads:getLeadsToScore')
    : 'leads:getAllLeads';

  const res = await httpRequest(
    `${CONVEX_URL}/api/call`,
    'POST',
    { 'X-SAAN-Secret': CONVEX_SECRET },
    { function: functionName, args }
  );

  if (res.status !== 200) {
    // Fallback: try query
    const fallbackRes = await httpRequest(
      `${CONVEX_URL}/api/query`,
      'POST',
      { 'X-SAAN-Secret': CONVEX_SECRET },
      { function: 'leads:listLeads', args: { limit: 500, ...args } }
    );
    if (fallbackRes.status === 200) return fallbackRes.data.value || fallbackRes.data || [];
    throw new Error(`Convex error: ${JSON.stringify(res.data)}`);
  }

  return res.data.value || res.data || [];
}

// ============================================
// Notion API
// ============================================
const NOTION_HEADERS = {
  'Authorization': `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28'
};

async function getExistingNotionPages() {
  // Query all pages in the database to check for duplicates
  const pages = [];
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const body = { page_size: 100 };
    if (startCursor) body.start_cursor = startCursor;

    const res = await httpRequest(
      `https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`,
      'POST',
      NOTION_HEADERS,
      body
    );

    if (res.status !== 200) {
      console.error('Error querying Notion:', JSON.stringify(res.data));
      break;
    }

    pages.push(...(res.data.results || []));
    hasMore = res.data.has_more;
    startCursor = res.data.next_cursor;
  }

  return pages;
}

function buildNotionProperties(lead) {
  // Map lead fields to Notion database properties
  // Assumes the Notion DB has these columns (creates them as text if they exist)
  const props = {};

  // Title property (required — first column)
  props['Nombre'] = {
    title: [{ text: { content: lead.contacto || 'Sin nombre' } }]
  };

  // Rich text properties
  if (lead.empresa) {
    props['Empresa'] = { rich_text: [{ text: { content: lead.empresa } }] };
  }
  if (lead.cargo) {
    props['Cargo'] = { rich_text: [{ text: { content: lead.cargo } }] };
  }
  if (lead.email) {
    props['Email'] = { email: lead.email };
  }
  if (lead.telefono) {
    props['Teléfono'] = { phone_number: lead.telefono };
  }
  if (lead.linkedinUrl) {
    props['LinkedIn'] = { url: lead.linkedinUrl };
  }
  if (lead.websiteUrl) {
    props['Website'] = { url: lead.websiteUrl };
  }
  if (lead.ubicacion) {
    props['Ubicación'] = { rich_text: [{ text: { content: lead.ubicacion } }] };
  }
  if (lead.industria) {
    props['Industria'] = { rich_text: [{ text: { content: lead.industria } }] };
  }

  // Select properties
  if (lead.scoreCategory) {
    props['Categoría'] = { select: { name: lead.scoreCategory } };
  }
  if (lead.status) {
    props['Estado'] = { select: { name: lead.status } };
  }
  if (lead.source) {
    props['Fuente'] = { select: { name: lead.source } };
  }

  // Number
  if (lead.score !== undefined && lead.score !== null) {
    props['Score'] = { number: lead.score };
  }

  return props;
}

async function createNotionPage(lead) {
  const res = await httpRequest(
    'https://api.notion.com/v1/pages',
    'POST',
    NOTION_HEADERS,
    {
      parent: { database_id: NOTION_DB_ID },
      properties: buildNotionProperties(lead)
    }
  );

  if (res.status !== 200) {
    // If property type mismatch, try with minimal properties
    if (res.data?.message?.includes('property')) {
      console.warn(`  ⚠ Propiedad no existe en Notion DB. Intentando con campos mínimos...`);
      const minimalProps = {
        'Nombre': { title: [{ text: { content: `${lead.contacto || 'Sin nombre'} — ${lead.empresa || ''}` } }] }
      };
      const retryRes = await httpRequest(
        'https://api.notion.com/v1/pages',
        'POST',
        NOTION_HEADERS,
        { parent: { database_id: NOTION_DB_ID }, properties: minimalProps }
      );
      return retryRes;
    }
  }

  return res;
}

async function updateNotionPage(pageId, lead) {
  return httpRequest(
    `https://api.notion.com/v1/pages/${pageId}`,
    'PATCH',
    NOTION_HEADERS,
    { properties: buildNotionProperties(lead) }
  );
}

// ============================================
// Deduplication
// ============================================
function getLeadKey(lead) {
  if (lead.linkedinUrl) return `linkedin:${lead.linkedinUrl.toLowerCase()}`;
  if (lead.email) return `email:${lead.email.toLowerCase()}`;
  return `name:${(lead.contacto || '').toLowerCase()}:${(lead.empresa || '').toLowerCase()}`;
}

function getNotionPageKey(page) {
  const props = page.properties;
  // Try LinkedIn URL first
  if (props['LinkedIn']?.url) return `linkedin:${props['LinkedIn'].url.toLowerCase()}`;
  // Try email
  if (props['Email']?.email) return `email:${props['Email'].email.toLowerCase()}`;
  // Fallback to name + company
  const name = props['Nombre']?.title?.[0]?.text?.content || '';
  const company = props['Empresa']?.rich_text?.[0]?.text?.content || '';
  return `name:${name.toLowerCase()}:${company.toLowerCase()}`;
}

// ============================================
// Main sync
// ============================================
async function main() {
  const args = process.argv.slice(2);
  const filters = {};

  // Parse CLI args
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--status' && args[i + 1]) filters.status = args[++i];
    if (args[i] === '--category' && args[i + 1]) filters.category = args[++i];
    if (args[i] === '--all') filters.all = true;
  }

  console.log('\n📊 Notion Sync — Sisteco Leads Pipeline');
  console.log('========================================\n');

  // Step 1: Fetch leads from Convex
  console.log('1️⃣  Leyendo leads de Convex...');
  let leads;
  try {
    leads = await fetchLeadsFromConvex(filters);
  } catch (err) {
    console.error(`   ❌ Error Convex: ${err.message}`);
    process.exit(1);
  }
  console.log(`   ✅ ${leads.length} leads encontrados\n`);

  if (leads.length === 0) {
    console.log('   No hay leads para sincronizar.');
    return;
  }

  // Step 2: Get existing Notion pages for dedup
  console.log('2️⃣  Leyendo páginas existentes en Notion...');
  let existingPages;
  try {
    existingPages = await getExistingNotionPages();
  } catch (err) {
    console.error(`   ❌ Error Notion: ${err.message}`);
    process.exit(1);
  }

  const existingMap = new Map();
  for (const page of existingPages) {
    const key = getNotionPageKey(page);
    existingMap.set(key, page.id);
  }
  console.log(`   ✅ ${existingPages.length} páginas existentes\n`);

  // Step 3: Sync
  console.log('3️⃣  Sincronizando...');
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const lead of leads) {
    const key = getLeadKey(lead);
    const existingPageId = existingMap.get(key);

    try {
      if (existingPageId) {
        // Update existing page
        const res = await updateNotionPage(existingPageId, lead);
        if (res.status === 200) {
          updated++;
          process.stdout.write('U');
        } else {
          errors++;
          process.stdout.write('!');
        }
      } else {
        // Create new page
        const res = await createNotionPage(lead);
        if (res.status === 200) {
          created++;
          process.stdout.write('+');
        } else {
          errors++;
          process.stdout.write('!');
          if (errors <= 3) {
            console.error(`\n   Error creating: ${JSON.stringify(res.data?.message || res.data).substring(0, 200)}`);
          }
        }
      }
    } catch (err) {
      errors++;
      process.stdout.write('X');
    }

    // Rate limit: Notion API allows 3 req/sec
    await new Promise(r => setTimeout(r, 350));
  }

  console.log('\n');
  console.log('========================================');
  console.log(`✅ Creados:      ${created}`);
  console.log(`🔄 Actualizados: ${updated}`);
  console.log(`⏭  Skipped:      ${skipped}`);
  console.log(`❌ Errores:       ${errors}`);
  console.log(`📊 Total:         ${leads.length}`);
  console.log('========================================\n');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});

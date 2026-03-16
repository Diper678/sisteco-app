#!/usr/bin/env node
/**
 * pb-email-finder.js — Automated email enrichment via PhantomBuster Professional Email Finder
 *
 * Manages the full lifecycle:
 *   1. Prepares a Google Sheet with leads that need email enrichment
 *   2. Configures and launches the phantom in controlled batches
 *   3. Polls for completion and parses results from output log
 *   4. Tracks progress across multiple runs (survives org timeout)
 *   5. Merges found emails back into leads JSON
 *
 * Usage:
 *   node scripts/pb-email-finder.js prepare        # Create Google Sheet with leads
 *   node scripts/pb-email-finder.js launch          # Launch phantom (next batch)
 *   node scripts/pb-email-finder.js status          # Check phantom status
 *   node scripts/pb-email-finder.js collect         # Parse output log for emails
 *   node scripts/pb-email-finder.js run             # Full cycle: launch → wait → collect
 *   node scripts/pb-email-finder.js progress        # Show enrichment progress
 *   node scripts/pb-email-finder.js merge           # Merge found emails into pb-leads-latest.json
 *   node scripts/pb-email-finder.js export-csv      # Export leads needing emails as CSV
 *
 * Config:
 *   PB_EMAIL_FINDER_ID    = PhantomBuster phantom ID (default: 5808820309237769)
 *   PHANTOMBUSTER_API_KEY  = PB API key
 *   PB_BATCH_SIZE         = Rows per launch (default: 50)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// --- Configuration ---
const PB_KEY = process.env.PHANTOMBUSTER_API_KEY || '4g2SqzX1xS45348lUTaaRYhF87uLc8o64HObs4QhJRA';
const PHANTOM_ID = process.env.PB_EMAIL_FINDER_ID || '5808820309237769';
const BATCH_SIZE = parseInt(process.env.PB_BATCH_SIZE || '50', 10);

const ROOT = path.join(__dirname, '..');
const LEADS_FILE = path.join(ROOT, 'pb-leads-latest.json');
const PROGRESS_FILE = path.join(ROOT, 'pb-email-progress.json');
const ENRICHED_FILE = path.join(ROOT, 'pb-leads-enriched.json');

// --- Progress Tracker ---

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return {
    sheetId: null,
    sheetUrl: null,
    totalLeads: 0,
    processedCount: 0,
    foundEmails: {},      // linkedinUrl -> email
    notFound: [],         // linkedinUrl[]
    lastLaunchAt: null,
    lastCollectAt: null,
    batchSize: BATCH_SIZE,
    runs: []
  };
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// --- PhantomBuster API ---

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

// --- Google Sheets (via sheets-manager.js pattern) ---

let sheetsApi = null;
let driveApi = null;

function initGoogleAuth() {
  try {
    const { google } = require('googleapis');
    const credsPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'gws', 'credentials.json');

    if (!fs.existsSync(credsPath)) {
      console.error('Google auth not configured. Run: node scripts/google-auth.js');
      return false;
    }

    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
    const oauth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret);
    oauth2.setCredentials({
      access_token: creds.access_token,
      refresh_token: creds.refresh_token,
      token_type: creds.token_type || 'Bearer',
      expiry_date: creds.expiry_date
    });

    oauth2.on('tokens', (tokens) => {
      if (tokens.access_token) {
        creds.access_token = tokens.access_token;
        if (tokens.expiry_date) creds.expiry_date = tokens.expiry_date;
        creds.updated_at = new Date().toISOString();
        fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2));
      }
    });

    sheetsApi = google.sheets({ version: 'v4', auth: oauth2 });
    driveApi = google.drive({ version: 'v3', auth: oauth2 });
    return true;
  } catch (err) {
    console.error('Google API init failed:', err.message);
    return false;
  }
}

// --- Core Functions ---

function loadLeads() {
  if (!fs.existsSync(LEADS_FILE)) {
    console.error(`Leads file not found: ${LEADS_FILE}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
}

function getLeadsNeedingEmail(leads, progress) {
  return leads.filter(l => {
    const url = l.linkedinProfileUrl || l.profileUrl || '';
    // Skip if already found or already marked as not found
    if (progress.foundEmails[url]) return false;
    if (progress.notFound.includes(url)) return false;
    // Need firstName + lastName + company minimum
    if (!l.firstName || !l.lastName || !l.company) return false;
    return true;
  });
}

async function cmdPrepare() {
  console.log('Preparing Google Sheet for Professional Email Finder...\n');

  if (!initGoogleAuth()) {
    console.log('Falling back to CSV export. Use: node scripts/pb-email-finder.js export-csv');
    return;
  }

  const leads = loadLeads();
  const progress = loadProgress();
  const needEmail = getLeadsNeedingEmail(leads, progress);

  console.log(`Total leads: ${leads.length}`);
  console.log(`Already have email: ${Object.keys(progress.foundEmails).length}`);
  console.log(`Confirmed no email: ${progress.notFound.length}`);
  console.log(`Need enrichment: ${needEmail.length}\n`);

  if (needEmail.length === 0) {
    console.log('All leads already processed!');
    return;
  }

  // Create Google Sheet with PB-compatible format
  // Professional Email Finder expects: firstName, lastName, company (or linkedinUrl)
  const sheetTitle = `Sisteco Email Finder - ${new Date().toISOString().slice(0, 10)}`;

  let sheetId = progress.sheetId;
  let sheetUrl = progress.sheetUrl;

  if (!sheetId) {
    console.log('Creating new Google Sheet...');
    const res = await sheetsApi.spreadsheets.create({
      requestBody: {
        properties: { title: sheetTitle },
        sheets: [{ properties: { title: 'Leads' } }]
      }
    });
    sheetId = res.data.spreadsheetId;
    sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

    // Make it publicly viewable (PB needs this)
    await driveApi.permissions.create({
      fileId: sheetId,
      requestBody: { role: 'reader', type: 'anyone' }
    });

    console.log(`Sheet created: ${sheetUrl}`);
  } else {
    console.log(`Using existing sheet: ${sheetUrl}`);
    // Clear existing data
    try {
      await sheetsApi.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: 'Leads!A:F'
      });
    } catch { /* ignore if range doesn't exist */ }
  }

  // Write header + data
  // PB Professional Email Finder accepts these column names
  const headers = ['firstName', 'lastName', 'company', 'linkedinUrl'];
  const rows = needEmail.map(l => [
    l.firstName || '',
    l.lastName || '',
    l.company || '',
    l.linkedinProfileUrl || l.profileUrl || ''
  ]);

  const allData = [headers, ...rows];

  // Write in chunks (Google Sheets API has limits)
  const CHUNK_SIZE = 500;
  for (let i = 0; i < allData.length; i += CHUNK_SIZE) {
    const chunk = allData.slice(i, i + CHUNK_SIZE);
    const startRow = i + 1;
    const endRow = startRow + chunk.length - 1;
    const range = `Leads!A${startRow}:D${endRow}`;

    if (i === 0) {
      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: chunk }
      });
    } else {
      await sheetsApi.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Leads!A:D',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: chunk }
      });
    }
    process.stdout.write(`  Wrote rows ${startRow}-${endRow} of ${allData.length}\r`);
  }

  console.log(`\nWrote ${rows.length} leads to Google Sheet`);

  // Save progress
  progress.sheetId = sheetId;
  progress.sheetUrl = sheetUrl;
  progress.totalLeads = needEmail.length;
  saveProgress(progress);

  console.log(`\nSheet URL: ${sheetUrl}`);
  console.log(`\nNext step: Configure phantom to use this sheet, then run:`);
  console.log(`  node scripts/pb-email-finder.js launch`);
}

async function cmdExportCsv() {
  const leads = loadLeads();
  const progress = loadProgress();
  const needEmail = getLeadsNeedingEmail(leads, progress);

  console.log(`Exporting ${needEmail.length} leads to CSV...\n`);

  const csvPath = path.join(ROOT, 'pb-email-finder-input.csv');
  const header = 'firstName,lastName,company,linkedinUrl';
  const rows = needEmail.map(l => {
    const escape = (s) => `"${(s || '').replace(/"/g, '""')}"`;
    return [
      escape(l.firstName),
      escape(l.lastName),
      escape(l.company),
      escape(l.linkedinProfileUrl || l.profileUrl || '')
    ].join(',');
  });

  fs.writeFileSync(csvPath, [header, ...rows].join('\n'));
  console.log(`Exported to: ${csvPath}`);
  console.log(`Rows: ${rows.length}`);
  console.log(`\nUpload this CSV to Google Sheets manually, make it public, and update the phantom.`);
}

async function cmdLaunch() {
  const progress = loadProgress();

  // Check if phantom is already running
  const statusRes = await pbRequest('GET', `agents/fetch-output?id=${PHANTOM_ID}`);
  if (statusRes.data.status === 'running') {
    console.log('Phantom is already running. Wait for it to finish.');
    console.log('Check with: node scripts/pb-email-finder.js status');
    return;
  }

  // Configure the phantom with Google Sheet URL and batch size
  const launchArgs = {};

  if (progress.sheetUrl) {
    launchArgs.spreadsheetUrl = progress.sheetUrl;
  }
  launchArgs.numberOfLinesPerLaunch = BATCH_SIZE;
  launchArgs.emailChooser = 'phantombuster'; // Uses Dropcontact

  console.log(`Launching Professional Email Finder...`);
  console.log(`  Batch size: ${BATCH_SIZE} rows`);
  console.log(`  Input: ${progress.sheetUrl || 'phantom default (PB lead list)'}`);

  const res = await pbRequest('POST', 'agents/launch', {
    id: PHANTOM_ID,
    argument: JSON.stringify(launchArgs)
  });

  if (res.status === 200) {
    console.log(`\nLaunched successfully!`);
    progress.lastLaunchAt = new Date().toISOString();
    progress.runs.push({
      launchedAt: progress.lastLaunchAt,
      status: 'running',
      emailsFound: 0
    });
    saveProgress(progress);
    console.log(`\nMonitor with: node scripts/pb-email-finder.js status`);
    console.log(`Or auto-wait: node scripts/pb-email-finder.js run`);
  } else {
    console.error(`Launch failed:`, JSON.stringify(res.data, null, 2));
    if (res.data?.error?.includes('timeout') || res.data?.error?.includes('limit')) {
      console.log('\nOrg execution time exhausted. Options:');
      console.log('  1. Wait for monthly reset');
      console.log('  2. Upgrade PB plan ($159/mo Pro = 80h)');
      console.log('  3. Use alternative enrichment: node scripts/pb-email-finder.js alt-enrich');
    }
  }
}

async function cmdStatus() {
  const res = await pbRequest('GET', `agents/fetch-output?id=${PHANTOM_ID}`);
  const agent = await pbRequest('GET', `agents/fetch?id=${PHANTOM_ID}`);

  console.log('Professional Email Finder Status');
  console.log('================================');
  console.log(`Status: ${res.data.status || 'unknown'}`);
  console.log(`Last end type: ${agent.data.lastEndType || 'n/a'}`);
  console.log(`Total launches: ${agent.data.nbLaunches || 0}`);

  const progress = loadProgress();
  console.log(`\nEnrichment Progress:`);
  console.log(`  Emails found: ${Object.keys(progress.foundEmails).length}`);
  console.log(`  Not found: ${progress.notFound.length}`);
  console.log(`  Total processed: ${Object.keys(progress.foundEmails).length + progress.notFound.length}`);
  console.log(`  Remaining: ${progress.totalLeads - Object.keys(progress.foundEmails).length - progress.notFound.length}`);
  console.log(`  Last launch: ${progress.lastLaunchAt || 'never'}`);
  console.log(`  Last collect: ${progress.lastCollectAt || 'never'}`);

  // Parse current output for emails
  if (res.data.output) {
    const emailMatches = res.data.output.match(/found (.+?) for (.+?) - (https:\/\/linkedin\.com\/in\/.+?)\./g);
    if (emailMatches) {
      console.log(`\nEmails in current output: ${emailMatches.length}`);
    }
  }
}

async function cmdCollect() {
  console.log('Collecting emails from phantom output...\n');

  const res = await pbRequest('GET', `agents/fetch-output?id=${PHANTOM_ID}`);
  const progress = loadProgress();

  if (!res.data.output) {
    console.log('No output available.');
    return;
  }

  const output = res.data.output;
  let newEmails = 0;
  let newNotFound = 0;

  // Parse output log for email results
  // Format: "PhantomBuster via Dropcontact found EMAIL for NAME - URL. (N)"
  // Format: "PhantomBuster via Dropcontact found no email for NAME - URL. (N)"
  const lines = output.split('\n');

  for (const line of lines) {
    // Found email
    const foundMatch = line.match(/found ([^\s]+@[^\s]+) for .+? - (https:\/\/linkedin\.com\/in\/[^\s.]+)/);
    if (foundMatch) {
      const [, email, linkedinUrl] = foundMatch;
      if (!progress.foundEmails[linkedinUrl]) {
        progress.foundEmails[linkedinUrl] = email;
        newEmails++;
        console.log(`  + ${email} (${linkedinUrl.split('/in/')[1]})`);
      }
      continue;
    }

    // No email found
    const notFoundMatch = line.match(/found no email for .+? - (https:\/\/linkedin\.com\/in\/[^\s.]+)/);
    if (notFoundMatch) {
      const linkedinUrl = notFoundMatch[1];
      if (!progress.notFound.includes(linkedinUrl) && !progress.foundEmails[linkedinUrl]) {
        progress.notFound.push(linkedinUrl);
        newNotFound++;
      }
    }
  }

  progress.lastCollectAt = new Date().toISOString();

  // Update last run
  if (progress.runs.length > 0) {
    const lastRun = progress.runs[progress.runs.length - 1];
    lastRun.status = res.data.status || 'collected';
    lastRun.emailsFound = newEmails;
    lastRun.collectedAt = progress.lastCollectAt;
  }

  saveProgress(progress);

  console.log(`\nCollection Results:`);
  console.log(`  New emails found: ${newEmails}`);
  console.log(`  New not-found: ${newNotFound}`);
  console.log(`  Total emails: ${Object.keys(progress.foundEmails).length}`);
  console.log(`  Total not-found: ${progress.notFound.length}`);
}

async function cmdRun() {
  console.log('Full cycle: Launch → Wait → Collect\n');

  // Launch
  await cmdLaunch();

  // Poll for completion
  console.log('\nWaiting for completion...');
  const MAX_POLLS = 60; // 60 * 15s = 15 min max
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, 15000)); // 15s between checks

    const res = await pbRequest('GET', `agents/fetch-output?id=${PHANTOM_ID}`);
    const status = res.data.status;
    process.stdout.write(`  Poll ${i + 1}/${MAX_POLLS}: ${status}    \r`);

    if (status === 'finished') {
      console.log(`\nPhantom finished!`);
      break;
    }
    if (status === 'error' || status === 'crashed') {
      console.log(`\nPhantom ${status}.`);
      break;
    }
  }

  // Collect
  console.log('');
  await cmdCollect();
}

function cmdProgress() {
  const leads = loadLeads();
  const progress = loadProgress();

  const totalLeads = leads.length;
  const withEmail = Object.keys(progress.foundEmails).length;
  const notFound = progress.notFound.length;
  const processed = withEmail + notFound;
  const remaining = totalLeads - processed;
  const hitRate = processed > 0 ? ((withEmail / processed) * 100).toFixed(1) : 0;

  console.log('Email Enrichment Progress');
  console.log('========================');
  console.log(`Total leads:     ${totalLeads}`);
  console.log(`With email:      ${withEmail} (${((withEmail / totalLeads) * 100).toFixed(1)}%)`);
  console.log(`No email found:  ${notFound}`);
  console.log(`Processed:       ${processed}/${totalLeads}`);
  console.log(`Remaining:       ${remaining}`);
  console.log(`Hit rate:        ${hitRate}%`);
  console.log(`Runs completed:  ${progress.runs.length}`);

  // Progress bar
  const barWidth = 40;
  const filled = Math.round((processed / totalLeads) * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  console.log(`\n[${bar}] ${((processed / totalLeads) * 100).toFixed(0)}%`);

  // Estimated time remaining
  if (processed > 0) {
    const batchesRemaining = Math.ceil(remaining / BATCH_SIZE);
    const minPerBatch = 3 * (BATCH_SIZE / 10); // ~3 min per 10 profiles
    console.log(`\nEstimate: ${batchesRemaining} batches remaining (~${minPerBatch} min each)`);
    console.log(`Total PB execution time needed: ~${(batchesRemaining * minPerBatch).toFixed(0)} min`);
  }

  // List found emails
  if (withEmail > 0) {
    console.log(`\nFound emails (sample):`);
    const entries = Object.entries(progress.foundEmails);
    entries.slice(0, 10).forEach(([url, email]) => {
      const slug = url.split('/in/')[1] || url;
      console.log(`  ${email.padEnd(35)} ${slug}`);
    });
    if (entries.length > 10) {
      console.log(`  ... and ${entries.length - 10} more`);
    }
  }
}

function cmdMerge() {
  const leads = loadLeads();
  const progress = loadProgress();
  const foundEmails = progress.foundEmails;

  let merged = 0;
  const enriched = leads.map(l => {
    const url = l.linkedinProfileUrl || l.profileUrl || '';
    if (foundEmails[url]) {
      merged++;
      return { ...l, email: foundEmails[url], emailSource: 'phantombuster-dropcontact' };
    }
    return l;
  });

  // Save enriched file
  fs.writeFileSync(ENRICHED_FILE, JSON.stringify(enriched, null, 2));

  // Also create categorized lists
  const withEmail = enriched.filter(l => l.email);
  const withoutEmail = enriched.filter(l => !l.email);

  const listsDir = path.join(ROOT, 'leads-lists');
  if (!fs.existsSync(listsDir)) fs.mkdirSync(listsDir, { recursive: true });

  fs.writeFileSync(
    path.join(listsDir, 'leads-with-email.json'),
    JSON.stringify(withEmail, null, 2)
  );
  fs.writeFileSync(
    path.join(listsDir, 'leads-without-email.json'),
    JSON.stringify(withoutEmail, null, 2)
  );

  console.log('Merge Results');
  console.log('=============');
  console.log(`Total leads:       ${leads.length}`);
  console.log(`Emails merged:     ${merged}`);
  console.log(`With email:        ${withEmail.length}`);
  console.log(`Without email:     ${withoutEmail.length}`);
  console.log(`\nFiles created:`);
  console.log(`  ${ENRICHED_FILE}`);
  console.log(`  ${path.join(listsDir, 'leads-with-email.json')}`);
  console.log(`  ${path.join(listsDir, 'leads-without-email.json')}`);
  console.log(`\nLeads WITH email are ready for cold email prospecting.`);
  console.log(`Leads WITHOUT email should go to LinkedIn outreach channel.`);
}

// --- CLI ---

async function main() {
  const cmd = process.argv[2];

  switch (cmd) {
    case 'prepare':
      await cmdPrepare();
      break;
    case 'launch':
      await cmdLaunch();
      break;
    case 'status':
      await cmdStatus();
      break;
    case 'collect':
      await cmdCollect();
      break;
    case 'run':
      await cmdRun();
      break;
    case 'progress':
      cmdProgress();
      break;
    case 'merge':
      cmdMerge();
      break;
    case 'export-csv':
      await cmdExportCsv();
      break;
    default:
      console.log(`
pb-email-finder.js — PhantomBuster Professional Email Finder Automation

Commands:
  prepare      Create Google Sheet with leads for PB (needs Google Auth)
  export-csv   Export leads as CSV (manual upload fallback)
  launch       Launch phantom for next batch
  status       Check phantom status + enrichment progress
  collect      Parse output log, save found emails
  run          Full cycle: launch → wait → collect
  progress     Show enrichment progress dashboard
  merge        Merge found emails into leads JSON, create categorized lists

Workflow:
  1. prepare    → Creates public Google Sheet with all leads
  2. Configure phantom in PB dashboard to use that Sheet URL
  3. run        → Launches, waits, collects results
  4. Repeat step 3 until all processed (or PB time runs out)
  5. merge      → Creates enriched leads + separate lists (with/without email)

Environment:
  PB_EMAIL_FINDER_ID    Phantom ID (default: ${PHANTOM_ID})
  PHANTOMBUSTER_API_KEY  API key
  PB_BATCH_SIZE         Rows per launch (default: ${BATCH_SIZE})
      `);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

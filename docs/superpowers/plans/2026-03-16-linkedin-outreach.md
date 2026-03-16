# LinkedIn Outreach System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a LinkedIn outreach system that takes enriched leads, generates personalized connection notes + follow-ups via the Personalization Engine (Plan 1), manages a LinkedIn Queue Google Sheet, launches PhantomBuster outreach via API, tracks status per lead, and routes leads across channels (LinkedIn / Email / Dual) based on ICP score and available contact data.

**Architecture:** Three Node.js CLI scripts coordinated via Google Sheets and Discord:
- `scripts/linkedin-outreach.js` — LinkedIn queue manager (prepare batches, launch PB, collect results, track status)
- `scripts/outreach-router.js` — Routing logic (assign channel per lead based on spec section 10.1 decision tree)
- Google Sheet "LinkedIn Queue" — Created via `scripts/sheets-manager.js` with CSV fallback
- Discord daily summary at 18:00 CLT

**Tech Stack:** Node.js, PhantomBuster API, Google Sheets API (via sheets-manager.js), Discord webhook, dotenv, https module (no extra deps).

**Spec:** `docs/superpowers/specs/2026-03-16-linkedin-automation-prospecting-design.md` sections 6.1-6.6, 10.1-10.4

**Depends on:**
- Personalization Engine (Plan 1) built: `scripts/personalize-messages.js` functional
- Enriched leads classified into lists: `leads-lists/list-a-verified-email.json`, `leads-lists/list-b-guessed-email.json`, `leads-lists/list-c-linkedin-only.json`
- `pb-leads-enriched.json` (869 leads with email enrichment fields)

---

## Prerequisites (Manual Steps)

Before executing this plan, the following must be done manually:

1. **Create PhantomBuster "LinkedIn Outreach" phantom** in the PB dashboard at phantombuster.com
   - Choose the "LinkedIn Outreach" template
   - Configure with your LinkedIn session cookie
   - Copy the Phantom ID and set it as `PB_OUTREACH_PHANTOM_ID` in `.env`

2. **Add env vars to `.env`:**
   ```bash
   PB_OUTREACH_PHANTOM_ID=<from step 1>
   LINKEDIN_QUEUE_SHEET_ID=<will be created by Task 2 or set after CSV fallback>
   ```

3. **Google Auth** may be broken — Tasks 1-2 attempt Sheets creation but fall back to CSV if auth fails.

---

## File Structure

```
scripts/
  linkedin-outreach.js       # LinkedIn queue manager — CLI + programmatic API
  outreach-router.js          # Routing logic — assigns channel per lead

data/
  outreach-state.json         # Master state file: every lead's outreach status
  linkedin-queue.csv          # CSV fallback if Google Sheets auth is broken
  suppression-list.json       # Leads that opted out (never contact again)

leads-lists/
  list-a-verified-email.json  # [EXISTS] Email verified leads
  list-b-guessed-email.json   # [EXISTS] Email guessed leads
  list-c-linkedin-only.json   # [EXISTS] LinkedIn-only leads

templates/outreach/           # [EXISTS from Plan 1] Message templates
```

---

## Chunk 1: Data Layer + LinkedIn Queue Setup

### Task 1: Create data directory and initial state files

**Files:**
- Create: `data/outreach-state.json`
- Create: `data/suppression-list.json`

- [ ] **Step 1: Create the data directory and initial outreach state file**

```json
{
  "version": 1,
  "created": "2026-03-16T00:00:00.000Z",
  "updated": "2026-03-16T00:00:00.000Z",
  "leads": {}
}
```

The `leads` object will be keyed by `leadId` (LinkedIn profile URL) and each entry will hold:

```json
{
  "leadId": "https://linkedin.com/in/...",
  "fullName": "...",
  "company": "...",
  "icpScore": 0,
  "tier": "HOT|WARM|NURTURE",
  "emailList": "A|B|C|NONE",
  "channel": "DUAL|EMAIL|LINKEDIN|NONE",
  "sequence": "linkedin-first-email-fallback|linkedin-or-email|linkedin-only|email-5-touch|linkedin-3-step",
  "status": "QUEUED|ROUTED|ACTIVE|REPLIED|MEETING_BOOKED|EXHAUSTED|NURTURE_POOL",
  "linkedin": {
    "connectionStatus": "NOT_SENT|PENDING|ACCEPTED|DECLINED",
    "connectionDate": null,
    "msg1Sent": false,
    "msg1Date": null,
    "msg2Sent": false,
    "msg2Date": null,
    "replied": false,
    "replyDate": null
  },
  "email": {
    "currentTouch": 0,
    "lastSentDate": null,
    "opened": false,
    "replied": false,
    "bounced": false
  },
  "routedAt": null,
  "notes": ""
}
```

- [ ] **Step 2: Create the suppression list file**

Write to `data/suppression-list.json`:

```json
{
  "version": 1,
  "created": "2026-03-16T00:00:00.000Z",
  "leads": [],
  "note": "Leads in this list must NEVER be contacted again. Permanent. Ley 21.719 compliance."
}
```

- [ ] **Step 3: Test files are valid JSON**

```bash
node -e "require('./data/outreach-state.json'); require('./data/suppression-list.json'); console.log('OK: data files valid');"
```

- [ ] **Step 4: Commit**

```bash
git add data/outreach-state.json data/suppression-list.json
git commit -m "feat: create outreach state and suppression list data files"
```

---

### Task 2: Create LinkedIn Queue Google Sheet (with CSV fallback)

**Files:**
- Read: `scripts/sheets-manager.js`
- Create: `scripts/create-linkedin-queue.js`

- [ ] **Step 1: Write the queue creation script**

This script attempts to create the Google Sheet via `sheets-manager.js`. If Google auth fails, it creates a CSV file as fallback.

Write to `scripts/create-linkedin-queue.js`:

```javascript
#!/usr/bin/env node
/**
 * create-linkedin-queue.js — Create the LinkedIn Queue tracking sheet
 *
 * Tries Google Sheets first. Falls back to CSV if auth is broken.
 *
 * Usage:
 *   node scripts/create-linkedin-queue.js
 *   node scripts/create-linkedin-queue.js --csv-only
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const CSV_PATH = path.join(DATA_DIR, 'linkedin-queue.csv');

// Column headers per spec section 6.5
const HEADERS = [
  'leadId',
  'linkedinUrl',
  'fullName',
  'company',
  'icpScore',
  'tier',
  'connectionStatus',
  'connectionDate',
  'connectionNote',
  'msg1Sent',
  'msg1Date',
  'msg1Text',
  'msg2Sent',
  'msg2Date',
  'msg2Text',
  'replied',
  'replyDate',
  'replyChannel',
  'meetingBooked',
  'notes'
];

function createCSVFallback() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CSV_PATH, HEADERS.join(',') + '\n', 'utf-8');
  console.log(`CSV fallback created: ${CSV_PATH}`);
  console.log(`Columns (${HEADERS.length}): ${HEADERS.join(', ')}`);
  return CSV_PATH;
}

async function createGoogleSheet() {
  const title = 'Sisteco - LinkedIn Outreach Queue';

  try {
    // Test auth first
    console.log('Testing Google Sheets auth...');
    execSync('node scripts/sheets-manager.js auth-check', {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 15000
    });

    // Create the sheet
    console.log(`Creating Google Sheet: "${title}"...`);
    const createOutput = execSync(
      `node scripts/sheets-manager.js create --title "${title}" --sheets "Queue,Metrics,Log"`,
      { cwd: ROOT, stdio: 'pipe', timeout: 30000 }
    ).toString();

    const result = JSON.parse(createOutput);
    const sheetId = result.spreadsheetId;

    console.log(`Sheet created: ${result.url}`);

    // Add headers to Queue sheet
    const headerData = JSON.stringify([HEADERS]);
    execSync(
      `node scripts/sheets-manager.js update --id ${sheetId} --range "Queue!A1:T1" --data '${headerData}'`,
      { cwd: ROOT, stdio: 'pipe', timeout: 15000 }
    );

    // Add Metrics headers
    const metricsHeaders = JSON.stringify([['Date', 'ConnectionsSent', 'Accepted', 'AcceptanceRate', 'Msg1Sent', 'Msg2Sent', 'Replies', 'ReplyRate', 'MeetingsBooked']]);
    execSync(
      `node scripts/sheets-manager.js update --id ${sheetId} --range "Metrics!A1:I1" --data '${metricsHeaders}'`,
      { cwd: ROOT, stdio: 'pipe', timeout: 15000 }
    );

    // Add Log headers
    const logHeaders = JSON.stringify([['Timestamp', 'Action', 'LeadId', 'Details']]);
    execSync(
      `node scripts/sheets-manager.js update --id ${sheetId} --range "Log!A1:D1" --data '${logHeaders}'`,
      { cwd: ROOT, stdio: 'pipe', timeout: 15000 }
    );

    console.log(`\nHeaders set. Sheet ID: ${sheetId}`);
    console.log(`\nAdd to .env:\n  LINKEDIN_QUEUE_SHEET_ID=${sheetId}`);

    // Also create CSV as backup
    createCSVFallback();
    console.log('\nCSV backup also created.');

    return { sheetId, url: result.url };

  } catch (err) {
    console.error(`Google Sheets failed: ${err.message}`);
    console.error('Falling back to CSV...\n');
    createCSVFallback();
    return { csv: CSV_PATH };
  }
}

async function main() {
  const csvOnly = process.argv.includes('--csv-only');

  if (csvOnly) {
    createCSVFallback();
  } else {
    await createGoogleSheet();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script**

```bash
node scripts/create-linkedin-queue.js
```

If Google auth works: a new Sheet is created with Queue/Metrics/Log tabs. Copy the Sheet ID to `.env`.
If Google auth fails: `data/linkedin-queue.csv` is created as fallback.

- [ ] **Step 3: Commit**

```bash
git add scripts/create-linkedin-queue.js data/linkedin-queue.csv
git commit -m "feat: create LinkedIn Queue sheet with CSV fallback"
```

---

### Task 3: Populate LinkedIn Queue with eligible leads

**Files:**
- Create: `scripts/populate-linkedin-queue.js`

This script reads leads from all three lists, filters those with LinkedIn URLs, runs them through the ICP engine for scoring (or reads existing scores), and prepares queue entries.

- [ ] **Step 1: Write the populate script**

Write to `scripts/populate-linkedin-queue.js`:

```javascript
#!/usr/bin/env node
/**
 * populate-linkedin-queue.js — Populate LinkedIn Queue with leads from lists A/B/C
 *
 * Reads enriched lead lists, filters for LinkedIn URLs, assigns ICP tier,
 * and writes to data/linkedin-queue.csv (and optionally Google Sheet).
 *
 * Usage:
 *   node scripts/populate-linkedin-queue.js
 *   node scripts/populate-linkedin-queue.js --dry-run
 *   node scripts/populate-linkedin-queue.js --limit 50
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ROOT = path.join(__dirname, '..');
const LISTS_DIR = path.join(ROOT, 'leads-lists');
const DATA_DIR = path.join(ROOT, 'data');
const CSV_PATH = path.join(DATA_DIR, 'linkedin-queue.csv');

// --- ICP Scoring (inline lightweight version) ---
// Priority industries for Sisteco
const PRIORITY_INDUSTRIES = [
  'information technology', 'financial services', 'insurance',
  'management consulting', 'mining', 'telecommunications',
  'banking', 'fintech', 'software', 'it services'
];

// Priority roles (decision makers)
const DECISION_MAKER_PATTERNS = [
  /\b(ceo|cto|cfo|coo|cro|cmo)\b/i,
  /\b(fundador|founder|co-founder|owner)\b/i,
  /\b(gerente general|general manager|president)\b/i,
  /\b(director|vp|vice president)\b/i,
  /\b(gerente|manager|head of|jefe)\b/i,
  /\b(chief|officer)\b/i
];

const SALES_PATTERNS = [
  /\b(ventas|sales|comercial|revenue|business development|growth)\b/i,
  /\b(pipeline|prospecting|leads)\b/i
];

function quickScore(lead) {
  let score = 30; // base

  // Industry match (+20)
  const ind = (lead.industry || '').toLowerCase();
  if (PRIORITY_INDUSTRIES.some(p => ind.includes(p))) score += 20;

  // Decision maker role (+25)
  const headline = lead.headline || lead.jobTitle || '';
  if (DECISION_MAKER_PATTERNS.some(p => p.test(headline))) score += 25;

  // Sales-related role (+10)
  if (SALES_PATTERNS.some(p => p.test(headline))) score += 10;

  // Has company (+5)
  if (lead.company) score += 5;

  // Chile location (+5)
  if ((lead.location || '').toLowerCase().includes('chile')) score += 5;

  // Has additional info / bio (+5)
  if (lead.additionalInfo && lead.additionalInfo.length > 50) score += 5;

  return Math.min(score, 100);
}

function getTier(score) {
  if (score >= 80) return 'HOT';
  if (score >= 50) return 'WARM';
  if (score >= 30) return 'NURTURE';
  return 'SKIP';
}

function escapeCSV(val) {
  const str = String(val || '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;

  // Load all lists
  const listA = JSON.parse(fs.readFileSync(path.join(LISTS_DIR, 'list-a-verified-email.json'), 'utf-8'));
  const listB = JSON.parse(fs.readFileSync(path.join(LISTS_DIR, 'list-b-guessed-email.json'), 'utf-8'));
  const listC = JSON.parse(fs.readFileSync(path.join(LISTS_DIR, 'list-c-linkedin-only.json'), 'utf-8'));

  console.log(`Loaded: List A (${listA.length}), List B (${listB.length}), List C (${listC.length})`);

  // Tag with email list
  listA.forEach(l => l._emailList = 'A');
  listB.forEach(l => l._emailList = 'B');
  listC.forEach(l => l._emailList = 'C');

  // Combine all leads that have LinkedIn URLs
  const allLeads = [...listC, ...listA, ...listB]; // List C first (LinkedIn-only priority)
  const withLinkedIn = allLeads.filter(l =>
    l.linkedinProfileUrl || l.profileUrl
  );

  console.log(`Leads with LinkedIn URL: ${withLinkedIn.length}`);

  // Deduplicate by LinkedIn URL
  const seen = new Set();
  const unique = withLinkedIn.filter(l => {
    const url = l.linkedinProfileUrl || l.profileUrl;
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  console.log(`After dedup: ${unique.length}`);

  // Score and sort
  const scored = unique.map(l => {
    const score = quickScore(l);
    return { ...l, _icpScore: score, _tier: getTier(score) };
  });

  // Filter out SKIP
  const eligible = scored
    .filter(l => l._tier !== 'SKIP')
    .sort((a, b) => b._icpScore - a._icpScore)
    .slice(0, limit);

  console.log(`Eligible (score >= 30): ${eligible.length}`);

  // Stats
  const tiers = { HOT: 0, WARM: 0, NURTURE: 0 };
  eligible.forEach(l => tiers[l._tier]++);
  console.log(`  HOT: ${tiers.HOT}, WARM: ${tiers.WARM}, NURTURE: ${tiers.NURTURE}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Would write to CSV. Top 10:');
    eligible.slice(0, 10).forEach((l, i) => {
      console.log(`  ${i + 1}. ${l.fullName} @ ${l.company} — Score: ${l._icpScore} (${l._tier}) — List: ${l._emailList}`);
    });
    return;
  }

  // Write CSV
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const HEADERS = [
    'leadId', 'linkedinUrl', 'fullName', 'company', 'icpScore', 'tier',
    'connectionStatus', 'connectionDate', 'connectionNote',
    'msg1Sent', 'msg1Date', 'msg1Text',
    'msg2Sent', 'msg2Date', 'msg2Text',
    'replied', 'replyDate', 'replyChannel', 'meetingBooked', 'notes'
  ];

  const rows = eligible.map(l => {
    const linkedinUrl = l.linkedinProfileUrl || l.profileUrl || '';
    return [
      linkedinUrl,                    // leadId
      linkedinUrl,                    // linkedinUrl
      l.fullName || '',               // fullName
      l.company || '',                // company
      l._icpScore,                    // icpScore
      l._tier,                        // tier
      'NOT_SENT',                     // connectionStatus
      '',                             // connectionDate
      '',                             // connectionNote (to be filled by personalize-messages.js)
      'false',                        // msg1Sent
      '',                             // msg1Date
      '',                             // msg1Text
      'false',                        // msg2Sent
      '',                             // msg2Date
      '',                             // msg2Text
      'false',                        // replied
      '',                             // replyDate
      '',                             // replyChannel
      'false',                        // meetingBooked
      `List:${l._emailList}`          // notes
    ].map(escapeCSV);
  });

  const csv = [HEADERS.join(','), ...rows.map(r => r.join(','))].join('\n') + '\n';
  fs.writeFileSync(CSV_PATH, csv, 'utf-8');

  console.log(`\nWrote ${eligible.length} leads to: ${CSV_PATH}`);
  console.log('Next: run `node scripts/linkedin-outreach.js prepare` to generate personalized messages');
}

main();
```

- [ ] **Step 2: Run the populate script (dry run first)**

```bash
node scripts/populate-linkedin-queue.js --dry-run
```

Expected: Shows top 10 leads sorted by ICP score, tier distribution.

- [ ] **Step 3: Run for real**

```bash
node scripts/populate-linkedin-queue.js
```

Expected: Creates `data/linkedin-queue.csv` with all eligible leads.

- [ ] **Step 4: Commit**

```bash
git add scripts/populate-linkedin-queue.js data/linkedin-queue.csv
git commit -m "feat: populate LinkedIn queue from enriched lead lists"
```

---

## Chunk 2: Outreach Router

### Task 4: Build outreach-router.js

**Files:**
- Create: `scripts/outreach-router.js`

This implements the routing decision tree from spec section 10.1. Reads enriched leads, assigns channel (DUAL, EMAIL, LINKEDIN, NONE), and writes the master `data/outreach-state.json`.

- [ ] **Step 1: Write the outreach router**

Write to `scripts/outreach-router.js`:

```javascript
#!/usr/bin/env node
/**
 * outreach-router.js — Route leads to channels based on ICP score + available data
 *
 * Implements the routing decision tree from spec section 10.1:
 *   - DUAL: LinkedIn + Email (HOT leads with both)
 *   - EMAIL: Email-only (leads without LinkedIn)
 *   - LINKEDIN: LinkedIn-only (leads without email OR NURTURE with both)
 *   - NONE: ICP too low or no contact method
 *
 * Commands:
 *   route     — Route all enriched leads and write to data/outreach-state.json
 *   status    — Show current routing status
 *   summary   — Show channel distribution summary
 *
 * Usage:
 *   node scripts/outreach-router.js route
 *   node scripts/outreach-router.js route --dry-run
 *   node scripts/outreach-router.js status
 *   node scripts/outreach-router.js summary
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ROOT = path.join(__dirname, '..');
const LISTS_DIR = path.join(ROOT, 'leads-lists');
const DATA_DIR = path.join(ROOT, 'data');
const STATE_PATH = path.join(DATA_DIR, 'outreach-state.json');
const SUPPRESSION_PATH = path.join(DATA_DIR, 'suppression-list.json');
const ENRICHED_PATH = path.join(ROOT, 'pb-leads-enriched.json');

// --- ICP Scoring (same lightweight version as populate script) ---

const PRIORITY_INDUSTRIES = [
  'information technology', 'financial services', 'insurance',
  'management consulting', 'mining', 'telecommunications',
  'banking', 'fintech', 'software', 'it services'
];

const DECISION_MAKER_PATTERNS = [
  /\b(ceo|cto|cfo|coo|cro|cmo)\b/i,
  /\b(fundador|founder|co-founder|owner)\b/i,
  /\b(gerente general|general manager|president)\b/i,
  /\b(director|vp|vice president)\b/i,
  /\b(gerente|manager|head of|jefe)\b/i,
  /\b(chief|officer)\b/i
];

const SALES_PATTERNS = [
  /\b(ventas|sales|comercial|revenue|business development|growth)\b/i
];

function quickScore(lead) {
  let score = 30;
  const ind = (lead.industry || '').toLowerCase();
  if (PRIORITY_INDUSTRIES.some(p => ind.includes(p))) score += 20;
  const headline = lead.headline || lead.jobTitle || '';
  if (DECISION_MAKER_PATTERNS.some(p => p.test(headline))) score += 25;
  if (SALES_PATTERNS.some(p => p.test(headline))) score += 10;
  if (lead.company) score += 5;
  if ((lead.location || '').toLowerCase().includes('chile')) score += 5;
  if (lead.additionalInfo && lead.additionalInfo.length > 50) score += 5;
  return Math.min(score, 100);
}

function getTier(score) {
  if (score >= 80) return 'HOT';
  if (score >= 50) return 'WARM';
  if (score >= 30) return 'NURTURE';
  return 'SKIP';
}

// --- Routing Decision Tree (Spec 10.1) ---

function routeLead(lead) {
  const hasEmail = lead._emailList === 'A' || lead._emailList === 'B';
  const hasLinkedIn = !!(lead.linkedinProfileUrl || lead.profileUrl);
  const score = lead._icpScore || 0;
  const tier = getTier(score);

  if (tier === 'SKIP') return { channel: 'NONE', sequence: null, reason: 'ICP too low (<30)' };

  if (hasEmail && hasLinkedIn) {
    if (tier === 'HOT') return { channel: 'DUAL', sequence: 'linkedin-first-email-fallback' };
    if (tier === 'WARM') return { channel: 'BEST', sequence: 'linkedin-or-email' };
    if (tier === 'NURTURE') return { channel: 'LINKEDIN', sequence: 'linkedin-only' };
  }

  if (hasEmail && !hasLinkedIn) return { channel: 'EMAIL', sequence: 'email-5-touch' };
  if (!hasEmail && hasLinkedIn) return { channel: 'LINKEDIN', sequence: 'linkedin-3-step' };

  return { channel: 'NONE', sequence: null, reason: 'No contact method' };
}

// --- Load and tag leads ---

function loadAllLeads() {
  const listAPath = path.join(LISTS_DIR, 'list-a-verified-email.json');
  const listBPath = path.join(LISTS_DIR, 'list-b-guessed-email.json');
  const listCPath = path.join(LISTS_DIR, 'list-c-linkedin-only.json');

  const listA = fs.existsSync(listAPath) ? JSON.parse(fs.readFileSync(listAPath, 'utf-8')) : [];
  const listB = fs.existsSync(listBPath) ? JSON.parse(fs.readFileSync(listBPath, 'utf-8')) : [];
  const listC = fs.existsSync(listCPath) ? JSON.parse(fs.readFileSync(listCPath, 'utf-8')) : [];

  listA.forEach(l => l._emailList = 'A');
  listB.forEach(l => l._emailList = 'B');
  listC.forEach(l => l._emailList = 'C');

  // Deduplicate by LinkedIn URL
  const all = [...listA, ...listB, ...listC];
  const seen = new Set();
  return all.filter(l => {
    const url = l.linkedinProfileUrl || l.profileUrl || l.fullName;
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

// --- Commands ---

function cmdRoute(dryRun) {
  const leads = loadAllLeads();
  console.log(`Loaded ${leads.length} unique leads from lists A/B/C`);

  // Load suppression list
  const suppression = fs.existsSync(SUPPRESSION_PATH)
    ? JSON.parse(fs.readFileSync(SUPPRESSION_PATH, 'utf-8')).leads || []
    : [];
  const suppressedSet = new Set(suppression.map(l => l.leadId || l));

  // Score and route
  const state = {
    version: 1,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    leads: {}
  };

  const stats = { DUAL: 0, BEST: 0, EMAIL: 0, LINKEDIN: 0, NONE: 0, SUPPRESSED: 0 };
  const tierStats = { HOT: 0, WARM: 0, NURTURE: 0, SKIP: 0 };

  for (const lead of leads) {
    const leadId = lead.linkedinProfileUrl || lead.profileUrl || '';

    // Check suppression
    if (suppressedSet.has(leadId)) {
      stats.SUPPRESSED++;
      continue;
    }

    const score = quickScore(lead);
    const tier = getTier(score);
    const routing = routeLead({ ...lead, _icpScore: score });

    tierStats[tier]++;
    stats[routing.channel]++;

    state.leads[leadId] = {
      leadId,
      fullName: lead.fullName || '',
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      company: lead.company || '',
      industry: lead.industry || '',
      headline: lead.headline || lead.jobTitle || '',
      location: lead.location || '',
      icpScore: score,
      tier,
      emailList: lead._emailList || 'NONE',
      email: lead.email || lead.emailBestGuess || '',
      channel: routing.channel,
      sequence: routing.sequence,
      reason: routing.reason || '',
      status: routing.channel === 'NONE' ? 'SKIPPED' : 'ROUTED',
      linkedin: {
        url: leadId,
        connectionStatus: 'NOT_SENT',
        connectionDate: null,
        msg1Sent: false,
        msg1Date: null,
        msg2Sent: false,
        msg2Date: null,
        replied: false,
        replyDate: null
      },
      email_state: {
        currentTouch: 0,
        lastSentDate: null,
        opened: false,
        replied: false,
        bounced: false
      },
      routedAt: new Date().toISOString(),
      notes: ''
    };
  }

  console.log('\n--- Routing Summary ---');
  console.log(`  DUAL (LinkedIn + Email):  ${stats.DUAL}`);
  console.log(`  BEST (best channel):      ${stats.BEST}`);
  console.log(`  EMAIL only:               ${stats.EMAIL}`);
  console.log(`  LINKEDIN only:            ${stats.LINKEDIN}`);
  console.log(`  NONE (skipped):           ${stats.NONE}`);
  console.log(`  SUPPRESSED:               ${stats.SUPPRESSED}`);
  console.log(`  Total routed:             ${stats.DUAL + stats.BEST + stats.EMAIL + stats.LINKEDIN}`);
  console.log('\n--- Tier Distribution ---');
  console.log(`  HOT (>= 80):    ${tierStats.HOT}`);
  console.log(`  WARM (50-79):   ${tierStats.WARM}`);
  console.log(`  NURTURE (30-49): ${tierStats.NURTURE}`);
  console.log(`  SKIP (< 30):    ${tierStats.SKIP}`);

  if (!dryRun) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
    console.log(`\nState written to: ${STATE_PATH}`);
    console.log(`Total leads in state: ${Object.keys(state.leads).length}`);
  } else {
    console.log('\n[DRY RUN] No files written.');
  }
}

function cmdStatus() {
  if (!fs.existsSync(STATE_PATH)) {
    console.log('No outreach state found. Run: node scripts/outreach-router.js route');
    return;
  }

  const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  const leads = Object.values(state.leads);

  const statusCounts = {};
  leads.forEach(l => {
    statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
  });

  console.log(`Outreach State (updated: ${state.updated})`);
  console.log(`Total leads: ${leads.length}\n`);
  console.log('By status:');
  Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });
}

function cmdSummary() {
  if (!fs.existsSync(STATE_PATH)) {
    console.log('No outreach state found. Run: node scripts/outreach-router.js route');
    return;
  }

  const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  const leads = Object.values(state.leads);

  const channels = {};
  const tiers = {};
  const sequences = {};
  let linkedinEligible = 0;
  let emailEligible = 0;

  leads.forEach(l => {
    channels[l.channel] = (channels[l.channel] || 0) + 1;
    tiers[l.tier] = (tiers[l.tier] || 0) + 1;
    if (l.sequence) sequences[l.sequence] = (sequences[l.sequence] || 0) + 1;
    if (['DUAL', 'BEST', 'LINKEDIN'].includes(l.channel)) linkedinEligible++;
    if (['DUAL', 'BEST', 'EMAIL'].includes(l.channel)) emailEligible++;
  });

  console.log(`\n=== Outreach Routing Summary ===\n`);
  console.log(`Total leads: ${leads.length}`);
  console.log(`LinkedIn eligible: ${linkedinEligible}`);
  console.log(`Email eligible: ${emailEligible}\n`);

  console.log('By channel:');
  Object.entries(channels).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    const pct = ((v / leads.length) * 100).toFixed(1);
    console.log(`  ${k.padEnd(12)} ${String(v).padStart(4)} (${pct}%)`);
  });

  console.log('\nBy tier:');
  Object.entries(tiers).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k.padEnd(12)} ${String(v).padStart(4)}`);
  });

  console.log('\nBy sequence:');
  Object.entries(sequences).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k.padEnd(35)} ${String(v).padStart(4)}`);
  });

  // LinkedIn queue estimate
  const perDay = 17; // avg of 15-20
  const workDaysPerWeek = 5;
  const weeksToComplete = Math.ceil(linkedinEligible / (perDay * workDaysPerWeek));
  console.log(`\nLinkedIn estimate: ${linkedinEligible} leads / ${perDay} per day = ~${weeksToComplete} weeks`);
}

// --- CLI ---

const cmd = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

switch (cmd) {
  case 'route':
    cmdRoute(dryRun);
    break;
  case 'status':
    cmdStatus();
    break;
  case 'summary':
    cmdSummary();
    break;
  default:
    console.log(`
outreach-router.js — Route leads to outreach channels

Commands:
  route [--dry-run]    Route all leads based on ICP score + available data
  status               Show current routing status
  summary              Show channel distribution summary

Channels:
  DUAL      LinkedIn + Email coordinated (HOT leads with both)
  BEST      Best available channel (WARM leads with both)
  EMAIL     Email-only (no LinkedIn URL)
  LINKEDIN  LinkedIn-only (no email or NURTURE tier)
  NONE      Skipped (ICP < 30 or no contact method)
    `);
}
```

- [ ] **Step 2: Test routing (dry run)**

```bash
node scripts/outreach-router.js route --dry-run
```

Expected: Shows routing summary with channel and tier distribution across all 869 leads.

- [ ] **Step 3: Run routing for real**

```bash
node scripts/outreach-router.js route
```

Expected: Creates `data/outreach-state.json` with all leads routed.

- [ ] **Step 4: View summary**

```bash
node scripts/outreach-router.js summary
```

Expected: Shows channel breakdown, tier breakdown, and LinkedIn queue time estimate.

- [ ] **Step 5: Commit**

```bash
git add scripts/outreach-router.js data/outreach-state.json
git commit -m "feat: build outreach router with channel routing decision tree"
```

---

## Chunk 3: LinkedIn Outreach Manager

### Task 5: Build linkedin-outreach.js — Core LinkedIn queue manager

**Files:**
- Create: `scripts/linkedin-outreach.js`

This is the main LinkedIn outreach script. It prepares batches with personalized messages, launches PhantomBuster API calls, collects results, and tracks status.

- [ ] **Step 1: Write the LinkedIn outreach manager**

Write to `scripts/linkedin-outreach.js`:

```javascript
#!/usr/bin/env node
/**
 * linkedin-outreach.js — LinkedIn outreach queue manager via PhantomBuster API
 *
 * Manages the full LinkedIn outreach lifecycle:
 *   1. Prepare: Generate personalized messages for queued leads
 *   2. Send-batch: Launch PB outreach phantom for a batch of leads
 *   3. Collect: Fetch results from PB and update status
 *   4. Status: Show current queue status
 *   5. Progress: Show overall progress metrics
 *
 * Rate limits: 15-20 connections/day, Mon-Fri only, 9:00-18:00 CLT
 *
 * Commands:
 *   node scripts/linkedin-outreach.js prepare [--limit N]
 *   node scripts/linkedin-outreach.js send-batch [--count N] [--dry-run]
 *   node scripts/linkedin-outreach.js collect
 *   node scripts/linkedin-outreach.js status
 *   node scripts/linkedin-outreach.js progress
 *
 * Environment:
 *   PHANTOMBUSTER_API_KEY         — PB API key (required)
 *   PB_OUTREACH_PHANTOM_ID        — PB LinkedIn Outreach phantom ID (required for send)
 *   DISCORD_WEBHOOK_URL            — For notifications (optional)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const STATE_PATH = path.join(DATA_DIR, 'outreach-state.json');
const CSV_PATH = path.join(DATA_DIR, 'linkedin-queue.csv');
const SUPPRESSION_PATH = path.join(DATA_DIR, 'suppression-list.json');
const BATCH_LOG_PATH = path.join(DATA_DIR, 'linkedin-batch-log.json');

const PB_API_KEY = process.env.PHANTOMBUSTER_API_KEY || '';
const PB_OUTREACH_ID = process.env.PB_OUTREACH_PHANTOM_ID || '';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL || '';

const MAX_CONNECTIONS_PER_DAY = 18; // safe middle of 15-20 range
const MAX_PENDING_INVITATIONS = 700;

// --- Helpers ---

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function pbApiRequest(method, endpoint, body) {
  const bodyStr = body ? JSON.stringify(body) : '';
  return httpRequest({
    hostname: 'api.phantombuster.com',
    path: `/api/v2${endpoint}`,
    method,
    headers: {
      'X-Phantombuster-Key': PB_API_KEY,
      'Content-Type': 'application/json',
      ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
    }
  }, bodyStr || null);
}

function sendDiscord(message) {
  if (!DISCORD_WEBHOOK) return Promise.resolve();
  const body = JSON.stringify({ content: message });
  const url = new URL(DISCORD_WEBHOOK);
  return httpRequest({
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body).catch(() => {}); // silent fail for Discord
}

function loadState() {
  if (!fs.existsSync(STATE_PATH)) {
    console.error('No outreach state found. Run: node scripts/outreach-router.js route');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
}

function saveState(state) {
  state.updated = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function loadBatchLog() {
  if (!fs.existsSync(BATCH_LOG_PATH)) return { batches: [] };
  return JSON.parse(fs.readFileSync(BATCH_LOG_PATH, 'utf-8'));
}

function saveBatchLog(log) {
  fs.writeFileSync(BATCH_LOG_PATH, JSON.stringify(log, null, 2));
}

function isWorkday() {
  const now = new Date();
  // CLT is UTC-3 (or UTC-4 depending on DST, but close enough)
  const cltHour = (now.getUTCHours() - 3 + 24) % 24;
  const day = now.getUTCDay();
  return day >= 1 && day <= 5 && cltHour >= 9 && cltHour < 18;
}

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function getSentToday() {
  const log = loadBatchLog();
  const today = todayKey();
  return log.batches
    .filter(b => b.date === today)
    .reduce((sum, b) => sum + (b.count || 0), 0);
}

// --- Personalization Integration ---

let personalizeModule = null;
function getPersonalizer() {
  if (!personalizeModule) {
    try {
      personalizeModule = require(path.join(__dirname, 'personalize-messages.js'));
    } catch (err) {
      console.error('Warning: Could not load personalize-messages.js:', err.message);
      console.error('Messages will use fallback templates.');
      personalizeModule = null;
    }
  }
  return personalizeModule;
}

async function generateConnectionNote(lead) {
  const engine = getPersonalizer();
  if (engine && engine.personalize) {
    const result = await engine.personalize(lead, 'connection_note');
    return result.text;
  }
  // Fallback: simple template
  const firstName = lead.firstName || lead.fullName?.split(' ')[0] || '';
  return `Hola ${firstName}, vi tu trabajo en ${lead.company || 'tu empresa'}. En Sisteco automatizamos ventas B2B para que tu equipo solo cierre. Hablamos?`;
}

async function generateFollowUp1(lead) {
  const engine = getPersonalizer();
  if (engine && engine.personalize) {
    const result = await engine.personalize(lead, 'follow_up_1');
    return result.text;
  }
  const firstName = lead.firstName || '';
  return `${firstName}, gracias por conectar. Dato rapido: 78% de clientes compran del primer vendedor en responder. En Sisteco ayudamos a que tu equipo sea siempre el primero. Te cuento mas en 15 min?`;
}

async function generateFollowUp2(lead) {
  const engine = getPersonalizer();
  if (engine && engine.personalize) {
    const result = await engine.personalize(lead, 'follow_up_2');
    return result.text;
  }
  const firstName = lead.firstName || '';
  return `${firstName}, se que el tiempo es limitado. Tu equipo de ventas pierde tiempo prospectando en vez de cerrando? 15 minutos para mostrarte como lo resolvemos. Si no, quedo como contacto.`;
}

// --- Commands ---

async function cmdPrepare(limit) {
  const state = loadState();
  const leads = Object.values(state.leads);

  // Get leads routed to LinkedIn that haven't been prepared yet
  const linkedinLeads = leads
    .filter(l =>
      ['DUAL', 'BEST', 'LINKEDIN'].includes(l.channel) &&
      l.linkedin.connectionStatus === 'NOT_SENT' &&
      l.status === 'ROUTED'
    )
    .sort((a, b) => b.icpScore - a.icpScore)
    .slice(0, limit);

  if (linkedinLeads.length === 0) {
    console.log('No leads to prepare. All LinkedIn-eligible leads have been prepared or sent.');
    return;
  }

  console.log(`Preparing ${linkedinLeads.length} leads with personalized messages...\n`);

  for (let i = 0; i < linkedinLeads.length; i++) {
    const lead = linkedinLeads[i];
    process.stdout.write(`[${i + 1}/${linkedinLeads.length}] ${lead.fullName} @ ${lead.company}... `);

    try {
      const note = await generateConnectionNote(lead);
      const msg1 = await generateFollowUp1(lead);
      const msg2 = await generateFollowUp2(lead);

      // Truncate connection note to 300 chars
      const truncatedNote = note.length > 300 ? note.slice(0, 297) + '...' : note;

      state.leads[lead.leadId]._preparedMessages = {
        connectionNote: truncatedNote,
        followUp1: msg1,
        followUp2: msg2,
        preparedAt: new Date().toISOString()
      };
      state.leads[lead.leadId].status = 'PREPARED';

      console.log(`OK (${truncatedNote.length} chars)`);
    } catch (err) {
      console.log(`FAIL: ${err.message}`);
    }

    // Rate limit between API calls
    if (i < linkedinLeads.length - 1) {
      await new Promise(r => setTimeout(r, 600));
    }
  }

  saveState(state);
  console.log(`\nPrepared ${linkedinLeads.length} leads. Run 'send-batch' to send connections.`);
}

async function cmdSendBatch(count, dryRun) {
  if (!PB_OUTREACH_ID && !dryRun) {
    console.error('ERROR: PB_OUTREACH_PHANTOM_ID not set in .env');
    console.error('Create the LinkedIn Outreach phantom in PB dashboard first.');
    process.exit(1);
  }

  if (!PB_API_KEY && !dryRun) {
    console.error('ERROR: PHANTOMBUSTER_API_KEY not set in .env');
    process.exit(1);
  }

  // Check workday
  if (!isWorkday() && !dryRun) {
    console.log('WARNING: Outside work hours (Mon-Fri 9:00-18:00 CLT). LinkedIn outreach should simulate human behavior.');
    console.log('Use --dry-run to preview, or wait for work hours.');
    return;
  }

  // Check daily limit
  const sentToday = getSentToday();
  const remaining = MAX_CONNECTIONS_PER_DAY - sentToday;
  if (remaining <= 0 && !dryRun) {
    console.log(`Daily limit reached: ${sentToday}/${MAX_CONNECTIONS_PER_DAY} connections sent today.`);
    console.log('Try again tomorrow.');
    return;
  }

  const batchSize = Math.min(count || remaining, remaining);

  const state = loadState();
  const leads = Object.values(state.leads);

  // Get prepared leads sorted by ICP score
  const prepared = leads
    .filter(l => l.status === 'PREPARED' && l._preparedMessages?.connectionNote)
    .sort((a, b) => b.icpScore - a.icpScore)
    .slice(0, batchSize);

  if (prepared.length === 0) {
    console.log('No prepared leads to send. Run: node scripts/linkedin-outreach.js prepare');
    return;
  }

  console.log(`\nSending batch: ${prepared.length} connections (${sentToday} sent today, limit: ${MAX_CONNECTIONS_PER_DAY})`);
  if (dryRun) console.log('[DRY RUN] — no actual API calls\n');

  const batchResult = {
    date: todayKey(),
    timestamp: new Date().toISOString(),
    count: 0,
    leads: []
  };

  for (let i = 0; i < prepared.length; i++) {
    const lead = prepared[i];
    const note = lead._preparedMessages.connectionNote;

    console.log(`  [${i + 1}/${prepared.length}] ${lead.fullName} — ${note.slice(0, 60)}...`);

    if (!dryRun) {
      try {
        // PB API: Launch phantom with lead data
        // The PB LinkedIn Outreach phantom expects a CSV/JSON input with LinkedIn URLs + messages
        // We prepare the arguments for the phantom launch
        const pbArgs = {
          id: PB_OUTREACH_ID,
          argument: JSON.stringify({
            spreadsheetUrl: lead.linkedin.url,
            message: note,
            onlyConnect: true // connection request mode
          })
        };

        const result = await pbApiRequest('POST', '/agents/launch', {
          id: PB_OUTREACH_ID,
          argument: JSON.stringify({
            numberOfProfilesPerLaunch: 1,
            spreadsheetUrl: lead.linkedin.url,
            message: note
          })
        });

        if (result.error) {
          console.log(`    ERROR: ${result.error}`);
          continue;
        }

        // Update state
        state.leads[lead.leadId].linkedin.connectionStatus = 'PENDING';
        state.leads[lead.leadId].linkedin.connectionDate = new Date().toISOString();
        state.leads[lead.leadId].status = 'ACTIVE';
        batchResult.count++;
        batchResult.leads.push(lead.leadId);

        // Rate limit: wait 30-90 seconds between sends (simulate human)
        const waitMs = 30000 + Math.random() * 60000;
        console.log(`    Sent. Waiting ${Math.round(waitMs / 1000)}s...`);
        await new Promise(r => setTimeout(r, waitMs));

      } catch (err) {
        console.log(`    ERROR: ${err.message}`);
      }
    } else {
      // Dry run: just log
      state.leads[lead.leadId].linkedin.connectionStatus = 'PENDING';
      state.leads[lead.leadId].status = 'ACTIVE';
      batchResult.count++;
      batchResult.leads.push(lead.leadId);
    }
  }

  // Save state and batch log
  saveState(state);
  const log = loadBatchLog();
  log.batches.push(batchResult);
  saveBatchLog(log);

  const msg = `LinkedIn Outreach: ${batchResult.count} connections sent (${sentToday + batchResult.count}/${MAX_CONNECTIONS_PER_DAY} today)`;
  console.log(`\n${msg}`);

  if (!dryRun && batchResult.count > 0) {
    await sendDiscord(`**LinkedIn Outreach Batch**\n${msg}\nLeads: ${batchResult.leads.length}`);
  }
}

async function cmdCollect() {
  if (!PB_API_KEY) {
    console.error('ERROR: PHANTOMBUSTER_API_KEY not set.');
    process.exit(1);
  }

  console.log('Collecting results from PhantomBuster...\n');

  // Fetch phantom output
  try {
    const agentData = await pbApiRequest('GET', `/agents/fetch-output?id=${PB_OUTREACH_ID}`);

    if (agentData.error) {
      console.error('PB API error:', agentData.error);
      return;
    }

    const output = agentData.output ? JSON.parse(agentData.output) : [];
    console.log(`PB returned ${Array.isArray(output) ? output.length : 0} results`);

    // Update state based on PB results
    const state = loadState();
    let accepted = 0;
    let declined = 0;

    if (Array.isArray(output)) {
      for (const result of output) {
        const url = result.profileUrl || result.linkedinUrl || '';
        if (state.leads[url]) {
          if (result.connectionAccepted || result.connected) {
            state.leads[url].linkedin.connectionStatus = 'ACCEPTED';
            accepted++;
          } else if (result.connectionDeclined || result.error) {
            state.leads[url].linkedin.connectionStatus = 'DECLINED';
            declined++;
          }
        }
      }
    }

    saveState(state);
    console.log(`Updated: ${accepted} accepted, ${declined} declined`);

    if (accepted > 0 || declined > 0) {
      await sendDiscord(`**LinkedIn Collect**\nAccepted: ${accepted}, Declined: ${declined}`);
    }
  } catch (err) {
    console.error('Error collecting:', err.message);
  }
}

function cmdStatus() {
  const state = loadState();
  const leads = Object.values(state.leads);

  // Filter LinkedIn-eligible leads
  const linkedin = leads.filter(l => ['DUAL', 'BEST', 'LINKEDIN'].includes(l.channel));

  const byConnStatus = {};
  linkedin.forEach(l => {
    const s = l.linkedin?.connectionStatus || 'UNKNOWN';
    byConnStatus[s] = (byConnStatus[s] || 0) + 1;
  });

  const byStatus = {};
  linkedin.forEach(l => {
    byStatus[l.status] = (byStatus[l.status] || 0) + 1;
  });

  console.log(`\n=== LinkedIn Outreach Status ===\n`);
  console.log(`Total LinkedIn-eligible: ${linkedin.length}`);
  console.log(`Sent today: ${getSentToday()}/${MAX_CONNECTIONS_PER_DAY}\n`);

  console.log('By connection status:');
  Object.entries(byConnStatus).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k.padEnd(15)} ${v}`);
  });

  console.log('\nBy pipeline status:');
  Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k.padEnd(15)} ${v}`);
  });

  // Follow-up eligibility
  const needMsg1 = linkedin.filter(l =>
    l.linkedin?.connectionStatus === 'ACCEPTED' &&
    !l.linkedin?.msg1Sent &&
    l.linkedin?.connectionDate &&
    (Date.now() - new Date(l.linkedin.connectionDate).getTime()) >= 3 * 86400000
  );

  const needMsg2 = linkedin.filter(l =>
    l.linkedin?.msg1Sent &&
    !l.linkedin?.msg2Sent &&
    l.linkedin?.msg1Date &&
    (Date.now() - new Date(l.linkedin.msg1Date).getTime()) >= 4 * 86400000
  );

  console.log(`\nFollow-up eligible:`);
  console.log(`  Ready for Message 1 (3+ days post-accept): ${needMsg1.length}`);
  console.log(`  Ready for Message 2 (4+ days post-msg1):   ${needMsg2.length}`);
}

function cmdProgress() {
  const state = loadState();
  const leads = Object.values(state.leads);
  const linkedin = leads.filter(l => ['DUAL', 'BEST', 'LINKEDIN'].includes(l.channel));

  const total = linkedin.length;
  const sent = linkedin.filter(l => l.linkedin?.connectionStatus !== 'NOT_SENT').length;
  const accepted = linkedin.filter(l => l.linkedin?.connectionStatus === 'ACCEPTED').length;
  const declined = linkedin.filter(l => l.linkedin?.connectionStatus === 'DECLINED').length;
  const pending = linkedin.filter(l => l.linkedin?.connectionStatus === 'PENDING').length;
  const msg1 = linkedin.filter(l => l.linkedin?.msg1Sent).length;
  const msg2 = linkedin.filter(l => l.linkedin?.msg2Sent).length;
  const replied = linkedin.filter(l => l.linkedin?.replied).length;

  const acceptanceRate = sent > 0 ? ((accepted / sent) * 100).toFixed(1) : '0.0';
  const replyRate = accepted > 0 ? ((replied / accepted) * 100).toFixed(1) : '0.0';

  console.log(`\n=== LinkedIn Outreach Progress ===\n`);
  console.log(`Total eligible:    ${total}`);
  console.log(`Connections sent:  ${sent} (${((sent / total) * 100).toFixed(1)}%)`);
  console.log(`  Pending:         ${pending}`);
  console.log(`  Accepted:        ${accepted} (${acceptanceRate}% acceptance)`);
  console.log(`  Declined:        ${declined}`);
  console.log(`Message 1 sent:    ${msg1}`);
  console.log(`Message 2 sent:    ${msg2}`);
  console.log(`Replied:           ${replied} (${replyRate}% response rate)`);
  console.log(`\nTarget: >30% acceptance, >15% response`);

  // Safety check
  if (sent >= 20 && parseFloat(acceptanceRate) < 20) {
    console.log('\nWARNING: Acceptance rate below 20%. Consider:');
    console.log('  - Reviewing connection note quality');
    console.log('  - Checking if you are targeting the right leads');
    console.log('  - Pausing for 48h (spec safety protocol)');
  }

  // Batch history
  const log = loadBatchLog();
  if (log.batches.length > 0) {
    console.log(`\nBatch history (last 7 days):`);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    log.batches
      .filter(b => b.date >= weekAgo)
      .forEach(b => {
        console.log(`  ${b.date}: ${b.count} connections`);
      });
  }
}

// --- CLI ---

async function main() {
  const cmd = process.argv[2];
  const args = process.argv.slice(3);

  function getFlag(name) {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 ? args[idx + 1] : null;
  }
  const dryRun = args.includes('--dry-run');

  switch (cmd) {
    case 'prepare':
      await cmdPrepare(parseInt(getFlag('limit') || '50'));
      break;
    case 'send-batch':
      await cmdSendBatch(parseInt(getFlag('count') || '0'), dryRun);
      break;
    case 'collect':
      await cmdCollect();
      break;
    case 'status':
      cmdStatus();
      break;
    case 'progress':
      cmdProgress();
      break;
    default:
      console.log(`
linkedin-outreach.js — LinkedIn outreach queue manager

Commands:
  prepare [--limit N]           Generate personalized messages for N leads
  send-batch [--count N] [--dry-run]  Send connection requests (max N, respects daily limit)
  collect                       Fetch results from PhantomBuster + update status
  status                        Show current queue status
  progress                      Show overall progress metrics

Rate Limits:
  - Max ${MAX_CONNECTIONS_PER_DAY} connections/day
  - Mon-Fri only, 9:00-18:00 CLT
  - 30-90s delay between sends
  - Cooldown if acceptance < 20%

Environment:
  PHANTOMBUSTER_API_KEY          Required
  PB_OUTREACH_PHANTOM_ID         Required for send-batch
  DISCORD_WEBHOOK_URL            Optional (notifications)
      `);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Test status command (no API needed)**

```bash
node scripts/linkedin-outreach.js status
```

Expected: Shows LinkedIn queue status from outreach-state.json (requires Task 4 to be complete).

- [ ] **Step 3: Test prepare with dry limit**

```bash
node scripts/linkedin-outreach.js prepare --limit 3
```

Expected: Generates personalized messages for 3 top-scored leads using the Personalization Engine. Updates their status from ROUTED to PREPARED.

- [ ] **Step 4: Test send-batch dry run**

```bash
node scripts/linkedin-outreach.js send-batch --count 3 --dry-run
```

Expected: Shows which leads would be sent, without making API calls. Verifies daily limit logic.

- [ ] **Step 5: Test progress command**

```bash
node scripts/linkedin-outreach.js progress
```

Expected: Shows overall progress metrics.

- [ ] **Step 6: Commit**

```bash
git add scripts/linkedin-outreach.js
git commit -m "feat: build LinkedIn outreach manager with PB integration and rate limits"
```

---

## Chunk 4: Discord Daily Summary

### Task 6: Build Discord daily summary notification

**Files:**
- Create: `scripts/outreach-daily-summary.js`

This script generates and sends the daily outreach summary to Discord at 18:00 CLT. Can be triggered by n8n cron or run manually.

- [ ] **Step 1: Write the daily summary script**

Write to `scripts/outreach-daily-summary.js`:

```javascript
#!/usr/bin/env node
/**
 * outreach-daily-summary.js — Send daily outreach summary to Discord
 *
 * Generates a summary of LinkedIn (and future email) outreach activity
 * and sends it to the configured Discord webhook.
 *
 * Designed to run daily at 18:00 CLT via n8n cron or manually.
 *
 * Usage:
 *   node scripts/outreach-daily-summary.js
 *   node scripts/outreach-daily-summary.js --preview  (prints to console only, no Discord send)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const STATE_PATH = path.join(DATA_DIR, 'outreach-state.json');
const BATCH_LOG_PATH = path.join(DATA_DIR, 'linkedin-batch-log.json');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL || '';

function sendDiscord(content) {
  if (!DISCORD_WEBHOOK) {
    console.error('DISCORD_WEBHOOK_URL not set. Cannot send.');
    return Promise.resolve();
  }
  const body = JSON.stringify({ content });
  const url = new URL(DISCORD_WEBHOOK);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function buildSummary() {
  if (!fs.existsSync(STATE_PATH)) {
    return 'No outreach state found. Run outreach-router.js route first.';
  }

  const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  const leads = Object.values(state.leads);
  const today = new Date().toISOString().split('T')[0];

  // LinkedIn stats
  const linkedinLeads = leads.filter(l => ['DUAL', 'BEST', 'LINKEDIN'].includes(l.channel));
  const totalLinkedIn = linkedinLeads.length;
  const sent = linkedinLeads.filter(l => l.linkedin?.connectionStatus !== 'NOT_SENT').length;
  const accepted = linkedinLeads.filter(l => l.linkedin?.connectionStatus === 'ACCEPTED').length;
  const pending = linkedinLeads.filter(l => l.linkedin?.connectionStatus === 'PENDING').length;
  const declined = linkedinLeads.filter(l => l.linkedin?.connectionStatus === 'DECLINED').length;
  const msg1Sent = linkedinLeads.filter(l => l.linkedin?.msg1Sent).length;
  const msg2Sent = linkedinLeads.filter(l => l.linkedin?.msg2Sent).length;
  const replied = linkedinLeads.filter(l => l.linkedin?.replied).length;

  // Today's batch activity
  const batchLog = fs.existsSync(BATCH_LOG_PATH)
    ? JSON.parse(fs.readFileSync(BATCH_LOG_PATH, 'utf-8'))
    : { batches: [] };
  const todayBatches = batchLog.batches.filter(b => b.date === today);
  const sentToday = todayBatches.reduce((sum, b) => sum + (b.count || 0), 0);

  // Accepted today (rough: those with connectionDate today)
  const acceptedToday = linkedinLeads.filter(l =>
    l.linkedin?.connectionStatus === 'ACCEPTED' &&
    l.linkedin?.connectionDate?.startsWith(today)
  ).length;

  const acceptanceRate = sent > 0 ? ((accepted / sent) * 100).toFixed(1) : '0.0';
  const replyRate = accepted > 0 ? ((replied / accepted) * 100).toFixed(1) : '0.0';

  // Pipeline stats
  const active = leads.filter(l => l.status === 'ACTIVE').length;
  const meetings = leads.filter(l => l.status === 'MEETING_BOOKED').length;

  // Build message
  const lines = [
    `**Outreach Daily — ${today}**`,
    '',
    '**LinkedIn:**',
    `  Connections sent today: ${sentToday}`,
    `  Accepted today: ${acceptedToday}`,
    `  Total sent: ${sent}/${totalLinkedIn}`,
    `  Pending: ${pending}`,
    `  Accepted: ${accepted} (${acceptanceRate}%)`,
    `  Declined: ${declined}`,
    `  Messages sent: ${msg1Sent} msg1, ${msg2Sent} msg2`,
    `  Replies: ${replied} (${replyRate}% response rate)`,
    '',
    '**Pipeline:**',
    `  Active sequences: ${active}`,
    `  Meetings booked: ${meetings}`,
  ];

  // Alerts
  const alerts = [];
  if (sent >= 20 && parseFloat(acceptanceRate) < 30) {
    alerts.push(`LinkedIn acceptance rate: ${acceptanceRate}% (target: >30%)`);
  }
  if (sent >= 20 && parseFloat(acceptanceRate) < 20) {
    alerts.push('CRITICAL: Acceptance below 20% — consider pausing 48h');
  }
  if (parseFloat(acceptanceRate) >= 30) {
    alerts.push(`LinkedIn acceptance rate: ${acceptanceRate}% OK`);
  }

  if (alerts.length > 0) {
    lines.push('', '**Alerts:**');
    alerts.forEach(a => lines.push(`  ${a}`));
  }

  return lines.join('\n');
}

async function main() {
  const preview = process.argv.includes('--preview');
  const summary = buildSummary();

  console.log(summary);

  if (!preview) {
    if (!DISCORD_WEBHOOK) {
      console.error('\nDISCORD_WEBHOOK_URL not set. Summary printed to console only.');
      return;
    }
    await sendDiscord(summary);
    console.log('\nSent to Discord.');
  } else {
    console.log('\n[PREVIEW] Not sent to Discord.');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Test preview mode**

```bash
node scripts/outreach-daily-summary.js --preview
```

Expected: Prints formatted daily summary to console without sending to Discord.

- [ ] **Step 3: Test Discord send (if webhook configured)**

```bash
node scripts/outreach-daily-summary.js
```

Expected: Summary appears in Discord channel.

- [ ] **Step 4: Commit**

```bash
git add scripts/outreach-daily-summary.js
git commit -m "feat: add Discord daily outreach summary notification"
```

---

## Chunk 5: Integration Testing + CSV Export

### Task 7: End-to-end integration test

**Files:**
- Read: all scripts created in Tasks 1-6

- [ ] **Step 1: Run the full pipeline in sequence**

```bash
# 1. Route all leads
node scripts/outreach-router.js route

# 2. View summary
node scripts/outreach-router.js summary

# 3. Prepare first 5 leads with personalized messages
node scripts/linkedin-outreach.js prepare --limit 5

# 4. Check status
node scripts/linkedin-outreach.js status

# 5. Dry-run send batch
node scripts/linkedin-outreach.js send-batch --count 3 --dry-run

# 6. View progress
node scripts/linkedin-outreach.js progress

# 7. Preview daily summary
node scripts/outreach-daily-summary.js --preview
```

- [ ] **Step 2: Verify outreach-state.json has correct structure**

```bash
node -e "
  const s = require('./data/outreach-state.json');
  const leads = Object.values(s.leads);
  const sample = leads.find(l => l.status === 'PREPARED');
  if (sample) {
    console.log('Sample prepared lead:');
    console.log('  Name:', sample.fullName);
    console.log('  Channel:', sample.channel);
    console.log('  Tier:', sample.tier);
    console.log('  Connection note:', sample._preparedMessages?.connectionNote?.slice(0, 80) + '...');
    console.log('  Note length:', sample._preparedMessages?.connectionNote?.length, 'chars');
  } else {
    console.log('No prepared leads found. Run prepare command first.');
  }
"
```

- [ ] **Step 3: Verify CSV queue matches state**

```bash
node -e "
  const fs = require('fs');
  const csv = fs.readFileSync('data/linkedin-queue.csv', 'utf-8');
  const lines = csv.trim().split('\n');
  console.log('CSV rows (including header):', lines.length);
  console.log('Header:', lines[0]);
  if (lines.length > 1) console.log('First data row:', lines[1].slice(0, 120) + '...');
"
```

- [ ] **Step 4: Commit final state**

```bash
git add data/
git commit -m "test: verify end-to-end LinkedIn outreach pipeline"
```

---

### Task 8: Update .env.example with new variables

**Files:**
- Edit: `.env.example`

- [ ] **Step 1: Add outreach-related env vars to .env.example**

Add these lines under the `LEAD GENERATION / ENRICHMENT` section:

```bash
# ── OUTREACH / LINKEDIN ───────────────────────────────────────────────────────
PB_OUTREACH_PHANTOM_ID=
PB_EMAIL_FINDER_ID=
LINKEDIN_QUEUE_SHEET_ID=
OUTREACH_STATE_SHEET_ID=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add outreach env vars to .env.example"
```

---

## Execution Notes

**Dependencies:** This plan requires NO new npm packages. Uses Node.js built-in `https` and `fs` modules for API calls and file I/O. The `googleapis` package (already installed for `sheets-manager.js`) is used indirectly.

**API Keys Required:**
- `PHANTOMBUSTER_API_KEY` — Already in .env (required for send-batch and collect)
- `PB_OUTREACH_PHANTOM_ID` — Must be created manually in PB dashboard first
- `DISCORD_WEBHOOK_URL` — Already in .env (optional, for notifications)
- `GEMINI_API_KEY` / `CLAUDE_API_KEY` — Already in .env (used by personalize-messages.js from Plan 1)

**Google Sheets Auth:** May be broken. All scripts have CSV fallback. The `data/linkedin-queue.csv` file serves as the fallback tracking mechanism. Google Sheet creation is best-effort.

**Rate Limits Enforced:**
- 15-20 connections/day (configurable, default 18)
- Mon-Fri only, 9:00-18:00 CLT
- 30-90s random delay between sends
- Cooldown warning if acceptance rate drops below 20%
- Max 700 pending invitations (LinkedIn limit)

**Data Flow:**
```
leads-lists/*.json
    |
    v
outreach-router.js route  -->  data/outreach-state.json (master state)
    |
    v
populate-linkedin-queue.js -->  data/linkedin-queue.csv (queue snapshot)
    |
    v
linkedin-outreach.js prepare  -->  adds _preparedMessages to state
    |
    v
linkedin-outreach.js send-batch  -->  PB API + updates state to ACTIVE
    |
    v
linkedin-outreach.js collect  -->  PB results + updates ACCEPTED/DECLINED
    |
    v
outreach-daily-summary.js  -->  Discord notification at 18:00 CLT
```

**Next plan:** After this plan is executed, proceed with Plan 3 (Cold Email System via Instantly.ai) which will use the same `data/outreach-state.json` for cross-channel coordination.

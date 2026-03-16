#!/usr/bin/env node
/**
 * populate-linkedin-queue.js -- Populate LinkedIn Queue with leads from lists A/B/C
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
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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
      console.log(`  ${i + 1}. ${l.fullName} @ ${l.company} -- Score: ${l._icpScore} (${l._tier}) -- List: ${l._emailList}`);
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

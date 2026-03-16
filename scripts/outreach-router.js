#!/usr/bin/env node
/**
 * outreach-router.js -- Route leads to channels based on ICP score + available data
 *
 * Implements the routing decision tree from spec section 10.1:
 *   - DUAL: LinkedIn + Email (HOT leads with both)
 *   - EMAIL: Email-only (leads without LinkedIn)
 *   - LINKEDIN: LinkedIn-only (leads without email OR NURTURE with both)
 *   - NONE: ICP too low or no contact method
 *
 * Commands:
 *   route     -- Route all enriched leads and write to data/outreach-state.json
 *   status    -- Show current routing status
 *   summary   -- Show channel distribution summary
 *
 * Usage:
 *   node scripts/outreach-router.js route
 *   node scripts/outreach-router.js route --dry-run
 *   node scripts/outreach-router.js status
 *   node scripts/outreach-router.js summary
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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
outreach-router.js -- Route leads to outreach channels

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

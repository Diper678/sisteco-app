#!/usr/bin/env node
/**
 * enqueue-hot-leads.js
 *
 * Reads enriched leads from pb-leads-enriched.json, filters HOT candidates
 * (SMTP-verified email + score threshold), and enqueues them to the n8n
 * hot-lead-enqueue webhook to start 5-touch email sequences.
 *
 * Usage:
 *   node scripts/enqueue-hot-leads.js [--dry-run] [--min-score 70] [--limit 20]
 *
 * Options:
 *   --dry-run     Preview leads that would be enqueued without sending
 *   --min-score N Minimum ICP score threshold (default: 70)
 *   --limit N     Max leads to enqueue per run (default: 20)
 *   --smtp-only   Only enqueue leads with SMTP-verified email (default: true)
 *   --all-emails  Also include pattern-guessed emails (use with caution)
 *
 * Requires:
 *   N8N_ENQUEUE_WEBHOOK in .env (webhook URL from hot-lead-enqueue workflow)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const includeAllEmails = args.includes('--all-emails');
const minScoreArg = args.find(a => a.startsWith('--min-score'));
const limitArg = args.find(a => a.startsWith('--limit'));
const MIN_SCORE = minScoreArg ? parseInt(minScoreArg.split('=')[1] || args[args.indexOf(minScoreArg) + 1]) : 70;
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1] || args[args.indexOf(limitArg) + 1]) : 20;

// ── Load .env ───────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const envPath = resolve(ROOT, '.env');
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // .env not found — rely on process.env
  }
}
loadEnv();

const WEBHOOK_URL = process.env.N8N_ENQUEUE_WEBHOOK;
const DELAY_MS = 500; // 500ms between requests to avoid rate limits

// ── Load lead data ──────────────────────────────────────────────────────────
function loadLeads() {
  const sources = [
    resolve(ROOT, 'pb-leads-enriched.json'),
    resolve(ROOT, 'leads-lists', 'list-a-verified-email.json'),
  ];

  const allLeads = [];
  for (const src of sources) {
    try {
      const raw = JSON.parse(readFileSync(src, 'utf-8'));
      const arr = Array.isArray(raw) ? raw : (raw.leads || raw.data || []);
      console.log(`Loaded ${arr.length} leads from ${src.split(/[/\\]/).pop()}`);
      allLeads.push(...arr);
    } catch (e) {
      console.warn(`Could not load ${src}: ${e.message}`);
    }
  }

  // Deduplicate by email
  const seen = new Set();
  return allLeads.filter(lead => {
    const email = lead.lead_email || lead.email || lead.emailBestGuess;
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}

// ── Score + Filter ──────────────────────────────────────────────────────────
function scoreAndFilter(leads) {
  return leads
    .map(lead => {
      const email = lead.lead_email || lead.email || lead.emailBestGuess || '';
      const confidence = lead.emailConfidence || lead.email_confidence || '';
      const smtpVerified = confidence === 'smtp-verified' || lead._smtpCode === 250;
      const score = parseInt(lead.score || lead.icpScore || 0);

      // Quick ICP pre-score if no Gemini score available
      let quickScore = score;
      if (!score) {
        const loc = (lead.location || '').toLowerCase();
        const headline = (lead.headline || lead.jobTitle || '').toLowerCase();
        const industry = (lead.industry || '').toLowerCase();
        if (loc.includes('chile') || loc.includes('santiago')) quickScore += 30;
        if (/ceo|gerente general|fundador|president/.test(headline)) quickScore += 40;
        else if (/gerente|director|manager|head/.test(headline)) quickScore += 25;
        if (/tech|software|it |consulting|mineria|financ|telecom/.test(industry)) quickScore += 20;
      }

      return {
        // Normalized fields for n8n webhook
        lead_email: email,
        first_name: lead.firstName || lead.first_name || (lead.fullName || '').split(' ')[0] || '',
        last_name: lead.lastName || lead.last_name || (lead.fullName || '').split(' ').slice(1).join(' ') || '',
        company: lead.company || lead.companyName || '',
        job_title: lead.jobTitle || lead.job_title || lead.headline || '',
        industry: lead.industry || '',
        additional_info: lead.additionalInfo || lead.additional_info || lead.summary || '',
        linkedin_url: lead.linkedinProfileUrl || lead.profileUrl || lead.linkedin_url || '',
        score: quickScore || score,
        // Meta for filtering
        _smtp_verified: smtpVerified,
        _email: email,
        _score: quickScore || score,
      };
    })
    .filter(lead => {
      if (!lead._email || !lead._email.includes('@')) return false;
      if (!lead.first_name) return false;
      if (!lead.company) return false;
      if (!includeAllEmails && !lead._smtp_verified) return false;
      if (lead._score < MIN_SCORE) return false;
      return true;
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, LIMIT);
}

// ── Enqueue ─────────────────────────────────────────────────────────────────
async function enqueue(lead) {
  const body = { ...lead };
  delete body._smtp_verified;
  delete body._email;
  delete body._score;

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 Sisteco — Enqueue HOT Leads for Email Sequences\n');
  console.log(`Config: min-score=${MIN_SCORE} | limit=${LIMIT} | smtp-only=${!includeAllEmails} | dry-run=${isDryRun}\n`);

  if (!isDryRun && !WEBHOOK_URL) {
    console.error('❌ N8N_ENQUEUE_WEBHOOK not set in .env');
    console.error('   Add: N8N_ENQUEUE_WEBHOOK=https://primary-production-24f87.up.railway.app/webhook/hot-lead-enqueue');
    process.exit(1);
  }

  const allLeads = loadLeads();
  const filtered = scoreAndFilter(allLeads);

  if (filtered.length === 0) {
    console.log(`⚠️  No leads match criteria (min-score ${MIN_SCORE}, smtp-only: ${!includeAllEmails})`);
    console.log('   Try: --min-score 50 or --all-emails to include pattern-guessed emails');
    return;
  }

  console.log(`Found ${allLeads.length} total leads → ${filtered.length} qualify for sequences\n`);
  console.log('Preview (top candidates):');
  console.log('─'.repeat(80));
  filtered.slice(0, 5).forEach((l, i) => {
    console.log(`${i + 1}. ${l.first_name} ${l.last_name} @ ${l.company}`);
    console.log(`   ${l.job_title} | ${l.industry}`);
    console.log(`   Email: ${l._email} | Score: ${l._score}`);
    console.log('');
  });
  if (filtered.length > 5) console.log(`   ... and ${filtered.length - 5} more\n`);

  if (isDryRun) {
    console.log('✅ Dry run complete. Remove --dry-run to actually enqueue.');
    return;
  }

  console.log(`\nEnqueuing ${filtered.length} leads...\n`);
  let success = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < filtered.length; i++) {
    const lead = filtered[i];
    try {
      const result = await enqueue(lead);
      console.log(`✅ [${i + 1}/${filtered.length}] ${lead.first_name} @ ${lead.company} → queued (${result.queued ? 'OK' : 'check webhook'})`);
      success++;
    } catch (e) {
      console.error(`❌ [${i + 1}/${filtered.length}] ${lead.first_name} @ ${lead.company} → ${e.message}`);
      failed++;
      errors.push({ lead: `${lead.first_name} @ ${lead.company}`, error: e.message });
    }

    if (i < filtered.length - 1) await sleep(DELAY_MS);
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`\nDone! ${success} enqueued, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed leads:');
    errors.forEach(e => console.log(`  - ${e.lead}: ${e.error}`));
  }
  console.log('\nNext: Run "Sisteco — Hot Lead Email Sequence" workflow in n8n to start sending.');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});

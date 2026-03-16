#!/usr/bin/env node
/**
 * enrich-emails.js — Alternative email enrichment without PhantomBuster
 *
 * Multi-layer approach:
 *   Layer 1: Resolve company domain from LinkedIn company page (via Firecrawl or pattern)
 *   Layer 2: Generate email pattern candidates (nombre@empresa.cl, etc.)
 *   Layer 3: Verify domain has MX records (via Google DNS API)
 *   Layer 4: Score candidates by common Chilean B2B email patterns
 *
 * Usage:
 *   node scripts/enrich-emails.js resolve-domains       # Find company domains
 *   node scripts/enrich-emails.js generate-candidates    # Generate email patterns
 *   node scripts/enrich-emails.js verify-mx              # Check which domains accept email
 *   node scripts/enrich-emails.js enrich                 # Full pipeline (all steps)
 *   node scripts/enrich-emails.js progress               # Show progress
 *   node scripts/enrich-emails.js export                 # Export enriched leads
 *
 * Environment:
 *   HUNTER_API_KEY     Optional — Hunter.io for domain search (25 free/month)
 *   FIRECRAWL_API_KEY  Optional — Firecrawl for scraping company websites
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ROOT = path.join(__dirname, '..');
const LEADS_FILE = path.join(ROOT, 'pb-leads-latest.json');
const DOMAINS_FILE = path.join(ROOT, 'pb-company-domains.json');
const ENRICHED_FILE = path.join(ROOT, 'pb-leads-enriched.json');
const PB_PROGRESS_FILE = path.join(ROOT, 'pb-email-progress.json');

const HUNTER_KEY = process.env.HUNTER_API_KEY || '';
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY || '';

// --- Utility ---

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

function httpsPost(hostname, apiPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname, path: apiPath, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalize(str) {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.-]/g, '');
}

// --- Layer 1: Domain Resolution ---

// Common Chilean company domain patterns
const DOMAIN_SUFFIXES = ['.cl', '.com', '.io', '.co', '.net', '.org'];

function guessDomainsFromCompany(companyName, companySlug) {
  const candidates = [];
  const clean = normalize(companyName);
  const slug = normalize(companySlug);

  // From slug (most reliable since it's from LinkedIn)
  if (slug) {
    for (const suffix of DOMAIN_SUFFIXES) {
      candidates.push(slug.replace(/-/g, '') + suffix);
      if (slug.includes('-')) {
        candidates.push(slug + suffix);
      }
    }
  }

  // From company name
  if (clean && clean !== slug) {
    // Remove common suffixes
    const stripped = clean
      .replace(/\b(spa|sac|sa|ltda|eirl|chile|consultores?|group|holding)\b/g, '')
      .replace(/\s+/g, '')
      .trim();

    if (stripped) {
      for (const suffix of DOMAIN_SUFFIXES) {
        candidates.push(stripped + suffix);
      }
    }
  }

  // Deduplicate
  return [...new Set(candidates)].slice(0, 8);
}

async function checkMX(domain) {
  try {
    const result = await httpsGet(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`);
    const mx = (result.Answer || []).map(a => a.data).filter(Boolean);
    return { domain, hasMX: mx.length > 0, mx };
  } catch {
    return { domain, hasMX: false, mx: [] };
  }
}

async function resolveCompanyDomain(companyName, companySlug) {
  const candidates = guessDomainsFromCompany(companyName, companySlug);

  for (const domain of candidates) {
    const mx = await checkMX(domain);
    if (mx.hasMX) {
      return { domain, method: 'mx-check', mx: mx.mx[0] || '' };
    }
    await sleep(100); // Don't hammer DNS
  }

  return null;
}

async function cmdResolveDomains() {
  const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));

  // Load existing domains
  let domains = {};
  if (fs.existsSync(DOMAINS_FILE)) {
    domains = JSON.parse(fs.readFileSync(DOMAINS_FILE, 'utf-8'));
  }

  // Get unique companies
  const companies = new Map();
  leads.forEach(l => {
    if (l.company && !domains[l.company]) {
      companies.set(l.company, l.companySlug || '');
    }
  });

  console.log(`Resolving domains for ${companies.size} companies...`);
  console.log(`Already resolved: ${Object.keys(domains).length}\n`);

  let resolved = 0, failed = 0;
  let i = 0;

  for (const [company, slug] of companies) {
    i++;
    process.stdout.write(`  [${i}/${companies.size}] ${company.slice(0, 30).padEnd(30)} `);

    const result = await resolveCompanyDomain(company, slug);

    if (result) {
      domains[company] = result;
      resolved++;
      console.log(`→ ${result.domain}`);
    } else {
      domains[company] = { domain: null, method: 'not-found' };
      failed++;
      console.log(`→ not found`);
    }

    // Save periodically
    if (i % 20 === 0) {
      fs.writeFileSync(DOMAINS_FILE, JSON.stringify(domains, null, 2));
    }

    await sleep(200); // Rate limit
  }

  fs.writeFileSync(DOMAINS_FILE, JSON.stringify(domains, null, 2));

  console.log(`\nResults:`);
  console.log(`  Resolved: ${resolved}`);
  console.log(`  Not found: ${failed}`);
  console.log(`  Total in database: ${Object.values(domains).filter(d => d.domain).length}`);
  console.log(`\nSaved to: ${DOMAINS_FILE}`);
}

// --- Layer 2: Email Pattern Generation ---

// Common email patterns in Chilean B2B companies
const EMAIL_PATTERNS = [
  // Most common first
  (f, l, d) => `${f}.${l}@${d}`,           // nombre.apellido@empresa.cl
  (f, l, d) => `${f}@${d}`,                // nombre@empresa.cl
  (f, l, d) => `${f[0]}${l}@${d}`,         // napellido@empresa.cl
  (f, l, d) => `${f}${l}@${d}`,            // nombreapellido@empresa.cl
  (f, l, d) => `${f[0]}.${l}@${d}`,        // n.apellido@empresa.cl
  (f, l, d) => `${f}_${l}@${d}`,           // nombre_apellido@empresa.cl
  (f, l, d) => `${f}${l[0]}@${d}`,         // nombrea@empresa.cl
  (f, l, d) => `${l}@${d}`,                // apellido@empresa.cl
];

function generateEmailCandidates(firstName, lastName, domain) {
  // Split on spaces BEFORE normalizing (normalize removes spaces)
  const firstParts = (firstName || '').trim().split(/\s+/).map(p => normalize(p)).filter(Boolean);
  const lastParts = (lastName || '').trim().split(/\s+/).map(p => normalize(p)).filter(Boolean);

  const f = firstParts[0] || ''; // First name only
  const l1 = lastParts[0] || ''; // First surname (Chilean: paternal)
  const l2 = lastParts[1] || ''; // Second surname (Chilean: maternal)

  if (!f || !l1 || !domain) return [];

  // Generate with first surname (most common in Chile)
  const primary = EMAIL_PATTERNS.map(pattern => {
    try { return pattern(f, l1, domain); }
    catch { return null; }
  }).filter(Boolean);

  // Also try with both surnames (some companies use this)
  if (l2) {
    primary.push(`${f}.${l1}.${l2}@${domain}`);  // nombre.ap1.ap2@empresa.cl
    primary.push(`${f}.${l1}${l2}@${domain}`);    // nombre.ap1ap2@empresa.cl
  }

  return [...new Set(primary)];
}

function cmdGenerateCandidates() {
  const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));

  if (!fs.existsSync(DOMAINS_FILE)) {
    console.error('Run resolve-domains first!');
    process.exit(1);
  }
  const domains = JSON.parse(fs.readFileSync(DOMAINS_FILE, 'utf-8'));

  // Load PB progress to skip already-found emails
  let pbProgress = { foundEmails: {}, notFound: [] };
  if (fs.existsSync(PB_PROGRESS_FILE)) {
    pbProgress = JSON.parse(fs.readFileSync(PB_PROGRESS_FILE, 'utf-8'));
  }
  const alreadyHaveEmail = new Set(Object.keys(pbProgress.foundEmails));

  let generated = 0, skipped = 0, noDomain = 0;
  const enriched = leads.map(l => {
    const url = l.linkedinProfileUrl || l.profileUrl || '';

    // Skip if PB already found email
    if (alreadyHaveEmail.has(url) && pbProgress.foundEmails[url]) {
      return {
        ...l,
        email: pbProgress.foundEmails[url],
        emailSource: 'phantombuster-dropcontact',
        emailConfidence: 'verified'
      };
    }

    // Get domain
    const domainInfo = domains[l.company];
    if (!domainInfo || !domainInfo.domain) {
      noDomain++;
      return l;
    }

    // Generate candidates
    const candidates = generateEmailCandidates(l.firstName, l.lastName, domainInfo.domain);
    if (candidates.length === 0) {
      skipped++;
      return l;
    }

    generated++;
    return {
      ...l,
      emailCandidates: candidates,
      emailDomain: domainInfo.domain,
      emailBestGuess: candidates[0], // Most common pattern first
      emailSource: 'pattern-guess',
      emailConfidence: 'unverified'
    };
  });

  fs.writeFileSync(ENRICHED_FILE, JSON.stringify(enriched, null, 2));

  const withPBEmail = enriched.filter(l => l.emailSource === 'phantombuster-dropcontact').length;
  const withGuess = enriched.filter(l => l.emailSource === 'pattern-guess').length;
  const withNothing = enriched.filter(l => !l.email && !l.emailBestGuess).length;

  console.log('Email Candidate Generation');
  console.log('=========================');
  console.log(`Total leads:           ${leads.length}`);
  console.log(`PB verified emails:    ${withPBEmail}`);
  console.log(`Pattern guesses:       ${withGuess}`);
  console.log(`No domain found:       ${noDomain}`);
  console.log(`No candidates:         ${skipped}`);
  console.log(`Without any email:     ${withNothing}`);
  console.log(`\nSaved to: ${ENRICHED_FILE}`);

  // Show samples
  console.log('\nSample candidates:');
  enriched.filter(l => l.emailCandidates).slice(0, 5).forEach(l => {
    console.log(`  ${l.fullName} @ ${l.company}`);
    console.log(`    Domain: ${l.emailDomain}`);
    console.log(`    Best guess: ${l.emailBestGuess}`);
    console.log(`    All: ${l.emailCandidates.slice(0, 3).join(', ')}...`);
  });
}

// --- Layer 3: Hunter.io Domain Search (Free tier: 25/month) ---

async function hunterDomainSearch(domain) {
  if (!HUNTER_KEY) return null;

  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${HUNTER_KEY}&limit=5`;
    const result = await httpsGet(url);

    if (result.data && result.data.pattern) {
      return {
        pattern: result.data.pattern,   // e.g., "{first}.{last}"
        emails: (result.data.emails || []).map(e => e.value),
        org: result.data.organization
      };
    }
  } catch { /* ignore */ }
  return null;
}

async function hunterEmailFinder(firstName, lastName, domain) {
  if (!HUNTER_KEY) return null;

  try {
    const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${HUNTER_KEY}`;
    const result = await httpsGet(url);

    if (result.data && result.data.email) {
      return {
        email: result.data.email,
        confidence: result.data.confidence,
        source: 'hunter.io'
      };
    }
  } catch { /* ignore */ }
  return null;
}

// --- Layer 4: Full Enrichment Pipeline ---

async function cmdEnrich() {
  console.log('=== Full Email Enrichment Pipeline ===\n');

  // Step 1: Resolve domains
  console.log('Step 1: Resolving company domains...');
  await cmdResolveDomains();

  // Step 2: Generate candidates
  console.log('\n\nStep 2: Generating email candidates...');
  cmdGenerateCandidates();

  // Step 3: If Hunter.io key available, verify top candidates
  if (HUNTER_KEY) {
    console.log('\n\nStep 3: Verifying via Hunter.io...');
    await cmdHunterVerify();
  } else {
    console.log('\n\nStep 3: Skipped (no HUNTER_API_KEY set)');
    console.log('  Set HUNTER_API_KEY in .env for verified emails (25 free/month)');
  }

  // Summary
  console.log('\n\n=== Enrichment Complete ===');
  cmdProgress();
}

async function cmdHunterVerify() {
  if (!HUNTER_KEY) {
    console.log('HUNTER_API_KEY not set. Get one free at https://hunter.io');
    return;
  }

  const enriched = JSON.parse(fs.readFileSync(ENRICHED_FILE, 'utf-8'));

  // Prioritize by ICP score — only verify HOT leads to save the 25 free lookups
  const HOT_TITLES = /\b(ceo|cro|cto|cfo|chief|presidente|fundador|founder|owner|co-founder|vp |vice\s*president|vicepresidente|director|gerente|manager|gerenta|head of|jefe|subgerente)\b/i;

  const toVerify = enriched
    .filter(l => l.emailDomain && l.emailConfidence === 'unverified')
    .filter(l => HOT_TITLES.test(l.headline || ''))
    .slice(0, 25); // Free tier limit

  console.log(`Verifying ${toVerify.length} HOT leads via Hunter.io...\n`);

  let verified = 0;
  for (const lead of toVerify) {
    const firstName = (lead.firstName || '').split(/\s+/)[0];
    const lastName = (lead.lastName || '').split(/\s+/)[0];

    const result = await hunterEmailFinder(firstName, lastName, lead.emailDomain);

    if (result && result.email) {
      // Find in enriched array and update
      const idx = enriched.findIndex(l =>
        (l.linkedinProfileUrl || l.profileUrl) === (lead.linkedinProfileUrl || lead.profileUrl)
      );
      if (idx >= 0) {
        enriched[idx].email = result.email;
        enriched[idx].emailConfidence = `hunter-${result.confidence}`;
        enriched[idx].emailSource = 'hunter.io';
        verified++;
        console.log(`  + ${result.email} (${result.confidence}%) - ${lead.fullName}`);
      }
    } else {
      console.log(`  - not found - ${lead.fullName} @ ${lead.emailDomain}`);
    }

    await sleep(1500); // Hunter rate limit: 10 req/sec on free tier
  }

  fs.writeFileSync(ENRICHED_FILE, JSON.stringify(enriched, null, 2));
  console.log(`\nHunter.io verified: ${verified}/${toVerify.length}`);
}

// --- Layer 5: SMTP Verification (custom — uses Google DNS API + direct SMTP) ---
// Note: deep-email-validator's dns.resolveMx fails on MSYS/Windows.
// We use Google DNS API (already proven to work) + raw SMTP RCPT TO check.

const net = require('net');

/**
 * Resolve MX records via Google DNS API (bypasses broken local DNS)
 */
async function resolveMxViaDns(domain) {
  try {
    const result = await httpsGet(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`);
    if (result.Answer && result.Answer.length > 0) {
      // Parse MX records: data format is "priority hostname."
      const mxRecords = result.Answer
        .filter(a => a.type === 15)
        .map(a => {
          const parts = (a.data || '').split(' ');
          return {
            priority: parseInt(parts[0], 10) || 99,
            exchange: (parts[1] || '').replace(/\.$/, '') // remove trailing dot
          };
        })
        .filter(m => m.exchange)
        .sort((a, b) => a.priority - b.priority);
      return mxRecords;
    }
  } catch { /* ignore */ }
  return [];
}

/**
 * SMTP RCPT TO verification — connects to MX server and checks if recipient is accepted
 * Returns: { valid: true/false, code: number, message: string }
 */
function smtpVerifyEmail(email, mxHost, timeout = 10000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ valid: false, code: 0, message: 'timeout' });
    }, timeout);

    const socket = net.createConnection(25, mxHost);
    let step = 0;
    let response = '';

    socket.setEncoding('utf-8');
    socket.setTimeout(timeout);

    socket.on('data', (data) => {
      response = data.toString();
      const code = parseInt(response.substring(0, 3), 10);

      if (step === 0 && code === 220) {
        // Server greeting — send EHLO
        step = 1;
        socket.write(`EHLO sisteco.cl\r\n`);
      } else if (step === 1 && code === 250) {
        // EHLO accepted — send MAIL FROM
        step = 2;
        socket.write(`MAIL FROM:<verify@sisteco.cl>\r\n`);
      } else if (step === 2 && code === 250) {
        // MAIL FROM accepted — send RCPT TO (the actual check)
        step = 3;
        socket.write(`RCPT TO:<${email}>\r\n`);
      } else if (step === 3) {
        // RCPT TO response — this is what we care about
        step = 4;
        socket.write(`QUIT\r\n`);
        clearTimeout(timer);

        if (code === 250 || code === 251) {
          resolve({ valid: true, code, message: response.trim() });
        } else if (code === 550 || code === 551 || code === 553 || code === 554) {
          resolve({ valid: false, code, message: 'recipient-rejected' });
        } else if (code === 452 || code === 450) {
          // Mailbox full or temporarily unavailable — treat as likely valid
          resolve({ valid: true, code, message: 'soft-accept' });
        } else {
          // Catch-all or greylisting (421, etc.)
          resolve({ valid: false, code, message: `unknown-${code}` });
        }
      } else if (step === 4) {
        socket.destroy();
      } else {
        // Unexpected response
        clearTimeout(timer);
        socket.destroy();
        resolve({ valid: false, code, message: `unexpected-step${step}-code${code}` });
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      resolve({ valid: false, code: 0, message: err.message || 'connection-error' });
    });

    socket.on('timeout', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ valid: false, code: 0, message: 'socket-timeout' });
    });
  });
}

// Cache MX lookups per domain to avoid redundant DNS calls
const mxCache = new Map();

async function getMxForDomain(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain);
  const mx = await resolveMxViaDns(domain);
  mxCache.set(domain, mx);
  return mx;
}

/**
 * Hybrid verification strategy:
 * 1. MX-verified: domain has MX records (confirmed by Google DNS) → high confidence
 * 2. SMTP RCPT TO: try direct verification → if IP not blocked, definitive answer
 * 3. If SMTP blocked (Spamhaus/etc), fall back to MX-verified + pattern confidence
 *
 * Confidence levels after this step:
 *   'smtp-verified'     — SMTP accepted the recipient (definitive)
 *   'smtp-rejected'     — SMTP explicitly rejected the recipient (bad email)
 *   'mx-verified'       — Domain has MX, SMTP inconclusive (IP blocked), pattern likely valid
 *   'smtp-failed'       — No MX or connection error
 */
async function cmdVerifySmtp() {
  if (!fs.existsSync(ENRICHED_FILE)) {
    console.error('Run generate-candidates first!');
    process.exit(1);
  }

  const enriched = JSON.parse(fs.readFileSync(ENRICHED_FILE, 'utf-8'));

  // Parse optional --limit flag (default: all)
  const limitArg = process.argv.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

  // Get leads that have an emailBestGuess but haven't been verified yet
  const toVerify = enriched
    .map((lead, idx) => ({ lead, idx }))
    .filter(({ lead }) =>
      lead.emailBestGuess &&
      lead.emailConfidence !== 'smtp-verified' &&
      lead.emailConfidence !== 'smtp-rejected' &&
      lead.emailConfidence !== 'mx-verified' &&
      lead.emailConfidence !== 'smtp-failed' &&
      lead.emailConfidence !== 'verified' // Skip PB verified
    )
    // Sort by ICP score (HOT leads first) — use _icpScore if available
    .sort((a, b) => {
      const scoreA = a.lead._icpScore || a.lead.icpScore || 0;
      const scoreB = b.lead._icpScore || b.lead.icpScore || 0;
      return scoreB - scoreA; // Higher score first
    })
    .slice(0, limit);

  console.log(`SMTP Email Verification (Google DNS + direct SMTP)`);
  console.log(`==================================================`);
  console.log(`Total leads with guesses: ${enriched.filter(l => l.emailBestGuess).length}`);
  console.log(`Already smtp-verified:    ${enriched.filter(l => l.emailConfidence === 'smtp-verified').length}`);
  console.log(`Already mx-verified:      ${enriched.filter(l => l.emailConfidence === 'mx-verified').length}`);
  console.log(`Already failed/rejected:  ${enriched.filter(l => l.emailConfidence === 'smtp-failed' || l.emailConfidence === 'smtp-rejected').length}`);
  console.log(`To verify this run:       ${toVerify.length}`);
  console.log();

  let smtpVerified = 0, smtpRejected = 0, mxVerified = 0, noMx = 0, errors = 0;

  for (let i = 0; i < toVerify.length; i++) {
    const { lead, idx } = toVerify[i];
    const email = lead.emailBestGuess;
    const domain = email.split('@')[1];

    process.stdout.write(`  [${i + 1}/${toVerify.length}] ${email.padEnd(45)} `);

    try {
      // Step 1: Get MX records via Google DNS API
      const mxRecords = await getMxForDomain(domain);

      if (mxRecords.length === 0) {
        enriched[idx].emailConfidence = 'smtp-failed';
        enriched[idx]._smtpFailReason = 'no-mx';
        noMx++;
        console.log('NO-MX');
        await sleep(200);
        continue;
      }

      const mxHost = mxRecords[0].exchange;

      // Step 2: Try SMTP RCPT TO
      const result = await smtpVerifyEmail(email, mxHost, 10000);

      if (result.valid) {
        // SMTP accepted — definitive valid
        enriched[idx].email = email;
        enriched[idx].emailConfidence = 'smtp-verified';
        enriched[idx].emailSource = 'pattern-smtp-verified';
        enriched[idx]._smtpCode = result.code;
        enriched[idx]._mxHost = mxHost;
        smtpVerified++;
        console.log(`SMTP-VALID (${result.code})`);
      } else if (result.code === 550 && result.message === 'recipient-rejected') {
        // SMTP explicitly rejected the recipient — bad email
        enriched[idx].emailConfidence = 'smtp-rejected';
        enriched[idx]._smtpFailReason = 'recipient-rejected';
        enriched[idx]._smtpCode = result.code;
        enriched[idx]._mxHost = mxHost;
        smtpRejected++;
        console.log(`SMTP-REJECTED (550)`);
      } else {
        // SMTP inconclusive (IP blocked, timeout, greylisted, etc.)
        // But we know MX is valid → mark as mx-verified (good confidence)
        enriched[idx].email = email;
        enriched[idx].emailConfidence = 'mx-verified';
        enriched[idx].emailSource = 'pattern-mx-verified';
        enriched[idx]._smtpNote = result.message;
        enriched[idx]._smtpCode = result.code;
        enriched[idx]._mxHost = mxHost;
        mxVerified++;
        console.log(`MX-VERIFIED (smtp: ${result.message})`);
      }
    } catch (err) {
      enriched[idx].emailConfidence = 'smtp-failed';
      enriched[idx]._smtpFailReason = err.message || 'error';
      errors++;
      console.log(`ERROR (${(err.message || '').slice(0, 50)})`);
    }

    // Save every 10 verifications
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(ENRICHED_FILE, JSON.stringify(enriched, null, 2));
    }

    // Rate limit: 1 per second to avoid blacklisting
    await sleep(1000);
  }

  // Final save
  fs.writeFileSync(ENRICHED_FILE, JSON.stringify(enriched, null, 2));

  console.log(`\nVerification Results`);
  console.log(`====================`);
  console.log(`SMTP verified (definitive):  ${smtpVerified}`);
  console.log(`MX verified (high conf.):    ${mxVerified}`);
  console.log(`SMTP rejected (bad email):   ${smtpRejected}`);
  console.log(`No MX records:               ${noMx}`);
  console.log(`Errors:                      ${errors}`);
  console.log(`Total processed:             ${toVerify.length}`);

  // Overall stats
  const allSmtpVerified = enriched.filter(l => l.emailConfidence === 'smtp-verified').length;
  const allMxVerified = enriched.filter(l => l.emailConfidence === 'mx-verified').length;
  const allVerified = enriched.filter(l => l.emailConfidence === 'verified').length;
  const totalGuesses = enriched.filter(l => l.emailBestGuess && l.emailConfidence === 'unverified').length;
  console.log(`\nOverall email stats:`);
  console.log(`  SMTP verified:  ${allSmtpVerified}`);
  console.log(`  MX verified:    ${allMxVerified}`);
  console.log(`  PB verified:    ${allVerified}`);
  console.log(`  Unverified:     ${totalGuesses}`);
  console.log(`  Usable emails:  ${allSmtpVerified + allMxVerified + allVerified} (smtp + mx + pb)`);
  console.log(`Saved to: ${ENRICHED_FILE}`);
}

// --- Progress & Export ---

function cmdProgress() {
  if (!fs.existsSync(ENRICHED_FILE)) {
    console.log('Run "enrich" first.');
    return;
  }

  const enriched = JSON.parse(fs.readFileSync(ENRICHED_FILE, 'utf-8'));
  const total = enriched.length;

  const bySource = {
    'phantombuster-dropcontact': enriched.filter(l => l.emailSource === 'phantombuster-dropcontact').length,
    'hunter.io': enriched.filter(l => l.emailSource === 'hunter.io').length,
    'pattern-guess': enriched.filter(l => l.emailSource === 'pattern-guess' && l.emailBestGuess).length,
    'none': enriched.filter(l => !l.email && !l.emailBestGuess).length,
  };

  const smtpVerified = enriched.filter(l => l.emailConfidence === 'smtp-verified').length;
  const mxVerified = enriched.filter(l => l.emailConfidence === 'mx-verified').length;
  const smtpRejected = enriched.filter(l => l.emailConfidence === 'smtp-rejected').length;
  const smtpFailed = enriched.filter(l => l.emailConfidence === 'smtp-failed').length;

  const byConfidence = {
    'pb-verified': enriched.filter(l => l.emailConfidence === 'verified' || (l.emailConfidence || '').startsWith('hunter')).length,
    'smtp-verified': smtpVerified,
    'mx-verified': mxVerified,
    'smtp-rejected': smtpRejected,
    'smtp-failed': smtpFailed,
    'unverified-guess': enriched.filter(l => l.emailConfidence === 'unverified').length,
    'no-email': enriched.filter(l => !l.email && !l.emailBestGuess).length,
  };

  console.log('\nEnrichment Progress');
  console.log('===================');
  console.log(`Total leads:       ${total}`);
  console.log(`\nBy source:`);
  console.log(`  PB/Dropcontact:  ${bySource['phantombuster-dropcontact']} (verified)`);
  console.log(`  Hunter.io:       ${bySource['hunter.io']} (verified)`);
  console.log(`  SMTP verified:   ${smtpVerified} (definitive)`);
  console.log(`  MX verified:     ${mxVerified} (high confidence)`);
  console.log(`  Pattern guess:   ${bySource['pattern-guess']} (unverified)`);
  console.log(`  No email:        ${bySource['none']}`);
  console.log(`\nBy confidence:`);
  console.log(`  PB/Hunter:       ${byConfidence['pb-verified']}`);
  console.log(`  SMTP verified:   ${byConfidence['smtp-verified']}`);
  console.log(`  MX verified:     ${byConfidence['mx-verified']}`);
  console.log(`  SMTP rejected:   ${byConfidence['smtp-rejected']}`);
  console.log(`  SMTP failed:     ${byConfidence['smtp-failed']}`);
  console.log(`  Guess:           ${byConfidence['unverified-guess']}`);
  console.log(`  None:            ${byConfidence['no-email']}`);

  // Progress bar
  const usableEmails = byConfidence['pb-verified'] + byConfidence['smtp-verified'] + byConfidence['mx-verified'];
  const totalWithEmail = total - bySource['none'];
  const pct = (totalWithEmail / total * 100).toFixed(0);
  const usablePct = (usableEmails / total * 100).toFixed(0);
  const barWidth = 40;
  const filled = Math.round((totalWithEmail / total) * barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  console.log(`\n[${bar}] ${pct}% with email (all sources)`);
  console.log(`Usable emails (verified + mx-verified): ${usableEmails} (${usablePct}%)`);
}

function cmdExport() {
  if (!fs.existsSync(ENRICHED_FILE)) {
    console.log('Run "enrich" first.');
    return;
  }

  const enriched = JSON.parse(fs.readFileSync(ENRICHED_FILE, 'utf-8'));
  const listsDir = path.join(ROOT, 'leads-lists');
  if (!fs.existsSync(listsDir)) fs.mkdirSync(listsDir, { recursive: true });

  // List A: Verified emails → ready for cold email (PB, Hunter, SMTP-verified, MX-verified)
  const listA = enriched.filter(l =>
    l.email && (
      l.emailConfidence === 'verified' ||
      l.emailConfidence === 'smtp-verified' ||
      l.emailConfidence === 'mx-verified' ||
      (l.emailConfidence || '').startsWith('hunter')
    )
  );

  // List B: Best guess emails → can try, lower confidence (unverified, smtp-failed, smtp-rejected)
  const listB = enriched.filter(l =>
    !l.email && l.emailBestGuess && (
      l.emailConfidence === 'unverified' ||
      l.emailConfidence === 'smtp-failed' ||
      l.emailConfidence === 'smtp-rejected'
    )
  );

  // List C: No email → LinkedIn outreach only
  const listC = enriched.filter(l => !l.email && !l.emailBestGuess);

  fs.writeFileSync(path.join(listsDir, 'list-a-verified-email.json'), JSON.stringify(listA, null, 2));
  fs.writeFileSync(path.join(listsDir, 'list-b-guessed-email.json'), JSON.stringify(listB, null, 2));
  fs.writeFileSync(path.join(listsDir, 'list-c-linkedin-only.json'), JSON.stringify(listC, null, 2));

  // Also export as CSV for each list
  const toCsv = (list, emailField = 'email') => {
    const header = 'firstName,lastName,email,company,jobTitle,industry,linkedinUrl';
    const rows = list.map(l => {
      const e = (s) => `"${(s || '').replace(/"/g, '""')}"`;
      return [
        e(l.firstName), e(l.lastName),
        e(l[emailField] || l.emailBestGuess || ''),
        e(l.company), e(l.jobTitle || l.headline),
        e(l.industry),
        e(l.linkedinProfileUrl || l.profileUrl)
      ].join(',');
    });
    return [header, ...rows].join('\n');
  };

  fs.writeFileSync(path.join(listsDir, 'list-a-verified-email.csv'), toCsv(listA));
  fs.writeFileSync(path.join(listsDir, 'list-b-guessed-email.csv'), toCsv(listB, 'emailBestGuess'));
  fs.writeFileSync(path.join(listsDir, 'list-c-linkedin-only.csv'), toCsv(listC));

  console.log('Export Complete');
  console.log('===============');
  console.log(`List A (verified email):   ${listA.length} leads → cold email ready`);
  console.log(`List B (guessed email):    ${listB.length} leads → try with caution`);
  console.log(`List C (LinkedIn only):    ${listC.length} leads → LinkedIn outreach`);
  console.log(`\nFiles in: ${listsDir}/`);
  console.log(`  list-a-verified-email.json/.csv`);
  console.log(`  list-b-guessed-email.json/.csv`);
  console.log(`  list-c-linkedin-only.json/.csv`);
}

// --- CLI ---

async function main() {
  const cmd = process.argv[2];

  switch (cmd) {
    case 'resolve-domains':
      await cmdResolveDomains();
      break;
    case 'generate-candidates':
      cmdGenerateCandidates();
      break;
    case 'verify-mx':
      await cmdResolveDomains(); // Same thing
      break;
    case 'hunter-verify':
      await cmdHunterVerify();
      break;
    case 'verify-smtp':
      await cmdVerifySmtp();
      break;
    case 'enrich':
      await cmdEnrich();
      break;
    case 'progress':
      cmdProgress();
      break;
    case 'export':
      cmdExport();
      break;
    default:
      console.log(`
enrich-emails.js — Alternative email enrichment (no PhantomBuster needed)

Commands:
  resolve-domains       Find company email domains via MX record checking
  generate-candidates   Generate email pattern candidates per lead
  verify-smtp           SMTP-verify email guesses (--limit=N for partial)
  hunter-verify         Verify HOT lead emails via Hunter.io (25 free/month)
  enrich                Full pipeline: domains → candidates → verify
  progress              Show enrichment progress
  export                Export categorized lead lists (A/B/C)

Lead Lists:
  List A: Verified emails → ready for cold email outreach
  List B: Pattern-guessed emails → try with caution (may bounce)
  List C: No email found → route to LinkedIn outreach

Environment:
  HUNTER_API_KEY     Get free at https://hunter.io (25 lookups/month)
      `);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

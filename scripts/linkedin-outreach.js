#!/usr/bin/env node
/**
 * linkedin-outreach.js -- LinkedIn outreach queue manager via PhantomBuster API
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
 *   PHANTOMBUSTER_API_KEY         -- PB API key (required)
 *   PB_OUTREACH_PHANTOM_ID        -- PB LinkedIn Outreach phantom ID (required for send)
 *   DISCORD_WEBHOOK_URL            -- For notifications (optional)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
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
  if (dryRun) console.log('[DRY RUN] -- no actual API calls\n');

  const batchResult = {
    date: todayKey(),
    timestamp: new Date().toISOString(),
    count: 0,
    leads: []
  };

  for (let i = 0; i < prepared.length; i++) {
    const lead = prepared[i];
    const note = lead._preparedMessages.connectionNote;

    console.log(`  [${i + 1}/${prepared.length}] ${lead.fullName} -- ${note.slice(0, 60)}...`);

    if (!dryRun) {
      try {
        // PB API: Launch phantom with lead data
        // The PB LinkedIn Outreach phantom expects a CSV/JSON input with LinkedIn URLs + messages
        // We prepare the arguments for the phantom launch
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
  console.log(`Connections sent:  ${sent} (${total > 0 ? ((sent / total) * 100).toFixed(1) : '0.0'}%)`);
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
linkedin-outreach.js -- LinkedIn outreach queue manager

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

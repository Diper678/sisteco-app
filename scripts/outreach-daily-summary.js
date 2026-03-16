#!/usr/bin/env node
/**
 * outreach-daily-summary.js -- Send daily outreach summary to Discord
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
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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
    `**Outreach Daily -- ${today}**`,
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
    alerts.push('CRITICAL: Acceptance below 20% -- consider pausing 48h');
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

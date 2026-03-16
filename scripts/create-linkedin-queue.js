#!/usr/bin/env node
/**
 * create-linkedin-queue.js -- Create the LinkedIn Queue tracking sheet
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
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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

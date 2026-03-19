#!/usr/bin/env node
/**
 * sheets-manager.js — Google Sheets helper para Claude Code / Sisteco
 *
 * Usa googleapis directamente con credentials.json plano.
 * Requiere: NODE_PATH=/c/npm-global/node_modules (o googleapis local)
 *
 * Uso:
 *   node scripts/sheets-manager.js create --title "Mi Sheet" --sheets "Hoja1,Hoja2"
 *   node scripts/sheets-manager.js read --id SHEET_ID --range "A1:Z100"
 *   node scripts/sheets-manager.js append --id SHEET_ID --range "A:D" --data '[["a","b","c","d"]]'
 *   node scripts/sheets-manager.js update --id SHEET_ID --range "A1:D1" --data '[["h1","h2","h3","h4"]]'
 *   node scripts/sheets-manager.js share --id SHEET_ID --email user@domain.com --role writer
 *   node scripts/sheets-manager.js list-sheets
 *   node scripts/sheets-manager.js template --type leads|clients|financial
 *   node scripts/sheets-manager.js auth-check
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CREDS_FILE = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'gws', 'credentials.json');

function getAuth() {
  if (!fs.existsSync(CREDS_FILE)) {
    console.error('ERROR: No credentials found. Run: node scripts/google-auth.js');
    process.exit(1);
  }

  const creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf-8'));
  const oauth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret);
  oauth2.setCredentials({
    access_token: creds.access_token,
    refresh_token: creds.refresh_token,
    token_type: creds.token_type || 'Bearer',
    expiry_date: creds.expiry_date
  });

  // Auto-refresh and persist new tokens
  oauth2.on('tokens', (tokens) => {
    if (tokens.access_token) {
      creds.access_token = tokens.access_token;
      if (tokens.expiry_date) creds.expiry_date = tokens.expiry_date;
      creds.updated_at = new Date().toISOString();
      fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));
    }
  });

  return oauth2;
}

const auth = getAuth();
const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });

// --- Commands ---

async function createSheet(title, sheetNames = []) {
  const sheetList = sheetNames.length > 0
    ? sheetNames.map(name => ({ properties: { title: name } }))
    : [{ properties: { title: 'Sheet1' } }];

  const res = await sheets.spreadsheets.create({
    requestBody: { properties: { title }, sheets: sheetList }
  });

  const result = {
    spreadsheetId: res.data.spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${res.data.spreadsheetId}/edit`,
    title: res.data.properties.title,
    sheets: res.data.sheets.map(s => s.properties.title)
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function readSheet(spreadsheetId, range) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  console.log(JSON.stringify(res.data, null, 2));
  return res.data;
}

async function appendData(spreadsheetId, range, data) {
  const values = typeof data === 'string' ? JSON.parse(data) : data;
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values }
  });
  console.log(JSON.stringify(res.data, null, 2));
  return res.data;
}

async function updateData(spreadsheetId, range, data) {
  const values = typeof data === 'string' ? JSON.parse(data) : data;
  const res = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values }
  });
  console.log(JSON.stringify(res.data, null, 2));
  return res.data;
}

async function shareSheet(spreadsheetId, email, role = 'writer') {
  const res = await drive.permissions.create({
    fileId: spreadsheetId,
    requestBody: { role, type: 'user', emailAddress: email }
  });
  console.log(JSON.stringify({ shared: true, email, role, permissionId: res.data.id }, null, 2));
  return res.data;
}

async function listSheets() {
  const res = await drive.files.list({
    pageSize: 20,
    q: "mimeType='application/vnd.google-apps.spreadsheet'",
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,modifiedTime,webViewLink)'
  });
  console.log(JSON.stringify(res.data, null, 2));
  return res.data;
}

// --- Templates ---

const TEMPLATES = {
  leads: {
    title: 'Sisteco - Lead Pipeline',
    sheets: ['Leads', 'Scoring', 'Outreach', 'Metricas'],
    headers: {
      Leads: ['Empresa', 'Contacto', 'Cargo', 'Email', 'LinkedIn', 'Website', 'Industria', 'Ubicacion', 'Source', 'Score', 'Categoria', 'Status', 'Fecha'],
      Scoring: ['Lead', 'Score', 'Categoria', 'Razon', 'Confianza', 'Senales', 'Riesgos', 'ScoredAt'],
      Outreach: ['Lead', 'Canal', 'Step', 'Asunto', 'Mensaje', 'EnviadoAt', 'Respondio', 'NextFollowUp'],
      Metricas: ['Semana', 'LeadsNuevos', 'HOT', 'WARM', 'NURTURE', 'SKIP', 'Contactados', 'Reuniones', 'Conversiones']
    }
  },
  clients: {
    title: 'Sisteco - Client Tracker',
    sheets: ['Clientes', 'Onboarding', 'Soporte', 'MRR'],
    headers: {
      Clientes: ['Empresa', 'Plan', 'MRR_CLP', 'FechaInicio', 'Estado', 'Contacto', 'Email', 'Telefono'],
      Onboarding: ['Cliente', 'Step', 'Descripcion', 'Completado', 'Fecha', 'Notas'],
      Soporte: ['Cliente', 'Ticket', 'Prioridad', 'Estado', 'Descripcion', 'Resolucion', 'Fecha'],
      MRR: ['Mes', 'ClientesActivos', 'MRR_Total', 'Nuevos', 'Churn', 'Expansion', 'NetMRR']
    }
  },
  financial: {
    title: 'Sisteco - Financial Tracker',
    sheets: ['Ingresos', 'Gastos', 'Metricas', 'Proyecciones'],
    headers: {
      Ingresos: ['Mes', 'MRR', 'OneTime', 'Total', 'ClientesActivos', 'ARPU'],
      Gastos: ['Mes', 'Concepto', 'Monto_CLP', 'Categoria', 'Recurrente', 'Notas'],
      Metricas: ['Mes', 'CAC', 'LTV', 'LTV_CAC', 'Churn_Pct', 'GrossMargin', 'BurnRate'],
      Proyecciones: ['Mes', 'MRR_Proyectado', 'Gastos_Proyectados', 'NetCash', 'Runway_Meses']
    }
  }
};

async function createTemplate(type) {
  const template = TEMPLATES[type];
  if (!template) {
    console.error(`Template no encontrado: ${type}. Opciones: ${Object.keys(TEMPLATES).join(', ')}`);
    process.exit(1);
  }

  console.error(`Creando template "${type}": ${template.title}...`);
  const created = await createSheet(template.title, template.sheets);
  const id = created.spreadsheetId;

  // Add headers via batchUpdate
  const data = template.sheets.map(sheetName => ({
    range: `${sheetName}!A1:${String.fromCharCode(64 + template.headers[sheetName].length)}1`,
    values: [template.headers[sheetName]]
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: id,
    requestBody: { valueInputOption: 'USER_ENTERED', data }
  });

  console.log(JSON.stringify({
    template: type,
    spreadsheetId: id,
    url: `https://docs.google.com/spreadsheets/d/${id}/edit`,
    sheets: template.sheets
  }, null, 2));
}

async function authCheck() {
  try {
    const creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf-8'));
    const tokenInfo = await google.oauth2({ version: 'v2', auth }).userinfo.get();
    console.log(JSON.stringify({
      authenticated: true,
      email: tokenInfo.data.email,
      scopes: (creds.scope || '').split(' ').length,
      token_expires: new Date(creds.expiry_date).toISOString(),
      has_refresh_token: !!creds.refresh_token
    }, null, 2));
  } catch (err) {
    console.log(JSON.stringify({ authenticated: false, error: err.message }, null, 2));
  }
}

// --- CLI Parser ---

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
}

async function main() {
  try {
    switch (command) {
      case 'create':
        await createSheet(
          getFlag('title') || 'Untitled Sheet',
          (getFlag('sheets') || '').split(',').filter(Boolean)
        );
        break;
      case 'read':
        await readSheet(getFlag('id'), getFlag('range') || 'Sheet1');
        break;
      case 'append':
        await appendData(getFlag('id'), getFlag('range') || 'A:A', getFlag('data'));
        break;
      case 'update':
        await updateData(getFlag('id'), getFlag('range'), getFlag('data'));
        break;
      case 'share':
        await shareSheet(getFlag('id'), getFlag('email'), getFlag('role') || 'writer');
        break;
      case 'list-sheets':
        await listSheets();
        break;
      case 'template':
        await createTemplate(getFlag('type') || 'leads');
        break;
      case 'auth-check':
        await authCheck();
        break;
      default:
        console.log(`
sheets-manager.js — Google Sheets helper para Sisteco

Comandos:
  auth-check                          Verificar autenticacion
  create --title "T" --sheets "A,B"   Crear spreadsheet
  read --id ID --range "A1:Z"         Leer datos
  append --id ID --range "A:D" --data '[...]'  Agregar filas
  update --id ID --range "A1:D1" --data '[...]' Actualizar celdas
  share --id ID --email E --role R    Compartir
  list-sheets                         Listar spreadsheets
  template --type leads|clients|financial  Crear desde template
        `);
    }
  } catch (err) {
    console.error('Error:', err.message);
    if (err.code === 401) {
      console.error('Token expirado. Ejecutar: node scripts/google-auth.js');
    }
    process.exit(1);
  }
}

main();

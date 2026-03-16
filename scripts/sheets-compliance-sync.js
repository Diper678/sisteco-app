#!/usr/bin/env node
/**
 * sheets-compliance-sync.js — Sincronizacion de compliance con Google Sheets
 *
 * Script de respaldo para operaciones manuales de compliance cuando la propagacion
 * automatica via Convex (sheetsPropagation.ts) falla o para operaciones de emergencia.
 *
 * Requiere: GOOGLE_SHEETS_API_KEY en el entorno (o .env en la raiz del proyecto)
 *
 * Uso:
 *   node scripts/sheets-compliance-sync.js delete-email <spreadsheetId> <email>
 *   node scripts/sheets-compliance-sync.js check-email <spreadsheetId> <email>
 *   node scripts/sheets-compliance-sync.js list-sheets
 *
 * Ref: Ley 21.719 — Art. 15 (derecho de supresion), Art. 48 (plazo 15 dias)
 * Ref: PLAN 04-04 — sheets-compliance-sync como backup de sheetsPropagation.ts
 */

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// ── Cargar variables de entorno desde .env si existe ─────────────────────────

function loadEnv() {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

// ── Helper: obtener API key ───────────────────────────────────────────────────

function getApiKey() {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!apiKey) {
    console.error(
      'ERROR: GOOGLE_SHEETS_API_KEY no configurado.\n' +
      'Agrega GOOGLE_SHEETS_API_KEY=<tu-key> a .env o al entorno.'
    );
    process.exit(1);
  }
  return apiKey;
}

// ── Helper: leer todas las filas de un Sheet ──────────────────────────────────

async function readAllRows(spreadsheetId, sheetName = 'Leads') {
  const apiKey = getApiKey();
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error leyendo Sheet ${spreadsheetId}: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.values || [];
}

// ── Helper: obtener sheetId numerico ─────────────────────────────────────────

async function getNumericSheetId(spreadsheetId, sheetName = 'Leads') {
  const apiKey = getApiKey();
  const url = `${SHEETS_API_BASE}/${spreadsheetId}?key=${apiKey}&fields=sheets.properties`;

  const response = await fetch(url);
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error obteniendo metadata de Sheet ${spreadsheetId}: ${response.status} ${errText}`);
  }

  const meta = await response.json();
  const sheet = (meta.sheets || []).find(s => s.properties.title === sheetName);
  if (!sheet) {
    // Si no se encuentra la hoja con ese nombre, intentar con la primera hoja
    if (meta.sheets && meta.sheets.length > 0) {
      console.warn(`Hoja "${sheetName}" no encontrada. Usando primera hoja: "${meta.sheets[0].properties.title}"`);
      return meta.sheets[0].properties.sheetId;
    }
    throw new Error(`Hoja "${sheetName}" no encontrada en spreadsheet ${spreadsheetId}`);
  }
  return sheet.properties.sheetId;
}

// ── Comando: delete-email ─────────────────────────────────────────────────────

async function deleteEmail(spreadsheetId, email) {
  if (!spreadsheetId || !email) {
    console.error('Uso: delete-email <spreadsheetId> <email>');
    process.exit(1);
  }

  const apiKey = getApiKey();
  console.log(`Buscando email "${email}" en spreadsheet ${spreadsheetId}...`);

  const rows = await readAllRows(spreadsheetId);

  if (rows.length === 0) {
    console.log('Sheet vacio. Nada que eliminar.');
    return;
  }

  // Encontrar filas con email matching (0-indexed, incluye header)
  const rowIndicesToDelete = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.some(cell => typeof cell === 'string' && cell.toLowerCase() === email.toLowerCase())) {
      rowIndicesToDelete.push(i);
    }
  }

  if (rowIndicesToDelete.length === 0) {
    console.log(`Email "${email}" no encontrado en ninguna fila. Nada que eliminar.`);
    return;
  }

  console.log(`Encontradas ${rowIndicesToDelete.length} fila(s) con email "${email}" en indices: ${rowIndicesToDelete.join(', ')}`);

  // Obtener sheetId numerico para batchUpdate
  const numericSheetId = await getNumericSheetId(spreadsheetId);

  // Eliminar de atras hacia adelante para no desplazar indices
  const deleteRequests = rowIndicesToDelete
    .sort((a, b) => b - a) // orden descendente
    .map(rowIdx => ({
      deleteDimension: {
        range: {
          sheetId: numericSheetId,
          dimension: 'ROWS',
          startIndex: rowIdx,
          endIndex: rowIdx + 1,
        },
      },
    }));

  const batchUrl = `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate?key=${apiKey}`;
  const batchResponse = await fetch(batchUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: deleteRequests }),
  });

  if (!batchResponse.ok) {
    const errText = await batchResponse.text();
    throw new Error(`Error en batchUpdate (deleteRange): ${batchResponse.status} ${errText}`);
  }

  console.log(`Deleted ${rowIndicesToDelete.length} row(s) containing "${email}" from sheet ${spreadsheetId}`);
}

// ── Comando: check-email ──────────────────────────────────────────────────────

async function checkEmail(spreadsheetId, email) {
  if (!spreadsheetId || !email) {
    console.error('Uso: check-email <spreadsheetId> <email>');
    process.exit(1);
  }

  console.log(`Buscando email "${email}" en spreadsheet ${spreadsheetId}...`);

  const rows = await readAllRows(spreadsheetId);

  if (rows.length === 0) {
    console.log('Sheet vacio.');
    return;
  }

  const foundRows = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.some(cell => typeof cell === 'string' && cell.toLowerCase() === email.toLowerCase())) {
      foundRows.push(i + 1); // 1-indexed para el usuario
    }
  }

  if (foundRows.length === 0) {
    console.log(`Email "${email}" NOT found in sheet ${spreadsheetId}`);
  } else {
    console.log(`Email "${email}" found in rows: ${foundRows.join(', ')} (spreadsheet ${spreadsheetId})`);
  }
}

// ── Comando: list-sheets ─────────────────────────────────────────────────────

function listSheets() {
  console.log(`
list-sheets — Informacion sobre Sheets de tenants registrados:

Para ver los spreadsheetIds registrados en Convex:
  1. Ve al Convex Dashboard: https://dashboard.convex.dev
  2. Selecciona tu deployment
  3. Abre la tabla "tenantSheets"
  4. Cada fila contiene: orgId, spreadsheetId, sheetName, status

Para registrar un Sheet de tenant en Convex:
  Usar la mutation interna "tenantSheets" (requiere operador con acceso al dashboard).

Nota: Los Sheets de tenants son de propiedad del tenant — Sisteco solo tiene
acceso de lectura/escritura limitado via API key para propagacion compliance.
  `);
}

// ── CLI Parser ────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
sheets-compliance-sync.js — Script de compliance para Google Sheets (Sisteco)

Uso:
  node scripts/sheets-compliance-sync.js <comando> [argumentos]

Comandos:
  delete-email <spreadsheetId> <email>   Eliminar todas las filas con ese email
  check-email  <spreadsheetId> <email>   Verificar si un email existe en el Sheet
  list-sheets                            Instrucciones para listar Sheets de tenants

Variables de entorno requeridas:
  GOOGLE_SHEETS_API_KEY    API key de Google Sheets (Console > APIs & Services > Credentials)

Ejemplos:
  node scripts/sheets-compliance-sync.js check-email 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms usuario@empresa.com
  node scripts/sheets-compliance-sync.js delete-email 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms usuario@empresa.com

Este script es el respaldo manual para cuando la propagacion automatica
via sheetsPropagation.ts (Convex) no este disponible.

Ref: Ley 21.719 — Derecho de supresion (Art. 15), SLA 15 dias habiles (Art. 48)
  `);
}

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return;
  }

  try {
    switch (command) {
      case 'delete-email':
        await deleteEmail(args[1], args[2]);
        break;
      case 'check-email':
        await checkEmail(args[1], args[2]);
        break;
      case 'list-sheets':
        listSheets();
        break;
      default:
        console.error(`Comando desconocido: "${command}"\n`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();

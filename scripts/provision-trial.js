#!/usr/bin/env node
/**
 * provision-trial.js — Script de provisioning semi-automatizado para nuevos clientes trial
 *
 * Uso: node scripts/provision-trial.js <requestId>
 *
 * Pasos (9 total):
 *   [1/9] Leer trial request de Convex
 *   [2/9] Crear o encontrar usuario en Clerk
 *   [3/9] Crear organizacion en Clerk
 *   [4/9] Crear Google Sheet del cliente
 *   [5/9] Compartir Sheet con el cliente (reader)
 *   [6/9] Registrar tenant Sheet en Convex
 *   [7/9] Crear suscripcion trial en Convex
 *   [8/9] Crear registro de usuario en Convex
 *   [9/9] Enviar email de bienvenida (requiere Plan 02 desplegado)
 *
 * Variables de entorno requeridas (en .env):
 *   CLERK_SECRET_KEY    — Clerk Backend API key
 *   CONVEX_URL          — URL del deployment Convex (https://xxx.convex.cloud)
 *   SAAN_API_SECRET     — Secret para autenticar mutaciones de admin
 *
 * Variables opcionales:
 *   DASHBOARD_URL       — URL del dashboard (para email de bienvenida)
 *   N8N_WEBHOOK_URL     — Para disparar pipeline al finalizar
 */

require('dotenv').config();
const { execSync } = require('child_process');
const { createClerkClient } = require('@clerk/backend');

// ── Validacion de entorno ──────────────────────────────────────────────────────

function requireEnv(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`ERROR: Variable de entorno ${name} no configurada.`);
    process.exit(1);
  }
  return val;
}

const CLERK_SECRET_KEY = requireEnv('CLERK_SECRET_KEY');
const CONVEX_URL = requireEnv('CONVEX_URL');
const SAAN_API_SECRET = requireEnv('SAAN_API_SECRET');
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://sisteco-dashboard.vercel.app';

const requestId = process.argv[2];
if (!requestId) {
  console.error('Uso: node scripts/provision-trial.js <requestId>');
  console.error('Ejemplo: node scripts/provision-trial.js jd7x3k8m9n2p4q5r');
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * runConvex — Ejecuta una funcion Convex via npx convex run.
 * Solo funciona con funciones publicas (no internas).
 */
function runConvex(fnPath, args) {
  const argsJson = JSON.stringify(args);
  const cmd = `npx convex run ${fnPath} '${argsJson}'`;
  try {
    const result = execSync(cmd, {
      encoding: 'utf-8',
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // npx convex run puede retornar JSON o null
    if (result && result.trim() && result.trim() !== 'null') {
      try {
        return JSON.parse(result.trim());
      } catch (_) {
        return result.trim();
      }
    }
    return null;
  } catch (err) {
    throw new Error(`Convex run ${fnPath} failed: ${err.stderr || err.message}`);
  }
}

/**
 * queryConvex — Ejecuta una query Convex via HTTP API.
 * Usa el endpoint /api/query del deployment Convex.
 * Requiere que la funcion sea publica.
 */
async function queryConvex(fnPath, args) {
  const response = await fetch(`${CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: fnPath,
      args: args || {},
      format: 'json',
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Convex query ${fnPath} HTTP ${response.status}: ${text}`);
  }
  const data = await response.json();
  if (data.status === 'error') {
    throw new Error(`Convex query ${fnPath} error: ${data.errorMessage}`);
  }
  return data.value;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== SISTECO — PROVISIONING TRIAL ===');
  console.log(`Request ID: ${requestId}\n`);

  let nombre, email, empresa, plan;

  // ── [1/9] Leer trial request ────────────────────────────────────────────────
  console.log('[1/9] Leyendo trial request...');
  try {
    // Usar la API HTTP de Convex para leer la solicitud
    // Nota: getById es internalQuery, no accesible via API publica.
    // Estrategia: usar npx convex run con una query publica temporal.
    // Para MVP, leer via la funcion listPending si no hay getById publico.
    // Alternativa: solicitar al usuario que proporcione datos.

    // Intentar via HTTP con endpoint personalizado (si existe)
    // Si no, pedir datos al usuario manualmente via stdin
    console.log('  Nota: getById es internal — leyendo via npx convex run trialRequests:getById (requiere ser publico)');
    console.log('  Alternativa: proporcionar datos manualmente si el comando falla.');

    // Intentar leer via API de Convex si tenemos acceso a funciones internas
    // via el deployment URL + admin secret
    const internalQueryResult = await fetch(`${CONVEX_URL}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SAAN_API_SECRET}`,
      },
      body: JSON.stringify({
        path: 'trialRequests:getById',
        args: { id: requestId },
        format: 'json',
      }),
    });

    if (internalQueryResult.ok) {
      const data = await internalQueryResult.json();
      if (data.value) {
        nombre = data.value.nombre;
        email = data.value.email;
        empresa = data.value.empresa;
        plan = 'base'; // default al plan base
        console.log(`  Prospecto: ${nombre} (${email}) — ${empresa}`);
      } else {
        throw new Error('Trial request no encontrado o acceso denegado');
      }
    } else {
      throw new Error(`HTTP ${internalQueryResult.status}: ${await internalQueryResult.text()}`);
    }
  } catch (err) {
    // Si falla la lectura via API, solicitar datos manualmente
    console.warn(`  Advertencia: no se pudo leer via API: ${err.message}`);
    console.warn('  Para continuar, editar este script con los datos del prospecto hardcodeados, o ejecutar:');
    console.warn('  npx convex run trialRequests:markProvisioned para actualizar el estado manualmente.');
    process.exit(1);
  }

  let clerkUserId, clerkOrgId;

  // ── [2/9] Crear o encontrar usuario en Clerk ────────────────────────────────
  console.log('\n[2/9] Creando usuario en Clerk...');
  try {
    const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

    // Buscar primero para evitar duplicados
    const existingUsers = await clerk.users.getUserList({ emailAddress: [email] });
    if (existingUsers.data.length > 0) {
      const existing = existingUsers.data[0];
      clerkUserId = existing.id;
      console.log(`  Usuario existente encontrado: ${clerkUserId}`);
    } else {
      const nameParts = nombre.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || undefined;

      const newUser = await clerk.users.createUser({
        emailAddress: [email],
        firstName,
        lastName,
        skipPasswordRequirement: true,
      });
      clerkUserId = newUser.id;
      console.log(`  Usuario creado: ${clerkUserId}`);
    }
  } catch (err) {
    console.error(`  ERROR en paso 2: ${err.message}`);
    process.exit(1);
  }

  // ── [3/9] Crear organizacion en Clerk ──────────────────────────────────────
  console.log('\n[3/9] Creando organizacion en Clerk...');
  try {
    const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
    const org = await clerk.organizations.createOrganization({
      name: empresa,
      createdBy: clerkUserId,
    });
    clerkOrgId = org.id;
    console.log(`  Organizacion creada: ${clerkOrgId} (${empresa})`);
  } catch (err) {
    console.error(`  ERROR en paso 3: ${err.message}`);
    process.exit(1);
  }

  let spreadsheetId;

  // ── [4/9] Crear Google Sheet ────────────────────────────────────────────────
  console.log('\n[4/9] Creando Google Sheet del cliente...');
  try {
    const sheetTitle = `Sisteco Leads — ${empresa}`;
    const createResult = execSync(
      `node scripts/sheets-manager.js create --title "${sheetTitle}" --sheets "HOT,WARM,NURTURE,Todos"`,
      { cwd: process.cwd(), encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const sheetData = JSON.parse(createResult.trim());
    spreadsheetId = sheetData.spreadsheetId;
    console.log(`  Sheet creado: ${spreadsheetId}`);
    console.log(`  URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  } catch (err) {
    console.error(`  ERROR en paso 4: ${err.message}`);
    console.error('  Verificar que Google credentials esten configuradas: node scripts/google-auth.js');
    process.exit(1);
  }

  // ── [5/9] Compartir Sheet con el cliente ───────────────────────────────────
  console.log('\n[5/9] Compartiendo Sheet con el cliente...');
  try {
    execSync(
      `node scripts/sheets-manager.js share --id ${spreadsheetId} --email ${email} --role reader`,
      { cwd: process.cwd(), encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    console.log(`  Sheet compartido con ${email} (rol: reader)`);
  } catch (err) {
    // No es fatal — se puede compartir manualmente
    console.warn(`  Advertencia: no se pudo compartir sheet automaticamente: ${err.message}`);
    console.warn(`  Compartir manualmente: node scripts/sheets-manager.js share --id ${spreadsheetId} --email ${email} --role reader`);
  }

  // ── [6/9] Registrar tenant Sheet en Convex ─────────────────────────────────
  console.log('\n[6/9] Registrando tenant Sheet en Convex...');
  try {
    runConvex('subscriptions:registerTenantSheet', {
      orgId: clerkOrgId,
      spreadsheetId,
      sheetName: 'HOT',
      adminSecret: SAAN_API_SECRET,
    });
    console.log(`  TenantSheet registrado para org ${clerkOrgId}`);
  } catch (err) {
    console.error(`  ERROR en paso 6: ${err.message}`);
    process.exit(1);
  }

  // ── [7/9] Crear suscripcion trial en Convex ─────────────────────────────────
  console.log('\n[7/9] Creando suscripcion trial en Convex...');
  try {
    runConvex('subscriptions:createTrialSubscription', {
      orgId: clerkOrgId,
      plan: plan || 'base',
      billingEmail: email,
      adminSecret: SAAN_API_SECRET,
    });
    const trialEndsAt = Date.now() + 14 * 24 * 60 * 60 * 1000;
    const trialEndsDate = new Date(trialEndsAt).toLocaleDateString('es-CL');
    console.log(`  Suscripcion trial creada — vence el ${trialEndsDate}`);
  } catch (err) {
    console.error(`  ERROR en paso 7: ${err.message}`);
    process.exit(1);
  }

  // ── [8/9] Crear registro de usuario en Convex ──────────────────────────────
  console.log('\n[8/9] Creando registro de usuario en Convex...');
  try {
    runConvex('users:createFromProvisioning', {
      orgId: clerkOrgId,
      clerkUserId,
      nombre,
      email,
      rol: 'ceo',
      adminSecret: SAAN_API_SECRET,
    });
    console.log(`  Usuario ${nombre} creado como CEO de ${empresa}`);

    // Marcar el trial request como provisionado
    try {
      runConvex('trialRequests:markProvisioned', {
        id: requestId,
        clerkOrgId,
        clerkUserId,
        spreadsheetId,
        adminSecret: SAAN_API_SECRET,
      });
      console.log('  Trial request marcado como provisionado');
    } catch (markErr) {
      console.warn(`  Advertencia: no se pudo marcar request como provisionado: ${markErr.message}`);
    }
  } catch (err) {
    console.error(`  ERROR en paso 8: ${err.message}`);
    process.exit(1);
  }

  // ── [9/9] Enviar email de bienvenida ───────────────────────────────────────
  console.log('\n[9/9] Enviando email de bienvenida...');
  try {
    const trialEndsAt = Date.now() + 14 * 24 * 60 * 60 * 1000;
    runConvex('onboardingEmail:sendWelcomeEmail', {
      email,
      nombre,
      empresa,
      dashboardUrl: DASHBOARD_URL,
      trialEndsAt,
    });
    console.log(`  Email de bienvenida enviado a ${email}`);
  } catch (err) {
    // Paso 9 no es fatal — Plan 02 (onboardingEmail) puede no estar desplegado aun
    console.warn(`  Advertencia: email de bienvenida no enviado: ${err.message}`);
    console.warn('  Este paso requiere Plan 05-02 (onboardingEmail.ts) desplegado.');
    console.warn(`  Enviar manualmente a: ${email}`);
  }

  // ── Resultado ──────────────────────────────────────────────────────────────
  const trialEndsDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL');

  console.log('\n');
  console.log('='.repeat(50));
  console.log('PROVISIONING COMPLETO');
  console.log('='.repeat(50));
  console.log(`- Cliente:     ${nombre} (${empresa})`);
  console.log(`- Email:       ${email}`);
  console.log(`- Clerk User:  ${clerkUserId}`);
  console.log(`- Clerk Org:   ${clerkOrgId}`);
  console.log(`- Sheet:       https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  console.log(`- Trial vence: ${trialEndsDate}`);
  console.log(`- Dashboard:   ${DASHBOARD_URL}`);
  console.log('');
  console.log('Proximos pasos:');
  console.log('  1. Verificar que el cliente recibio el email de bienvenida');
  console.log('  2. Ejecutar pipeline para esta org en n8n');
  console.log(`  3. Asignar SDRs: node scripts/assign-sdr.js ${clerkOrgId}`);
  console.log('='.repeat(50));
}

main().catch((err) => {
  console.error('\nERROR FATAL:', err.message);
  process.exit(1);
});

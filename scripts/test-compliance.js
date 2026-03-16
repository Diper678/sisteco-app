#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Sisteco — Compliance Smoke Tests
// Valida infraestructura de cumplimiento Ley 21.719
//
// USO:
//   node scripts/test-compliance.js <CONVEX_SITE_URL>
//   node scripts/test-compliance.js --full <CONVEX_SITE_URL>
//
// O con variable de entorno:
//   CONVEX_SITE_URL=https://xyz.convex.site node scripts/test-compliance.js
//
// CUBRE:
//   COMP-01 — Politica de privacidad accesible en /privacidad
//   COMP-03 — Formulario opt-out accesible y funcional en /opt-out
//   COMP-03 — ARCO-POL submission en /derechos
//   COMP-05 — CORS headers presentes para acceso cross-origin
//   COMP-02 — Documentos legales RAT, EIPD, DPA existen en docs/legal/
//   COMP-01 — Link privacidad en dashboard (mockups/ceo.html)
//
// CON --full FLAG ADICIONAL:
//   One-click unsubscribe en /unsubscribe
//   Manejo de token invalido en /opt-out/confirm
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// ── CLI args parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Sisteco Compliance Smoke Tests
================================
Valida endpoints de compliance Ley 21.719 y documentos legales.

USO:
  node scripts/test-compliance.js <CONVEX_SITE_URL>
  node scripts/test-compliance.js --full <CONVEX_SITE_URL>
  CONVEX_SITE_URL=https://xyz.convex.site node scripts/test-compliance.js

OPCIONES:
  --full    Incluye tests adicionales (unsubscribe, invalid token)
  --help    Muestra esta ayuda

EXIT CODES:
  0 = todos los tests pasaron
  1 = uno o mas tests fallaron
`);
  process.exit(0);
}

const fullMode = args.includes("--full");
const urlArg = args.find((a) => a.startsWith("http"));
const baseUrl = urlArg || process.env.CONVEX_SITE_URL;

if (!baseUrl) {
  console.error("ERROR: Se requiere CONVEX_SITE_URL como argumento o variable de entorno.");
  console.error("USO: node scripts/test-compliance.js <CONVEX_SITE_URL>");
  console.error("     node scripts/test-compliance.js https://xyz.convex.site");
  process.exit(1);
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

function pass(name) {
  console.log(`[PASS] ${name}`);
  passed++;
  results.push({ name, status: "PASS" });
}

function fail(name, reason) {
  console.log(`[FAIL] ${name}${reason ? ` — ${reason}` : ""}`);
  failed++;
  results.push({ name, status: "FAIL", reason });
}

async function runTest(name, fn) {
  try {
    await fn();
  } catch (err) {
    fail(name, err.message);
  }
}

// ── Test definitions ──────────────────────────────────────────────────────────

async function test1_privacyPolicyAccessible() {
  const res = await fetch(`${baseUrl}/privacidad`);
  if (res.status !== 200) {
    fail("Privacy policy accessible (200)", `HTTP ${res.status}`);
    return;
  }
  const body = await res.text();
  if (!body.toLowerCase().includes("privacidad")) {
    fail("Privacy policy accessible (200)", "Body no contiene 'privacidad'");
    return;
  }
  pass("Privacy policy accessible (200)");
}

async function test2_optOutFormAccessible() {
  const res = await fetch(`${baseUrl}/opt-out`);
  if (res.status !== 200) {
    fail("Opt-out form accessible (200)", `HTTP ${res.status}`);
    return;
  }
  const body = await res.text();
  if (!body.toLowerCase().includes("solicitud de baja") && !body.toLowerCase().includes("opt-out") && !body.toLowerCase().includes("baja")) {
    fail("Opt-out form accessible (200)", "Body no contiene formulario de baja");
    return;
  }
  if (!body.toLowerCase().includes("email")) {
    fail("Opt-out form accessible (200)", "Body no contiene campo email");
    return;
  }
  pass("Opt-out form accessible (200)");
}

async function test3_optOutSubmission() {
  const res = await fetch(`${baseUrl}/opt-out`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test-compliance-smoke@example.com" }),
  });
  if (res.status !== 200) {
    fail("Opt-out submission returns ok (200)", `HTTP ${res.status}`);
    return;
  }
  const json = await res.json();
  if (!json.ok) {
    fail("Opt-out submission returns ok (200)", `Response: ${JSON.stringify(json)}`);
    return;
  }
  pass("Opt-out submission returns ok (200)");
}

async function test4_arcoPolSubmission() {
  const res = await fetch(`${baseUrl}/derechos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test-arco-smoke@example.com",
      nombre: "Test Compliance",
      tipo: "acceso",
      detalles: "Smoke test — ignorar",
    }),
  });
  if (res.status !== 200) {
    fail("ARCO-POL submission returns ok (200)", `HTTP ${res.status}`);
    return;
  }
  const json = await res.json();
  if (!json.ok) {
    fail("ARCO-POL submission returns ok (200)", `Response: ${JSON.stringify(json)}`);
    return;
  }
  pass("ARCO-POL submission returns ok (200)");
}

async function test5_corsHeaders() {
  const res = await fetch(`${baseUrl}/opt-out`, { method: "OPTIONS" });
  if (res.status !== 204 && res.status !== 200) {
    fail("CORS headers present", `HTTP ${res.status} (se esperaba 200 o 204)`);
    return;
  }
  const allowOrigin = res.headers.get("access-control-allow-origin");
  if (!allowOrigin) {
    fail("CORS headers present", "Falta Access-Control-Allow-Origin header");
    return;
  }
  pass("CORS headers present");
}

function test6_legalDocsExist() {
  const docs = [
    "docs/legal/RAT.md",
    "docs/legal/test-ponderacion.md",
    "docs/legal/EIPD-scoring-ia.md",
    "docs/legal/DPA-template.md",
    "docs/legal/politica-privacidad.md",
  ];

  for (const doc of docs) {
    const fullPath = path.join(PROJECT_ROOT, doc);
    const name = path.basename(doc);
    if (fs.existsSync(fullPath)) {
      pass(`Legal docs: ${name} exists`);
    } else {
      fail(`Legal docs: ${name} exists`, `No encontrado en ${fullPath}`);
    }
  }
}

function test7_dashboardPrivacyLink() {
  const ceoPath = path.join(PROJECT_ROOT, "mockups/ceo.html");
  if (!fs.existsSync(ceoPath)) {
    fail("Dashboard privacy link present", "mockups/ceo.html no existe");
    return;
  }
  const content = fs.readFileSync(ceoPath, "utf-8");
  if (!content.includes("Politica de Privacidad")) {
    fail("Dashboard privacy link present", "mockups/ceo.html no contiene 'Politica de Privacidad'");
    return;
  }
  if (!content.includes("/privacidad")) {
    fail("Dashboard privacy link present", "mockups/ceo.html no contiene link a /privacidad");
    return;
  }
  pass("Dashboard privacy link present");
}

// ── Full mode tests ───────────────────────────────────────────────────────────

async function test8_oneClickUnsubscribe() {
  const res = await fetch(
    `${baseUrl}/unsubscribe?email=test-unsubscribe-smoke@example.com`,
    { method: "POST" }
  );
  if (res.status !== 200) {
    fail("One-click unsubscribe (200)", `HTTP ${res.status}`);
    return;
  }
  pass("One-click unsubscribe (200)");
}

async function test9_invalidOptOutToken() {
  const res = await fetch(`${baseUrl}/opt-out/confirm?token=invalid-token-12345`);
  if (res.status !== 200) {
    fail("Invalid opt-out token returns error page (200)", `HTTP ${res.status}`);
    return;
  }
  pass("Invalid opt-out token returns error page (200)");
}

// ── Main execution ────────────────────────────────────────────────────────────

(async () => {
  console.log("=== Sisteco Compliance Smoke Tests ===");
  console.log(`Base URL: ${baseUrl}`);
  if (fullMode) console.log("Mode: --full");
  console.log("");

  // Test 1: Privacy policy accessible
  await runTest("test1", test1_privacyPolicyAccessible);

  // Test 2: Opt-out form accessible
  await runTest("test2", test2_optOutFormAccessible);

  // Test 3: Opt-out submission (dry run)
  await runTest("test3", test3_optOutSubmission);

  // Test 4: ARCO-POL submission (dry run)
  await runTest("test4", test4_arcoPolSubmission);

  // Test 5: CORS headers
  await runTest("test5", test5_corsHeaders);

  // Test 6: Legal documents exist (local file check)
  test6_legalDocsExist();

  // Test 7: Dashboard privacy link
  test7_dashboardPrivacyLink();

  // Full mode: additional tests
  if (fullMode) {
    await runTest("test8", test8_oneClickUnsubscribe);
    await runTest("test9", test9_invalidOptOutToken);
  }

  const total = passed + failed;
  console.log("");
  console.log(`Results: ${passed}/${total} passed`);

  if (failed > 0) {
    console.log(`\nFailed tests:`);
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => console.log(`  - ${r.name}${r.reason ? `: ${r.reason}` : ""}`));
    process.exit(1);
  }

  process.exit(0);
})();

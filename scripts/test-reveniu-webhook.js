#!/usr/bin/env node
/**
 * test-reveniu-webhook.js — Smoke test para el endpoint POST /reveniu-webhook
 *
 * Tests:
 *   1. POST sin header Reveniu-Secret-Key → 401
 *   2. POST con secret invalido → 401
 *   3. POST con secret correcto + payload test → 200 (requiere REVENIU_WEBHOOK_SECRET en .env)
 *
 * Uso: node scripts/test-reveniu-webhook.js
 * Exit code 0 si todos los tests pasan (o se saltan), 1 si alguno falla.
 *
 * Requiere: CONVEX_SITE_URL en .env (o usa el URL por defecto del proyecto)
 */

const path = require("path");

// Cargar .env desde raiz del proyecto
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// ── Config ─────────────────────────────────────────────────────────────────────

const CONVEX_SITE_URL =
  process.env.CONVEX_SITE_URL || "https://animated-pika-122.convex.site";
const WEBHOOK_URL = `${CONVEX_SITE_URL}/reveniu-webhook`;
const WEBHOOK_SECRET = process.env.REVENIU_WEBHOOK_SECRET;

// ── Helpers ────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

function pass(description) {
  console.log(`  PASS: ${description}`);
  passed++;
}

function fail(description, detail) {
  console.error(`  FAIL: ${description}${detail ? ` — ${detail}` : ""}`);
  failed++;
}

function skip(description, reason) {
  console.log(`  SKIP: ${description} (${reason})`);
  skipped++;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

console.log("\n=== test-reveniu-webhook.js ===\n");
console.log(`  Endpoint: ${WEBHOOK_URL}\n`);

async function runTests() {
  // Test 1: POST sin header → 401
  console.log("Test 1: POST sin header Reveniu-Secret-Key → 401");
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "test", data: {} }),
    });
    if (res.status === 401) {
      pass("Response status === 401 (Unauthorized)");
    } else {
      fail(
        "Response status === 401",
        `got ${res.status} — el endpoint no valida el secret header`
      );
    }
  } catch (err) {
    fail("Conexion al endpoint", String(err));
  }

  // Test 2: POST con secret invalido → 401
  console.log("\nTest 2: POST con secret invalido → 401");
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Reveniu-Secret-Key": "test-invalid-secret-xyz-000",
      },
      body: JSON.stringify({ event: "test", data: {} }),
    });
    if (res.status === 401) {
      pass("Response status === 401 (secret invalido rechazado)");
    } else {
      fail(
        "Response status === 401 con secret invalido",
        `got ${res.status}`
      );
    }
  } catch (err) {
    fail("Conexion al endpoint", String(err));
  }

  // Test 3: POST con secret correcto + evento test → 200
  console.log("\nTest 3: POST con secret correcto + payload test → 200");
  if (!WEBHOOK_SECRET) {
    skip(
      "POST con secret correcto",
      "REVENIU_WEBHOOK_SECRET no configurado en .env"
    );
  } else {
    try {
      const payload = {
        event: "test_ping",
        data: { subscription_id: "test-001", email: "test@test.cl", plan_name: "base", amount: 0 },
      };
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Reveniu-Secret-Key": WEBHOOK_SECRET,
        },
        body: JSON.stringify(payload),
      });
      if (res.status === 200) {
        pass("Response status === 200 (secret valido aceptado)");
      } else {
        fail(
          "Response status === 200 con secret correcto",
          `got ${res.status}`
        );
      }
    } catch (err) {
      fail("Conexion al endpoint con secret correcto", String(err));
    }
  }

  // ── Resultado final ────────────────────────────────────────────────────────────

  console.log(
    `\n=== Resultado: ${passed} passed, ${failed} failed, ${skipped} skipped ===\n`
  );

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Error inesperado en tests:", err);
  process.exit(1);
});

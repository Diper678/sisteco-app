#!/usr/bin/env node
/**
 * test-plan-links.js — Verificar que los links de Reveniu esten configurados en .env
 *
 * Tests:
 *   1. REVENIU_LINK_BASE_MONTHLY existe y apunta a app.reveniu.com
 *   2. REVENIU_LINK_GROWTH_MONTHLY existe y apunta a app.reveniu.com
 *   3. REVENIU_LINK_ENTERPRISE_MONTHLY existe y apunta a app.reveniu.com
 *
 * Uso: node scripts/test-plan-links.js
 * Exit code 0 si todos los tests pasan, 1 si alguno falla.
 */

const path = require("path");

// Cargar .env desde raiz del proyecto
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// ── Helpers ────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  PASS: ${description}`);
    passed++;
  } else {
    console.error(`  FAIL: ${description}`);
    failed++;
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

console.log("\n=== test-plan-links.js ===\n");

const BASE = process.env.REVENIU_LINK_BASE_MONTHLY;
const GROWTH = process.env.REVENIU_LINK_GROWTH_MONTHLY;
const ENTERPRISE = process.env.REVENIU_LINK_ENTERPRISE_MONTHLY;

const REVENIU_BASE_URL = "https://app.reveniu.com/";

// Test 1: Plan Base
console.log("Test 1: Link Plan Base");
assert("REVENIU_LINK_BASE_MONTHLY existe", !!BASE && BASE.length > 0);
assert(
  "REVENIU_LINK_BASE_MONTHLY apunta a app.reveniu.com",
  !!BASE && BASE.startsWith(REVENIU_BASE_URL)
);

// Test 2: Plan Crecimiento
console.log("\nTest 2: Link Plan Crecimiento");
assert("REVENIU_LINK_GROWTH_MONTHLY existe", !!GROWTH && GROWTH.length > 0);
assert(
  "REVENIU_LINK_GROWTH_MONTHLY apunta a app.reveniu.com",
  !!GROWTH && GROWTH.startsWith(REVENIU_BASE_URL)
);

// Test 3: Plan Enterprise
console.log("\nTest 3: Link Plan Enterprise");
assert("REVENIU_LINK_ENTERPRISE_MONTHLY existe", !!ENTERPRISE && ENTERPRISE.length > 0);
assert(
  "REVENIU_LINK_ENTERPRISE_MONTHLY apunta a app.reveniu.com",
  !!ENTERPRISE && ENTERPRISE.startsWith(REVENIU_BASE_URL)
);

// ── Resultado final ────────────────────────────────────────────────────────────

console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

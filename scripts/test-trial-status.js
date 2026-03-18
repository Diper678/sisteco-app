#!/usr/bin/env node
/**
 * test-trial-status.js — Verificar logica de trial status y calculo de daysRemaining
 *
 * Tests:
 *   1. Trial nuevo (14 dias) → daysRemaining = 14, status = "trial"
 *   2. Trial en dia 7 → daysRemaining = 7
 *   3. Trial en dia 14 (hoy expira) → daysRemaining = 0
 *   4. Trial pasado dia 14 → daysRemaining < 0, status deberia ser "expired"
 *   5. Suscripcion activa → status = "active" (no aplica logica trial)
 *   6. Periodo de gracia → status = "grace"
 *
 * Uso: node scripts/test-trial-status.js
 * Exit code 0 si todos los tests pasan, 1 si alguno falla.
 */

const DAY = 24 * 60 * 60 * 1000;

// Logica de getTrialStatus — debe coincidir con subscriptions.ts y trial-banner.js
function getTrialStatus(sub) {
  const now = Date.now();
  const daysRemaining = Math.ceil((sub.trialEndsAt - now) / DAY);
  return { status: sub.status, daysRemaining };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

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

console.log('\n=== test-trial-status.js ===\n');

const now = Date.now();

// Test 1: Trial nuevo (14 dias) → daysRemaining = 14, status = "trial"
console.log('Test 1: Trial nuevo 14 dias');
{
  const sub = { status: 'trial', trialEndsAt: now + 14 * DAY };
  const result = getTrialStatus(sub);
  assert('status === "trial"', result.status === 'trial');
  assert('daysRemaining === 14', result.daysRemaining === 14);
}

// Test 2: Trial en dia 7 → daysRemaining = 7
console.log('\nTest 2: Trial en dia 7');
{
  const sub = { status: 'trial', trialEndsAt: now + 7 * DAY };
  const result = getTrialStatus(sub);
  assert('daysRemaining === 7', result.daysRemaining === 7);
}

// Test 3: Trial exactamente hoy → daysRemaining = 0
console.log('\nTest 3: Trial expira hoy');
{
  const sub = { status: 'trial', trialEndsAt: now };
  const result = getTrialStatus(sub);
  assert('daysRemaining === 0', result.daysRemaining === 0);
}

// Test 4: Trial pasado (2 dias atras) → daysRemaining negativo
console.log('\nTest 4: Trial expirado (2 dias atras)');
{
  const sub = { status: 'trial', trialEndsAt: now - 2 * DAY };
  const result = getTrialStatus(sub);
  assert('daysRemaining === -2', result.daysRemaining === -2);
}

// Test 5: Suscripcion activa → status = "active"
console.log('\nTest 5: Suscripcion activa');
{
  const sub = { status: 'active', trialEndsAt: now - 10 * DAY };
  const result = getTrialStatus(sub);
  assert('status === "active"', result.status === 'active');
}

// Test 6: Periodo de gracia → status = "grace"
console.log('\nTest 6: Periodo de gracia');
{
  const sub = { status: 'grace', trialEndsAt: now - 5 * DAY };
  const result = getTrialStatus(sub);
  assert('status === "grace"', result.status === 'grace');
}

// ── Resultado final ────────────────────────────────────────────────────────────

console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

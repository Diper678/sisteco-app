#!/usr/bin/env node
/**
 * test-metrics.js — Verificar logica de calculo MRR, churn rate y LTV
 *
 * Tests la misma logica que subscriptions.ts getMetrics (pure functions, sin Convex).
 *
 * Tests:
 *   1. 3 subs activas a $99.990 → MRR = $299.970
 *   2. 2 activas + 1 cancelada → churnRate = 0.333...
 *   3. LTV = avgBilling / churnRate
 *   4. 0 subs activas → MRR = 0, churnRate = 0, LTV = 0
 *   5. Todas activas, 0 canceladas → churnRate = 0, LTV = 0 (evitar division por cero)
 *
 * Uso: node scripts/test-metrics.js
 * Exit code 0 si todos los tests pasan, 1 si alguno falla.
 */

// ── Logica de metricas (debe coincidir con subscriptions.ts getMetrics) ─────────

function calculateMetrics(allSubs) {
  const activeSubs = allSubs.filter((s) => s.status === "active");
  const cancelledSubs = allSubs.filter((s) => s.status === "cancelled");
  const trialSubs = allSubs.filter((s) => s.status === "trial");

  const mrr = activeSubs.reduce((sum, s) => sum + (s.billingAmount ?? 0), 0);
  const activeCount = activeSubs.length;
  const cancelledCount = cancelledSubs.length;
  const trialCount = trialSubs.length;

  const churnRate =
    activeCount > 0 ? cancelledCount / (activeCount + cancelledCount) : 0;
  const avgBilling = activeCount > 0 ? mrr / activeCount : 0;
  const ltv = churnRate > 0 ? avgBilling / churnRate : 0;

  return { mrr, churnRate, ltv, activeCount, cancelledCount, trialCount };
}

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

function assertClose(description, actual, expected, tolerance = 0.001) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) {
    console.log(`  PASS: ${description} (${actual.toFixed(2)} ≈ ${expected.toFixed(2)})`);
    passed++;
  } else {
    console.error(
      `  FAIL: ${description} — expected ${expected.toFixed(2)}, got ${actual.toFixed(2)}`
    );
    failed++;
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

console.log("\n=== test-metrics.js ===\n");

// Test 1: 3 subs activas a $99.990 → MRR = $299.970
console.log("Test 1: MRR con 3 subs activas ($99.990 c/u)");
{
  const subs = [
    { status: "active", billingAmount: 99990 },
    { status: "active", billingAmount: 99990 },
    { status: "active", billingAmount: 99990 },
  ];
  const m = calculateMetrics(subs);
  assert("MRR === 299970", m.mrr === 299970);
  assert("activeCount === 3", m.activeCount === 3);
  assert("churnRate === 0 (no canceladas)", m.churnRate === 0);
  assert("LTV === 0 (churnRate 0, sin division por cero)", m.ltv === 0);
}

// Test 2: 2 activas + 1 cancelada → churnRate = 1/(2+1) = 0.333...
console.log("\nTest 2: churnRate con 2 activas y 1 cancelada");
{
  const subs = [
    { status: "active", billingAmount: 99990 },
    { status: "active", billingAmount: 99990 },
    { status: "cancelled", billingAmount: 99990 },
  ];
  const m = calculateMetrics(subs);
  assert("MRR === 199980 (solo activas)", m.mrr === 199980);
  assertClose("churnRate ≈ 0.333", m.churnRate, 1 / 3, 0.001);
  assert("cancelledCount === 1", m.cancelledCount === 1);
}

// Test 3: LTV = avgBilling / churnRate
console.log("\nTest 3: LTV = avgBillingAmount / churnRate");
{
  const subs = [
    { status: "active", billingAmount: 99990 },
    { status: "cancelled", billingAmount: 0 },
  ];
  const m = calculateMetrics(subs);
  // churnRate = 1 / (1+1) = 0.5
  // avgBilling = 99990 / 1 = 99990
  // LTV = 99990 / 0.5 = 199980
  assertClose("churnRate === 0.5", m.churnRate, 0.5, 0.001);
  assertClose("LTV === 199980", m.ltv, 199980, 0.01);
}

// Test 4: 0 subs activas → MRR = 0, churnRate = 0, LTV = 0
console.log("\nTest 4: Sin subs activas → MRR = 0, churn = 0, LTV = 0");
{
  const subs = [
    { status: "trial", billingAmount: 0 },
    { status: "cancelled", billingAmount: 99990 },
  ];
  const m = calculateMetrics(subs);
  assert("MRR === 0", m.mrr === 0);
  assert("churnRate === 0 (no hay activas para calcular)", m.churnRate === 0);
  assert("LTV === 0", m.ltv === 0);
  assert("activeCount === 0", m.activeCount === 0);
  assert("trialCount === 1", m.trialCount === 1);
}

// Test 5: Todas activas, 0 canceladas → churnRate = 0, LTV = 0 (evitar /0)
console.log("\nTest 5: Todas activas, 0 canceladas → churnRate = 0 (sin division por cero)");
{
  const subs = [
    { status: "active", billingAmount: 249990 },
    { status: "active", billingAmount: 249990 },
  ];
  const m = calculateMetrics(subs);
  assert("MRR === 499980", m.mrr === 499980);
  assert("churnRate === 0", m.churnRate === 0);
  assert("LTV === 0 (no hay churn — no se calcula LTV)", m.ltv === 0);
  assert("cancelledCount === 0", m.cancelledCount === 0);
}

// ── Resultado final ────────────────────────────────────────────────────────────

console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

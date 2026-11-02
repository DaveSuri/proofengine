const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { verifyFile, verifyProofJWT } = require('../packages/solver-api/dist/index.js');

async function runMilestone2Tests() {
  console.log('=== Milestone 2 Verification: @proofengine/solver-api Z3 Solver Pipeline ===\n');

  // Test 1: Mathematically sound invariant test case -> STATUS: PROVEN (UNSAT) + signed proof.jwt
  const soundSource = `
// @proofengine:boundary seats in [1, 100]
// @proofengine:boundary price_per_seat == 100
// @proofengine:boundary days in [0, 30]
// @proofengine:boundary discount_pct in [0, 50]
export function computeSoundProration(seats: number, pricePerSeat: number, days: number, discountPct: number) {
  const grossCents = seats * pricePerSeat * (days / 30);
  const discountCents = grossCents * (discountPct / 100);
  const netCharge = grossCents - discountCents;
  // @proofengine:invariant net_charge >= 0
  // @proofengine:invariant net_charge <= gross_cents
  return netCharge;
}
`;

  const soundOut = await verifyFile({
    filePath: 'sound-proration.ts',
    source: soundSource,
    skipQuota: true,
  });

  assert.equal(soundOut.overallStatus, 'ALL_PROVEN', 'Expected ALL_PROVEN for sound billing code');
  assert.equal(soundOut.provenCount, 2, 'Expected both invariants to be PROVEN');

  const firstProven = soundOut.results[0];
  console.log(`1. Sound Invariant Test: ${firstProven.statusLabel}`);
  assert.equal(firstProven.status, 'PROVEN');
  assert.equal(firstProven.statusLabel, 'STATUS: PROVEN (UNSAT)');
  assert.ok(firstProven.proofJwt, 'Expected signed proofJwt token');

  const decodedJwt = verifyProofJWT(firstProven.proofJwt);
  assert.ok(decodedJwt, 'Expected proofJwt to pass cryptographic HS256 verification');
  assert.equal(decodedJwt.status, 'PROVEN');
  assert.equal(decodedJwt.solver, 'z3');
  console.log(`   Signed proof.jwt verified (jti=${decodedJwt.jti}, token=${firstProven.proofJwt.slice(0, 32)}...)\n`);

  // Test 2: Flawed financial calculation (test/fixtures/proration.ts with 33.3% proration floor drift)
  const flawedPath = path.resolve(__dirname, 'fixtures/proration.ts');
  const flawedSource = fs.readFileSync(flawedPath, 'utf-8');

  const startMs = Date.now();
  const flawedOut = await verifyFile({
    filePath: flawedPath,
    source: flawedSource,
    skipQuota: true,
  });
  const elapsedMs = Date.now() - startMs;

  assert.equal(flawedOut.overallStatus, 'SOME_VIOLATIONS', 'Expected SOME_VIOLATIONS for buggy proration');
  assert.equal(flawedOut.violationCount, 1);

  const vRes = flawedOut.results[0];
  console.log(`2. Flawed Proration Test: ${vRes.statusLabel} (completed in ${elapsedMs}ms)`);
  assert.equal(vRes.status, 'VIOLATION');
  assert.equal(vRes.statusLabel, 'STATUS: VIOLATION (SAT)');
  assert.ok(elapsedMs < 3000, `Expected solver execution < 3000ms, got ${elapsedMs}ms`);
  assert.ok(vRes.counterexampleObject, 'Expected structured counterexample JSON object');
  assert.ok(vRes.counterexampleObject.inputs, 'Expected inputs in counterexample object');
  assert.notEqual(vRes.counterexampleObject.drift, 0, 'Expected non-zero rounding drift in counterexample');

  console.log('   Concrete Counterexample JSON Trace:');
  console.log('   ' + JSON.stringify(vRes.counterexampleObject, null, 2).replace(/\n/g, '\n   '));
  console.log('\n✔ Milestone 2 Verification PASSED (100% assertions succeeded)\n');
  process.exit(0);
}

runMilestone2Tests().catch(err => {
  console.error('Milestone 2 Verification FAILED:', err);
  process.exit(1);
});

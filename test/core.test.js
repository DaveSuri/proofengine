const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseFile, generateAllSMTPrograms, parseAndGenerate } = require('../packages/core/dist/index.js');

console.log('=== Milestone 1 Verification: @proofengine/core AST Parser & SMT-LIB2 Generator ===\n');

const fixturePath = path.resolve(__dirname, 'fixtures/proration.ts');
const source = fs.readFileSync(fixturePath, 'utf-8');

const { parsed, programs } = parseAndGenerate(fixturePath, source);

// 1. Verify invariant & boundary annotations extraction
assert.equal(parsed.invariants.length, 1, 'Expected 1 @proofengine:invariant annotation');
assert.equal(
  parsed.invariants[0].expression,
  'billed_cents == exact_proration_cents',
  'Expected invariant expression to match',
);
assert.equal(parsed.boundaries.length, 3, 'Expected 3 @proofengine:boundary annotations');

// 2. Verify SMT-LIB2 program generation
assert.equal(programs.length, 1, 'Expected 1 SMTProgram generated');
const smt = programs[0].rawSmtLib;
console.log(smt);

assert.ok(smt.includes('(declare-const days Real)'), 'Missing days variable declaration');
assert.ok(smt.includes('(declare-const seats Real)'), 'Missing seats variable declaration');
assert.ok(smt.includes('(declare-const pricePerSeat Real)'), 'Missing pricePerSeat variable declaration');
assert.ok(smt.includes('(declare-const exactProrationCents Real)'), 'Missing exactProrationCents declaration');
assert.ok(smt.includes('(declare-const billedCents Real)'), 'Missing billedCents declaration');
assert.ok(smt.includes('(assert (and (>= days 0) (<= days 30)))'), 'Missing days boundary constraint');
assert.ok(smt.includes('(assert (and (>= seats 1) (<= seats 100)))'), 'Missing seats boundary constraint');
assert.ok(smt.includes('(assert (= pricePerSeat 100))'), 'Missing pricePerSeat boundary constraint');
assert.ok(
  smt.includes('(assert (= perSeatCents (to_real (to_int (* pricePerSeat prorationRatio)))))'),
  'Missing floor equation for perSeatCents',
);
assert.ok(
  smt.includes('(assert (not (= billedCents exactProrationCents)))'),
  'Missing negated target invariant assertion',
);
assert.ok(smt.includes('(check-sat)'), 'Missing (check-sat)');

// 3. Verify control-flow branch (if/else and ternary) translation
const branchSource = `
// @proofengine:boundary amount >= 0
// @proofengine:boundary discount_rate in [0, 0.5]
export function computeTieredTotal(amount: number, discountRate: number): number {
  const effectiveDiscount = amount > 100 ? amount * discountRate : 0;
  let netTotal = amount - effectiveDiscount;
  if (netTotal < 0) {
    netTotal = 0;
  } else {
    netTotal = amount - effectiveDiscount;
  }
  // @proofengine:invariant net_total >= 0
  return netTotal;
}
`;
const branchRes = parseAndGenerate('branch-test.ts', branchSource);
assert.equal(branchRes.parsed.branches.length, 2, 'Expected ternary + if/else branches extracted');
assert.ok(
  branchRes.programs[0].rawSmtLib.includes('(ite (> amount 100)'),
  'Expected ternary translated to SMT-LIB2 (ite ...)',
);

console.log('✔ Milestone 1 Verification PASSED (100% assertions succeeded)\n');

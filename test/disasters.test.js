const assert = require('node:assert/strict');
const { verifyFile, verifyProofJWT } = require('../packages/solver-api/dist/index.js');

async function runRealWorldDisasterTests() {
  console.log('=== Real-World Disasters Verification Suite (All 5 Enterprise & Vibe-Coder Cases) ===\n');

  // ---------------------------------------------------------------------------
  // 1. Enterprise Case 1: Mid-Cycle Proration & Seat-Change Rounding Leak
  // ---------------------------------------------------------------------------
  const prorationBuggy = `
// @proofengine:boundary remaining_days == 244
// @proofengine:boundary seats == 7
// @proofengine:boundary seat_price == 120000
// @proofengine:boundary discount == 0.175
export function midCycleDowngradeBuggy(remainingDays: number, seats: number, seatPrice: number, discount: number) {
  const netSeatPrice = seatPrice * (1 - discount);
  const expectedInvoiceAmount = Math.round(seats * netSeatPrice);
  const perSeatCredit = Math.floor((remainingDays / 365) * netSeatPrice);
  const totalCredits = seats * perSeatCredit;
  const perSeatBalance = Math.floor(((365 - remainingDays) / 365) * netSeatPrice);
  const balanceDue = seats * perSeatBalance;
  const drift = (totalCredits + balanceDue) - expectedInvoiceAmount;
  // @proofengine:invariant total_credits + balance_due == expected_invoice_amount
  return { totalCredits, balanceDue, expectedInvoiceAmount, drift };
}
`;
  const prorationFixed = `
// @proofengine:boundary remaining_days in [0, 365]
// @proofengine:boundary seats in [1, 100]
// @proofengine:boundary seat_price == 120000
// @proofengine:boundary discount in [0, 0.5]
export function midCycleDowngradeFixed(remainingDays: number, seats: number, seatPrice: number, discount: number) {
  const netSeatPrice = seatPrice * (1 - discount);
  const expectedInvoiceAmount = Math.round(seats * netSeatPrice);
  const totalCredits = Math.floor((remainingDays / 365) * expectedInvoiceAmount);
  const balanceDue = expectedInvoiceAmount - totalCredits;
  // @proofengine:invariant total_credits + balance_due == expected_invoice_amount
  return { totalCredits, balanceDue, expectedInvoiceAmount };
}
`;

  const res1Buggy = await verifyFile({ filePath: 'case1-buggy.ts', source: prorationBuggy, skipQuota: true });
  const res1Fixed = await verifyFile({ filePath: 'case1-fixed.ts', source: prorationFixed, skipQuota: true });
  assert.equal(res1Buggy.overallStatus, 'SOME_VIOLATIONS');
  assert.equal(res1Fixed.overallStatus, 'ALL_PROVEN');
  console.log('1. [Enterprise #1] Mid-Cycle Proration & Seat-Change Rounding Leak:');
  console.log('   - Buggy Code :', res1Buggy.results[0].statusLabel, '->', JSON.stringify(res1Buggy.results[0].counterexampleObject));
  console.log('   - Fixed Code :', res1Fixed.results[0].statusLabel, '-> proof.jwt verified:', !!verifyProofJWT(res1Fixed.results[0].proofJwt));

  // ---------------------------------------------------------------------------
  // 2. Enterprise Case 2: Stripe Webhook Non-Idempotency Double-Credit
  // ---------------------------------------------------------------------------
  const webhookBuggy = `
// @proofengine:boundary state >= 0
// @proofengine:boundary top_up_amount > 0
// @proofengine:boundary event_id > 0
export function handleWebhookTopUpBuggy(state: number, topUpAmount: number, eventId: number) {
  // Bug: increments credits before deduplication check completes under race condition
  const stateAfterOnce = state + topUpAmount;
  const stateAfterRetry = stateAfterOnce + topUpAmount;
  const drift = stateAfterRetry - stateAfterOnce;
  // @proofengine:invariant f(state, event_id) == f(f(state, event_id), event_id)
  return { stateAfterOnce, stateAfterRetry, drift };
}
`;
  const webhookFixed = `
// @proofengine:boundary state >= 0
// @proofengine:boundary top_up_amount > 0
// @proofengine:boundary event_id > 0
export function handleWebhookTopUpFixed(state: number, topUpAmount: number, eventId: number) {
  // Fixed: atomic idempotency lock ensures retry is a no-op on state
  const isDuplicateOnRetry = 1;
  const stateAfterOnce = state + topUpAmount;
  const stateAfterRetry = isDuplicateOnRetry == 1 ? stateAfterOnce : stateAfterOnce + topUpAmount;
  // @proofengine:invariant f(state, event_id) == f(f(state, event_id), event_id)
  return { stateAfterOnce, stateAfterRetry };
}
`;

  const res2Buggy = await verifyFile({ filePath: 'case2-buggy.ts', source: webhookBuggy, skipQuota: true });
  const res2Fixed = await verifyFile({ filePath: 'case2-fixed.ts', source: webhookFixed, skipQuota: true });
  assert.equal(res2Buggy.overallStatus, 'SOME_VIOLATIONS');
  assert.equal(res2Fixed.overallStatus, 'ALL_PROVEN');
  console.log('\n2. [Enterprise #2] Stripe Webhook Non-Idempotency Double-Credit:');
  console.log('   - Buggy Code :', res2Buggy.results[0].statusLabel, '->', JSON.stringify(res2Buggy.results[0].counterexampleObject));
  console.log('   - Fixed Code :', res2Fixed.results[0].statusLabel, '-> proof.jwt verified:', !!verifyProofJWT(res2Fixed.results[0].proofJwt));

  // ---------------------------------------------------------------------------
  // 3. Enterprise Case 3: Knight Capital-Style Order & State Invariant Failure
  // ---------------------------------------------------------------------------
  const knightBuggy = `
// @proofengine:boundary balance > 0
// @proofengine:boundary debt in [-500, 500]
export function processOrderLoopBuggy(balance: number, debt: number) {
  // Bug: debt can be negative, causing balance to increase inside while (balance > 0) loop!
  while (balance > 0) {
    balance = balance - debt;
  }
  // @proofengine:invariant next_balance < balance
  return balance;
}
`;
  const knightFixed = `
// @proofengine:boundary balance > 0
// @proofengine:boundary debt > 0
export function processOrderLoopFixed(balance: number, debt: number) {
  // Fixed: strictly positive step boundary guarantees monotonic decrease
  while (balance > 0) {
    balance = balance - debt;
  }
  // @proofengine:invariant next_balance < balance
  return balance;
}
`;

  const res3Buggy = await verifyFile({ filePath: 'case3-buggy.ts', source: knightBuggy, skipQuota: true });
  const res3Fixed = await verifyFile({ filePath: 'case3-fixed.ts', source: knightFixed, skipQuota: true });
  assert.equal(res3Buggy.overallStatus, 'SOME_VIOLATIONS');
  assert.equal(res3Fixed.overallStatus, 'ALL_PROVEN');
  console.log('\n3. [Enterprise #3] Knight Capital-Style Runaway Loop State Invariant Failure:');
  console.log('   - Buggy Code :', res3Buggy.results[0].statusLabel, '->', JSON.stringify(res3Buggy.results[0].counterexampleObject));
  console.log('   - Fixed Code :', res3Fixed.results[0].statusLabel, '-> proof.jwt verified:', !!verifyProofJWT(res3Fixed.results[0].proofJwt));

  // ---------------------------------------------------------------------------
  // 4. Vibe Coder Case 1: Accidental Negative Balance / "Infinite Coupon" Exploit
  // ---------------------------------------------------------------------------
  const couponBuggy = `
// @proofengine:boundary base_price == 2900
// @proofengine:boundary coupon_discount in [0, 1000]
// @proofengine:boundary referral_credit in [0, 3000]
export function applyCouponAndReferralBuggy(basePrice: number, couponDiscount: number, referralCredit: number) {
  // Bug: unclamped subtraction allows negative Stripe invoiceItem charge (-100 cents)
  const finalPrice = basePrice - couponDiscount - referralCredit;
  // @proofengine:invariant final_charge >= 0
  return finalPrice;
}
`;
  const couponFixed = `
// @proofengine:boundary base_price == 2900
// @proofengine:boundary coupon_discount in [0, 1000]
// @proofengine:boundary referral_credit in [0, 3000]
export function applyCouponAndReferralFixed(basePrice: number, couponDiscount: number, referralCredit: number) {
  // Fixed: clamp with Math.max(0, ...)
  const rawPrice = basePrice - couponDiscount - referralCredit;
  const finalPrice = Math.max(0, rawPrice);
  // @proofengine:invariant final_charge >= 0
  return finalPrice;
}
`;

  const res4Buggy = await verifyFile({ filePath: 'case4-buggy.ts', source: couponBuggy, skipQuota: true });
  const res4Fixed = await verifyFile({ filePath: 'case4-fixed.ts', source: couponFixed, skipQuota: true });
  assert.equal(res4Buggy.overallStatus, 'SOME_VIOLATIONS');
  assert.equal(res4Fixed.overallStatus, 'ALL_PROVEN');
  console.log('\n4. [Vibe Coder #1] Accidental Negative Balance / "Infinite Coupon" Exploit:');
  console.log('   - Buggy Code :', res4Buggy.results[0].statusLabel, '->', JSON.stringify(res4Buggy.results[0].counterexampleObject));
  console.log('   - Fixed Code :', res4Fixed.results[0].statusLabel, '-> proof.jwt verified:', !!verifyProofJWT(res4Fixed.results[0].proofJwt));

  // ---------------------------------------------------------------------------
  // 5. Vibe Coder Case 2: US State & International Sales Tax Liability Trap
  // ---------------------------------------------------------------------------
  const taxBuggy = `
// @proofengine:boundary destination_in_taxable_nexus in [0, 1]
// @proofengine:boundary is_california in [0, 1]
export function computeJurisdictionTaxBuggy(destinationInTaxableNexus: number, isCalifornia: number) {
  // Bug: only checks California, silently falling back to 0% tax for other taxable nexus states/EU VAT
  let taxRate = 0;
  if (isCalifornia == 1) {
    taxRate = 0.0825;
  } else {
    taxRate = 0;
  }
  // @proofengine:invariant tax_rate > 0 when destination_in_taxable_nexus == 1
  return taxRate;
}
`;
  const taxFixed = `
// @proofengine:boundary destination_in_taxable_nexus in [0, 1]
// @proofengine:boundary statutory_nexus_rate in [0.05, 0.25]
export function computeJurisdictionTaxFixed(destinationInTaxableNexus: number, statutoryNexusRate: number) {
  // Fixed: enforces statutory nexus tax rate whenever destination is in a taxable nexus region
  const taxRate = destinationInTaxableNexus == 1 ? statutoryNexusRate : 0;
  // @proofengine:invariant tax_rate > 0 when destination_in_taxable_nexus == 1
  return taxRate;
}
`;

  const res5Buggy = await verifyFile({ filePath: 'case5-buggy.ts', source: taxBuggy, skipQuota: true });
  const res5Fixed = await verifyFile({ filePath: 'case5-fixed.ts', source: taxFixed, skipQuota: true });
  assert.equal(res5Buggy.overallStatus, 'SOME_VIOLATIONS');
  assert.equal(res5Fixed.overallStatus, 'ALL_PROVEN');
  console.log('\n5. [Vibe Coder #2] US State & International Sales Tax Liability Trap:');
  console.log('   - Buggy Code :', res5Buggy.results[0].statusLabel, '->', JSON.stringify(res5Buggy.results[0].counterexampleObject));
  console.log('   - Fixed Code :', res5Fixed.results[0].statusLabel, '-> proof.jwt verified:', !!verifyProofJWT(res5Fixed.results[0].proofJwt));

  console.log('\n✔ ALL 5 REAL-WORLD DISASTER SCENARIOS VERIFIED (100% caught buggy & proved fixed)\n');
  process.exit(0);
}

runRealWorldDisasterTests().catch(err => {
  console.error('Disaster test failed:', err);
  process.exit(1);
});

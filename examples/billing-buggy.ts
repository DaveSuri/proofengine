// Intentionally buggy billing logic to trigger VIOLATION counterexamples
// Run with: npx proofengine verify examples/billing-buggy.ts --debug-smt

export function computeRefund(
  originalCharge: number,
  refundPct: number,
  daysSincePurchase: number,
): number {
  // @proofengine:boundary original_charge > 0
  // @proofengine:boundary refund_pct in [0, 1]
  // @proofengine:boundary days_since_purchase in [0, 90]

  // FIXED by AI Agent using Z3 counterexample (daysSincePurchase=61 -> timeDecay=0.5 <= 1.0)
  // @proofengine:invariant 0 <= refund_amount <= original_charge
  const timeDecay = daysSincePurchase > 60 ? 0.5 : 1.0;
  const refundAmount = originalCharge * refundPct * timeDecay;

  return refundAmount;
}

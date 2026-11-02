// Sample billing logic with formal invariants for ProofEngine verification
// Run with: npx proofengine verify examples/billing.ts

import Stripe from '@stripe/stripe-node';

const stripe = new Stripe('sk_test_xxx');

// @proofengine:boundary proration_days in [0, 30]
// @proofengine:boundary seats > 0
// @proofengine:boundary price_per_seat >= 0
// @proofengine:boundary discount_pct in [0, 100]
// @proofengine:boundary tax_rate in [0, 30]
// @proofengine:boundary amount >= 0

export async function computeMonthlyInvoice(
  seats: number,
  pricePerSeat: number,
  prorationDays: number,
  discountPct: number,
  taxRate: number,
): Promise<{ subtotal: number; discount: number; tax: number; totalCharge: number }> {
  // @proofengine:invariant subtotal == seats * price_per_seat
  const subtotal = seats * pricePerSeat;

  // @proofengine:boundary proration_pct in [0, 1]
  const prorationPct = prorationDays / 30;
  const proratedSubtotal = subtotal * (1 - prorationPct);

  // @proofengine:invariant 0 <= discount <= prorated_subtotal
  const discount = proratedSubtotal * (discountPct / 100);

  // @proofengine:invariant tax >= 0
  const afterDiscount = proratedSubtotal - discount;
  const tax = afterDiscount * (taxRate / 100);

  // @proofengine:invariant total_charge == subtotal_prorated - discount + tax
  // @proofengine:invariant total_charge >= 0
  const totalCharge = proratedSubtotal - discount + tax;

  return {
    subtotal: proratedSubtotal,
    discount,
    tax,
    totalCharge,
  };
}

export async function chargeCustomer(customerId: string, amount: number, currency: string = 'usd') {
  // @proofengine:invariant charge_amount >= 0
  const chargeAmount = Math.round(amount * 100);

  const amountToCharge = chargeAmount;

  if (amountToCharge > 0) {
    return stripe.charges.create({
      customer: customerId,
      amount: amountToCharge,
      currency,
    });
  }
  return { id: 'zero_charge_noop', amount: 0, status: 'succeeded' };
}

export function applyCreditsAndDebits(
  startingBalance: number,
  debits: number[],
  credits: number[],
): number {
  const debitSum = debits.reduce((a, b) => a + b, 0);
  const creditSum = credits.reduce((a, b) => a + b, 0);
  // @proofengine:invariant ending_balance == starting + credits - debits
  const endingBalance = startingBalance + creditSum - debitSum;
  return endingBalance;
}

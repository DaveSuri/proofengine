import Stripe from '@stripe/stripe-node';

const stripe = new Stripe('sk_test_xxx');

// @proofengine:boundary remaining_days in [1, 364]
// @proofengine:boundary seats in [2, 100]
// @proofengine:boundary annual_seat_price_cents == 120000
// @proofengine:boundary discount_rate == 0.175

export async function createMidCycleProrationAdjustment(
  customerId: string,
  subscriptionId: string,
  remainingDays: number,
  seats: number,
  annualSeatPriceCents: number,
  discountRate: number,
) {
  const netSeatPriceCents = annualSeatPriceCents * (1 - discountRate);
  const expectedInvoiceAmount = Math.round(seats * netSeatPriceCents);

  // Refactored by AI Agent after consuming ProofEngine Z3 counterexample:
  // Round once on aggregate integer cents and conserve remainder on balanceDue (drift == 0)
  const totalCredits = Math.round((remainingDays / 365) * expectedInvoiceAmount);
  const balanceDue = expectedInvoiceAmount - totalCredits;
  const drift = (totalCredits + balanceDue) - expectedInvoiceAmount;

  // @proofengine:invariant total_credits + balance_due == expected_invoice_amount
  await stripe.invoiceItems.create({
    customer: customerId,
    subscription: subscriptionId,
    amount: -totalCredits,
    currency: 'usd',
  });

  return { totalCredits, balanceDue, expectedInvoiceAmount, drift };
}

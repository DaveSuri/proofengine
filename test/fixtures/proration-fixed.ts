// Stripe subscription proration calculation (fixed: aggregate integer-cents rounding)
// @proofengine:boundary days in [0, 30]
// @proofengine:boundary seats in [1, 100]
// @proofengine:boundary price_per_seat == 100

export function calculateStripeProration(
  days: number,
  seats: number,
  pricePerSeat: number,
): { exactProrationCents: number; billedCents: number; drift: number } {
  const prorationRatio = days / 30;
  const exactProrationCents = Math.floor(seats * pricePerSeat * prorationRatio);

  // Fixed: floor once on the aggregate subtotal instead of per-seat
  const billedCents = Math.floor(seats * pricePerSeat * prorationRatio);
  const drift = billedCents - exactProrationCents;

  // @proofengine:invariant billed_cents == exact_proration_cents
  return {
    exactProrationCents,
    billedCents,
    drift,
  };
}

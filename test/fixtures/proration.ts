// Stripe subscription proration calculation with intentional floating-point rounding drift
// @proofengine:boundary days in [0, 30]
// @proofengine:boundary seats in [1, 100]
// @proofengine:boundary price_per_seat == 100

export function calculateStripeProration(
  days: number,
  seats: number,
  pricePerSeat: number,
): { exactProrationCents: number; billedCents: number; drift: number } {
  // Exact proration across all seats (in cents)
  const prorationRatio = days / 30;
  const exactProrationCents = seats * pricePerSeat * prorationRatio;

  // Intentional bug: per-seat floor rounding before multiplying by seats causes rounding drift
  // e.g. when days = 10 (33.33% proration) and seats = 3, perSeatCents = floor(33.333...) = 33, billed = 99 instead of 100
  const perSeatCents = Math.floor(pricePerSeat * prorationRatio);
  const billedCents = perSeatCents * seats;
  const drift = billedCents - exactProrationCents;

  // @proofengine:invariant billed_cents == exact_proration_cents
  return {
    exactProrationCents,
    billedCents,
    drift,
  };
}

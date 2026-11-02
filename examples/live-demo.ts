// @proofengine:boundary amount >= 0
export function calculateCheckoutTotal(amount: number): number {
  // Fixed: adding processing fee satisfies total >= amount
  // @proofengine:invariant total >= amount
  const total = amount + 1;
  return total;
}

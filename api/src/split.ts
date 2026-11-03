// Splits totalCents over the members, in the given order. Integer math only.
// The first (totalCents % count) members get one extra cent, so the amounts always sum to the total.
// Example: 1000 over 3 members gives 334, 333, 333.
export function splitCents<T>(totalCents: number, members: readonly T[]) {
  const count = members.length
  if (count === 0) {
    throw new Error('Cannot split over zero members')
  }
  const base = Math.floor(totalCents / count)
  const remainder = totalCents % count
  return members.map((member, index) => ({
    member,
    amountCents: base + (index < remainder ? 1 : 0),
  }))
}

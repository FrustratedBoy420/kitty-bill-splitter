import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { splitCents } from '../src/split'
import { type Balance, call, createBill, createHome, type Share } from './helpers'

// Property-based tests: instead of a few hand-picked examples, fast-check generates many random
// inputs and checks that the rules hold for every one. When a rule breaks, it shrinks the input to
// the smallest failing case.

describe('splitCents properties', () => {
  const total = fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER })
  const count = fc.integer({ min: 1, max: 60 })

  it('always sums to the total', () => {
    fc.assert(
      fc.property(total, count, (t, n) => {
        const sum = splitCents(t, Array.from({ length: n })).reduce(
          (acc, s) => acc + s.amountCents,
          0,
        )
        expect(sum).toBe(t)
      }),
      { numRuns: 2000 },
    )
  })

  it('never lets two shares differ by more than one cent', () => {
    fc.assert(
      fc.property(total, count, (t, n) => {
        const amounts = splitCents(t, Array.from({ length: n })).map((s) => s.amountCents)
        expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1)
      }),
      { numRuns: 2000 },
    )
  })

  it('gives the extra cents to the earliest members, in order', () => {
    fc.assert(
      fc.property(total, count, (t, n) => {
        const amounts = splitCents(t, Array.from({ length: n })).map((s) => s.amountCents)
        // Non-increasing, and exactly (t % n) shares carry the extra cent.
        for (let i = 1; i < amounts.length; i++) {
          expect(amounts[i]).toBeLessThanOrEqual(amounts[i - 1] ?? 0)
        }
        const base = Math.floor(t / n)
        expect(amounts.filter((a) => a === base + 1).length).toBe(t % n)
      }),
      { numRuns: 2000 },
    )
  })

  it('only ever produces whole, non-negative cents', () => {
    fc.assert(
      fc.property(total, count, (t, n) => {
        for (const { amountCents } of splitCents(t, Array.from({ length: n }))) {
          expect(Number.isSafeInteger(amountCents) && amountCents >= 0).toBe(true)
        }
      }),
      { numRuns: 2000 },
    )
  })
})

describe('payment properties (real worker, real D1)', () => {
  // Each run: a random bill, then a random burst of parallel pay requests on one share, where
  // requests may reuse keys. Whatever the mix, exactly one key wins, every request carrying the
  // winning key gets 200 with the same paidAt, every other request gets 409, and the share is
  // counted as paid exactly once in the balances.
  it('pays a share exactly once under any burst of parallel requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 2, maxLength: 8 }),
        async (members, totalCents, keyPicks) => {
          const { homeId } = await createHome(Array.from({ length: members }, (_, i) => `M${i}`))
          const bill = await createBill(homeId, totalCents)
          const share = bill.body.shares[0]
          if (!share) throw new Error('bill has no shares')
          const keys = ['k0', 'k1', 'k2', 'k3'].map((k) => `${k}-${crypto.randomUUID()}`)

          const results = await Promise.all(
            keyPicks.map((pick) =>
              call<Share>('POST', `/api/bills/${bill.body.id}/shares/${share.id}/pay`, {
                headers: { 'Idempotency-Key': keys[pick] ?? 'missing' },
              }).then((r) => ({ ...r, key: keys[pick] })),
            ),
          )

          const winners = results.filter((r) => r.status === 200)
          const winningKeys = new Set(winners.map((r) => r.key))
          expect(winningKeys.size).toBe(1)
          expect(new Set(winners.map((r) => r.body.paidAt)).size).toBe(1)
          for (const r of results) {
            expect(r.status).toBe(winningKeys.has(r.key) ? 200 : 409)
          }

          const balances = await call<{ balances: Balance[] }>(
            'GET',
            `/api/homes/${homeId}/balances`,
          )
          const owed = balances.body.balances.reduce((sum, b) => sum + b.outstandingCents, 0)
          expect(owed).toBe(totalCents - share.amountCents)
        },
      ),
      { numRuns: 40 },
    )
  })
})

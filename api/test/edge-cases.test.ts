import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { splitCents } from '../src/split'
import { type Balance, type Bill, call, createBill, createHome, type Share } from './helpers'

function pay(billId: string, shareId: string, key: string) {
  return call<Share>('POST', `/api/bills/${billId}/shares/${shareId}/pay`, {
    headers: { 'Idempotency-Key': key },
  })
}

async function outstanding(homeId: string) {
  const result = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
  return result.body.balances.map((balance) => balance.outstandingCents)
}

async function billWithTwoMembers() {
  const { homeId } = await createHome(['Asha', 'Ben'])
  const bill = await createBill(homeId, 1000)
  const share = bill.body.shares[0]
  if (!share) throw new Error('bill has no shares')
  return { homeId, bill: bill.body, share }
}

describe('splitCents', () => {
  it('gives zero shares when the total is smaller than the member count', () => {
    expect(splitCents(2, ['a', 'b', 'c']).map((s) => s.amountCents)).toEqual([1, 1, 0])
  })

  it('always sums to the total', () => {
    for (let count = 1; count <= 12; count++) {
      for (const total of [1, 7, 99, 100, 101, 999_999]) {
        const members = Array.from({ length: count }, (_, i) => i)
        const sum = splitCents(total, members).reduce((acc, s) => acc + s.amountCents, 0)
        expect(sum).toBe(total)
      }
    }
  })
})

describe('bill edge cases', () => {
  it('creates a bill smaller than the member count', async () => {
    const { homeId } = await createHome(['Asha', 'Ben', 'Chitra'])

    const bill = await createBill(homeId, 2)

    expect(bill.status).toBe(201)
    expect(bill.body.shares.map((share) => share.amountCents)).toEqual([1, 1, 0])
  })

  it.each([Number.MAX_SAFE_INTEGER + 2, '', true, [], {}])(
    'rejects the amount %j',
    async (totalCents) => {
      const { homeId } = await createHome(['Asha'])

      const bill = await call('POST', `/api/homes/${homeId}/bills`, {
        body: { title: 'Rent', totalCents },
      })

      expect(bill.status).toBe(422)
    },
  )

  it('rejects a missing amount and a blank title', async () => {
    const { homeId } = await createHome(['Asha'])

    const noAmount = await call('POST', `/api/homes/${homeId}/bills`, { body: { title: 'Rent' } })
    const blankTitle = await call('POST', `/api/homes/${homeId}/bills`, {
      body: { title: '   ', totalCents: 100 },
    })

    expect(noAmount.status).toBe(422)
    expect(blankTitle.status).toBe(422)
  })

  it('writes nothing when the bill is rejected', async () => {
    const { homeId } = await createHome([])

    await createBill(homeId, 1000)
    const listed = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)

    expect(listed.body.bills).toEqual([])
  })

  it('splits a bill in a large home (shares are inserted in chunks)', async () => {
    const names = Array.from({ length: 45 }, (_, i) => `Member ${i + 1}`)
    const { homeId, members } = await createHome(names)

    const bill = await createBill(homeId, 100_000)

    expect(bill.status).toBe(201)
    expect(bill.body.shares.map((s) => s.memberId)).toEqual(members.map((m) => m.id))
    expect(bill.body.shares.reduce((sum, s) => sum + s.amountCents, 0)).toBe(100_000)
    const listed = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)
    expect(listed.body.bills[0]?.shares).toHaveLength(45)
  })

  it('lists the bills of a home with their shares', async () => {
    const { homeId, bill } = await billWithTwoMembers()

    const listed = await call<{ bills: Bill[] }>('GET', `/api/homes/${homeId}/bills`)

    expect(listed.status).toBe(200)
    expect(listed.body.bills).toEqual([bill])
  })
})

describe('payment edge cases', () => {
  it('pays once when the same key is sent twice at the same time', async () => {
    const { homeId, bill, share } = await billWithTwoMembers()
    const key = crypto.randomUUID()

    const results = await Promise.all([pay(bill.id, share.id, key), pay(bill.id, share.id, key)])

    expect(results.map((r) => r.status)).toEqual([200, 200])
    expect(results[0]?.body.paidAt).toBe(results[1]?.body.paidAt)
    expect(await outstanding(homeId)).toEqual([0, 500])
  })

  it('lets only one of two different keys pay the same share at the same time', async () => {
    const { homeId, bill, share } = await billWithTwoMembers()

    const results = await Promise.all(
      Array.from({ length: 5 }, () => pay(bill.id, share.id, crypto.randomUUID())),
    )

    const statuses = results.map((r) => r.status).sort()
    expect(statuses).toEqual([200, 409, 409, 409, 409])
    expect(await outstanding(homeId)).toEqual([0, 500])
  })

  it('returns 404 when the share belongs to another bill', async () => {
    const first = await billWithTwoMembers()
    const second = await billWithTwoMembers()

    const paid = await pay(second.bill.id, first.share.id, crypto.randomUUID())

    expect(paid.status).toBe(404)
  })

  it('rejects a blank Idempotency-Key', async () => {
    const { bill, share } = await billWithTwoMembers()

    const paid = await pay(bill.id, share.id, '   ')

    expect(paid.status).toBe(400)
  })
})

describe('request edge cases', () => {
  it('answers invalid JSON with a JSON 400', async () => {
    const response = await exports.default.fetch(
      new Request('http://localhost/api/homes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ not json',
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: expect.any(String) })
  })

  it.each([{}, { name: '' }, { name: '  ' }, { name: 42 }, []])(
    'rejects the home %j',
    async (body) => {
      const home = await call<{ error: string }>('POST', '/api/homes', { body })

      expect(home.status).toBe(422)
      expect(home.body.error).toEqual(expect.any(String))
    },
  )

  it('does not expose a list of every home', async () => {
    const result = await call<{ error: string }>('GET', '/api/homes')

    expect(result.status).toBe(404)
  })

  it('answers an unknown route with JSON', async () => {
    const result = await call<{ error: string }>('GET', '/api/nope')

    expect(result.status).toBe(404)
    expect(result.body.error).toEqual(expect.any(String))
  })

  it('returns an empty balance list for a home with no members', async () => {
    const { homeId } = await createHome([])

    const result = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)

    expect(result.status).toBe(200)
    expect(result.body.balances).toEqual([])
  })
})

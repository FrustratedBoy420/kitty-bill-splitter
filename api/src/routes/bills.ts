import { Hono } from 'hono'
import { type Bill, findHome, type Share, type ShareRow, toShare } from '../db'
import { conflict, notFound, unprocessable } from '../errors'
import { splitCents } from '../split'
import {
  readJsonBody,
  requireIdempotencyKey,
  requirePositiveCents,
  requireText,
} from '../validation'

export const bills = new Hono<{ Bindings: Env }>()

const SHARES_PER_INSERT = 20

type BillShareRow = {
  bill_id: string
  title: string
  total_cents: number
  share_id: string
  member_id: string
  amount_cents: number
  paid_at: string | null
}

bills.post('/homes/:homeId/bills', async (c) => {
  const homeId = c.req.param('homeId')
  const body = await readJsonBody(c)
  const title = requireText(body, 'title')
  const totalCents = requirePositiveCents(body, 'totalCents')

  const home = await findHome(c.env.DB, homeId)
  if (!home) throw notFound('Home not found')

  const { results: members } = await c.env.DB.prepare(
    'SELECT id FROM members WHERE home_id = ? ORDER BY seq',
  )
    .bind(homeId)
    .all<{ id: string }>()
  if (members.length === 0) throw unprocessable('Home has no members')

  const billId = crypto.randomUUID()
  const shares: Share[] = splitCents(totalCents, members).map(({ member, amountCents }) => ({
    id: crypto.randomUUID(),
    memberId: member.id,
    amountCents,
    paidAt: null,
  }))

  // Shares go in as multi-row INSERTs of SHARES_PER_INSERT rows each (5 bound values per row,
  // D1 allows 100 per statement), so a big home is a few statements, not one per member.
  // D1 runs a batch as one transaction: the bill and all its shares are written, or none are.
  const shareInserts = []
  for (let i = 0; i < shares.length; i += SHARES_PER_INSERT) {
    const chunk = shares.slice(i, i + SHARES_PER_INSERT)
    shareInserts.push(
      c.env.DB.prepare(
        `INSERT INTO shares (id, home_id, bill_id, member_id, amount_cents) VALUES ${chunk
          .map(() => '(?, ?, ?, ?, ?)')
          .join(', ')}`,
      ).bind(
        ...chunk.flatMap((share) => [share.id, homeId, billId, share.memberId, share.amountCents]),
      ),
    )
  }
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)',
    ).bind(billId, homeId, title, totalCents),
    ...shareInserts,
  ])

  return c.json({ id: billId, homeId, title, totalCents, shares }, 201)
})

bills.get('/homes/:homeId/bills', async (c) => {
  const homeId = c.req.param('homeId')
  const home = await findHome(c.env.DB, homeId)
  if (!home) throw notFound('Home not found')

  // One query, so bills and shares come from the same snapshot. Every bill has at least one
  // share, so an inner join loses no bill. Rows arrive newest bill first, shares in member order.
  const { results: rows } = await c.env.DB.prepare(
    `SELECT b.id AS bill_id, b.title, b.total_cents,
            s.id AS share_id, s.member_id, s.amount_cents, s.paid_at
     FROM bills b
     JOIN shares s ON s.bill_id = b.id
     JOIN members m ON m.id = s.member_id
     WHERE b.home_id = ?
     ORDER BY b.seq DESC, m.seq`,
  )
    .bind(homeId)
    .all<BillShareRow>()

  const byBill = new Map<string, Bill>()
  for (const row of rows) {
    let bill = byBill.get(row.bill_id)
    if (!bill) {
      bill = {
        id: row.bill_id,
        homeId,
        title: row.title,
        totalCents: row.total_cents,
        shares: [],
      }
      byBill.set(row.bill_id, bill)
    }
    bill.shares.push({
      id: row.share_id,
      memberId: row.member_id,
      amountCents: row.amount_cents,
      paidAt: row.paid_at,
    })
  }
  const result = [...byBill.values()]

  return c.json({ bills: result })
})

bills.post('/bills/:billId/shares/:shareId/pay', async (c) => {
  const { billId, shareId } = c.req.param()
  const key = requireIdempotencyKey(c)
  const db = c.env.DB

  // Check and write in one statement. SQLite runs writes one at a time, so when two requests
  // race for the same unpaid share exactly one of them matches `paid_at IS NULL`.
  const paid = await db
    .prepare(
      `UPDATE shares SET paid_at = ?, paid_key = ?
       WHERE id = ? AND bill_id = ? AND paid_at IS NULL
       RETURNING id, bill_id, member_id, amount_cents, paid_at`,
    )
    .bind(new Date().toISOString(), key, shareId, billId)
    .first<ShareRow>()
  if (paid) return c.json(toShare(paid))

  // Nothing was updated: the share is missing, or it is already paid.
  const existing = await db
    .prepare(
      `SELECT id, bill_id, member_id, amount_cents, paid_at, paid_key
       FROM shares WHERE id = ? AND bill_id = ?`,
    )
    .bind(shareId, billId)
    .first<ShareRow & { paid_key: string | null }>()
  if (!existing) {
    const bill = await db.prepare('SELECT 1 FROM bills WHERE id = ?').bind(billId).first()
    throw notFound(bill ? 'Share not found' : 'Bill not found')
  }
  // Same key again: replay the stored result instead of paying twice.
  if (existing.paid_key === key) return c.json(toShare(existing))

  throw conflict('Share is already paid')
})

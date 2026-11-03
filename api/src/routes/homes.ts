import { Hono } from 'hono'
import { findHome, type MemberRow, toMember } from '../db'
import { notFound } from '../errors'
import { readJsonBody, requireText } from '../validation'

export const homes = new Hono<{ Bindings: Env }>()

homes.post('/homes', async (c) => {
  const body = await readJsonBody(c)
  const name = requireText(body, 'name')
  const id = crypto.randomUUID()

  await c.env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(id, name).run()

  return c.json({ id, name }, 201)
})

homes.get('/homes/:homeId', async (c) => {
  const homeId = c.req.param('homeId')
  const home = await findHome(c.env.DB, homeId)
  if (!home) throw notFound('Home not found')

  const { results } = await c.env.DB.prepare(
    'SELECT id, home_id, name FROM members WHERE home_id = ? ORDER BY seq',
  )
    .bind(homeId)
    .all<MemberRow>()

  return c.json({ id: home.id, name: home.name, members: results.map(toMember) })
})

homes.post('/homes/:homeId/members', async (c) => {
  const homeId = c.req.param('homeId')
  const body = await readJsonBody(c)
  const name = requireText(body, 'name')
  const id = crypto.randomUUID()

  // One statement: the row is inserted only if the home exists, so there is no check-then-write gap.
  const result = await c.env.DB.prepare(
    'INSERT INTO members (id, home_id, name) SELECT ?, id, ? FROM homes WHERE id = ?',
  )
    .bind(id, name, homeId)
    .run()
  if (result.meta.changes === 0) throw notFound('Home not found')

  return c.json({ id, homeId, name }, 201)
})

homes.get('/homes/:homeId/balances', async (c) => {
  const homeId = c.req.param('homeId')
  const home = await findHome(c.env.DB, homeId)
  if (!home) throw notFound('Home not found')

  // LEFT JOIN keeps members who owe nothing; COALESCE turns their NULL sum into 0.
  const { results } = await c.env.DB.prepare(
    `SELECT m.id AS memberId, m.name AS name, COALESCE(SUM(s.amount_cents), 0) AS outstandingCents
     FROM members m
     LEFT JOIN shares s ON s.member_id = m.id AND s.paid_at IS NULL
     WHERE m.home_id = ?
     GROUP BY m.seq
     ORDER BY m.seq`,
  )
    .bind(homeId)
    .all<{ memberId: string; name: string; outstandingCents: number }>()

  return c.json({ balances: results })
})

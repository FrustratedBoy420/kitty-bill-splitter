// Row shapes as stored in D1, and mappers to the JSON shapes of the API.

export type HomeRow = { id: string; name: string }
export type MemberRow = { id: string; home_id: string; name: string }
export type ShareRow = {
  id: string
  bill_id: string
  member_id: string
  amount_cents: number
  paid_at: string | null
}

export type Home = { id: string; name: string }
export type Member = { id: string; homeId: string; name: string }
export type Share = { id: string; memberId: string; amountCents: number; paidAt: string | null }
export type Bill = {
  id: string
  homeId: string
  title: string
  totalCents: number
  shares: Share[]
}

export const toMember = (row: MemberRow): Member => ({
  id: row.id,
  homeId: row.home_id,
  name: row.name,
})

export const toShare = (row: ShareRow): Share => ({
  id: row.id,
  memberId: row.member_id,
  amountCents: row.amount_cents,
  paidAt: row.paid_at,
})

export function findHome(db: D1Database, homeId: string) {
  return db.prepare('SELECT id, name FROM homes WHERE id = ?').bind(homeId).first<HomeRow>()
}

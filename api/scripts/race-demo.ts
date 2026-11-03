// Live proof of the two hardest rules, against a running API (pnpm dev):
//   1. Many people press Pay on the same share at the same moment: exactly one wins.
//   2. One person's request is retried many times with the same key: it pays once.
// Run: pnpm demo:race            (defaults to http://localhost:8787)
//      pnpm demo:race -- --url http://localhost:8787 --requests 20

type Share = { id: string; memberId: string; amountCents: number; paidAt: string | null }
type Bill = { id: string; shares: Share[] }
type Balance = { name: string; outstandingCents: number }

const args = process.argv.slice(2)
const option = (name: string, fallback: string) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback
}
const base = option('url', 'http://localhost:8787')
const requests = Number(option('requests', '12'))

async function post<T>(path: string, body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json()) as T }
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${base}/api${path}`)
  return (await response.json()) as T
}

// Integer math only, like the rest of the project.
const money = (cents: number) =>
  `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
const tally = (statuses: number[]) =>
  Object.entries(
    statuses.reduce<Record<string, number>>((acc, s) => {
      acc[s] = (acc[s] ?? 0) + 1
      return acc
    }, {}),
  )
    .map(([status, n]) => `${n} × ${status}`)
    .join(', ')

async function main() {
  console.log(`Race demo against ${base}\n`)

  const home = await post<{ id: string }>('/homes', {
    name: `Race demo ${new Date().toISOString()}`,
  })
  for (const name of ['Asha', 'Ben', 'Chitra']) {
    await post(`/homes/${home.body.id}/members`, { name })
  }
  const bill = await post<Bill>(`/homes/${home.body.id}/bills`, {
    title: 'Electricity',
    totalCents: 1000,
  })
  const [first, second] = bill.body.shares
  if (!first || !second) throw new Error('Bill was not split')
  console.log(
    `Bill $10.00 split 3 ways: ${bill.body.shares.map((s) => money(s.amountCents)).join(' / ')}\n`,
  )

  // 1. Different people, different keys, same instant.
  const crowd = await Promise.all(
    Array.from({ length: requests }, (_, i) =>
      post<Share>(`/bills/${bill.body.id}/shares/${first.id}/pay`, undefined, {
        'Idempotency-Key': `person-${i}-${crypto.randomUUID()}`,
      }),
    ),
  )
  const crowdWins = crowd.filter((r) => r.status === 200).length
  console.log(`1) ${requests} parallel payments of Asha's share, each with its own key`)
  console.log(`   answers: ${tally(crowd.map((r) => r.status))}`)
  console.log(`   ${crowdWins === 1 ? 'PASS' : 'FAIL'}: exactly one payment won\n`)

  // 2. One request retried, same key, same instant.
  const key = crypto.randomUUID()
  const retries = await Promise.all(
    Array.from({ length: requests }, () =>
      post<Share>(`/bills/${bill.body.id}/shares/${second.id}/pay`, undefined, {
        'Idempotency-Key': key,
      }),
    ),
  )
  const paidAts = new Set(retries.map((r) => r.body.paidAt))
  const allOk = retries.every((r) => r.status === 200)
  console.log(`2) ${requests} parallel retries of Ben's payment, all with the same key`)
  console.log(
    `   answers: ${tally(retries.map((r) => r.status))}, distinct paidAt values: ${paidAts.size}`,
  )
  console.log(
    `   ${allOk && paidAts.size === 1 ? 'PASS' : 'FAIL'}: every retry got the same answer\n`,
  )

  // 3. The money still adds up.
  const { balances } = await get<{ balances: Balance[] }>(`/homes/${home.body.id}/balances`)
  const owed = balances.reduce((sum, b) => sum + b.outstandingCents, 0)
  const expected = 1000 - first.amountCents - second.amountCents
  console.log('3) Balances afterwards')
  for (const b of balances) console.log(`   ${b.name.padEnd(8)} ${money(b.outstandingCents)}`)
  console.log(
    `   ${owed === expected ? 'PASS' : 'FAIL'}: ${money(owed)} still owed, each share paid once`,
  )

  if (crowdWins !== 1 || !allOk || paidAts.size !== 1 || owed !== expected) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error(`Could not run the demo. Is the API running (pnpm dev)?\n${String(error)}`)
  process.exitCode = 1
})

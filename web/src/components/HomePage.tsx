import { useEffect, useState } from 'react'
import { type Balance, billsApi, homesApi, type Member } from '../api'
import { formatCents, parseDollars, previewSplit } from '../money'
import { rememberHome } from '../storage'
import { type ResourceHandle, useResource } from '../useResource'
import { AnimatedMoney } from './AnimatedMoney'
import { BillList, type MemberInfo } from './BillList'
import { Avatar, ErrorBox, ResourceView, resultError, Shell, Skeleton, useSubmit } from './ui'

export function HomePage({ homeId }: { homeId: string }) {
  const home = useResource(`home:${homeId}`, (signal) => homesApi.get(homeId, signal))
  const bills = useResource(`bills:${homeId}`, (signal) => billsApi.list(homeId, signal))
  const balances = useResource(`balances:${homeId}`, (signal) => homesApi.balances(homeId, signal))

  const refreshMoney = () => {
    bills.reload()
    balances.reload()
  }

  const name = home.state.status === 'ready' ? home.state.data.name : undefined

  // Opening a home (also from a shared link) adds it to this device's homes list.
  useEffect(() => {
    if (name !== undefined) rememberHome({ id: homeId, name })
  }, [homeId, name])

  if (home.state.status === 'error') {
    return (
      <Shell crumb="Home">
        <div className="title-row">
          <h1>Home unavailable</h1>
        </div>
        <ErrorBox message={home.state.error} onRetry={home.reload} />
      </Shell>
    )
  }

  const members = home.state.status === 'ready' ? home.state.data.members : []
  const memberInfo = new Map<string, MemberInfo>(
    members.map((m, index) => [m.id, { name: m.name, index }]),
  )

  return (
    <Shell crumb={name ?? '…'}>
      <div className="title-row">
        <div>
          <h1>{name ?? <Skeleton width={220} height={34} />}</h1>
          <p>
            {balances.state.status === 'ready' && home.state.status === 'ready' ? (
              finding(balances.state.data.balances, members.length)
            ) : (
              <Skeleton width={320} height={20} />
            )}
          </p>
        </div>
      </div>

      <div className="layout">
        <div className="stack">
          {home.state.status === 'ready' ? (
            <NewBill homeId={homeId} members={members} onAdded={refreshMoney} />
          ) : (
            <section className="panel" aria-busy="true">
              <Skeleton width={120} height={26} />
              <div style={{ marginTop: 16 }}>
                <Skeleton width="100%" height={40} />
              </div>
            </section>
          )}

          <div className="section-head">
            <h2>Bills</h2>
            {bills.state.status === 'ready' && bills.state.data.bills.length > 0 && (
              <span className="muted num">
                {bills.state.data.bills.length}{' '}
                {bills.state.data.bills.length === 1 ? 'bill' : 'bills'}
              </span>
            )}
          </div>
          <ResourceView resource={bills.state} onRetry={bills.reload} loading={<BillSkeleton />}>
            {({ bills: list }) => (
              <BillList bills={list} members={memberInfo} onChanged={refreshMoney} />
            )}
          </ResourceView>
        </div>

        <aside className="aside">
          <WhoOwes
            homeId={homeId}
            balances={balances}
            billCount={bills.state.status === 'ready' ? bills.state.data.bills.length : null}
            onMemberAdded={() => {
              home.reload()
              balances.reload()
            }}
          />
        </aside>
      </div>
    </Shell>
  )
}

// The line under the title answers the screen's question in words.
function finding(balances: Balance[], memberCount: number): string {
  if (memberCount === 0) return 'Add your flatmates, then split the first bill.'
  const owing = balances.filter((b) => b.outstandingCents > 0)
  if (owing.length === 0) return 'Everyone is square.'
  const total = owing.reduce((sum, b) => sum + b.outstandingCents, 0)
  if (owing.length === 1) return `${owing[0]?.name} still owes ${formatCents(total)}.`
  // With several people owing, the useful fact is who owes the most.
  const most = owing.reduce((a, b) => (b.outstandingCents > a.outstandingCents ? b : a))
  return `${owing.length} flatmates still owe ${formatCents(total)}. ${most.name} owes the most, ${formatCents(most.outstandingCents)}.`
}

function WhoOwes({
  homeId,
  balances,
  billCount,
  onMemberAdded,
}: {
  homeId: string
  balances: ResourceHandle<{ balances: Balance[] }>
  billCount: number | null
  onMemberAdded: () => void
}) {
  const [name, setName] = useState('')
  const form = useSubmit(async () => {
    const result = await homesApi.addMember(homeId, name)
    if (result.ok) {
      setName('')
      onMemberAdded()
    }
    return resultError(result)
  })

  return (
    <section className="panel" aria-labelledby="who-owes">
      <div className="panel-head">
        <h2 id="who-owes">Who owes what</h2>
      </div>
      <ResourceView resource={balances.state} onRetry={balances.reload} loading={<OwedSkeleton />}>
        {({ balances: list }) => {
          const total = list.reduce((sum, b) => sum + b.outstandingCents, 0)
          if (list.length === 0) {
            return <p className="empty">Nobody lives here yet. Add the first flatmate below.</p>
          }
          return (
            <>
              <p className="owed-label">Still owed</p>
              <AnimatedMoney cents={total} className="owed-total num" />
              {billCount !== null && (
                <p className="owed-note">
                  Across {billCount} {billCount === 1 ? 'bill' : 'bills'}, {list.length}{' '}
                  {list.length === 1 ? 'flatmate' : 'flatmates'}
                </p>
              )}
              <ul className="people">
                {list.map((b, index) => (
                  <li key={b.memberId} className="person">
                    <Avatar name={b.name} index={index} />
                    <span>{b.name}</span>
                    {b.outstandingCents > 0 ? (
                      <AnimatedMoney cents={b.outstandingCents} className="person-amount num" />
                    ) : (
                      <span className="person-amount zero num">$0.00</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )
        }}
      </ResourceView>

      <form className="add-person" onSubmit={form.onSubmit}>
        <input
          className="input"
          aria-label="Flatmate name"
          placeholder="Add a flatmate"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          required
        />
        <button type="submit" className="btn btn-ghost" disabled={form.pending}>
          {form.pending ? 'Adding…' : 'Add'}
        </button>
      </form>
      {form.error && (
        <div className="form-error">
          <ErrorBox message={form.error} />
        </div>
      )}
    </section>
  )
}

function NewBill({
  homeId,
  members,
  onAdded,
}: {
  homeId: string
  members: Member[]
  onAdded: () => void
}) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const cents = parseDollars(amount)
  const hasMembers = members.length > 0

  const form = useSubmit(async () => {
    if (cents === null) return 'Enter an amount above zero, like 12.50.'
    const result = await billsApi.create(homeId, title, cents)
    if (result.ok) {
      setTitle('')
      setAmount('')
      onAdded()
    }
    return resultError(result)
  })

  const shares = cents === null ? [] : previewSplit(cents, members.length)

  return (
    <section className="panel" aria-labelledby="new-bill">
      <div className="panel-head">
        <h2 id="new-bill">New bill</h2>
      </div>
      <form onSubmit={form.onSubmit}>
        <div className="composer-fields">
          <div className="field">
            <label htmlFor="bill-title">What for</label>
            <input
              id="bill-title"
              className="input"
              placeholder="Electricity, October"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              required
              disabled={!hasMembers}
            />
          </div>
          <div className="field">
            <label htmlFor="bill-amount">Amount</label>
            <div className="input-money">
              <span>$</span>
              <input
                id="bill-amount"
                className="input"
                placeholder="0.00"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
                disabled={!hasMembers}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={form.pending || !hasMembers}>
            {form.pending ? 'Adding…' : 'Add bill'}
          </button>
        </div>

        {/* The live split: what each flatmate will owe, before the bill is sent. */}
        <div className="preview" aria-live="polite">
          {!hasMembers
            ? 'Add a flatmate first. Every bill is split between everyone in the home.'
            : shares.length === 0
              ? `Splits between ${members.length} ${members.length === 1 ? 'flatmate' : 'flatmates'}, extra cents to whoever joined first.`
              : members.map((member, index) => (
                  <span key={member.id} className="preview-item">
                    <Avatar name={member.name} index={index} size="small" />
                    {member.name}
                    <span className="num">{formatCents(shares[index] ?? 0)}</span>
                  </span>
                ))}
        </div>
        {form.error && (
          <div className="form-error">
            <ErrorBox message={form.error} />
          </div>
        )}
      </form>
    </section>
  )
}

function BillSkeleton() {
  return (
    <div className="panel" role="status" aria-busy="true" aria-label="Loading bills">
      <div className="bill-head">
        <Skeleton width={160} height={24} />
        <Skeleton width={80} height={26} />
      </div>
      <div style={{ marginTop: 8 }}>
        <Skeleton width={220} height={18} />
      </div>
      <div style={{ margin: '16px 0 8px' }}>
        <Skeleton width="100%" height={8} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="share">
          <Skeleton width={32} height={32} />
          <Skeleton width={90} height={18} />
          <Skeleton width={56} height={18} />
          <span className="share-action">
            <Skeleton width={96} height={40} />
          </span>
        </div>
      ))}
    </div>
  )
}

function OwedSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading balances">
      <Skeleton width={80} height={20} />
      <div style={{ marginTop: 6 }}>
        <Skeleton width={140} height={38} />
      </div>
      <ul className="people">
        {[0, 1, 2].map((i) => (
          <li key={i} className="person">
            <Skeleton width={32} height={32} />
            <Skeleton width={90} height={18} />
            <Skeleton width={56} height={18} />
          </li>
        ))}
      </ul>
    </div>
  )
}

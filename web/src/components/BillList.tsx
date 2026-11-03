import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { type Bill, billsApi, type Share } from '../api'
import { formatCents, formatPaidAt } from '../money'
import { forgetPayKey, payKeyFor } from '../storage'
import { PayButton, type PayStatus } from './PayButton'
import { SplitStrip } from './SplitStrip'
import { Avatar } from './ui'

export type MemberInfo = { name: string; index: number }

type Props = {
  bills: Bill[]
  members: Map<string, MemberInfo>
  onChanged: () => void
}

export function BillList({ bills, members, onChanged }: Props) {
  if (bills.length === 0) {
    return <p className="empty">No bills yet. New bills land here, newest first.</p>
  }

  return (
    <ul className="bills">
      {/* initial={false}: bills on screen at load stay still; only a new bill slides in. */}
      <AnimatePresence initial={false}>
        {bills.map((bill) => (
          <motion.li
            key={bill.id}
            layout
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <BillCard bill={bill} members={members} onChanged={onChanged} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

function BillCard({
  bill,
  members,
  onChanged,
}: {
  bill: Bill
  members: Map<string, MemberInfo>
  onChanged: () => void
}) {
  const paidCount = bill.shares.filter((s) => s.paidAt !== null).length
  const settled = paidCount === bill.shares.length
  const leftCents = bill.shares.reduce((sum, s) => sum + (s.paidAt ? 0 : s.amountCents), 0)
  const status = settled
    ? 'Settled, everyone paid'
    : `${paidCount} of ${bill.shares.length} paid · ${formatCents(leftCents)} left`

  return (
    <article className="panel" aria-labelledby={`bill-${bill.id}`}>
      <div className="bill-head">
        <h3 id={`bill-${bill.id}`}>{bill.title}</h3>
        <span className="bill-total num">{formatCents(bill.totalCents)}</span>
      </div>
      <p className="bill-sub">
        Split {bill.shares.length} {bill.shares.length === 1 ? 'way' : 'ways'} · {status}
      </p>
      <SplitStrip shares={bill.shares} totalCents={bill.totalCents} />
      {/* A settled bill needs no rows: the full strip and "Settled" say it all. */}
      {!settled && (
        <ul className="shares">
          {bill.shares.map((share) => {
            const member = members.get(share.memberId)
            return (
              <ShareRow
                key={share.id}
                billId={bill.id}
                share={share}
                name={member?.name ?? 'Former flatmate'}
                index={member?.index ?? 0}
                onChanged={onChanged}
              />
            )
          })}
        </ul>
      )}
    </article>
  )
}

type ShareRowProps = {
  billId: string
  share: Share
  name: string
  index: number
  onChanged: () => void
}

function ShareRow({ billId, share, name, index, onChanged }: ShareRowProps) {
  const [status, setStatus] = useState<PayStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  // Set only from a 200 answer. There is no optimistic update, so a failed payment stays unpaid.
  const [paidAt, setPaidAt] = useState(share.paidAt)
  const shownPaidAt = paidAt ?? share.paidAt

  async function pay() {
    if (status === 'paying') return
    // One Idempotency-Key per share until the payment is confirmed (kept across reloads). A retry
    // after a timeout reuses it, so a payment that did reach the server is replayed, not repeated.
    const key = payKeyFor(share.id)
    setStatus('paying')
    setError(null)
    const result = await billsApi.pay(billId, share.id, key)

    if (result.ok) {
      forgetPayKey(share.id)
      setPaidAt(result.data.paidAt)
      setStatus('idle')
      onChanged()
      return
    }
    setStatus('failed')
    if (result.status === 409) {
      // Paid by a different request. Refresh to show who paid and when.
      forgetPayKey(share.id)
      setError('This share was already paid.')
      onChanged()
    } else if (result.status === 0) {
      // No answer: the payment may have gone through. Never claim it did not.
      setError("We couldn't confirm this payment. Trying again is safe: it can't charge twice.")
    } else {
      setError(`Not paid. ${result.error}`)
    }
  }

  return (
    <li className="share">
      <Avatar name={name} index={index} />
      <span className="share-name">{name}</span>
      <span className="share-amount num">{formatCents(share.amountCents)}</span>
      <span className="share-action">
        <PayButton
          status={status}
          paidLabel={shownPaidAt ? formatPaidAt(shownPaidAt) : null}
          onPay={pay}
          label={`Pay ${formatCents(share.amountCents)} for ${name}`}
        />
      </span>
      {error && !shownPaidAt && (
        <p className="share-error" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

import { motion } from 'motion/react'
import { useRef } from 'react'
import type { Share } from '../api'

// The bill as its shares: one segment per flatmate, as wide as their share, filled in cobalt once
// paid. Read at a glance: how much of this bill is still out.
export function SplitStrip({ shares, totalCents }: { shares: Share[]; totalCents: number }) {
  return (
    <div
      className="split"
      role="img"
      aria-label={`${shares.filter((s) => s.paidAt).length} of ${shares.length} shares paid`}
    >
      {shares.map((share) => (
        <span
          key={share.id}
          className="split-seg"
          style={{ flexGrow: totalCents > 0 ? share.amountCents : 1, flexBasis: 0 }}
        >
          <Fill paid={share.paidAt !== null} />
        </span>
      ))}
    </div>
  )
}

// Grows from the left when a share is paid. A share already paid on first render is drawn full,
// so loading the page does not replay old payments.
function Fill({ paid }: { paid: boolean }) {
  const paidOnMount = useRef(paid)
  if (!paid) return null
  return (
    <motion.span
      className="split-fill"
      initial={paidOnMount.current ? false : { scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    />
  )
}

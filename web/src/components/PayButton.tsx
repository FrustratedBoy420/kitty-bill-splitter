import { AnimatePresence, motion } from 'motion/react'
import { CheckIcon } from './ui'

export type PayStatus = 'idle' | 'paying' | 'failed'

// One control that morphs in place: Pay → Paying → (Paid pill | back to Pay with a shake).
// Pattern after 21st.dev's "MorphStatusButton" (radiumcoders), rebuilt on Motion with the app's
// tokens, because 21st.dev installs need an account API key. The label swaps inside a fixed
// min-width, so the row never shifts.
export function PayButton({
  status,
  paidLabel,
  onPay,
  label,
}: {
  status: PayStatus
  paidLabel: string | null
  onPay: () => void
  label: string
}) {
  if (paidLabel) {
    return (
      <motion.span
        className="pill-paid"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        <CheckIcon />
        {paidLabel}
      </motion.span>
    )
  }

  const paying = status === 'paying'
  return (
    <motion.button
      type="button"
      className="btn btn-ghost pay"
      onClick={onPay}
      disabled={paying}
      aria-label={label}
      aria-busy={paying}
      animate={status === 'failed' ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.36 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={paying ? 'paying' : 'pay'}
          className="pay-label"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.14 }}
        >
          {paying ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Paying
            </>
          ) : status === 'failed' ? (
            'Try again'
          ) : (
            'Pay'
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

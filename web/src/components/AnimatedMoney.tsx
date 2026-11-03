import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { formatCents } from '../money'

// A money figure that eases in when its value changes, so a payment visibly moves the total.
// Keyed by value: a new value remounts the span and plays the change. Nothing animates on the
// first render, so loading the page moves nothing.
export function AnimatedMoney({ cents, className }: { cents: number; className?: string }) {
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
  }, [])
  return (
    <motion.span
      key={cents}
      className={className}
      initial={mounted.current ? { opacity: 0, y: -6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {formatCents(cents)}
    </motion.span>
  )
}

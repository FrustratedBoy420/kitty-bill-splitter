// Money helpers. Cents stay integers; dollars are only ever strings for display and input.

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const rest = String(abs % 100).padStart(2, '0')
  return `${sign}$${dollars.toLocaleString('en-US')}.${rest}`
}

// Parses "12", "12.5" or "12.50" into 1250 with string math, so no float rounding is involved.
// Returns null for anything else, including zero.
export function parseDollars(input: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim())
  if (!match) return null
  const whole = match[1] ?? ''
  const fraction = (match[2] ?? '').padEnd(2, '0')
  const cents = Number(whole) * 100 + Number(fraction)
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

// Same rule as the API (api/src/split.ts), used only to preview a bill before it is sent.
// The API stays the source of truth: the page shows the shares the API returns.
export function previewSplit(totalCents: number, count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(totalCents / count)
  const remainder = totalCents % count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}

// "Paid 17:54" today, "Paid 3 Nov" on another day.
export function formatPaidAt(iso: string, now = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Paid'
  const sameDay = date.toDateString() === now.toDateString()
  const text = sameDay
    ? date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `Paid ${text}`
}

// Small browser-storage helpers. Storage can be full, disabled or hold old data, so every read is
// checked and every failure falls back to "nothing stored".
import type { Home } from './api'
import { arrayOf, isHome } from './guards'

// Homes this browser has created or opened. The API deliberately has no "list every home"
// endpoint: without accounts it would show every household to anyone.
const HOMES_KEY = 'kitty.homes'

export function knownHomes(): Home[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(HOMES_KEY) ?? '[]')
    return arrayOf(isHome)(value) ? value : []
  } catch {
    return []
  }
}

// Adds or renames a home and moves it to the top (most recent first).
export function rememberHome(home: Home): void {
  const rest = knownHomes().filter((h) => h.id !== home.id)
  try {
    localStorage.setItem(HOMES_KEY, JSON.stringify([{ id: home.id, name: home.name }, ...rest]))
  } catch {
    // Storage unavailable: the home still works through its link.
  }
}

// Idempotency keys of payments that have not been confirmed yet, per share. Kept in
// sessionStorage so a retry after a page reload reuses the same key and gets the stored answer
// (200) instead of a confusing 409.
const KEYS_KEY = 'kitty.payKeys'

function readKeys(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(KEYS_KEY) ?? '{}')
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
    const keys: Record<string, string> = {}
    for (const [shareId, key] of Object.entries(value)) {
      if (typeof key === 'string') keys[shareId] = key
    }
    return keys
  } catch {
    return {}
  }
}

function writeKeys(keys: Record<string, string>): void {
  try {
    sessionStorage.setItem(KEYS_KEY, JSON.stringify(keys))
  } catch {
    // Storage unavailable: keys live only as long as this call.
  }
}

export function payKeyFor(shareId: string): string {
  const keys = readKeys()
  const existing = keys[shareId]
  if (existing) return existing
  const key = crypto.randomUUID()
  writeKeys({ ...keys, [shareId]: key })
  return key
}

export function forgetPayKey(shareId: string): void {
  const { [shareId]: _done, ...rest } = readKeys()
  writeKeys(rest)
}

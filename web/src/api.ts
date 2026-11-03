// Typed client for the bill splitter API. `api()` never throws: every failure (HTTP error,
// network error, timeout, non-JSON body, wrong shape) comes back as `{ ok: false, error }`.

import {
  arrayOf,
  type Guard,
  isBalance,
  isBill,
  isHome,
  isHomeDetails,
  isMember,
  isShare,
  wrapped,
} from './guards'

export type Home = { id: string; name: string }
export type Member = { id: string; homeId: string; name: string }
export type HomeDetails = Home & { members: Member[] }
export type Share = { id: string; memberId: string; amountCents: number; paidAt: string | null }
export type Bill = {
  id: string
  homeId: string
  title: string
  totalCents: number
  shares: Share[]
}
export type Balance = { memberId: string; name: string; outstandingCents: number }

// status 0 means no answer arrived (offline or timed out): the request may or may not have run.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

const TIMEOUT_MS = 10_000

type RequestOptions = {
  method?: 'GET' | 'POST'
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

export async function api<T>(
  path: string,
  guard: Guard<T>,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...options.headers },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    })
  } catch {
    const error = timeout.aborted
      ? 'The server took too long to answer.'
      : 'Could not reach the server. Check your connection.'
    return { ok: false, status: 0, error }
  }

  const body = await readJson(response)
  if (!response.ok) {
    return { ok: false, status: response.status, error: errorMessage(body, response.status) }
  }
  // The guard proves the shape, so no cast is needed.
  if (!guard(body)) {
    return { ok: false, status: response.status, error: 'The server sent an unreadable answer.' }
  }
  return { ok: true, data: body }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    return undefined
  }
}

function errorMessage(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const { error } = body
    if (typeof error === 'string' && error.length > 0) return error
  }
  return status >= 500
    ? 'Something went wrong on the server. Try again.'
    : `Request failed (${status})`
}

export const homesApi = {
  create: (name: string) => api('/homes', isHome, { method: 'POST', body: { name } }),
  get: (homeId: string, signal?: AbortSignal) =>
    api(`/homes/${encodeURIComponent(homeId)}`, isHomeDetails, { signal }),
  addMember: (homeId: string, name: string) =>
    api(`/homes/${encodeURIComponent(homeId)}/members`, isMember, {
      method: 'POST',
      body: { name },
    }),
  balances: (homeId: string, signal?: AbortSignal) =>
    api(`/homes/${encodeURIComponent(homeId)}/balances`, wrapped('balances', arrayOf(isBalance)), {
      signal,
    }),
}

export const billsApi = {
  list: (homeId: string, signal?: AbortSignal) =>
    api(`/homes/${encodeURIComponent(homeId)}/bills`, wrapped('bills', arrayOf(isBill)), {
      signal,
    }),
  create: (homeId: string, title: string, totalCents: number) =>
    api(`/homes/${encodeURIComponent(homeId)}/bills`, isBill, {
      method: 'POST',
      body: { title, totalCents },
    }),
  pay: (billId: string, shareId: string, idempotencyKey: string) =>
    api(`/bills/${encodeURIComponent(billId)}/shares/${encodeURIComponent(shareId)}/pay`, isShare, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
}

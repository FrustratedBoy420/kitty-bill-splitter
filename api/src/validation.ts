import type { Context } from 'hono'
import { badRequest, unprocessable } from './errors'

const MAX_TEXT_LENGTH = 100
const MAX_IDEMPOTENCY_KEY_LENGTH = 255

// Unparseable JSON is a 400. A JSON value with the wrong shape is a 422 (see requireObject).
export async function readJsonBody(c: Context): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await c.req.json<unknown>()
  } catch {
    throw badRequest('Request body must be valid JSON')
  }
  return requireObject(body)
}

function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw unprocessable('Request body must be a JSON object')
  }
  return value as Record<string, unknown>
}

export function requireText(body: Record<string, unknown>, field: string): string {
  const value = body[field]
  if (typeof value !== 'string') {
    throw unprocessable(`${field} must be a string`)
  }
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_TEXT_LENGTH) {
    throw unprocessable(`${field} must be 1 to ${MAX_TEXT_LENGTH} characters`)
  }
  return trimmed
}

// No coercion: "1000", 10.5, 0, -1, null and NaN are all rejected.
export function requirePositiveCents(body: Record<string, unknown>, field: string): number {
  const value = body[field]
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw unprocessable(`${field} must be a positive whole number of cents`)
  }
  return value
}

export function requireIdempotencyKey(c: Context): string {
  const key = c.req.header('Idempotency-Key')?.trim()
  if (!key) {
    throw badRequest('Idempotency-Key header is required')
  }
  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw badRequest(`Idempotency-Key must be at most ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`)
  }
  return key
}

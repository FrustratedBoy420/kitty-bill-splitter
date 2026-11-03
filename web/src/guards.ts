// Runtime checks for API answers. The response body arrives as `unknown`; a guard proves its
// shape before the page uses it, so a wrong answer becomes an error state instead of a crash or a
// silent `as` cast.
import type { Balance, Bill, Home, HomeDetails, Member, Share } from './api'

export type Guard<T> = (value: unknown) => value is T

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string'
const isCents = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)

export const arrayOf =
  <T>(item: Guard<T>): Guard<T[]> =>
  (v: unknown): v is T[] =>
    Array.isArray(v) && v.every(item)

// `{ [key]: T }`, for list answers such as `{ bills: [...] }`.
export const wrapped =
  <K extends string, T>(key: K, inner: Guard<T>): Guard<Record<K, T>> =>
  (v: unknown): v is Record<K, T> =>
    isObject(v) && inner(v[key])

export const isHome: Guard<Home> = (v: unknown): v is Home =>
  isObject(v) && isString(v.id) && isString(v.name)

export const isMember: Guard<Member> = (v: unknown): v is Member =>
  isObject(v) && isString(v.id) && isString(v.homeId) && isString(v.name)

export const isHomeDetails: Guard<HomeDetails> = (v: unknown): v is HomeDetails =>
  isObject(v) && isString(v.id) && isString(v.name) && arrayOf(isMember)(v.members)

export const isShare: Guard<Share> = (v: unknown): v is Share =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.memberId) &&
  isCents(v.amountCents) &&
  (v.paidAt === null || isString(v.paidAt))

export const isBill: Guard<Bill> = (v: unknown): v is Bill =>
  isObject(v) &&
  isString(v.id) &&
  isString(v.homeId) &&
  isString(v.title) &&
  isCents(v.totalCents) &&
  arrayOf(isShare)(v.shares)

export const isBalance: Guard<Balance> = (v: unknown): v is Balance =>
  isObject(v) && isString(v.memberId) && isString(v.name) && isCents(v.outstandingCents)

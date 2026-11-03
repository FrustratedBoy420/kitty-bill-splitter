import { Link } from '@tanstack/react-router'
import { type FormEvent, type ReactNode, useState } from 'react'
import type { ApiResult } from '../api'
import { initialOf, tintFor } from '../people'
import type { Resource } from '../useResource'

// The product mark: a coin cut into three unequal shares, one of them paid.
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="var(--accent-soft)" />
      <path d="M12 12 L12 2 A10 10 0 0 1 21.5 15 Z" fill="var(--accent)" />
      <path d="M12 12 L21.5 15 M12 12 L4.5 18.6" stroke="#fff" strokeWidth="1.5" />
    </svg>
  )
}

// No sidebar: Kitty has two places, the homes list and one home, so a bar with a breadcrumb is
// all the navigation it needs.
export function Shell({ crumb, children }: { crumb?: string; children: ReactNode }) {
  return (
    <>
      <header className="bar">
        <Link to="/" search={{}} className="brand">
          <Mark />
          Kitty
        </Link>
        <span className="crumb-sep" aria-hidden="true">
          /
        </span>
        {crumb ? (
          <>
            <Link to="/" search={{}} className="crumb">
              Homes
            </Link>
            <span className="crumb-sep" aria-hidden="true">
              /
            </span>
            <span className="crumb" aria-current="page">
              {crumb}
            </span>
          </>
        ) : (
          <span className="crumb" aria-current="page">
            Homes
          </span>
        )}
      </header>
      <main className="canvas">{children}</main>
    </>
  )
}

export function Avatar({ name, index, size }: { name: string; index: number; size?: 'small' }) {
  const tint = tintFor(index)
  return (
    <span
      className={size === 'small' ? 'avatar small' : 'avatar'}
      style={{ background: tint.bg, color: tint.ink }}
      aria-hidden="true"
    >
      {initialOf(name)}
    </span>
  )
}

export function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8.5 6.5 12 13 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// A failed block keeps its frame: one sentence on what failed, and Retry.
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="text-btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

// A grey bar at the real size of the value it stands for. No shimmer.
export function Skeleton({ width, height = 16 }: { width: number | string; height?: number }) {
  return <span className="sk" style={{ width, height }} />
}

// Renders the loading and error states of a resource, and the children once data is ready.
export function ResourceView<T>({
  resource,
  onRetry,
  loading,
  children,
}: {
  resource: Resource<T>
  onRetry: () => void
  loading: ReactNode
  children: (data: T) => ReactNode
}) {
  if (resource.status === 'loading') return <>{loading}</>
  if (resource.status === 'error') return <ErrorBox message={resource.error} onRetry={onRetry} />
  return <>{children(resource.data)}</>
}

// Form submit with a pending state and an inline error. `submit` returns an error message or null.
export function useSubmit(submit: () => Promise<string | null>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    const message = await submit()
    setError(message)
    setPending(false)
  }

  return { pending, error, onSubmit }
}

export function resultError<T>(result: ApiResult<T>): string | null {
  return result.ok ? null : result.error
}

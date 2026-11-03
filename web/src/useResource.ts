import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiResult } from './api'

export type Resource<T> =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: T }

export type ResourceHandle<T> = { state: Resource<T>; reload: () => void }

// Loads data on mount and whenever `key` changes. `reload()` refreshes in the background and keeps
// the current data on screen. Stale answers are dropped via AbortController, so a slow old request
// can never overwrite a newer one.
export function useResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<ApiResult<T>>,
): ResourceHandle<T> {
  const [state, setState] = useState<Resource<T>>({ status: 'loading' })
  const [version, setVersion] = useState(0)
  const loadedKey = useRef<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `load` is a new function every render; `key` and `version` decide when to load.
  useEffect(() => {
    const controller = new AbortController()
    if (loadedKey.current !== key) {
      loadedKey.current = key
      setState({ status: 'loading' })
    }
    load(controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setState(
        result.ok
          ? { status: 'ready', data: result.data }
          : { status: 'error', error: result.error },
      )
    })
    return () => controller.abort()
  }, [key, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { state, reload }
}

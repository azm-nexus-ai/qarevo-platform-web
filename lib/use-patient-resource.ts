'use client'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ApiError, apiGet, getApiErrorDetail } from '@/lib/api'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'

const subscribeAccount = (changed: () => void) => {
  window.addEventListener(ACCOUNT_CHANGED, changed)
  window.addEventListener('storage', changed)
  return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) }
}

type RefreshOptions = { refreshOnFocus?: boolean; refreshIntervalMs?: number; abortOnCleanup?: boolean }

// Account/path/policy changes hide prior data during render. Refreshes retain the
// same account's read-only data until the new response arrives; nothing is cached
// outside component memory. Background reads never renew session activity.
export function usePatientResource<T>(path: string | null, missingIsEmpty = false, options: RefreshOptions = {}) {
  const scope = useSyncExternalStore(subscribeAccount, readAccountScope, () => null)
  const [attempt, setAttempt] = useState(0)
  const request = useMemo(() => ({ scope, path, missingIsEmpty }), [scope, path, missingIsEmpty])
  const [state, setState] = useState<{ request: typeof request; data: T | null; error: boolean; errorMessage: string; errorStatus: number | null } | null>(null)
  const operation = useMemo(() => ({request, attempt}), [request, attempt])
  const [settled, setSettled] = useState<typeof operation | null>(null)
  const inFlight = useRef<object | null>(null)
  const refreshQueued = useRef(false)
  const abortOnCleanup = options.abortOnCleanup ?? false
  const retry = useCallback(() => {
    if (inFlight.current) refreshQueued.current = true
    else setAttempt(value => value + 1)
  }, [])
  useEffect(() => {
    if (!path || !scope) return
    let current = true
    const controller = abortOnCleanup ? new AbortController() : null
    inFlight.current = operation
    apiGet<T>(path, undefined, controller?.signal).then(data => {
      if (current) setState({ request, data, error: false, errorMessage: '', errorStatus: null })
    }).catch(error => {
      const empty = missingIsEmpty && error instanceof ApiError && error.status === 404
      if (current) setState({ request, data: null, error: !empty, errorMessage: empty ? '' : getApiErrorDetail(error) || 'This information could not be loaded. Please retry.', errorStatus: error instanceof ApiError ? error.status : null })
    }).finally(() => {
      if (inFlight.current === operation) inFlight.current = null
      if (current) {
        setSettled(operation)
        if (refreshQueued.current) {
          refreshQueued.current = false
          setAttempt(value => value + 1)
        }
      }
    })
    return () => {
      current = false
      controller?.abort()
      if (inFlight.current === operation) inFlight.current = null
      refreshQueued.current = false
    }
  }, [operation, request, path, scope, missingIsEmpty, abortOnCleanup])
  const interval = options.refreshIntervalMs ?? 0
  const onFocus = options.refreshOnFocus ?? false
  useEffect(() => {
    if (!path || !scope || (!onFocus && interval <= 0)) return
    const refreshVisible = () => { if (document.visibilityState === 'visible') retry() }
    if (onFocus) {
      window.addEventListener('focus', refreshVisible)
      document.addEventListener('visibilitychange', refreshVisible)
    }
    const timer = interval > 0 ? window.setInterval(refreshVisible, Math.max(10000, interval)) : null
    return () => {
      window.removeEventListener('focus', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
      if (timer !== null) window.clearInterval(timer)
    }
  }, [path, scope, onFocus, interval, retry])
  const matched = state?.request === request ? state : null
  const refreshing = Boolean(path && scope && settled !== operation)
  return { data: matched?.data ?? null, loading: Boolean(path && scope && (!matched || (refreshing && matched.error))), refreshing, error: matched?.error ?? false, errorMessage: matched?.errorMessage ?? '', errorStatus: matched?.errorStatus ?? null, retry }
}

'use client'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { ApiError, apiGet, getApiErrorDetail } from '@/lib/api'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'

const subscribeAccount = (changed: () => void) => {
  window.addEventListener(ACCOUNT_CHANGED, changed)
  window.addEventListener('storage', changed)
  return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) }
}

// A changed account, path, retry or policy hides prior data during render,
// before the next request/effect can run. apiGet also verifies account ownership.
export function usePatientResource<T>(path: string | null, missingIsEmpty = false) {
  const scope = useSyncExternalStore(subscribeAccount, readAccountScope, () => null)
  const [attempt, setAttempt] = useState(0)
  const request = useMemo(() => ({ scope, path, attempt, missingIsEmpty }), [scope, path, attempt, missingIsEmpty])
  const [state, setState] = useState<{ request: typeof request; data: T | null; error: boolean; errorMessage: string } | null>(null)
  useEffect(() => {
    if (!path || !scope) return
    let current = true
    apiGet<T>(path).then(data => {
      if (current) setState({ request, data, error: false, errorMessage: '' })
    }).catch(error => {
      const empty = missingIsEmpty && error instanceof ApiError && error.status === 404
      if (current) setState({ request, data: null, error: !empty, errorMessage: empty ? '' : getApiErrorDetail(error) || 'This information could not be loaded. Please retry.' })
    })
    return () => { current = false }
  }, [request, path, scope, missingIsEmpty])
  const matched = state?.request === request ? state : null
  return { data: matched?.data ?? null, loading: Boolean(path && scope && !matched), error: matched?.error ?? false, errorMessage: matched?.errorMessage ?? '', retry: () => setAttempt(value => value + 1) }
}

'use client'
import { useEffect, useState } from 'react'
import { ApiError, apiGet } from '@/lib/api'

// apiGet guards account ownership and renews expired sessions.
export function usePatientResource<T>(path: string | null, missingIsEmpty = false) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ path: string | null; data: T | null; loading: boolean; error: boolean }>({ path, data: null, loading: !!path, error: false })
  useEffect(() => {
    let current = true
    setState({ path, data: null, loading: !!path, error: false })
    if (path) apiGet<T>(path).then(data => {
      if (current) setState({ path, data, loading: false, error: false })
    }).catch(error => {
      if (current) setState({ path, data: null, loading: false, error: !(missingIsEmpty && error instanceof ApiError && error.status === 404) })
    })
    return () => { current = false }
  }, [path, attempt, missingIsEmpty])
  return { ...(state.path === path ? state : { data: null, loading: !!path, error: false }), retry: () => setAttempt(value => value + 1) }
}

'use client'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { usePortalAction } from './portal-action'
import { getApiErrorDetail, getApiErrorRequestId } from './api'

/** Every action belongs to the mounted portal/account/route and selected practice/version. */
export function usePracticeAction(context: string) {
  const capture = usePortalAction(), latest = useRef(context), pending = useRef<AbortController | null>(null)
  const [state, setState] = useState({ context, busy: false, error: '', reference: null as string | null, message: '' })
  useLayoutEffect(() => { latest.current = context; return () => { pending.current?.abort(); pending.current = null } }, [context])
  const run = useCallback(async (operation: (signal: AbortSignal) => Promise<unknown>, confirm: (result: unknown) => string, settled?: () => void, completedSession = false) => {
    if (pending.current || latest.current !== context) return
    const action = capture(), controller = new AbortController()
    if (!action.isCurrent()) return
    pending.current = controller; setState({ context, busy: true, error: '', reference: null, message: '' })
    const current = () => action.isCurrent() && latest.current === context && !controller.signal.aborted
    try {
      const result = await operation(controller.signal)
      const identity = result && typeof result === 'object' && 'browser_session' in result ? result.browser_session as import('./portal-scope').PortalIdentity : undefined
      if (!(current() || (completedSession && identity && action.isCurrent({ completedSession: identity })))) return
      const message = confirm(result)
      setState({ context, busy: false, error: '', reference: null, message }); settled?.()
    } catch (error) {
      if (!current()) return
      setState({ context, busy: false, error: getApiErrorDetail(error) || (error instanceof Error ? error.message : '') || 'This change could not be confirmed. Refresh and review the saved record before retrying.', reference: getApiErrorRequestId(error), message: '' }); settled?.()
    } finally { if (pending.current === controller) pending.current = null }
  }, [capture, context])
  const matched = state.context === context
  return { ...state, busy: matched && state.busy, error: matched ? state.error : '', reference: matched ? state.reference : null, message: matched ? state.message : '', run }
}

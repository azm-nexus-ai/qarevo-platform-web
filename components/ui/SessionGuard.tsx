'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { ApiError, getSessionStatus, logoutCurrentUser } from '@/lib/api'
import { sessionTiming, type SessionStatus } from '@/lib/session-timeout'
import { currentPortal, isPortalEvent, protectedPortalPath } from '@/lib/portal-scope'

type Timing = ReturnType<typeof sessionTiming>
const button = 'rounded-xl px-5 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-60'

export type InitialSessionCheck = {status:SessionStatus; receivedAt:number; requestDuration:number; scope:string|null}
export function SessionGuard({ children, initialCheck }: { children: ReactNode; initialCheck?:InitialSessionCheck }) {
  const pathname = usePathname()
  const portal = currentPortal()
  const protectedPage = protectedPortalPath(pathname)
  const monitorSession = protectedPage || /^\/support(?:\/|$)/.test(pathname)
  const [scope, setScope] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [timing, setTiming] = useState<Timing | null>(null)
  const [remaining, setRemaining] = useState(Infinity)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [absoluteDismissed, setAbsoluteDismissed] = useState(false)
  const controller = useRef<{ check: () => void; continue: () => void; end: () => void } | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId(), descriptionId = useId()
  const warning = !!timing && remaining <= timing.warningMs && remaining > 0 && !(timing.absolute && absoluteDismissed)

  useEffect(() => {
    const changed = (event?: Event) => { if(event && !isPortalEvent(event,portal))return; setScope(readAccountScope(portal)); setChecked(true) }
    changed()
    window.addEventListener(ACCOUNT_CHANGED, changed)
    // BookingProvider separately blocks a different account opened in another tab.
    window.addEventListener('storage', changed)
    return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) }
  }, [portal])

  useEffect(() => {
    setTiming(null); setRemaining(Infinity); setError(''); setAbsoluteDismissed(false)
    if (!scope || !monitorSession) return
    let alive = true, ended = false, pending = false, lastActivityRequest = -Infinity
    let current: Timing | null = null
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`qarevo:${portal}:session-activity`)
    const valid = () => alive && !ended && scope === readAccountScope(portal)
    const end = () => {
      if (!valid()) return
      ended = true; setTiming(null); setRemaining(0)
      // Clear private content immediately; revocation uses the captured refresh secret.
      void logoutCurrentUser().catch(() => { /* Server expiry still applies if offline. */ })
    }
    const check = async (activity = false) => {
      if (!valid() || pending) return
      if (current && performance.now() >= current.deadline) { end(); return }
      pending = true; if (activity) setBusy(true)
      const start = performance.now()
      try {
        const status = await getSessionStatus(activity)
        if (!valid()) return
        const now = performance.now()
        current = sessionTiming(status, now, now-start)
        setTiming(current); setRemaining(current.deadline-now); setError('')
        if (current.deadline <= now) { end(); return }
        if (activity) { lastActivityRequest = now; channel?.postMessage('activity') }
      } catch (failure) {
        if (!valid()) return
        if (failure instanceof ApiError && [401, 403].includes(failure.status)) { end(); return }
        setError('We could not confirm your session. Check your connection and try again.')
      } finally {
        pending = false; if (alive) setBusy(false)
      }
    }
    const activity = (event: Event) => {
      if (!event.isTrusted || document.visibilityState !== 'visible' || !current) return
      const now = performance.now()
      // Once the warning is shown, only its explicit action renews the session.
      if (current.deadline-now <= current.warningMs || now-lastActivityRequest < 30_000) return
      void check(true)
    }
    const focus = () => { if (document.visibilityState === 'visible') void check() }
    controller.current = { check: () => { void check() }, continue: () => { void check(true) }, end }
    if (channel) channel.onmessage = focus
    const timer = window.setInterval(() => {
      if (!valid() || !current) return
      const left = current.deadline-performance.now()
      setRemaining(left)
      if (left <= 0) end()
    }, 500)
    const authorityCheck = window.setInterval(focus, 60_000)
    for (const name of ['pointerdown', 'keydown', 'touchstart', 'scroll']) window.addEventListener(name, activity, { passive: true })
    window.addEventListener('focus', focus)
    window.addEventListener('pageshow', focus)
    document.addEventListener('visibilitychange', focus)
    if(initialCheck && initialCheck.scope===scope) {
      current=sessionTiming(initialCheck.status,initialCheck.receivedAt,initialCheck.requestDuration);
      setTiming(current);setRemaining(current.deadline-performance.now());
      if(current.deadline<=performance.now())end();
    } else void check()
    return () => {
      alive = false; controller.current = null; channel?.close()
      clearInterval(timer); clearInterval(authorityCheck)
      for (const name of ['pointerdown', 'keydown', 'touchstart', 'scroll']) window.removeEventListener(name, activity)
      window.removeEventListener('focus', focus); window.removeEventListener('pageshow', focus)
      document.removeEventListener('visibilitychange', focus)
    }
  }, [scope,portal,monitorSession,initialCheck])

  useEffect(() => {
    if (warning && dialog.current && !dialog.current.open) dialog.current.showModal()
    if (!warning && dialog.current?.open) dialog.current.close()
  }, [warning])

  const locked = protectedPage && (!checked || !scope || !timing || remaining <= 0)
  return <>
    {locked ? <main className='grid min-h-dvh place-items-center bg-surface-subtle px-6 text-ink'>
      <section className='w-full max-w-md rounded-2xl border border-theme bg-surface p-8 shadow-sm' aria-label='Session verification'>
        <h1 className='text-xl font-semibold tracking-tight'>Secure access</h1>
        <p className='mt-3 text-sm leading-7 text-secondary' role={error ? 'alert' : 'status'}>{error || 'Checking your session…'}</p>
        {error && <div className='mt-6 flex flex-wrap gap-3'>
          <button className={`${button} bg-blue-600 text-white hover:bg-blue-700`} onClick={() => controller.current?.check()}>Retry connection</button>
          <button className={`${button} border border-theme bg-surface text-ink`} onClick={() => controller.current?.end()}>Sign out</button>
        </div>}
      </section>
    </main> : children}
    <dialog ref={dialog} onCancel={event => event.preventDefault()} aria-labelledby={titleId} aria-describedby={descriptionId}
      className='m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-theme bg-surface p-6 text-ink shadow-2xl backdrop:bg-slate-950/60 sm:p-8'>
      <h2 id={titleId} className='text-xl font-semibold tracking-tight'>Your session is ending soon</h2>
      <p id={descriptionId} className='mt-3 text-sm leading-7 text-secondary'>
        {timing?.absolute ? 'For your security, this session has reached its maximum duration. Save your work and sign in again.'
          : 'To protect your health information, we sign you out after inactivity. Stay signed in to continue your work. Unsaved changes will be lost when this session ends.'}
      </p>
      <p className='mt-4 text-sm font-semibold tabular-nums'>Time remaining: {Number.isFinite(remaining) ? Math.max(0, Math.ceil(remaining/1000)) : 0} seconds</p>
      {error && <p role='alert' className='mt-4 rounded-xl border border-danger bg-danger-subtle p-3 text-sm text-danger'>{error}</p>}
      <div className='mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end'>
        {timing?.absolute && <button autoFocus className={`${button} bg-blue-600 text-white hover:bg-blue-700`} onClick={() => setAbsoluteDismissed(true)}>Return to work and save</button>}
        {!timing?.absolute && <button autoFocus disabled={busy} className={`${button} bg-blue-600 text-white hover:bg-blue-700`} onClick={() => controller.current?.continue()}>{busy ? 'Confirming…' : 'Stay signed in'}</button>}
        <button className={`${button} border border-theme bg-surface text-ink hover:bg-surface-subtle`} onClick={() => controller.current?.end()}>Sign out now</button>
      </div>
    </dialog>
  </>
}

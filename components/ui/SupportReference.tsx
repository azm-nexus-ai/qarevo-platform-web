'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { ACCOUNT_CHANGED } from '@/lib/account-storage'
import { safeRequestId } from '@/lib/api'
import { usePortalAction } from '@/lib/portal-action'
import { PortalButton } from '@/components/patient/PatientPortalPrimitives'
/** Copy only an opaque server reference, never error bodies, URLs or account data. */
export default function SupportReference({ requestId }: { requestId?: string | null }) {
  const id = safeRequestId(requestId)
  return id ? <ReferenceContent key={id} requestId={id} /> : null
}
function ReferenceContent({ requestId }: { requestId: string }) {
  const inputId = useId(), input = useRef<HTMLInputElement>(null), captureAction = usePortalAction(), origin = useRef<ReturnType<typeof captureAction> | null>(null)
  const [visible, setVisible] = useState(true), [notice, setNotice] = useState('')
  useEffect(() => {
    origin.current = captureAction()
    const check = () => { if (!origin.current?.isCurrent()) setVisible(false) }
    window.addEventListener(ACCOUNT_CHANGED, check); window.addEventListener('storage', check)
    return () => { window.removeEventListener(ACCOUNT_CHANGED, check); window.removeEventListener('storage', check) }
  }, [captureAction])
  const copy = async () => {
    const action = origin.current
    if (!action?.isCurrent()) { setVisible(false); return }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(requestId)
      if (action.isCurrent()) setNotice('Support reference copied.')
    } catch {
      if (!action.isCurrent()) return
      input.current?.focus(); input.current?.select(); setNotice('Select the reference and copy it using your keyboard or device menu.')
    }
  }
  if (!visible) return null
  return <div role='group' aria-label='Support reference' className='my-4 min-w-0 rounded-xl border border-theme bg-surface-subtle p-3'>
    <label htmlFor={inputId} className='block text-sm font-semibold text-ink'>Support reference</label><p className='mt-1 text-sm leading-6 text-secondary'>Share this reference with support if the problem continues.</p>
    <div className='mt-2 flex min-w-0 flex-col gap-2 sm:flex-row'><input ref={input} id={inputId} readOnly value={requestId} spellCheck={false} autoComplete='off' className='min-h-11 w-full min-w-0 rounded-lg border border-theme bg-surface px-3 py-2 font-mono text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]' /><PortalButton type='button' onClick={() => void copy()} aria-label='Copy support reference'>Copy reference</PortalButton></div>
    <p role='status' aria-live='polite' className='mt-2 text-sm leading-6 text-secondary'>{notice}</p>
  </div>
}

'use client'

import { useEffect, useId, useRef } from 'react'
import { LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'

/** Confirm sign-out. Focus starts on "stay", Escape cancels, focus returns to the trigger. */
export default function SignOutDialog({ open, busy, description, onCancel, onConfirm }: {
  open: boolean; busy: boolean; description: string; onCancel: () => void; onConfirm: () => void
}) {
  const t = useTranslations('shell'), titleId = useId(), descriptionId = useId(), stay = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    stay.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.() }
  }, [open, busy, onCancel])
  if (!open) return null
  return <div className='portal-dialog-backdrop' onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <div className='portal-dialog' role='dialog' aria-modal='true' aria-labelledby={titleId} aria-describedby={descriptionId}>
      <div className='portal-dialog-body'>
        <span className='portal-dialog-icon' aria-hidden='true'><LogOut size={20} /></span>
        <div>
          <h2 id={titleId} className='portal-dialog-title'>{t('signOutTitle')}</h2>
          <p id={descriptionId} className='portal-dialog-text'>{description}</p>
        </div>
      </div>
      <div className='portal-dialog-actions'>
        <button ref={stay} type='button' className='portal-dialog-secondary' onClick={onCancel} disabled={busy}>{t('stay')}</button>
        <button type='button' className='portal-dialog-danger' onClick={onConfirm} disabled={busy}>{busy ? t('signingOut') : t('confirmSignOut')}</button>
      </div>
    </div>
  </div>
}

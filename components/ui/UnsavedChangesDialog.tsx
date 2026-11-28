'use client'

import { useEffect, useId, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { PortalButton } from '@/components/patient/PatientPortalPrimitives'

type Props = { open: boolean; busy: boolean; onKeepEditing: () => void; onDiscard: () => void; variant?: 'clinical' | 'profile' }

export default function UnsavedChangesDialog({ open, busy, onKeepEditing, onDiscard, variant = 'clinical' }: Props) {
  const profile = variant === 'profile'
  const t = useTranslations('unsavedChanges')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onKeepEditing() }}
    className='m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-theme bg-surface p-6 text-ink shadow-2xl backdrop:bg-slate-950/60 sm:p-8'>
    <h2 id={titleId} className='text-xl font-semibold tracking-tight'>{busy ? t(profile ? 'profileBusyTitle' : 'yourRecordIsBeingSaved') : t(profile ? 'profileTitle' : 'keepYourClinicalNotes')}</h2>
    <p id={descriptionId} className='mt-3 text-sm leading-7 text-secondary'>
      {busy ? t(profile ? 'profileBusyText' : 'waitForThisOperationTo')
        : t(profile ? 'profileText' : 'youHaveUnsavedChangesKeep')}
    </p>
    <div className='mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end'>
      <PortalButton autoFocus type='button' tone='primary' onClick={onKeepEditing}>
        {busy ? t('stayOnThisPage') : t('keepEditing')}
      </PortalButton>
      {!busy && <PortalButton type='button' onClick={onDiscard}>{t('discardAndLeave')}</PortalButton>}
    </div>
  </dialog>
}

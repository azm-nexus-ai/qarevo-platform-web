'use client'

import { useEffect, useId, useRef } from 'react'

type Props = { open: boolean; busy: boolean; onKeepEditing: () => void; onDiscard: () => void }

export default function UnsavedChangesDialog({ open, busy, onKeepEditing, onDiscard }: Props) {
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
    <h2 id={titleId} className='text-xl font-semibold tracking-tight'>{busy ? 'Your record is being saved' : 'Keep your clinical notes?'}</h2>
    <p id={descriptionId} className='mt-3 text-sm leading-7 text-secondary'>
      {busy ? 'Wait for this operation to finish before leaving. Your clinical record is still being processed.'
        : 'You have unsaved changes. Keep editing to save your draft, or discard these changes and leave. Previously saved versions will remain available.'}
    </p>
    <div className='mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end'>
      <button autoFocus type='button' onClick={onKeepEditing}
        className='rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'>
        {busy ? 'Stay on this page' : 'Keep editing'}
      </button>
      {!busy && <button type='button' onClick={onDiscard}
        className='rounded-xl border border-theme bg-surface px-5 py-3 font-semibold text-ink hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'>Discard and leave</button>}
    </div>
  </dialog>
}

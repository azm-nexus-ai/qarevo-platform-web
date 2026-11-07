'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ACCOUNT_CHANGED } from '@/lib/account-storage'
import { getApiErrorDetail } from '@/lib/api'
import { usePortalAction } from '@/lib/portal-action'
import { documentFileSize, validateDocumentAccess, type DocumentAccessLifetime, type SecureDocumentAccess, type SecureDocumentMetadata } from '@/lib/secure-document-access'
import { PortalButton } from '@/components/patient/PatientPortalPrimitives'

type State = { status: 'loading' | 'expired' | 'closed' } | { status: 'error'; message: string } | { status: 'ready'; access: SecureDocumentAccess }
type Props = {
  documentTitle: string
  documentKind?: string
  expectedFileId: string
  maxLifetimeSeconds?: DocumentAccessLifetime
  loadDocument: () => Promise<SecureDocumentMetadata>
  onClose: () => void
}

/** Authorized attachment access; this does not verify or clinically approve a result. */
export default function SecureDocumentAccessDialog(props: Props) {
  // A new file must never inherit a previous file's ready bearer capability.
  return <DocumentAccessDialogContent key={`${props.expectedFileId}:${props.maxLifetimeSeconds ?? 300}`} {...props} />
}

function DocumentAccessDialogContent({ documentTitle, documentKind = 'Document', expectedFileId, maxLifetimeSeconds = 300, loadDocument, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const captureAction = usePortalAction()
  const originAction = useRef<ReturnType<typeof captureAction> | null>(null)
  const closed = useRef(false)
  const pendingRequest = useRef<{
    fileId: string
    revision: number
    scope: string | null
    loader: Props['loadDocument']
    requestedAt: number
    promise: Promise<SecureDocumentMetadata>
  } | null>(null)
  const pending = useRef(true)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<State>({ status: 'loading' })
  const close = useCallback(() => {
    closed.current = true
    setState({ status: 'closed' })
    if (dialogRef.current?.open) dialogRef.current.close()
    onClose()
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    closed.current = false
    dialog.showModal()
    return () => { closed.current = true; if (dialog.open) dialog.close() }
  }, [])

  useEffect(() => {
    if (!originAction.current) originAction.current = captureAction()
    const action = originAction.current
    if (!action.isCurrent() || closed.current) { close(); return }
    // React development StrictMode replays effects. Reuse only this instance's
    // matching pending request; a completed capability is never cached here.
    let request = pendingRequest.current
    if (!request || request.fileId !== expectedFileId || request.revision !== revision || request.scope !== action.scope || request.loader !== loadDocument) {
      const promise = Promise.resolve().then(() => {
        if (closed.current || !action.isCurrent()) throw new Error('Document access was cancelled.')
        return loadDocument()
      })
      const created = { fileId: expectedFileId, revision, scope: action.scope, loader: loadDocument, requestedAt: Date.now(), promise }
      pendingRequest.current = created
      const clear = () => { if (pendingRequest.current === created) pendingRequest.current = null }
      void promise.then(clear, clear)
      request = created
    }
    const { promise, requestedAt } = request
    let current = true
    const run = async () => {
      try {
        const metadata = await promise
        if (!current || closed.current || !action.isCurrent()) return
        setState({ status: 'ready', access: validateDocumentAccess(metadata, expectedFileId, requestedAt, Date.now(), maxLifetimeSeconds) })
      } catch (failure) {
        if (current && !closed.current && action.isCurrent()) setState({ status: 'error', message: getApiErrorDetail(failure) || 'This document is unavailable. Retry access or close this dialog and refresh the records.' })
      } finally { if (current) pending.current = false }
    }
    void run()
    return () => { current = false }
  }, [captureAction, close, expectedFileId, loadDocument, maxLifetimeSeconds, revision])

  useEffect(() => {
    const check = (event?: Event) => {
      const action = originAction.current
      const expiredSession = event?.type === 'qarevo:auth-session-expired' && (event as CustomEvent<{ portal?: string }>).detail?.portal === action?.portal
      if (!action?.isCurrent() || expiredSession) { close(); return }
      if (state.status === 'ready' && Date.now() >= state.access.expiresAt) setState({ status: 'expired' })
    }
    const timeout = state.status === 'ready' ? window.setTimeout(() => check(), Math.max(0, state.access.expiresAt - Date.now())) : null
    window.addEventListener(ACCOUNT_CHANGED, check)
    window.addEventListener('storage', check)
    window.addEventListener('qarevo:auth-session-expired', check)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      if (timeout !== null) window.clearTimeout(timeout)
      window.removeEventListener(ACCOUNT_CHANGED, check)
      window.removeEventListener('storage', check)
      window.removeEventListener('qarevo:auth-session-expired', check)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [captureAction, close, state])

  const retry = () => {
    if (!originAction.current?.isCurrent() || closed.current) { close(); return }
    if (pending.current) return
    pending.current = true
    setState({ status: 'loading' }); setRevision(value => value + 1)
  }

  return <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); close() }}
    className='m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-theme bg-surface p-5 text-ink shadow-2xl backdrop:bg-slate-950/60 sm:p-7'>
    <div className='flex items-start justify-between gap-4'>
      <div className='min-w-0'><h2 id={titleId} className='portal-h2'>{documentKind} access</h2><p className='break-words text-sm text-secondary'>{documentTitle}</p></div>
      <PortalButton autoFocus type='button' aria-label='Close document access' onClick={close}>Close</PortalButton>
    </div>
    <p id={descriptionId} className='mt-4 text-sm leading-6 text-muted'>Access is requested for the file associated with this record. Opening a file does not mark it as clinically reviewed.</p>
    <div className='mt-5' aria-busy={state.status === 'loading'}>
      {state.status === 'loading' && <p role='status' className='rounded-xl bg-surface-subtle p-4 text-sm text-secondary'>Preparing document access…</p>}
      {state.status === 'error' && <div role='alert' className='rounded-xl border border-theme bg-surface-subtle p-4'><p className='mb-4 text-sm leading-6'>{state.message}</p><PortalButton type='button' onClick={retry}>Retry document access</PortalButton></div>}
      {state.status === 'expired' && <div role='status' className='rounded-xl border border-theme bg-surface-subtle p-4'><p className='mb-4 text-sm leading-6'>This document link has expired. Request fresh access to download the file.</p><PortalButton type='button' onClick={retry}>Request fresh access</PortalButton></div>}
      {state.status === 'ready' && <>
        <dl className='grid gap-3 rounded-xl border border-theme bg-surface-subtle p-4 text-sm'>
          <div className='min-w-0'><dt className='font-semibold text-secondary'>Original filename</dt><dd className='mt-1 break-all text-ink'>{state.access.filename}</dd></div>
          <div><dt className='font-semibold text-secondary'>Format and size</dt><dd className='mt-1 break-words text-ink'>{state.access.contentType} · {documentFileSize(state.access.fileSizeBytes)}</dd></div>
          <div><dt className='font-semibold text-secondary'>Upload source</dt><dd className='mt-1 text-ink'>{state.access.uploadedBy === 'patient' ? 'Uploaded by patient' : state.access.uploadedBy === 'care_team' ? 'Uploaded by care team' : 'Upload source unavailable'}</dd></div>
        </dl>
        <p className='my-4 text-sm leading-6 text-muted'>This download link expires at <time dateTime={new Date(state.access.expiresAt).toISOString()}>{new Date(state.access.expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>. Files download with a generic name for privacy. Request a new link after it expires.</p>
        <a className='portal-button portal-button-primary q-button q-button-primary inline-flex min-h-11 max-w-full items-center justify-center rounded-xl px-4 py-2 text-center text-sm font-semibold' href={state.access.downloadUrl} target='_blank' rel='noopener noreferrer' referrerPolicy='no-referrer'
          onClick={event => {
            const action = originAction.current
            if (!action?.isCurrent()) { event.preventDefault(); close() }
            else if (Date.now() >= state.access.expiresAt) { event.preventDefault(); setState({ status: 'expired' }) }
          }}>Download {documentKind.toLowerCase()}</a>
      </>}
    </div>
  </dialog>
}

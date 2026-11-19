'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { ACCOUNT_CHANGED } from '@/lib/account-storage'
import { getApiErrorDetail, type DoctorLabOrdersResponse } from '@/lib/api'
import { labReviewReceipt, labResultReview, type LabReviewTarget } from '@/lib/lab-result-review'
import { usePortalAction } from '@/lib/portal-action'
import { PortalButton } from '@/components/patient/PatientPortalPrimitives'
type Props = { target: LabReviewTarget; isTargetCurrent: () => boolean; save: (signal: AbortSignal) => Promise<DoctorLabOrdersResponse>; onSaved: (response: DoctorLabOrdersResponse, current: boolean) => void; onClose: () => void }
export default function LabResultReviewDialog({ target, isTargetCurrent, save, onSaved, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), captureAction = usePortalAction(), origin = useRef<ReturnType<typeof captureAction> | null>(null), pending = useRef(false), closed = useRef(false), controller = useRef<AbortController | null>(null)
  const titleId = useId(), descriptionId = useId(), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const targetCheck = useRef(isTargetCurrent); targetCheck.current = isTargetCurrent
  useEffect(() => {
    const node = dialog.current; origin.current = captureAction(); closed.current = false; node?.showModal()
    const check = () => { if (!origin.current?.isCurrent() || !targetCheck.current()) { closed.current = true; dialog.current?.close(); onClose() } }
    window.addEventListener(ACCOUNT_CHANGED, check); window.addEventListener('storage', check); window.addEventListener('focus', check)
    return () => { closed.current = true; controller.current?.abort(); node?.close(); window.removeEventListener(ACCOUNT_CHANGED, check); window.removeEventListener('storage', check); window.removeEventListener('focus', check) }
  }, [captureAction, onClose])
  const close = () => { if (pending.current) return; closed.current = true; dialog.current?.close(); onClose() }
  const submit = async () => {
    if (!confirmed || pending.current || closed.current || !origin.current?.isCurrent() || !targetCheck.current()) return
    pending.current = true; controller.current = new AbortController(); setBusy(true); setError('')
    try { const response = await save(controller.current.signal); if (closed.current || !origin.current?.isCurrent() || !targetCheck.current()) return; const receipt = labReviewReceipt(response.review_receipt, target); if (!receipt) throw new Error('Review confirmation could not be verified. Retry this same file to recover its existing acknowledgement.'); const saved = Array.isArray(response.test_requests) ? response.test_requests.find(row => row.id === target.orderId && row.patient_id === target.patientId) : null; const status = labResultReview(saved?.result_review, target.fileId); if (!saved || receipt.current && (saved.result_file_id !== target.fileId || status.state !== 'acknowledged' || status.reviewId !== receipt.id)) throw new Error('The current review projection could not be verified. Retry the same selected file.'); onSaved(response, receipt.current) }
    catch (failure) { if (!closed.current && origin.current?.isCurrent() && targetCheck.current()) setError(getApiErrorDetail(failure) || 'Review confirmation is unavailable. Retry the same file; this will not create a second acknowledgement.') }
    finally { pending.current = false; controller.current = null; if (!closed.current && origin.current?.isCurrent()) setBusy(false) }
  }
  return <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); close() }} className='m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-theme bg-surface p-5 text-ink shadow-2xl backdrop:bg-slate-950/60 sm:p-7'>
    <h2 id={titleId} className='portal-h2'>Record result review</h2><p className='mb-4 break-words font-semibold text-ink'>{target.title}</p><p id={descriptionId} className='text-sm leading-7 text-secondary'>Confirm you have reviewed this exact result file. The clinician and review date will appear in the patient’s records. Record interpretation and follow-up separately in the care plan.</p>
    <label className='my-5 flex min-h-11 items-start gap-3 rounded-xl border border-theme p-4 text-sm leading-7'><input autoFocus type='checkbox' className='mt-2 h-4 w-4 shrink-0 accent-[var(--primary)]' checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />I have reviewed this exact result file.</label>
    {error && <p role='alert' className='mb-4 rounded-xl border border-theme bg-surface-subtle p-3 text-sm leading-7 text-danger'>{error}</p>}{busy && <p role='status' className='mb-4 text-sm text-secondary'>Recording review acknowledgement…</p>}
    <div className='flex flex-wrap gap-3'><PortalButton tone='primary' disabled={!confirmed || busy} onClick={() => void submit()}>{busy ? 'Recording…' : error ? 'Retry review' : 'Confirm review'}</PortalButton><PortalButton disabled={busy} onClick={close}>Cancel</PortalButton></div>
  </dialog>
}

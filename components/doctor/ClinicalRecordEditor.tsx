'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useNavigationGuard } from 'nextjs-nav-guard'
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog'
import { apiGet, apiPost, apiPut, completeDoctorConsultation } from '@/lib/api'
import { clinicalFields, contentOf, emptyRecord, recordErrors, type ClinicalRecordState, type PublishedClinicalRecord, type RecordContent } from '@/lib/clinical-record'
import { publicationHref } from '@/lib/clinical-publications'

type Props = { consultationId: string; consultationStatus: string; onPublished: () => Promise<void> }
const control = 'mt-2 w-full rounded-xl border border-theme bg-canvas px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-blue-500'
const secondary = 'rounded-xl border border-theme bg-surface px-4 py-3 font-semibold text-ink hover:bg-surface-subtle disabled:opacity-60'

export default function ClinicalRecordEditor({ consultationId, consultationStatus, onPublished }: Props) {
  const path = `/api/v1/doctor/workspace/${encodeURIComponent(consultationId)}/clinical-record`
  const [state, setState] = useState<ClinicalRecordState>({ draft: null, published: null })
  const [form, setForm] = useState<RecordContent>({ ...emptyRecord })
  const [amendment, setAmendment] = useState('')
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [errors, setErrors] = useState<ReturnType<typeof recordErrors>>({})
  const [amendmentError, setAmendmentError] = useState('')
  const navigation = useNavigationGuard({
    // Session expiry/logout must still remove clinical content from the screen.
    enabled: ({ to }) => (dirty || busy !== null) && !to.startsWith('/auth/'),
  })

  useEffect(() => {
    let current = true
    setLoading(true); setError(''); setNotice(''); setReviewed(false)
    apiGet<ClinicalRecordState>(path).then(data => {
      if (!current) return
      setState(data); setForm(contentOf(data.draft ?? data.published)); setDirty(false)
      setAmendment(data.draft?.amendment_reason ?? ''); setEditing(Boolean(data.draft) || !data.published)
      setErrors({}); setAmendmentError('')
    }).catch(err => { if (current) setError(err instanceof Error ? err.message : 'The saved record could not be loaded.') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [path, attempt])

  async function save() {
    setError(''); setNotice('')
    const validation = recordErrors(form, false)
    setErrors(validation)
    const reasonError = state.published && amendment.trim().length < 4 ? 'Enter an amendment reason of 4–500 characters.' : ''
    setAmendmentError(reasonError)
    if (Object.keys(validation).length || reasonError) return
    setBusy('save')
    const base = state.draft ?? state.published
    try {
      const draft = await apiPut<PublishedClinicalRecord>(path, { ...form, consultation_id: consultationId,
        record_id: base?.id ?? null, expected_version: base?.version ?? 0, amendment_reason: amendment.trim() || null })
      setState(previous => ({ ...previous, draft })); setForm(contentOf(draft)); setDirty(false); setReviewed(false)
      setNotice(`Draft saved at ${new Date(draft.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. It is not visible to the patient.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'The draft could not be saved. Your text is still here.') }
    finally { setBusy(null) }
  }

  async function publish() {
    setError(''); setNotice('')
    const validation = recordErrors(form, true); setErrors(validation)
    if (Object.keys(validation).length) { setError('Complete the highlighted fields before publishing.'); return }
    if (dirty || !state.draft) { setError('Save your draft, then review the saved version before publishing.'); return }
    if (!reviewed) { setError('Confirm that you reviewed this saved version before publishing.'); return }
    setBusy('publish')
    try {
      const published = await apiPost<PublishedClinicalRecord>(`${path}/publish`, { record_id: state.draft.id, expected_version: state.draft.version, reviewed: true })
      setState({ draft: null, published }); setEditing(false); setDirty(false); setReviewed(false)
      setNotice('Published to the patient. This version is retained; future changes require an amendment.')
      await onPublished()
    } catch (err) { setError(err instanceof Error ? err.message : 'Publication could not be confirmed. Retry to recover the saved record safely.') }
    finally { setBusy(null) }
  }

  async function reconcile() {
    setBusy('reconcile'); setError('')
    try { await completeDoctorConsultation(consultationId); await onPublished(); setNotice('Consultation completion confirmed.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Completion could not be confirmed. Please retry.') }
    finally { setBusy(null) }
  }

  if (loading) return <section className='rounded-2xl border border-theme bg-surface p-6' role='status'>Loading the saved clinical record…</section>
  return <><UnsavedChangesDialog open={navigation.active} busy={busy !== null}
    onKeepEditing={navigation.reject} onDiscard={navigation.accept} /><section aria-labelledby='clinical-record-title' className='rounded-2xl border border-theme bg-surface p-5 sm:p-8'>
    <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
      <div><p className='text-xs font-semibold uppercase tracking-widest text-muted'>Clinical documentation</p>
        <h2 id='clinical-record-title' className='mt-2 text-2xl font-semibold text-ink'>{editing ? 'Review and publish the care summary' : 'Published care summary'}</h2>
        <p className='mt-2 max-w-2xl text-sm leading-6 text-secondary'>Every section below is shared with the patient after your approval. Save a draft at any time; all clinical fields are required for publication.</p></div>
      <div className='flex flex-wrap items-center gap-3'><span className='rounded-full border border-theme px-3 py-2 text-sm text-secondary'>{state.draft ? `Draft · revision ${state.draft.revision}` : state.published ? `Published · revision ${state.published.revision}` : 'Not yet recorded'}</span>
        {state.published && publicationHref('doctor', consultationId, state.published.id) && <Link href={publicationHref('doctor', consultationId, state.published.id)!} prefetch={false} className={secondary}>View published versions</Link>}</div>
    </div>
    {error && <div role='alert' className='mb-5 rounded-xl border border-red-400 bg-surface-subtle p-4 text-ink'><p>{error}</p>
      <button type='button' className={`${secondary} mt-3`} disabled={Boolean(busy)} onClick={() => {
        if (!dirty || window.confirm('Reload the saved record? Unsaved text on this page will be replaced.')) { setDirty(false); setAttempt(value => value + 1) }
      }}>Reload saved record</button></div>}
    {notice && <p role='status' className='mb-5 rounded-xl border border-theme bg-surface-subtle p-4 text-ink'>{notice}</p>}
    {editing ? <form onSubmit={event => { event.preventDefault(); void save() }} noValidate>
      <fieldset disabled={Boolean(busy)} className='space-y-6'>
        <div><label htmlFor='record-language' className='font-semibold text-ink'>Record language <span className='text-sm font-normal text-muted'>(required)</span></label>
          <select id='record-language' value={form.language} className={control} onChange={event => { setForm({ ...form, language: event.target.value as 'en' | 'de' }); setDirty(true); setReviewed(false) }}><option value='en'>English</option><option value='de'>Deutsch</option></select></div>
        {clinicalFields.map(field => <div key={field.key}>
          <label htmlFor={`record-${field.key}`} className='font-semibold text-ink'>{field.label} <span className='text-sm font-normal text-muted'>(required to publish)</span></label>
          <p id={`record-${field.key}-hint`} className='mt-1 text-sm leading-6 text-muted'>{field.hint}</p>
          <textarea id={`record-${field.key}`} rows={field.key === 'summary' ? 4 : 3} maxLength={field.max} value={form[field.key]}
            aria-invalid={Boolean(errors[field.key])} aria-describedby={`record-${field.key}-hint${errors[field.key] ? ` record-${field.key}-error` : ''}`}
            className={control} onChange={event => { setForm({ ...form, [field.key]: event.target.value }); setDirty(true); setReviewed(false); setErrors(previous => ({ ...previous, [field.key]: undefined })) }} />
          {errors[field.key] && <p id={`record-${field.key}-error`} className='mt-2 text-sm font-semibold text-ink'>{errors[field.key]}</p>}
        </div>)}
        {state.published && <div><label htmlFor='record-amendment' className='font-semibold text-ink'>Amendment reason (required)</label>
          <p className='mt-1 text-sm text-muted'>4–500 characters. The original published record will be retained. This reason is also visible to the patient.</p>
          <textarea id='record-amendment' className={control} rows={2} minLength={4} maxLength={500} value={amendment} aria-invalid={Boolean(amendmentError)} aria-describedby={amendmentError ? 'record-amendment-error' : undefined}
            onChange={event => { setAmendment(event.target.value); setDirty(true); setReviewed(false); setAmendmentError('') }} />
          {amendmentError && <p id='record-amendment-error' className='mt-2 font-semibold text-ink'>{amendmentError}</p>}</div>}
        <div className='rounded-xl border border-theme bg-canvas p-4'>
          <label className='flex items-start gap-3 text-sm leading-6 text-ink'><input type='checkbox' className='mt-1 h-5 w-5 shrink-0' checked={reviewed} onChange={event => setReviewed(event.target.checked)} />
            <span>I have reviewed this saved record and approve sharing it with the patient. This records my clinical approval; it is not a qualified electronic signature.</span></label>
          <p className='mt-3 text-sm text-muted'>{dirty ? 'You have unsaved changes. Save the draft before approval.' : 'Publication requires a started consultation and an ended video session.'}</p>
        </div>
        <div className='flex flex-wrap gap-3'><button type='submit' className={secondary}>{busy === 'save' ? 'Saving draft…' : 'Save draft'}</button>
          <button type='button' onClick={() => void publish()} className='rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700'>{busy === 'publish' ? 'Publishing…' : 'Approve and publish'}</button></div>
      </fieldset>
    </form> : state.published && <>
      <p className='text-sm text-muted'>Approved {new Date(state.published.published_at!).toLocaleString()} · {state.published.language === 'de' ? 'Deutsch' : 'English'}</p>
      <dl className='mt-6 space-y-6'>{clinicalFields.map(field => <div key={field.key}><dt className='font-semibold text-ink'>{field.label}</dt><dd className='mt-2 whitespace-pre-wrap break-words leading-7 text-secondary'>{state.published![field.key]}</dd></div>)}</dl>
      <div className='mt-6 flex flex-wrap gap-3'><button type='button' className={secondary} onClick={() => { setEditing(true); setAmendment(''); setReviewed(false); setNotice('') }}>Create amendment</button>
        {consultationStatus !== 'ENDED' && <button type='button' className={secondary} disabled={Boolean(busy)} onClick={() => void reconcile()}>{busy === 'reconcile' ? 'Confirming…' : 'Confirm consultation completion'}</button>}</div>
    </>}
  </section></>
}

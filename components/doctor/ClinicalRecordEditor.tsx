'use client'

import { getApiErrorDetail, getApiErrorRequestId } from '@/lib/api'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useNavigationGuard } from 'nextjs-nav-guard'
import SupportReference from '@/components/ui/SupportReference'
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog'
import { apiGet, apiPost, apiPut, completeDoctorConsultation } from '@/lib/api'
import { clinicalFields, contentOf, emptyRecord, recordErrors, type ClinicalRecordState, type PublishedClinicalRecord, type RecordContent } from '@/lib/clinical-record'
import { publicationHref } from '@/lib/clinical-publications'

type Props = { consultationId: string; consultationStatus: string; onPublished: () => Promise<void> }
const control = 'mt-2 w-full rounded-xl border border-theme bg-canvas px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-blue-500'
const secondary = 'rounded-xl border border-theme bg-surface px-4 py-3 font-semibold text-ink hover:bg-surface-subtle disabled:opacity-60'

export default function ClinicalRecordEditor({ consultationId, consultationStatus, onPublished }: Props) {
  const t = useTranslations('recordEditor'), timeLocale = useLocale().startsWith('de') ? 'de-DE' : []
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
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [errors, setErrors] = useState<ReturnType<typeof recordErrors>>({})
  const [amendmentError, setAmendmentError] = useState('')
  const navigation = useNavigationGuard({
    // Session expiry/logout must still remove clinical content from the screen.
    enabled: ({ to }) => (dirty || busy !== null) && !to.startsWith('/auth/'),
  })

  useEffect(() => {
    let current = true
    setLoading(true); setError(''); setErrorRequestId(null); setNotice(''); setReviewed(false)
    apiGet<ClinicalRecordState>(path).then(data => {
      if (!current) return
      setState(data); setForm(contentOf(data.draft ?? data.published)); setDirty(false)
      setAmendment(data.draft?.amendment_reason ?? ''); setEditing(Boolean(data.draft) || !data.published)
      setErrors({}); setAmendmentError('')
    }).catch(err => { if (current) { setError(getApiErrorDetail(err) || t('loadFailed')); setErrorRequestId(getApiErrorRequestId(err)) } })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [path, attempt, t])

  async function save() {
    setError(''); setErrorRequestId(null); setNotice('')
    const validation = recordErrors(form, false)
    setErrors(validation)
    const reasonError = state.published && amendment.trim().length < 4 ? t('amendmentReasonError') : ''
    setAmendmentError(reasonError)
    if (Object.keys(validation).length || reasonError) return
    setBusy('save')
    const base = state.draft ?? state.published
    try {
      const draft = await apiPut<PublishedClinicalRecord>(path, { ...form, consultation_id: consultationId,
        record_id: base?.id ?? null, expected_version: base?.version ?? 0, amendment_reason: amendment.trim() || null })
      setState(previous => ({ ...previous, draft })); setForm(contentOf(draft)); setDirty(false); setReviewed(false)
      setNotice(t('draftSavedAt', { time: new Date(draft.updated_at).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' }) }))
    } catch (err) { setError(getApiErrorDetail(err) || t('draftSaveFailed')); setErrorRequestId(getApiErrorRequestId(err)) }
    finally { setBusy(null) }
  }

  async function publish() {
    setError(''); setErrorRequestId(null); setNotice('')
    const validation = recordErrors(form, true); setErrors(validation)
    if (Object.keys(validation).length) { setError(t('completeFields')); return }
    if (dirty || !state.draft) { setError(t('saveThenReview')); return }
    if (!reviewed) { setError(t('confirmReview')); return }
    setBusy('publish')
    try {
      const published = await apiPost<PublishedClinicalRecord>(`${path}/publish`, { record_id: state.draft.id, expected_version: state.draft.version, reviewed: true })
      setState({ draft: null, published }); setEditing(false); setDirty(false); setReviewed(false)
      setNotice(t('published'))
      await onPublished()
    } catch (err) { setError(getApiErrorDetail(err) || t('publishUnconfirmed')); setErrorRequestId(getApiErrorRequestId(err)) }
    finally { setBusy(null) }
  }

  async function reconcile() {
    setBusy('reconcile'); setError('')
    try { await completeDoctorConsultation(consultationId); await onPublished(); setNotice(t('completed')) }
    catch (err) { setError(getApiErrorDetail(err) || t('completeFailed')); setErrorRequestId(getApiErrorRequestId(err)) }
    finally { setBusy(null) }
  }

  if (loading) return <section className='rounded-2xl border border-theme bg-surface p-6' role='status'>{t('loading')}</section>
  return <><UnsavedChangesDialog open={navigation.active} busy={busy !== null}
    onKeepEditing={navigation.reject} onDiscard={navigation.accept} /><section aria-labelledby='clinical-record-title' className='rounded-2xl border border-theme bg-surface p-5 sm:p-8'>
    <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
      <div><p className='text-xs font-semibold uppercase tracking-widest text-muted'>{t('eyebrow')}</p>
        <h2 id='clinical-record-title' className='mt-2 text-2xl font-semibold text-ink'>{editing ? t('title') : t('publishedTitle')}</h2>
        <p className='mt-2 max-w-2xl text-sm leading-6 text-secondary'>{t('intro')}</p></div>
      <div className='flex flex-wrap items-center gap-3'><span className='rounded-full border border-theme px-3 py-2 text-sm text-secondary'>{state.draft ? t('draftRevision', { revision: state.draft.revision }) : state.published ? t('publishedRevision', { revision: state.published.revision }) : t('notRecorded')}</span>
        {state.published && publicationHref('doctor', consultationId, state.published.id) && <Link href={publicationHref('doctor', consultationId, state.published.id)!} prefetch={false} className={secondary}>{t('viewVersions')}</Link>}</div>
    </div>
    {error && <div role='alert' className='mb-5 rounded-xl border border-red-400 bg-surface-subtle p-4 text-ink'><p>{error}</p><SupportReference requestId={errorRequestId} />
      <button type='button' className={`${secondary} mt-3`} disabled={Boolean(busy)} onClick={() => {
        if (!dirty || window.confirm(t('reloadConfirm'))) { setDirty(false); setAttempt(value => value + 1) }
      }}>{t('reload')}</button></div>}
    {notice && <p role='status' className='mb-5 rounded-xl border border-theme bg-surface-subtle p-4 text-ink'>{notice}</p>}
    {editing ? <form onSubmit={event => { event.preventDefault(); void save() }} noValidate>
      <fieldset disabled={Boolean(busy)} className='space-y-6'>
        <div><label htmlFor='record-language' className='font-semibold text-ink'>{t('language')} <span className='text-sm font-normal text-muted'>{t('requiredSuffix')}</span></label>
          <select id='record-language' value={form.language} className={control} onChange={event => { setForm({ ...form, language: event.target.value as 'en' | 'de' }); setDirty(true); setReviewed(false) }}><option value='en'>English</option><option value='de'>Deutsch</option></select></div>
        {clinicalFields.map(field => <div key={field.key}>
          <label htmlFor={`record-${field.key}`} className='font-semibold text-ink'>{field.label} <span className='text-sm font-normal text-muted'>{t('requiredToPublish')}</span></label>
          <p id={`record-${field.key}-hint`} className='mt-1 text-sm leading-6 text-muted'>{field.hint}</p>
          <textarea id={`record-${field.key}`} rows={field.key === 'summary' ? 4 : 3} maxLength={field.max} value={form[field.key]}
            aria-invalid={Boolean(errors[field.key])} aria-describedby={`record-${field.key}-hint${errors[field.key] ? ` record-${field.key}-error` : ''}`}
            className={control} onChange={event => { setForm({ ...form, [field.key]: event.target.value }); setDirty(true); setReviewed(false); setErrors(previous => ({ ...previous, [field.key]: undefined })) }} />
          {errors[field.key] && <p id={`record-${field.key}-error`} className='mt-2 text-sm font-semibold text-ink'>{errors[field.key]}</p>}
        </div>)}
        {state.published && <div><label htmlFor='record-amendment' className='font-semibold text-ink'>{t('amendmentReason')}</label>
          <p className='mt-1 text-sm text-muted'>{t('n4500CharactersTheOriginal')}</p>
          <textarea id='record-amendment' className={control} rows={2} minLength={4} maxLength={500} value={amendment} aria-invalid={Boolean(amendmentError)} aria-describedby={amendmentError ? 'record-amendment-error' : undefined}
            onChange={event => { setAmendment(event.target.value); setDirty(true); setReviewed(false); setAmendmentError('') }} />
          {amendmentError && <p id='record-amendment-error' className='mt-2 font-semibold text-ink'>{amendmentError}</p>}</div>}
        <div className='rounded-xl border border-theme bg-canvas p-4'>
          <label className='flex items-start gap-3 text-sm leading-6 text-ink'><input type='checkbox' className='mt-1 h-5 w-5 shrink-0' checked={reviewed} onChange={event => setReviewed(event.target.checked)} />
            <span>{t('approval')}</span></label>
          <p className='mt-3 text-sm text-muted'>{dirty ? t('unsaved') : t('publishRequires')}</p>
        </div>
        <div className='flex flex-wrap gap-3'><button type='submit' className={secondary}>{busy === 'save' ? t('savingDraft') : t('saveDraft')}</button>
          <button type='button' onClick={() => void publish()} className='rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700'>{busy === 'publish' ? t('publishing') : t('approvePublish')}</button></div>
      </fieldset>
    </form> : state.published && <>
      <p className='text-sm text-muted'>Approved {new Date(state.published.published_at!).toLocaleString()} · {state.published.language === 'de' ? 'Deutsch' : 'English'}</p>
      <dl className='mt-6 space-y-6'>{clinicalFields.map(field => <div key={field.key}><dt className='font-semibold text-ink'>{field.label}</dt><dd className='mt-2 whitespace-pre-wrap break-words leading-7 text-secondary'>{state.published![field.key]}</dd></div>)}</dl>
      <div className='mt-6 flex flex-wrap gap-3'><button type='button' className={secondary} onClick={() => { setEditing(true); setAmendment(''); setReviewed(false); setNotice('') }}>{t('createAmendment')}</button>
        {consultationStatus !== 'ENDED' && <button type='button' className={secondary} disabled={Boolean(busy)} onClick={() => void reconcile()}>{busy === 'reconcile' ? t('confirming') : t('confirmCompletion')}</button>}</div>
    </>}
  </section></>
}

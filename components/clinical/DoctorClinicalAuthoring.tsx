'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useNavigationGuard } from 'nextjs-nav-guard'
import ClinicalPatientDirectory from './ClinicalPatientDirectory'
import { clinicalSelectedPatient, clinicalSelectedPatientPath } from '@/lib/clinical-patient-directory'
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog'
import { PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import { MedicationRecordCard, CarePlanRecordCard } from './InstructionRecords'
import { ApiError, apiPost, apiPut, apiDelete, getApiErrorDetail, isAuthError } from '@/lib/api'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { currentPortal } from '@/lib/portal-scope'
import { usePortalAction } from '@/lib/portal-action'
import { usePortalResource } from '@/lib/use-portal-resource'
import { MEDICATION_FIELDS, DAYPARTS, clinicalValidationErrors, instructionList, medicationInstruction, careInstruction, instructionIdentifier, instructionActionsAllowed } from '@/lib/clinical-instructions'
import { clinicalWriteHeaders, recordWriteVersion, clinicalRecordChanged, MISSING_CLINICAL_VERSION } from '@/lib/clinical-write-version'
import { clinicalCreateIntent, sameClinicalCreateIntent, clinicalCreationReceipt, type ClinicalCreateIntent } from '@/lib/clinical-create-intent'
import { authoringChanges, emptyAuthoringForm, savedAuthoringForm, type AuthoringKind, type AuthoringForm } from '@/lib/clinical-authoring'

const subscribe = (changed: () => void) => { window.addEventListener(ACCOUNT_CHANGED, changed); window.addEventListener('storage', changed); return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) } }
const doctorScope = () => readAccountScope('doctor')
const control = 'min-h-11 w-full rounded-xl border border-theme bg-surface px-4 py-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]'
function ClinicalAuthoringContext({ kind }: { kind: AuthoringKind }) {
  const scope = useSyncExternalStore(subscribe, doctorScope, () => null), path = usePathname(), parameters = useSearchParams()
  return <ClinicalAuthoring key={JSON.stringify([scope, path, parameters.toString(), kind])} kind={kind} scope={scope} path={path} query={parameters.toString()} />
}
export default function DoctorClinicalAuthoring({ kind }: { kind: AuthoringKind }) {
  return <Suspense fallback={<p role='status' className='p-5 text-secondary'>Loading clinical instructions…</p>}><ClinicalAuthoringContext kind={kind} /></Suspense>
}
function ClinicalAuthoring({ kind, scope, path, query }: { kind: AuthoringKind; scope: string | null; path: string; query: string }) {
  const router = useRouter(), captureAction = usePortalAction(), patientRef = useRef('')
  const [patientId, setPatientId] = useState(''), [pendingPatientId, setPendingPatientId] = useState<string | null>(null)
  const endpoint = kind === 'medication' ? '/api/v1/doctor/prescriptions' : '/api/v1/doctor/care-plans'
  const collectionKey = kind === 'medication' ? 'medications' : 'care_plans'
  const selectedDirectory = usePortalResource<unknown>(clinicalSelectedPatientPath(patientId), false, { refreshOnFocus: true, abortOnCleanup: true })
  const selectedPatient = clinicalSelectedPatient(selectedDirectory.data, patientId)
  const authorized = Boolean(selectedPatient && !selectedDirectory.error)
  const selectionAccess = useRef({ id: patientId, allowed: authorized, refreshing: selectedDirectory.refreshing, epoch: 0 })
  const accessEpoch = selectionAccess.current.epoch + (selectionAccess.current.id !== patientId || (selectionAccess.current.allowed && !authorized) ? 1 : 0)
  selectionAccess.current = { id: patientId, allowed: authorized, refreshing: selectedDirectory.refreshing, epoch: accessEpoch }
  const resource = usePortalResource<Record<string, unknown>>(patientId && authorized ? `${endpoint}/${encodeURIComponent(patientId)}` : null, false, { refreshOnFocus: true, abortOnCleanup: true })
  const empty = useMemo(() => emptyAuthoringForm(kind), [kind])
  const [form, setForm] = useState<AuthoringForm>(empty), [baseline, setBaseline] = useState<AuthoringForm>(empty)
  const [editingId, setEditingId] = useState<string | null>(null), [showForm, setShowForm] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({}), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  const pending = useRef<AbortController | null>(null), pendingIntent = useRef<'create' | 'update' | 'delete' | null>(null), uncertainCreateRef = useRef(false)
  const [uncertainCreate, setUncertainCreate] = useState(false)
  const creationAttempt = useRef<{ intent: ClinicalCreateIntent; uncertain: boolean; reviewBase: unknown } | null>(null)
  const [createRecovery, setCreateRecovery] = useState(false)
  const editorVersion = useRef<string | null>(null)
  const [editorConflict, setEditorConflict] = useState(false)
  const editorConflictBase = useRef<unknown>(null), latestData = useRef(resource.data); latestData.current = resource.data
  const deleteAttempts = useRef(new Map<string, { version: string; base: unknown; conflicted: boolean; label: string }>())
  const [deleteRecovery, setDeleteRecovery] = useState<string[]>([])
  const [projection, setProjection] = useState<{ patientId: string; base: unknown; data: Record<string, unknown> } | null>(null)
  const source = projection?.patientId === patientId && projection.base === resource.data ? projection.data : resource.data
  const records = instructionList(source?.[collectionKey])
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline) || createRecovery
  const reconciliationReady = authorized && resource.data !== null && !resource.refreshing && !resource.error && !records.invalid && (!creationAttempt.current?.uncertain || resource.data !== creationAttempt.current.reviewBase)
  const navigation = useNavigationGuard({ enabled: ({ to }) => (dirty || busy) && !to.startsWith('/auth/') })
  const validPage = useCallback(() => !!scope && scope === doctorScope() && currentPortal() === 'doctor' && window.location.pathname === path && new URLSearchParams(window.location.search).toString() === query, [scope, path, query])
  useEffect(() => () => { pending.current?.abort(); pending.current = null; creationAttempt.current = null; deleteAttempts.current.clear(); editorVersion.current = null }, [])
  useEffect(() => {
    if (authorized || !pending.current) return
    if (pendingIntent.current === 'create') { uncertainCreateRef.current = true; setUncertainCreate(true); if (creationAttempt.current) creationAttempt.current.uncertain = true }
    if (pendingIntent.current === 'delete') setDeleteRecovery([...deleteAttempts.current.keys()])
    pending.current.abort(); pending.current = null; pendingIntent.current = null; setBusy(false); setNotice('')
    setError('Selected patient access was lost during the operation. We could not confirm whether it was saved. Your entries remain here. Retry access and review the reloaded saved list before proceeding.')
  }, [authorized])
  const reset = () => { editorVersion.current = null; setEditorConflict(false); creationAttempt.current = null; setCreateRecovery(false); uncertainCreateRef.current = false; setUncertainCreate(false); setForm(empty); setBaseline(empty); setEditingId(null); setErrors({}); setShowForm(false) }
  const changePatient = (id: string) => { if (id === patientId && (uncertainCreateRef.current || creationAttempt.current?.uncertain) && !reconciliationReady) { setError('Reload the saved instructions before discarding this unconfirmed create.'); return }; if (!validPage() || pending.current || (id && !clinicalSelectedPatientPath(id))) return; patientRef.current = id; deleteAttempts.current.clear(); setDeleteRecovery([]); setPatientId(id); setPendingPatientId(null); setProjection(null); setError(''); setNotice(''); reset() }
  const choosePatient = (id: string) => { if (!validPage() || pending.current) return; if (dirty) setPendingPatientId(id); else changePatient(id) }
  function begin(intent: 'create' | 'update' | 'delete') {
    if (!validPage() || !patientId || patientRef.current !== patientId || !authorized || selectionAccess.current.id !== patientId || !selectionAccess.current.allowed || pending.current) return null
    if (intent === 'create' && uncertainCreateRef.current) { setError('Review the reloaded saved records and explicitly discard this unconfirmed draft before starting a new create.'); return null }
    if (resource.refreshing || selectionAccess.current.refreshing) { setError('Wait for the saved instructions to finish loading, then retry this action.'); return null }
    const action = captureAction(), controller = new AbortController(), owner = patientId, epoch = selectionAccess.current.epoch
    const isCurrent = () => action.isCurrent() && validPage() && patientRef.current === owner && selectionAccess.current.id === owner && selectionAccess.current.allowed && selectionAccess.current.epoch === epoch && !controller.signal.aborted
    pending.current = controller; pendingIntent.current = intent; setBusy(true); setError(''); setNotice('')
    return { controller, isCurrent, finish: () => { if (pending.current === controller) { pending.current = null; pendingIntent.current = null }; if (isCurrent()) setBusy(false) } }
  }
  const apply = (data: Record<string, unknown>) => { setProjection({ patientId, base: resource.data, data }); resource.retry() }
  async function save() {
    if (!validPage() || patientRef.current !== patientId) return
    if (editingId && editorConflict) { setError('Reload and review the saved record, then discard and reopen these edits before saving.'); return }
    if (editingId && !editorVersion.current) { setError(MISSING_CLINICAL_VERSION); return }
    if (editingId && !eligibleIdentifier(editingId)) { setError('This record cannot be corrected until its identifier is repaired. Refresh the saved list.'); return }
    const validation = authoringChanges(kind, form, baseline, Boolean(editingId)); setErrors(validation.errors)
    if (Object.keys(validation.errors).length) { setError('Correct the highlighted fields before saving.'); document.getElementById(`instruction-${Object.keys(validation.errors)[0]}`)?.focus(); return }
    if (editingId && !Object.keys(validation.payload).length) { setNotice('No changed fields to save.'); return }
    const body = { patient_id: patientId, ...validation.payload }, creationKind = kind === 'medication' ? 'medication' : 'care_plan'
    const owner = JSON.stringify([scope, path, query, patientId, creationKind])
    if (!editingId && creationAttempt.current?.uncertain && !sameClinicalCreateIntent(creationAttempt.current.intent, owner, creationKind, body)) { setError('These details differ from the unconfirmed creation. Restore its original details to retry, or reload and review the saved list, then explicitly discard this draft before starting a new creation.'); return }
    const operation = begin(editingId ? 'update' : 'create'); if (!operation) return
    let sent = false
    try {
      const previous = creationAttempt.current
      const intent = editingId ? null : clinicalCreateIntent(previous?.intent || null, owner, creationKind, body)
      if (intent) creationAttempt.current = { intent, uncertain: previous?.uncertain || false, reviewBase: previous?.reviewBase ?? resource.data }
      sent = true
      const data = editingId ? await apiPut<Record<string, unknown>>(kind === 'medication' ? endpoint : `${endpoint}/${encodeURIComponent(patientId)}/${encodeURIComponent(editingId)}`, kind === 'medication' ? { ...body, medication_id: editingId } : body, clinicalWriteHeaders(editorVersion.current), operation.controller.signal)
        : await apiPost<Record<string, unknown>>(endpoint, { ...body, creation_id: intent!.creationId }, undefined, operation.controller.signal)
      if (!operation.isCurrent()) return
      const receipt = intent ? clinicalCreationReceipt(data, intent) : null
      if (intent && !receipt) throw new Error('The creation could not be confirmed. Retry the same details to recover this attempt; it may already have been saved.')
      apply(data); reset(); setNotice(editingId ? 'Changed clinical fields saved. Unchanged fields were preserved.' : receipt?.available === false ? 'The earlier creation was recorded but is no longer in the current instruction list. It has not been restored.' : receipt?.replayed ? 'This creation was already saved. The current recorded instructions are shown below.' : kind === 'medication' ? 'Medication instructions saved. This does not issue an electronic prescription.' : 'Care plan saved.')
    } catch (failure) {
      if (!operation.isCurrent()) return
      const fieldErrors = clinicalValidationErrors(failure)
      if (editingId && failure instanceof ApiError && clinicalRecordChanged(failure.status, failure.body)) { editorConflictBase.current = latestData.current; setEditorConflict(true) }
      if (!editingId && sent && creationAttempt.current) {
        if (!creationAttempt.current.uncertain && failure instanceof ApiError && failure.status === 422 && Object.keys(fieldErrors).length) { creationAttempt.current = null; setCreateRecovery(false) }
        else { creationAttempt.current.uncertain = true; creationAttempt.current.reviewBase = resource.data; setCreateRecovery(true); resource.retry() }
      }
      if (isAuthError(failure)) { router.replace('/auth/doctor/login'); return }
      setErrors(fieldErrors); setError(getApiErrorDetail(failure) || 'The clinical instructions could not be saved. Your entries remain here.')
    } finally { operation.finish() }
  }

  function eligibleIdentifier(id: string) {
    const matches = records.items.filter(value => (kind === 'medication' ? medicationInstruction(value) : careInstruction(value)).id === id)
    return matches.length === 1 && instructionActionsAllowed(kind === 'medication' ? medicationInstruction(matches[0]) : careInstruction(matches[0]))
  }
  async function remove(value: unknown) {
    if (!validPage() || patientRef.current !== patientId) return
    const id = (kind === 'medication' ? medicationInstruction(value) : careInstruction(value)).id
    if (!id || !instructionIdentifier(id)) return
    if (!eligibleIdentifier(id)) { setError('This record identifier is duplicated. Correction actions are unavailable until the data is repaired.'); return }
    if (dirty) { setError('Save or discard the current edits before deleting a record.'); return }
    const original = deleteAttempts.current.get(id)
    if (original?.conflicted) { setError('Reload and review the saved list, then discard this stale delete attempt before trying again.'); return }
    const version = original?.version || recordWriteVersion(value)
    if (!version) { setError(MISSING_CLINICAL_VERSION); return }
    const operation = begin('delete'); if (!operation) return
    const attempt = original || { version, base: resource.data, conflicted: false, label: (kind === 'medication' ? medicationInstruction(value).name : careInstruction(value).title) || 'Clinical record' }; deleteAttempts.current.set(id, attempt)
    try { const data = await apiDelete<Record<string, unknown>>(`${endpoint}/${encodeURIComponent(patientId)}/${encodeURIComponent(id)}`, clinicalWriteHeaders(version), operation.controller.signal); if (operation.isCurrent()) { deleteAttempts.current.delete(id); setDeleteRecovery(previous => previous.filter(value => value !== id)); apply(data); if (editingId === id) reset(); setNotice('Record removed from the current instruction list.') } }
    catch (failure) { if (operation.isCurrent()) { attempt.conflicted = failure instanceof ApiError && clinicalRecordChanged(failure.status, failure.body); attempt.base = latestData.current; setDeleteRecovery(previous => previous.includes(id) ? previous : [...previous, id]); setError(getApiErrorDetail(failure) || 'The record could not be removed. The original record version has been retained for retry.') } }
    finally { operation.finish() }
  }
  function discardDelete(id: string) {
    const attempt = deleteAttempts.current.get(id)
    if (!validPage() || pending.current || !authorized || resource.refreshing || resource.error || !attempt || resource.data === attempt.base) return
    deleteAttempts.current.delete(id); setDeleteRecovery(previous => previous.filter(value => value !== id)); setError(''); setNotice('The delete attempt was discarded. Review the current record before choosing a new action.')
  }

  function edit(value: unknown) {
    if (!validPage() || pending.current) return
    const record = kind === 'medication' ? medicationInstruction(value) : careInstruction(value)
    if (!record.id || records.duplicateIds.includes(record.id) || !instructionActionsAllowed(record)) return
    if (dirty) { setError('Save or discard your current edits before opening another record.'); return }
    if (deleteAttempts.current.has(record.id)) { setDeleteRecovery(previous => previous.includes(record.id!) ? previous : [...previous, record.id!]); setError('Reload and review the saved list, then discard the earlier delete attempt before opening this record.'); return }
    const version = recordWriteVersion(value)
    if (!version) { setError(MISSING_CLINICAL_VERSION); return }
    editorVersion.current = version; setEditorConflict(false)
    const next = savedAuthoringForm(kind, value); setForm(next); setBaseline(next); setEditingId(record.id); setErrors({}); setError(''); setNotice(''); setShowForm(true)
  }
  const update = (key: string, value: string) => { if (!validPage() || pending.current || (editingId && key === 'episode_id')) return; setForm(previous => ({ ...previous, values: { ...previous.values, [key]: value } })); setErrors(previous => ({ ...previous, [key]: '' })) }
  const field = (key: string, label: string, required: boolean, max: number, placeholder = '', multiline = false) => <div key={key}><label htmlFor={`instruction-${key}`} className='font-semibold text-ink'>{label} <span className='text-sm font-normal text-secondary'>({required ? 'Required' : 'Optional'})</span></label>{multiline ? <textarea id={`instruction-${key}`} className={`${control} mt-2`} rows={3} maxLength={max} placeholder={placeholder} value={form.values[key] ?? ''} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `instruction-${key}-error` : undefined} onChange={event => update(key, event.target.value)} /> : <input id={`instruction-${key}`} className={`${control} mt-2`} maxLength={max} placeholder={placeholder} value={form.values[key] ?? ''} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `instruction-${key}-error` : undefined} onChange={event => update(key, event.target.value)} />}{errors[key] && <p id={`instruction-${key}-error`} role='alert' className='mt-2 text-sm text-danger'>{errors[key]}</p>}</div>
  const title = kind === 'medication' ? 'Prescriptions' : 'Care Plans', plural = kind === 'medication' ? 'Medications' : 'Care Plans'
  return <div className='space-y-6'><header><h1 className='text-2xl font-bold text-ink'>{title}</h1><p className='mt-2 text-sm leading-7 text-secondary'>{kind === 'medication' ? 'Record medication instructions. This workflow does not issue a signed electronic prescription.' : 'Record and maintain clinician-led care plans.'}</p></header>
    <ClinicalPatientDirectory selectedId={patientId} selectedPatient={selectedPatient} disabled={busy} isCurrent={validPage} onSelect={choosePatient} />
    {patientId && <PortalCard>{selectedDirectory.refreshing && <p role='status' className='text-sm text-secondary'>Confirming access to the selected patient…</p>}{!selectedDirectory.loading && !authorized && <div role='alert' className='space-y-3 text-sm leading-7 text-danger'><p>{selectedDirectory.errorMessage || 'This patient is no longer available in your assigned patient list. Clinical actions are blocked until access is confirmed.'}</p><PortalButton disabled={busy || selectedDirectory.refreshing} onClick={selectedDirectory.retry}>Retry selected patient access</PortalButton></div>}{errors.patient_id && <p role='alert' className='text-sm text-danger'>{errors.patient_id}</p>}<PortalButton disabled={busy || !authorized || resource.refreshing || selectedDirectory.refreshing} onClick={resource.retry}>{resource.refreshing ? 'Loading...' : `Load ${plural}`}</PortalButton></PortalCard>}
    {error && <p role='alert' className='rounded-xl border border-theme bg-surface p-4 text-sm leading-7 text-danger'>{error}</p>}{notice && <p role='status' className='rounded-xl border border-theme bg-surface p-4 text-sm leading-7 text-secondary'>{notice}</p>}
    {patientId && authorized && <><PortalButton disabled={busy} onClick={() => { if (validPage()) setShowForm(value => !value) }}>{showForm ? dirty ? 'Hide unsaved form' : 'Close form' : kind === 'medication' ? 'Add Medication' : 'Add Care Plan'}</PortalButton>
      {uncertainCreate && <PortalCard role='alert'><p className='text-sm leading-7 text-danger'>The previous create has an unknown outcome. Reload and review the saved instructions, then explicitly discard this unconfirmed draft before creating another record. A reload alone does not make retrying the create safe.</p><PortalButton className='mt-3' disabled={resource.refreshing} onClick={resource.retry}>Reload saved instructions</PortalButton><p className='mt-3 text-sm text-secondary'>{reconciliationReady ? 'Saved instructions have reloaded. Review them below, then use Discard edits to reset this draft.' : 'A successful authorized reload is required before resetting this draft.'}</p></PortalCard>}
      {createRecovery && !uncertainCreate && <PortalCard role='alert'><p className='text-sm leading-7'>This creation may already have been saved. Retry unchanged details to recover the same creation. Changed details require reloading and reviewing the saved list, then explicitly discarding this draft before starting a new creation.</p><PortalButton className='mt-3' disabled={resource.refreshing} onClick={resource.retry}>Reload saved instructions</PortalButton></PortalCard>}
      {editorConflict && <PortalCard role='alert'><p className='text-sm leading-7'>This record changed after you opened it. Your unsaved entries and original version remain here. Reload and review the current record, then discard and reopen the edits to accept its newer version.</p><PortalButton className='mt-3' disabled={resource.refreshing} onClick={resource.retry}>Reload changed record</PortalButton></PortalCard>}
      {deleteRecovery.map(id => { const attempt = deleteAttempts.current.get(id); return <PortalCard key={id} role='alert'><p className='mb-2 font-semibold'>{attempt?.label || 'Clinical record'}</p><p className='text-sm leading-7'>The delete could not be confirmed against the original record version. Reload and review the current list before discarding this attempt. No delete is retried automatically.</p><div className='mt-3 flex flex-wrap gap-3'><PortalButton disabled={busy || resource.refreshing} onClick={resource.retry}>Reload delete outcome</PortalButton><PortalButton disabled={busy || !authorized || resource.refreshing || Boolean(resource.error) || !attempt || resource.data === attempt.base} onClick={() => discardDelete(id)}>Discard delete attempt</PortalButton></div></PortalCard> })}
      {showForm && <PortalCard><h2 className='portal-h2'>{editingId ? 'Correct saved instructions' : kind === 'medication' ? 'New Medication' : 'New Care Plan'}</h2><p className='mb-5 text-sm leading-7 text-secondary'>{editingId ? 'Only changed fields are saved. Untouched historical gaps remain flagged; optional fields can be cleared explicitly.' : 'Required fields must be completed. Optional fields may be left blank.'}</p><form noValidate onSubmit={event => { event.preventDefault(); void save() }}><fieldset disabled={busy} className='grid min-w-0 gap-5'>
        {!editingId && field('episode_id', 'Episode ID', false, 80, 'CWS Episode ID')}
        {kind === 'medication' ? <>{MEDICATION_FIELDS.map(item => field(item.key, item.label, 'required' in item && item.required, item.max, item.placeholder, 'multiline' in item && item.multiline))}<div><p id='instruction-times-label' className='font-semibold text-ink'>Times of Day (Optional)</p><div aria-labelledby='instruction-times-label' className='mt-2 flex flex-wrap gap-2'>{DAYPARTS.map(part => <PortalButton type='button' key={part} aria-pressed={form.times.includes(part)} onClick={() => { if (validPage() && !pending.current) setForm(previous => ({ ...previous, times: previous.times.includes(part) ? previous.times.filter(value => value !== part) : [...previous.times, part] })) }}>{part}</PortalButton>)}</div><label htmlFor='instruction-times' className='mt-4 block text-sm font-semibold text-secondary'>Additional clock times (24-hour HH:MM, optional)</label><input id='instruction-times' className={`${control} mt-2`} value={form.clockTimes} placeholder='08:00, 20:00' aria-invalid={Boolean(errors.times)} aria-describedby={errors.times ? 'instruction-times-error' : undefined} onChange={event => { if (validPage()) setForm(previous => ({ ...previous, clockTimes: event.target.value })) }} />{errors.times && <p id='instruction-times-error' role='alert' className='mt-2 text-sm text-danger'>{errors.times}</p>}</div>{editingId && field('status', 'Clinical status', true, 80)}</> : <>{field('title', 'Title', true, 220, 'Care plan title')}{field('status', 'Clinical status', true, 80)}<p className='text-sm text-secondary'>Supported examples: Active, Monitoring, Completed, On Hold. Preserve the recorded status when no change is intended.</p>{field('description', 'Description', false, 10000, 'Care plan description', true)}<div><label htmlFor='instruction-progress' className='font-semibold text-ink'>Progress (Optional, 0–100%)</label><input id='instruction-progress' className={`${control} mt-2`} type='number' min={0} max={100} step={1} value={form.values.progress} aria-invalid={Boolean(errors.progress)} aria-describedby={errors.progress ? 'instruction-progress-error' : undefined} onChange={event => update('progress', event.target.value)} /><p className='mt-2 text-sm text-secondary'>Leave blank when progress has not been recorded.</p>{errors.progress && <p id='instruction-progress-error' role='alert' className='mt-2 text-sm text-danger'>{errors.progress}</p>}</div></>}
        <div className='flex flex-wrap gap-3'><PortalButton type='submit' tone='primary' disabled={uncertainCreate && !editingId || Boolean(editingId && editorConflict)}>{busy ? 'Saving...' : editingId ? 'Save changes' : createRecovery ? 'Retry same creation' : kind === 'medication' ? 'Add Medication' : 'Create Care Plan'}</PortalButton>{dirty && <PortalButton type='button' disabled={(uncertainCreate || createRecovery) && !reconciliationReady || editorConflict && (!authorized || resource.refreshing || Boolean(resource.error) || resource.data === editorConflictBase.current)} onClick={() => { if (validPage()) { setPendingPatientId(patientId) } }}>Discard edits</PortalButton>}</div>
      </fieldset></form></PortalCard>}
      {resource.loading ? <p role='status' className='text-secondary'>Loading saved instructions…</p> : resource.error || records.invalid ? <PortalCard role='alert'><p className='mb-3'>{resource.errorMessage || 'The saved instruction list could not be confirmed. Please retry.'}</p><PortalButton onClick={resource.retry}>Retry {plural.toLowerCase()}</PortalButton></PortalCard> : <section aria-label='Saved clinical instructions' className='space-y-4'><h2 className='portal-h2'>{kind === 'medication' ? 'Current Medications' : 'Existing Care Plans'}</h2>{!records.items.length && <p className='rounded-xl border border-dashed border-theme p-5 text-secondary'>{kind === 'medication' ? 'No medications found for this patient' : 'No care plans found for this patient'}</p>}{records.invalidCount > 0 && <p role='alert' className='text-sm text-secondary'>Some historical entries could not be displayed. The saved data has not been changed.</p>}{records.truncated && <p role='alert' className='text-sm text-secondary'>Showing the first 200 saved records. Remaining records have not been loaded in this view.</p>}{records.items.map((record, index) => { const normalized = kind === 'medication' ? medicationInstruction(record) : careInstruction(record); return <div key={`${normalized.id || 'legacy'}:${index}`} className='space-y-2'>{kind === 'medication' ? <MedicationRecordCard medication={medicationInstruction(record)} busy={busy} actionsAvailable={instructionActionsAllowed(normalized) && !records.duplicateIds.includes(normalized.id!)} onDelete={() => void remove(record)} /> : <CarePlanRecordCard plan={careInstruction(record)} busy={busy} actionsAvailable={instructionActionsAllowed(normalized) && !records.duplicateIds.includes(normalized.id!)} onDelete={() => void remove(record)} />}<PortalButton disabled={busy || !instructionActionsAllowed(normalized) || records.duplicateIds.includes(normalized.id!)} onClick={() => edit(record)}>Edit</PortalButton>{normalized.id && records.duplicateIds.includes(normalized.id) && <p className='text-sm leading-7 text-secondary'>This record identifier is duplicated. Edit and delete are unavailable until the data is repaired.</p>}</div> })}</section>}
    </>}
    <UnsavedChangesDialog open={pendingPatientId !== null || navigation.active} busy={busy} onKeepEditing={() => { setPendingPatientId(null); if (navigation.active) navigation.reject() }} onDiscard={() => { if (pendingPatientId !== null) changePatient(pendingPatientId); else navigation.accept() }} />
  </div>
}

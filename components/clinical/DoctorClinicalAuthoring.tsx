'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useNavigationGuard } from 'nextjs-nav-guard'
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog'
import { PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import { MedicationRecordCard, CarePlanRecordCard } from './InstructionRecords'
import { apiPost, apiPut, apiDelete, getApiErrorDetail, isAuthError, type DoctorPatientsResponse } from '@/lib/api'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { currentPortal } from '@/lib/portal-scope'
import { usePortalAction } from '@/lib/portal-action'
import { usePortalResource } from '@/lib/use-portal-resource'
import { MEDICATION_FIELDS, DAYPARTS, clinicalValidationErrors, instructionList, medicationInstruction, careInstruction, instructionIdentifier, instructionActionsAllowed } from '@/lib/clinical-instructions'
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
  const directory = usePortalResource<DoctorPatientsResponse>('/api/v1/doctor/patients?page=1&page_size=25', false, { refreshOnFocus: true, abortOnCleanup: true })
  const patients = Array.isArray(directory.data?.patients) ? directory.data.patients : []
  const [patientId, setPatientId] = useState(''), [pendingPatientId, setPendingPatientId] = useState<string | null>(null)
  const endpoint = kind === 'medication' ? '/api/v1/doctor/prescriptions' : '/api/v1/doctor/care-plans'
  const collectionKey = kind === 'medication' ? 'medications' : 'care_plans'
  const authorized = patients.some(patient => patient.patient_id === patientId)
  const resource = usePortalResource<Record<string, unknown>>(patientId && authorized ? `${endpoint}/${encodeURIComponent(patientId)}` : null, false, { refreshOnFocus: true, abortOnCleanup: true })
  const empty = useMemo(() => emptyAuthoringForm(kind), [kind])
  const [form, setForm] = useState<AuthoringForm>(empty), [baseline, setBaseline] = useState<AuthoringForm>(empty)
  const [editingId, setEditingId] = useState<string | null>(null), [showForm, setShowForm] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({}), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  const pending = useRef<AbortController | null>(null)
  const [projection, setProjection] = useState<{ patientId: string; base: unknown; data: Record<string, unknown> } | null>(null)
  const source = projection?.patientId === patientId && projection.base === resource.data ? projection.data : resource.data
  const records = instructionList(source?.[collectionKey])
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline)
  const navigation = useNavigationGuard({ enabled: ({ to }) => (dirty || busy) && !to.startsWith('/auth/') })
  const validPage = useCallback(() => !!scope && scope === doctorScope() && currentPortal() === 'doctor' && window.location.pathname === path && new URLSearchParams(window.location.search).toString() === query, [scope, path, query])
  useEffect(() => () => { pending.current?.abort(); pending.current = null }, [])
  const reset = () => { setForm(empty); setBaseline(empty); setEditingId(null); setErrors({}); setShowForm(false) }
  const changePatient = (id: string) => { if (!validPage() || pending.current || (id && !patients.some(patient => patient.patient_id === id))) return; patientRef.current = id; setPatientId(id); setPendingPatientId(null); setProjection(null); setError(''); setNotice(''); reset() }
  const choosePatient = (id: string) => { if (!validPage() || pending.current) return; if (dirty) setPendingPatientId(id); else changePatient(id) }
  function begin() {
    if (!validPage() || !patientId || patientRef.current !== patientId || !authorized || pending.current) return null
    if (resource.refreshing) { setError('Wait for the saved instructions to finish loading, then retry this action.'); return null }
    const action = captureAction(), controller = new AbortController(), owner = patientId
    const isCurrent = () => action.isCurrent() && validPage() && patientRef.current === owner && !controller.signal.aborted
    pending.current = controller; setBusy(true); setError(''); setNotice('')
    return { controller, isCurrent, finish: () => { if (pending.current === controller) pending.current = null; if (isCurrent()) setBusy(false) } }
  }
  const apply = (data: Record<string, unknown>) => { setProjection({ patientId, base: resource.data, data }); resource.retry() }
  async function save() {
    if (!validPage() || patientRef.current !== patientId) return
    if (editingId && !eligibleIdentifier(editingId)) { setError('This record cannot be corrected until its identifier is repaired. Refresh the saved list.'); return }
    const validation = authoringChanges(kind, form, baseline, Boolean(editingId)); setErrors(validation.errors)
    if (Object.keys(validation.errors).length) { setError('Correct the highlighted fields before saving.'); document.getElementById(`instruction-${Object.keys(validation.errors)[0]}`)?.focus(); return }
    if (editingId && !Object.keys(validation.payload).length) { setNotice('No changed fields to save.'); return }
    const operation = begin(); if (!operation) return
    try {
      const body = { patient_id: patientId, ...validation.payload }
      const data = editingId ? await apiPut<Record<string, unknown>>(kind === 'medication' ? endpoint : `${endpoint}/${encodeURIComponent(patientId)}/${encodeURIComponent(editingId)}`, kind === 'medication' ? { ...body, medication_id: editingId } : body, undefined, operation.controller.signal)
        : await apiPost<Record<string, unknown>>(endpoint, body, undefined, operation.controller.signal)
      if (!operation.isCurrent()) return
      apply(data); reset(); setNotice(editingId ? 'Changed clinical fields saved. Unchanged fields were preserved.' : kind === 'medication' ? 'Medication instructions saved. This does not issue an electronic prescription.' : 'Care plan saved.')
    } catch (failure) { if (!operation.isCurrent()) return; if (isAuthError(failure)) { router.replace('/auth/doctor/login'); return }; setErrors(clinicalValidationErrors(failure)); setError(getApiErrorDetail(failure) || 'The clinical instructions could not be saved. Your entries remain here.') }
    finally { operation.finish() }
  }
  function eligibleIdentifier(id: string) {
    const matches = records.items.filter(value => (kind === 'medication' ? medicationInstruction(value) : careInstruction(value)).id === id)
    return matches.length === 1 && instructionActionsAllowed(kind === 'medication' ? medicationInstruction(matches[0]) : careInstruction(matches[0]))
  }
  async function remove(id: string | null) {
    if (!id || !instructionIdentifier(id)) return
    if (!eligibleIdentifier(id)) { setError('This record identifier is duplicated. Correction actions are unavailable until the data is repaired.'); return }
    if (dirty) { setError('Save or discard the current edits before deleting a record.'); return }
    const operation = begin(); if (!operation) return
    try { const data = await apiDelete<Record<string, unknown>>(`${endpoint}/${encodeURIComponent(patientId)}/${encodeURIComponent(id)}`, undefined, operation.controller.signal); if (operation.isCurrent()) { apply(data); if (editingId === id) reset(); setNotice('Record removed from the current instruction list.') } }
    catch (failure) { if (operation.isCurrent()) setError(getApiErrorDetail(failure) || 'The record could not be removed. Please retry.') }
    finally { operation.finish() }
  }
  function edit(value: unknown) {
    if (!validPage() || pending.current) return
    const record = kind === 'medication' ? medicationInstruction(value) : careInstruction(value)
    if (!record.id || records.duplicateIds.includes(record.id) || !instructionActionsAllowed(record)) return
    if (dirty) { setError('Save or discard your current edits before opening another record.'); return }
    const next = savedAuthoringForm(kind, value); setForm(next); setBaseline(next); setEditingId(record.id); setErrors({}); setError(''); setNotice(''); setShowForm(true)
  }
  const update = (key: string, value: string) => { if (!validPage() || pending.current || (editingId && key === 'episode_id')) return; setForm(previous => ({ ...previous, values: { ...previous.values, [key]: value } })); setErrors(previous => ({ ...previous, [key]: '' })) }
  const field = (key: string, label: string, required: boolean, max: number, placeholder = '', multiline = false) => <div key={key}><label htmlFor={`instruction-${key}`} className='font-semibold text-ink'>{label} <span className='text-sm font-normal text-secondary'>({required ? 'Required' : 'Optional'})</span></label>{multiline ? <textarea id={`instruction-${key}`} className={`${control} mt-2`} rows={3} maxLength={max} placeholder={placeholder} value={form.values[key] ?? ''} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `instruction-${key}-error` : undefined} onChange={event => update(key, event.target.value)} /> : <input id={`instruction-${key}`} className={`${control} mt-2`} maxLength={max} placeholder={placeholder} value={form.values[key] ?? ''} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `instruction-${key}-error` : undefined} onChange={event => update(key, event.target.value)} />}{errors[key] && <p id={`instruction-${key}-error`} role='alert' className='mt-2 text-sm text-danger'>{errors[key]}</p>}</div>
  const title = kind === 'medication' ? 'Prescriptions' : 'Care Plans', plural = kind === 'medication' ? 'Medications' : 'Care Plans'
  return <div className='space-y-6'><header><h1 className='text-2xl font-bold text-ink'>{title}</h1><p className='mt-2 text-sm leading-7 text-secondary'>{kind === 'medication' ? 'Record medication instructions. This workflow does not issue a signed electronic prescription.' : 'Record and maintain clinician-led care plans.'}</p></header>
    <PortalCard><label htmlFor='clinical-patient-select' className='mb-2 block font-semibold text-ink'>Select Patient</label><select id='clinical-patient-select' className={control} value={patientId} disabled={busy || directory.loading} onChange={event => choosePatient(event.target.value)}><option value=''>-- Choose a patient --</option>{patients.map(patient => <option key={patient.patient_id} value={patient.patient_id}>{patient.name || patient.email}</option>)}</select>{directory.loading && <p role='status' className='mt-3 text-sm text-secondary'>Loading assigned patients…</p>}{directory.error && <div role='alert' className='mt-4'><p>{directory.errorMessage}</p><PortalButton onClick={directory.retry}>Retry patients</PortalButton></div>}{errors.patient_id && <p role='alert' className='mt-2 text-sm text-danger'>{errors.patient_id}</p>}<PortalButton className='mt-4' disabled={busy || !patientId || resource.refreshing} onClick={resource.retry}>{resource.refreshing ? 'Loading...' : `Load ${plural}`}</PortalButton></PortalCard>
    {error && <p role='alert' className='rounded-xl border border-theme bg-surface p-4 text-sm leading-7 text-danger'>{error}</p>}{notice && <p role='status' className='rounded-xl border border-theme bg-surface p-4 text-sm leading-7 text-secondary'>{notice}</p>}
    {patientId && authorized && <><PortalButton disabled={busy} onClick={() => { if (validPage()) setShowForm(value => !value) }}>{showForm ? dirty ? 'Hide unsaved form' : 'Close form' : kind === 'medication' ? 'Add Medication' : 'Add Care Plan'}</PortalButton>
      {showForm && <PortalCard><h2 className='portal-h2'>{editingId ? 'Correct saved instructions' : kind === 'medication' ? 'New Medication' : 'New Care Plan'}</h2><p className='mb-5 text-sm leading-7 text-secondary'>{editingId ? 'Only changed fields are saved. Untouched historical gaps remain flagged; optional fields can be cleared explicitly.' : 'Required fields must be completed. Optional fields may be left blank.'}</p><form noValidate onSubmit={event => { event.preventDefault(); void save() }}><fieldset disabled={busy} className='grid min-w-0 gap-5'>
        {!editingId && field('episode_id', 'Episode ID', false, 80, 'CWS Episode ID')}
        {kind === 'medication' ? <>{MEDICATION_FIELDS.map(item => field(item.key, item.label, 'required' in item && item.required, item.max, item.placeholder, 'multiline' in item && item.multiline))}<div><p id='instruction-times-label' className='font-semibold text-ink'>Times of Day (Optional)</p><div aria-labelledby='instruction-times-label' className='mt-2 flex flex-wrap gap-2'>{DAYPARTS.map(part => <PortalButton type='button' key={part} aria-pressed={form.times.includes(part)} onClick={() => { if (validPage() && !pending.current) setForm(previous => ({ ...previous, times: previous.times.includes(part) ? previous.times.filter(value => value !== part) : [...previous.times, part] })) }}>{part}</PortalButton>)}</div><label htmlFor='instruction-times' className='mt-4 block text-sm font-semibold text-secondary'>Additional clock times (24-hour HH:MM, optional)</label><input id='instruction-times' className={`${control} mt-2`} value={form.clockTimes} placeholder='08:00, 20:00' aria-invalid={Boolean(errors.times)} aria-describedby={errors.times ? 'instruction-times-error' : undefined} onChange={event => { if (validPage()) setForm(previous => ({ ...previous, clockTimes: event.target.value })) }} />{errors.times && <p id='instruction-times-error' role='alert' className='mt-2 text-sm text-danger'>{errors.times}</p>}</div>{editingId && field('status', 'Clinical status', true, 80)}</> : <>{field('title', 'Title', true, 220, 'Care plan title')}{field('status', 'Clinical status', true, 80)}<p className='text-sm text-secondary'>Supported examples: Active, Monitoring, Completed, On Hold. Preserve the recorded status when no change is intended.</p>{field('description', 'Description', false, 10000, 'Care plan description', true)}<div><label htmlFor='instruction-progress' className='font-semibold text-ink'>Progress (Optional, 0–100%)</label><input id='instruction-progress' className={`${control} mt-2`} type='number' min={0} max={100} step={1} value={form.values.progress} aria-invalid={Boolean(errors.progress)} aria-describedby={errors.progress ? 'instruction-progress-error' : undefined} onChange={event => update('progress', event.target.value)} /><p className='mt-2 text-sm text-secondary'>Leave blank when progress has not been recorded.</p>{errors.progress && <p id='instruction-progress-error' role='alert' className='mt-2 text-sm text-danger'>{errors.progress}</p>}</div></>}
        <div className='flex flex-wrap gap-3'><PortalButton type='submit' tone='primary'>{busy ? 'Saving...' : editingId ? 'Save changes' : kind === 'medication' ? 'Add Medication' : 'Create Care Plan'}</PortalButton>{dirty && <PortalButton type='button' onClick={() => { if (validPage()) { setPendingPatientId(patientId) } }}>Discard edits</PortalButton>}</div>
      </fieldset></form></PortalCard>}
      {resource.loading ? <p role='status' className='text-secondary'>Loading saved instructions…</p> : resource.error || records.invalid ? <PortalCard role='alert'><p className='mb-3'>{resource.errorMessage || 'The saved instruction list could not be confirmed. Please retry.'}</p><PortalButton onClick={resource.retry}>Retry {plural.toLowerCase()}</PortalButton></PortalCard> : <section aria-label='Saved clinical instructions' className='space-y-4'><h2 className='portal-h2'>{kind === 'medication' ? 'Current Medications' : 'Existing Care Plans'}</h2>{!records.items.length && <p className='rounded-xl border border-dashed border-theme p-5 text-secondary'>{kind === 'medication' ? 'No medications found for this patient' : 'No care plans found for this patient'}</p>}{records.invalidCount > 0 && <p role='alert' className='text-sm text-secondary'>Some historical entries could not be displayed. The saved data has not been changed.</p>}{records.truncated && <p role='alert' className='text-sm text-secondary'>Showing the first 200 saved records. Remaining records have not been loaded in this view.</p>}{records.items.map((record, index) => { const normalized = kind === 'medication' ? medicationInstruction(record) : careInstruction(record); return <div key={`${normalized.id || 'legacy'}:${index}`} className='space-y-2'>{kind === 'medication' ? <MedicationRecordCard medication={medicationInstruction(record)} busy={busy} actionsAvailable={instructionActionsAllowed(normalized) && !records.duplicateIds.includes(normalized.id!)} onDelete={() => void remove(normalized.id)} /> : <CarePlanRecordCard plan={careInstruction(record)} busy={busy} actionsAvailable={instructionActionsAllowed(normalized) && !records.duplicateIds.includes(normalized.id!)} onDelete={() => void remove(normalized.id)} />}<PortalButton disabled={busy || !instructionActionsAllowed(normalized) || records.duplicateIds.includes(normalized.id!)} onClick={() => edit(record)}>Edit</PortalButton>{normalized.id && records.duplicateIds.includes(normalized.id) && <p className='text-sm leading-7 text-secondary'>This record identifier is duplicated. Edit and delete are unavailable until the data is repaired.</p>}</div> })}</section>}
    </>}
    <UnsavedChangesDialog open={pendingPatientId !== null || navigation.active} busy={busy} onKeepEditing={() => { setPendingPatientId(null); if (navigation.active) navigation.reject() }} onDiscard={() => { if (pendingPatientId !== null) changePatient(pendingPatientId); else navigation.accept() }} />
  </div>
}

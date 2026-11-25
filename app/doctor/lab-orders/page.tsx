'use client'

import { useTranslations } from 'next-intl'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { currentPortal } from '@/lib/portal-scope'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { labResultTarget } from '@/lib/doctor-lab-notifications'
import { recordWriteVersion, clinicalRecordChanged, MISSING_CLINICAL_VERSION } from '@/lib/clinical-write-version'
import { clinicalCreateIntent, sameClinicalCreateIntent, clinicalCreationReceipt, type ClinicalCreateIntent } from '@/lib/clinical-create-intent'
import { clinicalValidationErrors } from '@/lib/clinical-instructions'
import { labUploadAttempt, labUploadReceipt, type LabUploadAttempt } from '@/lib/lab-upload-attempt'
import { useNavigationGuard } from 'nextjs-nav-guard'
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog'
import ClinicalPatientDirectory from '@/components/clinical/ClinicalPatientDirectory'
import { clinicalSelectedPatient, clinicalSelectedPatientPath } from '@/lib/clinical-patient-directory'
import { usePortalResource } from '@/lib/use-portal-resource'
import LabResultReviewDialog from '@/components/clinical/LabResultReviewDialog'
import LabResultReviewStatus from '@/components/clinical/LabResultReviewStatus'
import { labReference, type LabReviewTarget } from '@/lib/lab-result-review'
import SecureDocumentAccessDialog from '@/components/ui/SecureDocumentAccessDialog'
import { usePortalAction } from '@/lib/portal-action'
import { medicalUploadError } from '@/lib/clinical-upload'
import { orderDateFromIso, orderDateToIso } from '@/lib/clinical-order-dates'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import {
  ApiError,
  clearPortalSession,
  createDoctorLabOrder,
  deleteDoctorLabOrder,
  getApiErrorDetail,
  getDoctorLabOrders,
  getDoctorLabResultAccess,
  isAuthError,
  readSessionMarker,
  recordDoctorLabResultReview,
  updateDoctorLabOrder,
  uploadDoctorLabResult,
  type DoctorLabOrderPayload,
  type PatientLabRequest,
} from '@/lib/api'

const emptyForm: DoctorLabOrderPayload = {
  patient_id: '',
  episode_id: '',
  title: '',
  category: '',
  test: '',
  status: 'Pending',
  scheduled_for: '',
  recommended_date: '',
  recommended_lab_name: '',
  recommended_lab_address: '',
  description: '',
  reason: '',
  priority: 'Routine',
  processing_time: '',
  preparation_instructions: '',
}

const inputStyle = {
  width: '100%',
  minHeight: '44px',
  padding: '12px 14px',
  borderRadius: '12px',
  border: "1px solid var(--border)",
  background: "var(--surface-glass)",
  color: T.navy,
  fontSize: '14px',
  fontWeight: 600,
  outline: 'none',
} as const

function DoctorLabOrdersPageContent() {
  const t = useTranslations('doctorLabOrders');
  const priorityLabel = (value: string) => ({ routine: t('routine'), urgent: t('urgent'), high: t('high') } as Record<string, string>)[value.trim().toLowerCase()] ?? value;
  const router = useRouter()
  const renderedScope = readAccountScope('doctor'), renderedPath = usePathname()
  const parameters = useSearchParams()
  const renderedQuery = parameters.toString()
  const isRenderedContext = useCallback(() => currentPortal() === 'doctor' && renderedScope === readAccountScope('doctor') && window.location.pathname === renderedPath && new URLSearchParams(window.location.search).toString() === renderedQuery, [renderedScope, renderedPath, renderedQuery])
  const linked = useMemo(() => labResultTarget(new URLSearchParams(parameters.toString())), [parameters])
  const linkedKey = JSON.stringify(linked)
  const appliedLink = useRef('')
  const dirtyRef = useRef(false)
  const uploadAttempt = useRef<LabUploadAttempt | null>(null)
  const [failedUpload, setFailedUpload] = useState<{ orderId: string; file: File; note: string } | null>(null)
  const [uploadNotice, setUploadNotice] = useState('')
  const captureAction = usePortalAction()
  const operationInFlight = useRef(false), creatingOrder = useRef(false), uncertainCreateRef = useRef(false)
  const [uncertainCreate, setUncertainCreate] = useState(false)
  const creationAttempt = useRef<{ intent: ClinicalCreateIntent; uncertain: boolean; reviewEpoch: number } | null>(null)
  const [createRecovery, setCreateRecovery] = useState(false)
  const ordersReadEpoch = useRef(0), ordersReadFailed = useRef(false)
  const editorWriteVersion = useRef<string | null>(null), editorConflictEpoch = useRef(0)
  const [editorConflict, setEditorConflict] = useState(false)
  const quickWrites = useRef(new Map<string, { version: string; conflicted: boolean; reviewEpoch: number; label: string }>())
  const [quickRecovery, setQuickRecovery] = useState<string[]>([])
  useEffect(() => () => { quickWrites.current.clear(); editorWriteVersion.current = null }, [])
  useEffect(() => () => { creationAttempt.current = null }, [])
  const readVersion = useRef(0)
  const patientScope = useRef('')
  const baseline = useRef({ ...emptyForm })
  const originalDates = useRef<{ scheduled_for?: string | null; recommended_date?: string | null }>({})
  const [pendingChange, setPendingChange] = useState<null | { patientId: string } | { edit: PatientLabRequest } | { cancel: true }>(null)
  const [documentAccess, setDocumentAccess] = useState<{ patientId: string; orderId: string; fileId: string; title: string } | null>(null)
  const closeDocumentAccess = useCallback(() => setDocumentAccess(null), [])
  const loadDocument = useCallback(() => {
    if (!documentAccess || documentAccess.patientId !== patientScope.current || !isRenderedContext()) return Promise.reject(new Error(t('choosePatientRefresh')))
    return getDoctorLabResultAccess(documentAccess.patientId, documentAccess.orderId)
  }, [documentAccess, isRenderedContext, t])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const lookupPatientId = selectedPatientId || (!appliedLink.current ? linked.target?.patientId || '' : '')
  const selectedDirectory = usePortalResource<unknown>(clinicalSelectedPatientPath(lookupPatientId), false, { refreshOnFocus: true, abortOnCleanup: true })
  const selectedPatient = clinicalSelectedPatient(selectedDirectory.data, lookupPatientId)
  const selectedAuthorized = Boolean(selectedPatient && !selectedDirectory.error)
  const authority = useRef({ id: lookupPatientId, allowed: selectedAuthorized, epoch: 0 })
  authority.current = { id: lookupPatientId, allowed: selectedAuthorized, epoch: authority.current.epoch + (authority.current.id !== lookupPatientId || authority.current.allowed && !selectedAuthorized ? 1 : 0) }
  const [labTests, setLabTests] = useState<PatientLabRequest[]>([])
  const currentOrders = useRef(labTests); currentOrders.current = labTests
  const [reviewSelection, setReviewSelection] = useState<LabReviewTarget | null>(null)
  const closeReview = useCallback(() => setReviewSelection(null), [])
  const reviewTargetCurrent = (target: LabReviewTarget) => isRenderedContext() && authority.current.allowed && authority.current.id === target.patientId && patientScope.current === target.patientId && currentOrders.current.some(order => order.id === target.orderId && order.result_file_id === target.fileId && order.can_review_result === true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<DoctorLabOrderPayload>(emptyForm)
  const reviewStillCurrent = Boolean(reviewSelection && reviewTargetCurrent(reviewSelection))
  const documentStillCurrent = Boolean(documentAccess && selectedAuthorized && isRenderedContext() && documentAccess.patientId === patientScope.current && labTests.some(order => order.id === documentAccess.orderId && order.result_file_id === documentAccess.fileId))
  useEffect(() => { if (reviewSelection && !reviewStillCurrent) setReviewSelection(null) }, [reviewSelection, reviewStillCurrent])
  useEffect(() => { if (documentAccess && !documentStillCurrent) setDocumentAccess(null) }, [documentAccess, documentStillCurrent])


  const dirty = showAddForm && JSON.stringify(form) !== JSON.stringify(baseline.current) || createRecovery
  const writeResetReady = selectedAuthorized && !loading && !ordersReadFailed.current && ordersReadEpoch.current > editorConflictEpoch.current
  const creationResetReady = selectedAuthorized && !loading && !ordersReadFailed.current && (!creationAttempt.current?.uncertain || ordersReadEpoch.current > creationAttempt.current.reviewEpoch)
  useEffect(() => { dirtyRef.current = dirty }, [dirty])
  const patientsReady = !lookupPatientId || !selectedDirectory.loading
  const navigation = useNavigationGuard({ enabled: ({ to }) => (dirty || saving) && !to.startsWith('/auth/') })

  const fetchLabTests = useCallback(async (patientId = patientScope.current) => {
    if (!patientId || operationInFlight.current || !isRenderedContext() || authority.current.id !== patientId || !authority.current.allowed) return
    const action = captureAction()
    const version = ++readVersion.current
    const epoch = authority.current.epoch
    const isCurrent = () => action.isCurrent() && isRenderedContext() && version === readVersion.current && patientId === patientScope.current && authority.current.id === patientId && authority.current.allowed && authority.current.epoch === epoch
    setLoading(true); setError(null)
    try {
      const data = await getDoctorLabOrders(patientId)
      if (isCurrent()) { ++ordersReadEpoch.current; ordersReadFailed.current = false; setLabTests(data.test_requests || []) }
    } catch (err) {
      if (!isCurrent()) return
      if (isAuthError(err)) { router.replace('/auth/doctor/login'); return }
      ordersReadFailed.current = true; setError(getApiErrorDetail(err) ?? t('loadFailed'))
    } finally { if (isCurrent()) setLoading(false) }
  }, [captureAction, router, isRenderedContext, t])

  const changePatient = useCallback((patientId: string) => {
    if (operationInFlight.current || !isRenderedContext()) return
    ++readVersion.current
    patientScope.current = patientId
    setDocumentAccess(null); setReviewSelection(null)
    uploadAttempt.current = null; setFailedUpload(null); setUploadNotice('')
    setSelectedPatientId(patientId); setLabTests([]); setShowAddForm(false)
    uncertainCreateRef.current = false; setUncertainCreate(false); creationAttempt.current = null; setCreateRecovery(false); quickWrites.current.clear(); setQuickRecovery([]); editorWriteVersion.current = null; setEditorConflict(false); ordersReadEpoch.current = 0; ordersReadFailed.current = false
    setEditingId(null); setError(null); setLoading(false)
    baseline.current = { ...emptyForm, patient_id: patientId }
    originalDates.current = {}
    setForm(baseline.current); setPendingChange(null)
  }, [isRenderedContext])
  const handlePatientChange = (patientId: string) => {
    if (operationInFlight.current) return
    if (dirty) setPendingChange({ patientId })
    else changePatient(patientId)
  }

  useEffect(() => {
    if (!readSessionMarker()) { clearPortalSession(); router.replace('/auth/doctor/login'); return }
    if (linked.target && appliedLink.current !== linkedKey && selectedAuthorized && selectedPatient?.id === linked.target.patientId && !dirtyRef.current && !operationInFlight.current) { appliedLink.current = linkedKey; changePatient(linked.target.patientId) }
  }, [router, linked, linkedKey, selectedAuthorized, selectedPatient?.id, changePatient])
  useEffect(() => { if (selectedPatientId && selectedAuthorized && selectedPatient?.id === selectedPatientId) void fetchLabTests(selectedPatientId) }, [selectedPatientId, selectedAuthorized, selectedPatient?.id, fetchLabTests])

  useEffect(() => {
    if (selectedAuthorized || !patientScope.current) return
    setDocumentAccess(null); setReviewSelection(null); setLabTests([]); setLoading(false); setQuickRecovery([...quickWrites.current.keys()])
    if (operationInFlight.current && creatingOrder.current) { uncertainCreateRef.current = true; setUncertainCreate(true); if (creationAttempt.current) creationAttempt.current.uncertain = true; setError(t('accessLostDraft')) }
  }, [selectedAuthorized, t])

  const beginEdit = (test: PatientLabRequest) => {
    if (operationInFlight.current || !isRenderedContext() || test.can_edit !== true) { setError(t('editUnconfirmed')); return }
    if (quickWrites.current.has(test.id)) { setError(t('reloadDiscardQuick')); return }
    const version = recordWriteVersion(test)
    if (!version) { setError(MISSING_CLINICAL_VERSION); return }
    if (creationAttempt.current?.uncertain && !creationResetReady) { setError(t('refreshBeforeDiscard')); return }
    creationAttempt.current = null; setCreateRecovery(false)
    editorWriteVersion.current = version; setEditorConflict(false)
    setEditingId(test.id)
    setShowAddForm(true)
    const nextForm = {
      patient_id: selectedPatientId,
      episode_id: test.episode_id ?? '',
      title: test.title,
      category: test.category ?? '',
      test: test.test ?? '',
      status: test.status || 'Pending',
      scheduled_for: orderDateFromIso(test.scheduled_for),
      recommended_date: orderDateFromIso(test.recommended_date),
      recommended_lab_name: test.recommended_lab_name ?? '',
      recommended_lab_address: test.recommended_lab_address ?? '',
      description: test.description ?? '',
      reason: test.reason ?? '',
      priority: test.priority ?? 'Routine',
      processing_time: test.processing_time ?? '',
      preparation_instructions: test.preparation_instructions ?? '',
    }
    baseline.current = nextForm
    originalDates.current = { scheduled_for: test.scheduled_for, recommended_date: test.recommended_date }
    setForm(nextForm); setPendingChange(null)
  }

  const resetForm = (confirmed = false) => {
    if (!isRenderedContext() || operationInFlight.current && !confirmed) return
    if (!confirmed && editorConflict && !writeResetReady) { setError(t('reloadBeforeDiscardEdits')); return }
    editorWriteVersion.current = null; setEditorConflict(false)
    if ((uncertainCreateRef.current || creationAttempt.current?.uncertain) && (!creationResetReady || !selectedAuthorized)) { setError(t('reloadBeforeDiscardCreate')); return }
    uncertainCreateRef.current = false; setUncertainCreate(false); creationAttempt.current = null; setCreateRecovery(false)
    setEditingId(null)
    setShowAddForm(false)
    baseline.current = { ...emptyForm, patient_id: patientScope.current }
    originalDates.current = {}
    setForm(baseline.current); setPendingChange(null)
  }

  // Serialize writes synchronously and bind their continuations to the patient,
  // portal, session and page that started the request.
  const beginMutation = (intent: 'write' | 'create' = 'write') => {
    if (!selectedPatientId || selectedPatientId !== patientScope.current || operationInFlight.current || !renderedScope || !isRenderedContext() || authority.current.id !== patientScope.current || !authority.current.allowed || selectedDirectory.refreshing) return null
    if (intent === 'create' && uncertainCreateRef.current) { setError(t('discardDraftFirst')); return null }
    creatingOrder.current = intent === 'create'; operationInFlight.current = true
    ++readVersion.current
    const action = captureAction()
    const patientId = patientScope.current, epoch = authority.current.epoch
    setSaving(true); setLoading(false); setError(null)
    return { patientId, scope: action.scope, isCurrent: () => action.isCurrent() && isRenderedContext() && patientScope.current === patientId && authority.current.allowed && authority.current.id === patientId && authority.current.epoch === epoch,
      finish: () => { operationInFlight.current = false; creatingOrder.current = false; if (action.isCurrent() && isRenderedContext() && patientScope.current === patientId) setSaving(false) } }
  }

  const handleSave = async () => {
    if (editingId && editorConflict) { setError(t('reloadReopen')); return }
    if (editingId && !editorWriteVersion.current) { setError(MISSING_CLINICAL_VERSION); return }
    if (editingId && currentOrders.current.find(order => order.id === editingId)?.can_edit !== true) { setError(t('cannotEdit')); return }
    if (!selectedPatientId || !form.title.trim()) { setError(t('selectPatientTitle')); return }
    let dates: { scheduled_for: string; recommended_date: string }
    try {
      dates = { scheduled_for: orderDateToIso(form.scheduled_for, originalDates.current.scheduled_for),
        recommended_date: orderDateToIso(form.recommended_date, originalDates.current.recommended_date) }
    } catch (err) { setError(err instanceof Error ? err.message : t('checkDates')); return }
    const payload = { ...form, ...dates, patient_id: patientScope.current, title: form.title.trim() }
    const owner = JSON.stringify([renderedScope, renderedPath, renderedQuery, patientScope.current, 'lab_request'])
    if (!editingId && creationAttempt.current?.uncertain && !sameClinicalCreateIntent(creationAttempt.current.intent, owner, 'lab_request', payload)) { setError(t('detailsDiffer')); return }
    const operation = beginMutation(editingId ? 'write' : 'create')
    if (!operation) return
    let sent = false
    try {
      const previous = creationAttempt.current
      const intent = editingId ? null : clinicalCreateIntent(previous?.intent || null, owner, 'lab_request', payload)
      if (intent) creationAttempt.current = { intent, uncertain: previous?.uncertain || false, reviewEpoch: previous?.reviewEpoch ?? ordersReadEpoch.current }
      const savedBaseline = { ...baseline.current,
        scheduled_for: orderDateToIso(baseline.current.scheduled_for, originalDates.current.scheduled_for),
        recommended_date: orderDateToIso(baseline.current.recommended_date, originalDates.current.recommended_date) }
      // Deliberate updates remain changed-fields-only; creation IDs are POST-only.
      const changes = Object.fromEntries(Object.entries(payload).filter(([key, value]) => key === 'patient_id' || value !== savedBaseline[key as keyof DoctorLabOrderPayload]))
      sent = true
      const response = editingId ? await updateDoctorLabOrder({ ...changes, patient_id: operation.patientId, test_id: editingId }, editorWriteVersion.current!) : await createDoctorLabOrder({ ...payload, creation_id: intent!.creationId })
      if (!operation.isCurrent()) return
      const receipt = intent ? clinicalCreationReceipt(response, intent) : null
      if (intent && !receipt) throw new Error(t('createUnconfirmed'))
      setLabTests(response.test_requests || []); creationAttempt.current = null; setCreateRecovery(false); uncertainCreateRef.current = false; setUncertainCreate(false); resetForm(true)
      if (receipt) setUploadNotice(!receipt.available ? t('createGone') : receipt.replayed ? t('alreadySaved') : t('saved'))
    } catch (err) {
      if (!operation.isCurrent()) return
      const fieldErrors = clinicalValidationErrors(err)
      if (editingId && err instanceof ApiError && clinicalRecordChanged(err.status, err.body)) { editorConflictEpoch.current = ordersReadEpoch.current; setEditorConflict(true) }
      if (!editingId && sent && creationAttempt.current) {
        if (!creationAttempt.current.uncertain && err instanceof ApiError && err.status === 422 && Object.keys(fieldErrors).length) { creationAttempt.current = null; setCreateRecovery(false) }
        else { creationAttempt.current.uncertain = true; creationAttempt.current.reviewEpoch = ordersReadEpoch.current; setCreateRecovery(true) }
      }
      setError(getApiErrorDetail(err) ?? t('saveFailed'))
    } finally { operation.finish() }
  }

  const quickVersion = (test: PatientLabRequest) => {
    const original = quickWrites.current.get(test.id)
    if (original?.conflicted) { setError(t('discardStale')); return null }
    const version = original?.version || recordWriteVersion(test)
    if (!version) { setError(MISSING_CLINICAL_VERSION); return null }
    return original || { version, conflicted: false, reviewEpoch: ordersReadEpoch.current, label: test.title }
  }
  const discardQuickWrite = (id: string) => {
    const original = quickWrites.current.get(id)
    if (!isRenderedContext() || operationInFlight.current || !selectedAuthorized || loading || ordersReadFailed.current || !original || ordersReadEpoch.current <= original.reviewEpoch) return
    quickWrites.current.delete(id); setQuickRecovery(previous => previous.filter(value => value !== id)); setError(null); setUploadNotice(t('actionDiscarded'))
  }
  const handleStatusChange = async (test: PatientLabRequest, status: string) => {
    if (currentOrders.current.find(order => order.id === test.id)?.can_edit !== true) { setError(t('statusUnavailable')); return }
    const attempt = quickVersion(test); if (!attempt) return
    const operation = beginMutation(); if (!operation) return
    quickWrites.current.set(test.id, attempt)
    try {
      const response = await updateDoctorLabOrder({ patient_id: operation.patientId, test_id: test.id, status }, attempt.version)
      if (operation.isCurrent()) { quickWrites.current.delete(test.id); setQuickRecovery(previous => previous.filter(value => value !== test.id)); setLabTests(response.test_requests || []) }
    } catch (err) { if (operation.isCurrent()) { attempt.conflicted = err instanceof ApiError && clinicalRecordChanged(err.status, err.body); attempt.reviewEpoch = ordersReadEpoch.current; setQuickRecovery(previous => previous.includes(test.id) ? previous : [...previous, test.id]); setError(getApiErrorDetail(err) ?? t('statusUnconfirmed')) } }
    finally { operation.finish() }
  }
  const handleDelete = async (test: PatientLabRequest) => {
    if (currentOrders.current.find(order => order.id === test.id)?.can_delete !== true) { setError(t('deleteUnavailable')); return }
    const attempt = quickVersion(test); if (!attempt) return
    const operation = beginMutation(); if (!operation) return
    quickWrites.current.set(test.id, attempt)
    try {
      const response = await deleteDoctorLabOrder(operation.patientId, test.id, attempt.version)
      if (!operation.isCurrent()) return
      quickWrites.current.delete(test.id); setQuickRecovery(previous => previous.filter(value => value !== test.id)); setLabTests(response.test_requests || [])
      if (editingId === test.id) resetForm(true)
    } catch (err) { if (operation.isCurrent()) { attempt.conflicted = err instanceof ApiError && clinicalRecordChanged(err.status, err.body); attempt.reviewEpoch = ordersReadEpoch.current; setQuickRecovery(previous => previous.includes(test.id) ? previous : [...previous, test.id]); setError(getApiErrorDetail(err) ?? t('removeUnconfirmed')) } }
    finally { operation.finish() }
  }

  const handleUploadResult = async (test: PatientLabRequest, file?: File, retryNote?: string) => {
    if (!file) return
    if (test.can_upload_result !== true) { setError(t('onlyOrderingUpload')); return }
    const uploadError = medicalUploadError(file.size) || (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) ? t('fileType') : null)
    if (uploadError) { setError(uploadError); return }
    const operation = beginMutation()
    if (!operation) return
    const note = retryNote ?? t('uploadedByClinician')
    setUploadNotice('')
    try {
      const attempt = await labUploadAttempt(uploadAttempt.current, JSON.stringify([operation.scope, operation.patientId, test.id]), file, note)
      if (!operation.isCurrent()) return
      uploadAttempt.current = attempt
      const formData = new FormData()
      formData.set('file', file); formData.set('note', attempt.note); formData.set('upload_id', attempt.uploadId)
      const response = await uploadDoctorLabResult(operation.patientId, test.id, formData)
      if (!operation.isCurrent()) return
      const receipt = labUploadReceipt(response.upload_receipt, attempt.uploadId)
      if (!receipt) throw new Error(t('uploadUnconfirmed'))
      setLabTests(response.test_requests || []); uploadAttempt.current = null; setFailedUpload(null)
      setUploadNotice(receipt.current ? (receipt.replayed ? t('uploadReplayed') : t('uploadSaved')) : t('uploadSuperseded'))
    } catch (err) { if (operation.isCurrent()) { setFailedUpload({ orderId: test.id, file, note }); setError(getApiErrorDetail(err) ?? t('uploadFailed')) } }
    finally { operation.finish() }
  }
  const saveReview = async (signal: AbortSignal) => {
    if (!reviewSelection || !reviewTargetCurrent(reviewSelection)) throw new Error(t('fileOrAuthorityChanged'))
    const operation = beginMutation(); if (!operation) throw new Error(t('waitThenReview'))
    try {
      const response = await recordDoctorLabResultReview(reviewSelection.patientId, reviewSelection.orderId, reviewSelection.fileId, signal)
      if (!operation.isCurrent() || !reviewTargetCurrent(reviewSelection)) throw new Error(t('contextChanged'))
      return response
    } finally { operation.finish() }
  }
  const linkedOrder = linked.target?.patientId === selectedPatientId ? labTests.find(test => test.id === linked.target?.requestId && test.patient_id === linked.target.patientId) : null
  const linkedFileMatches = Boolean(linkedOrder?.result_file_id && linkedOrder.result_file_id === linked.target?.fileId)

  return (
    <div className='doctor-lab-page'>
      <style>{`
        .doctor-lab-page { display: grid; gap: 18px; }
        .dl-card { background: var(--surface); backdrop-filter: blur(22px) saturate(175%); -webkit-backdrop-filter: blur(22px) saturate(175%); border: 1px solid var(--border); border-radius: 20px; box-shadow: ${Sh.card}; padding: 22px; }
        .dl-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
        .dl-btn { min-height: 42px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: ${T.navy}; padding: 0 14px; font-size: 13px; font-weight: 800; cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .dl-btn:hover, .dl-btn:focus-visible { transform: translateY(-1px); box-shadow: ${Sh.glow}; outline: none; }
        .dl-btn.primary { border-color: transparent; background: var(--action-primary); color: var(--action-primary-text); }
        .dl-btn.primary:hover:not(:disabled) { background: var(--action-primary-hover); }
        .dl-btn.danger { color: ${T.red}; border-color: rgba(220,38,38,0.18); background: rgba(220,38,38,0.06); }
        .dl-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; box-shadow: none; }
        .dl-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 12px; }
        .dl-field { display: grid; gap: 6px; }
        .dl-field span, .dl-eyebrow { font-size: 11px; font-weight: 800; color: ${T.slate2}; letter-spacing: 0.06em; text-transform: uppercase; }
        .dl-order[data-notification-target=true] { border-color:var(--focus-ring); box-shadow:0 0 0 1px var(--focus-ring); scroll-margin-top:100px; }
        .dl-order { border-radius: 18px; border: 1px solid var(--border); background: var(--surface-subtle); padding: 16px; display: grid; gap: 12px; }
        .dl-meta { display: flex; gap: 10px; flex-wrap: wrap; color: ${T.slate2}; font-size: 12px; font-weight: 700; }
        .dl-empty { padding: 28px; border-radius: 18px; background: rgba(32,181,223,0.08); color: ${T.blue}; text-align: center; font-weight: 800; }
        @media (max-width: 700px) { .dl-card { padding: 16px; border-radius: 18px; } .dl-btn { width: 100%; } .dl-header { display: grid; } }
      `}</style>

      {(linked.target || linked.invalid) && <section aria-label={t('selectedLabResult')} className='dl-card'>
        <h2 className='portal-h2'>{t('resultSelectedFromNotifications')}</h2>
        <p className='text-sm leading-7 text-secondary'>{linked.invalid ? t('linkInvalid') : !patientsReady ? t('confirmingAccess') : lookupPatientId === linked.target?.patientId && !selectedAuthorized ? t('patientUnavailable') : selectedPatientId !== linked.target?.patientId ? t('choosePatientFirst') : loading ? t('loadingOrder') : error ? t('resultUnconfirmed') : !linkedOrder ? t('orderGone') : !linkedFileMatches ? linkedOrder.result_file_id ? t('differentUpload') : t('fileGone') : t('exactFile')}</p>
        <div className='mt-3 flex flex-wrap gap-3'>{linkedOrder && <button className='dl-btn' onClick={() => { const order = document.getElementById(`lab-order-${linkedOrder.id}`); order?.focus(); order?.scrollIntoView({ block: 'center' }) }}>{t('jumpToSelectedOrder')}</button>}<Link href='/doctor/notifications' className='portal-button portal-button-secondary q-button q-button-secondary'>{t('backToResultUpdates')}</Link>
          {patientsReady && linked.target && selectedPatientId !== linked.target.patientId && <button className='dl-btn' disabled={saving} onClick={() => handlePatientChange(linked.target!.patientId)}>{t('showSelectedPatient')}</button>}
        </div>
      </section>}

      {uploadNotice && <p role='status' className='dl-card text-sm text-secondary'>{uploadNotice}</p>}

      <div className='dl-header'>
        <div>
          <p className='dl-eyebrow' style={{ margin: 0 }}>{t('doctorWorkspace')}</p>
          <h1 style={{ margin: '6px 0 4px', fontSize: '28px', fontWeight: 800, color: T.navy }}>{t('labOrders')}</h1>
          <p style={{ margin: 0, fontSize: '14px', color: T.slate }}>{t('createUpdateAndTrackPatient')}</p>
        </div>
        <button className='dl-btn primary' type='button' onClick={() => setShowAddForm(true)} disabled={!selectedPatientId || !selectedAuthorized || saving} aria-expanded={showAddForm}>{t('orderLabTest')}</button>
      </div>

      {error && <div role='alert' className='dl-card' style={{ color: T.red, border: '1px solid rgba(220,38,38,0.2)' }}>{error}</div>}

      <ClinicalPatientDirectory selectLabel={t('selectPatient')} selectedId={selectedPatientId} selectedPatient={selectedPatient?.id === selectedPatientId ? selectedPatient : null} disabled={saving || Boolean(reviewSelection)} isCurrent={isRenderedContext} onSelect={handlePatientChange} />
      {lookupPatientId && <section className='dl-card'>{selectedDirectory.refreshing && <p role='status'>{t('confirmingAccessToTheSelected')}</p>}{!selectedDirectory.loading && !selectedAuthorized && <div role='alert'><p>{selectedDirectory.errorMessage || t('patientBlocked')}</p><button className='dl-btn' disabled={selectedDirectory.refreshing} onClick={selectedDirectory.retry}>{t('retrySelectedPatientAccess')}</button></div>}</section>}

      {uncertainCreate && <p role='alert' className='dl-card'>{t('theEarlierCreateHasAn')}</p>}
      {createRecovery && !uncertainCreate && <section role='alert' className='dl-card'><p>{t('thisOrderMayAlreadyHave')}</p><button className='dl-btn' type='button' disabled={saving || loading} onClick={() => fetchLabTests()}>{t('refreshSavedOrders')}</button></section>}
      {editorConflict && <section role='alert' className='dl-card'><p>{t('thisOrderChangedAfterYou')}</p><button className='dl-btn' disabled={saving || loading} onClick={() => fetchLabTests()}>{t('reloadChangedOrder')}</button></section>}
      {quickRecovery.map(id => { const attempt = quickWrites.current.get(id); return <section role='alert' className='dl-card' key={id}><p className='mb-2 font-semibold'>{attempt?.label || t('labOrder')}</p><p>{t('theQuickActionCouldNot')}</p><div className='mt-3 flex flex-wrap gap-3'><button className='dl-btn' disabled={saving || loading} onClick={() => fetchLabTests()}>{t('reloadActionOutcome')}</button><button className='dl-btn' disabled={saving || loading || !selectedAuthorized || ordersReadFailed.current || !attempt || ordersReadEpoch.current <= attempt.reviewEpoch} onClick={() => discardQuickWrite(id)}>{t('discardStaleAction')}</button></div></section> })}
      {showAddForm && selectedPatientId && selectedAuthorized && (
        <section className='dl-card'>
          <div className='dl-header' style={{ marginBottom: '14px' }}>
            <div>
              <p className='dl-eyebrow' style={{ margin: 0 }}>{editingId ? t('editRequest') : t('newRequest')}</p>
              <h2 style={{ margin: '5px 0 0', color: T.navy }}>{editingId ? t('updateOrder') : t('orderTest')}</h2>
            </div>
            <button className='dl-btn' type='button' onClick={() => dirty ? setPendingChange({ cancel: true }) : resetForm()} disabled={saving || ((uncertainCreate || createRecovery) && !creationResetReady) || (editorConflict && !writeResetReady)}>{t('cancel')}</button>
          </div>
          <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className='dl-grid'>
            <label className='dl-field'><span>{t('testTitleRequired')}</span><input style={inputStyle} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={t('completeBloodCount')} /></label>
            <label className='dl-field'><span>{t('category')}</span><input style={inputStyle} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder={t('bloodTest')} /></label>
            <label className='dl-field'><span>{t('specificTest')}</span><input style={inputStyle} value={form.test} onChange={(event) => setForm({ ...form, test: event.target.value })} placeholder={t('cbc')} /></label>
            <label className='dl-field'><span id='doctor-lab-priority-label'>{t('priority')}</span><select aria-labelledby='doctor-lab-priority-label' style={inputStyle} value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>{t('routine')}</option><option>{t('urgent')}</option><option>{t('high')}</option></select></label>
            <label className='dl-field'><span id='doctor-lab-status-label'>{t('status')}</span><select aria-labelledby='doctor-lab-status-label' style={inputStyle} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>{t('pending')}</option><option>{t('booked')}</option><option>{t('collected')}</option><option>{t('processing')}</option><option>{t('resultsAvailable')}</option><option>{t('completed')}</option></select></label>
            <label className='dl-field'><span>{t('recommendedBy')}</span><input style={inputStyle} type='datetime-local' value={form.recommended_date} onChange={(event) => setForm({ ...form, recommended_date: event.target.value })} /></label>
            <label className='dl-field'><span>{t('knownAppointmentTime')}</span><input style={inputStyle} type='datetime-local' value={form.scheduled_for} onChange={(event) => setForm({ ...form, scheduled_for: event.target.value })} /></label>
            <label className='dl-field'><span>{t('processingTime')}</span><input style={inputStyle} value={form.processing_time} onChange={(event) => setForm({ ...form, processing_time: event.target.value })} placeholder={t('t24Hrs')} /></label>
            <label className='dl-field'><span>{t('recommendedLab')}</span><input style={inputStyle} value={form.recommended_lab_name} onChange={(event) => setForm({ ...form, recommended_lab_name: event.target.value })} placeholder={t('anyAccreditedLaboratory')} /></label>
            <label className='dl-field'><span>{t('recommendedLabDetails')}</span><input style={inputStyle} value={form.recommended_lab_address} onChange={(event) => setForm({ ...form, recommended_lab_address: event.target.value })} placeholder={t('optionalAddressBranchOrInstruction')} /></label>
          </div>
          <div className='dl-grid' style={{ marginTop: '12px' }}>
            <label className='dl-field'><span>{t('patientFacingDescription')}</span><textarea style={{ ...inputStyle, minHeight: '92px' }} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <label className='dl-field'><span>{t('reasonForTest')}</span><textarea style={{ ...inputStyle, minHeight: '92px' }} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
            <label className='dl-field'><span>{t('preparationInstructions')}</span><textarea style={{ ...inputStyle, minHeight: '92px' }} value={form.preparation_instructions} onChange={(event) => setForm({ ...form, preparation_instructions: event.target.value })} /></label>
          </div>
          <button className='dl-btn primary' type='button' onClick={handleSave} disabled={saving || uncertainCreate || editorConflict} style={{ marginTop: '14px' }}>
            {saving ? t('saving') : editingId ? t('saveChanges') : createRecovery ? t('retryCreation') : t('createRequest')}
          </button>
          </fieldset>
          <p style={{ margin: '12px 0 0', color: T.slate2, fontSize: '13px' }}>{t('datesAndTimesUseYour')}</p>
        </section>
      )}

      <section className='dl-card'>
        <div className='dl-header' style={{ marginBottom: '14px' }}>
          <div>
            <p className='dl-eyebrow' style={{ margin: 0 }}>{t('patientRequests')}</p>
            <h2 style={{ margin: '5px 0 0', color: T.navy }}>{t('labTestOrders')}</h2>
          </div>
          <button className='dl-btn' type='button' onClick={() => fetchLabTests()} disabled={!selectedPatientId || !selectedAuthorized || loading || saving}>{loading ? t('loading') : t('refresh')}</button>
        </div>
        {!selectedPatientId && <div className='dl-empty'>{t('chooseAPatientToView')}</div>}
        {loading && <p role='status'>{t('loadingLabRequests')}</p>}
        {selectedPatientId && selectedAuthorized && !loading && !error && labTests.length === 0 && <div className='dl-empty'>{t('noLabRequestsYetFor')}</div>}
        <div style={{ display: 'grid', gap: '12px' }}>
          {(selectedAuthorized ? labTests : []).map((test) => (
            <article className='dl-order' key={test.id} id={`lab-order-${test.id}`} tabIndex={linked.target?.requestId === test.id ? -1 : undefined} data-lab-order-id={test.id} data-notification-target={linked.target?.requestId === test.id ? 'true' : undefined}>
              <div className='dl-header'>
                <div>
                  <h3 style={{ margin: '0 0 4px', color: T.navy }}>{test.title}</h3>
                  <p style={{ margin: 0, color: T.slate }}>{test.description || test.test || t('noDescription')}</p>
                </div>
                <select
                  aria-label={t('statusFor', { title: test.title })}
                  style={{ ...inputStyle, width: '190px' }}
                  value={test.status}
                  onChange={(event) => handleStatusChange(test, event.target.value)}
                  disabled={saving || showAddForm || test.can_edit !== true}
                >
                  <option>{t('pending')}</option>
                  <option>{t('booked')}</option>
                  <option>{t('collected')}</option>
                  <option>{t('processing')}</option>
                  <option>{t('resultsAvailable')}</option>
                  <option>{t('completed')}</option>
                </select>
              </div>
              <div className='dl-meta'>
                <span>Category: {test.category || t('diagnosticTest')}</span>
                <span>{t('priorityLine', { priority: priorityLabel(test.priority || 'Routine') })}</span>
                <span>Recommended: {test.completionDate || test.recommended_date || t('notSet')}</span>
                <span>Recommended lab: {test.recommended_lab_name || t('anyLabShort')}</span>
                {test.result_filename && <span>Result: {test.result_filename}</span>}
              </div>
              <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
                <div style={{ padding: '10px 12px', borderRadius: '12px', background: "var(--surface-glass)", border: "1px solid var(--border)" }}>
                  <div className='dl-eyebrow'>{t('doctorLabGuidance')}</div>
                  <div style={{ marginTop: '4px', color: T.navy, fontSize: '13px', fontWeight: 800 }}>{test.recommended_lab_name || t('anyLab')}</div>
                  {test.recommended_lab_address && <div style={{ marginTop: '2px', color: T.slate, fontSize: "13px" }}>{test.recommended_lab_address}</div>}
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '12px', background: "var(--surface-glass)", border: "1px solid var(--border)" }}>
                  <div className='dl-eyebrow'>{t('patientRecordedAppointment')}</div>
                  <div style={{ marginTop: '4px', color: T.navy, fontSize: '13px', fontWeight: 800 }}>{test.selected_lab_name || t('notRecordedYet')}</div>
                  <div style={{ marginTop: '2px', color: T.slate, fontSize: "13px" }}>{test.scheduledForLabel || test.scheduled_for || t('noDate')}{test.home_collection ? ` - ${t('homeCollection')}` : ''}</div>
                  {test.selected_lab_address && <div style={{ marginTop: '2px', color: T.slate, fontSize: "13px" }}>{test.selected_lab_address}</div>}
                </div>
              </div>
              {test.reason && <p style={{ margin: 0, fontSize: '13px', color: T.slate }}>Reason: {test.reason}</p>}
              <LabResultReviewStatus review={test.result_review} fileId={test.result_file_id} />
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className='dl-btn' type='button' aria-haspopup='dialog' disabled={saving || showAddForm || test.can_review_result !== true || !labReference(test.result_file_id)} onClick={() => { if (!isRenderedContext() || !labReference(test.result_file_id) || !labReference(test.id) || !labReference(patientScope.current) || test.can_review_result !== true) return; setDocumentAccess(null); setReviewSelection({ patientId: patientScope.current, orderId: test.id, fileId: test.result_file_id!, title: test.title }) }}>{t('recordResultReview')}</button>
                {test.can_review_result !== true && <span className='text-sm text-secondary'>{t('reviewAcknowledgementIsUnavailableFor')}</span>}
                {test.can_edit !== true && <span className='text-sm text-secondary'>{t('editingAndStatusChangesAre')}</span>}
                {test.can_delete !== true && <span className='text-sm text-secondary'>{t('deletionIsUnavailableForThis')}</span>}
                {test.result_file_id ? <button className='dl-btn' type='button' aria-haspopup='dialog' aria-label={t('openResultFor', { title: test.title })} disabled={saving || Boolean(reviewSelection)}
                  onClick={() => setDocumentAccess(current => current ?? { patientId: patientScope.current, orderId: test.id, fileId: test.result_file_id!, title: test.title })}>{linked.target?.requestId === test.id ? linkedFileMatches ? t('openSelected') : t('openCurrentDifferent') : t('openResult')}</button>
                  : <span className='text-sm text-muted'>{t('noResultFileAvailable')}</span>}
                <button className='dl-btn' type='button' onClick={() => dirty ? setPendingChange({ edit: test }) : beginEdit(test)} disabled={saving || test.can_edit !== true}>{t('edit')}</button>
                <input
                  id={`lab-result-${test.id}`}
                  type='file'
                  accept='.pdf,image/png,image/jpeg,image/webp'
                  disabled={saving || showAddForm || test.can_upload_result !== true}
                  style={{ display: 'none' }}
                  onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void handleUploadResult(test, file) }}
                />
                <button className='dl-btn primary' type='button' disabled={saving || showAddForm || test.can_upload_result !== true} onClick={() => document.getElementById(`lab-result-${test.id}`)?.click()}>
                  {t('uploadResult')}
                </button>
                {test.can_upload_result !== true && <span className='text-sm text-secondary'>{t('onlyTheOrderingClinicianCan')}</span>}
                {failedUpload?.orderId === test.id && <button className='dl-btn' type='button' disabled={saving} onClick={() => void handleUploadResult(test, failedUpload.file, failedUpload.note)}>{t('retryResultUpload')}</button>}
                <button className='dl-btn danger' type='button' onClick={() => handleDelete(test)} disabled={saving || showAddForm || test.can_delete !== true}>{t('delete')}</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      {reviewSelection && reviewStillCurrent && <LabResultReviewDialog key={`${reviewSelection.patientId}:${reviewSelection.orderId}:${reviewSelection.fileId}`} target={reviewSelection} isTargetCurrent={() => reviewTargetCurrent(reviewSelection)} save={saveReview} onClose={closeReview} onSaved={(response, current) => { if (!reviewTargetCurrent(reviewSelection)) return; setLabTests(response.test_requests || []); setReviewSelection(null); setUploadNotice(current ? t('reviewRecorded') : t('reviewStale')) }} />}
      {documentAccess && documentStillCurrent && <SecureDocumentAccessDialog key={`${documentAccess.patientId}:${documentAccess.orderId}:${documentAccess.fileId}`}
        documentTitle={documentAccess.title} documentKind={t('labResult')} expectedFileId={documentAccess.fileId} loadDocument={loadDocument} onClose={closeDocumentAccess} />}
      <UnsavedChangesDialog open={pendingChange !== null || navigation.active} busy={saving}
        onKeepEditing={() => { setPendingChange(null); if (navigation.active) navigation.reject() }}
        onDiscard={() => {
          if (pendingChange && 'patientId' in pendingChange) changePatient(pendingChange.patientId)
          else if (pendingChange && 'edit' in pendingChange) beginEdit(pendingChange.edit)
          else if (pendingChange) resetForm()
          else navigation.accept()
        }} />
    </div>
  )
}

const subscribeClinicalAccount = (changed: () => void) => { window.addEventListener(ACCOUNT_CHANGED, changed); window.addEventListener('storage', changed); return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) } }
function DoctorLabOrdersRoute() {
  const parameters = useSearchParams(), path = usePathname(), scope = useSyncExternalStore(subscribeClinicalAccount, () => readAccountScope('doctor'), () => null)
  return <DoctorLabOrdersPageContent key={JSON.stringify([scope, path, parameters.toString()])} />
}
export default function DoctorLabOrdersPage() {
  const t = useTranslations('doctorLabOrders');
  return <Suspense fallback={<p role='status' className='text-secondary'>{t('loadingLabOrders')}</p>}><DoctorLabOrdersRoute /></Suspense>
}

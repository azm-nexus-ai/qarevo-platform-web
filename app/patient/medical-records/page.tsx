'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { deleteMedicalRecord, downloadMedicalRecord, getApiErrorDetail, uploadMedicalRecord, type PatientHealthInfo } from '@/lib/api'
import { usePatientResource } from '@/lib/use-patient-resource'
import { medicalUploadError } from '@/lib/clinical-upload'
import ClinicalStatusBadge from '@/components/ui/ClinicalStatusBadge'
import { PortalButton } from '@/components/patient/PatientPortalPrimitives'
import SecureDocumentAccessDialog from '@/components/ui/SecureDocumentAccessDialog'
import { usePortalAction } from '@/lib/portal-action'
import { readAccountScope } from '@/lib/account-storage'

// ─── Types ────────────────────────────────────────────────────────────────────

type RecordType = 'Consultation' | 'Prescription' | 'Lab Request' | 'Lab Result' | 'Diagnosis' | 'Referral' | 'Medical Document'
type RecordStatus = 'Available' | 'Pending' | 'Archived'

type MedicalRecord = {
  id: string
  type: RecordType
  title: string
  provider: string
  specialty: string
  date: string
  status: RecordStatus
  lastUpdated: string
  fileType?: string // e.g. "PDF", "JPG"
  fileSize?: string
  summary?: string
  clinicalNotes?: string
  recommendations?: string
  canPreview: boolean
  canDownload: boolean
  canDelete: boolean // User-uploaded can be deleted, clinical cannot
  clinicalStatus?: string
  sourceType?: 'medication' | 'lab-request'
  sourceHref?: string
}

type TimelineEvent = {
  id: string
  date: string
  event: string
  provider: string
  recordId?: string
}

type PreviewState = {
  record: MedicalRecord
  url: string | null
  contentType: string | null
  loading: boolean
  error: string | null
}

const CATEGORIES: RecordType[] = ['Consultation', 'Prescription', 'Lab Request', 'Lab Result', 'Diagnosis', 'Referral', 'Medical Document']

// ─── Modals ───────────────────────────────────────────────────────────────────

function ModalOverlay({ onClose, children, width = '520px' }: { onClose: () => void; children: React.ReactNode; width?: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div aria-hidden onClick={onClose} style={{ position: 'absolute', inset: 0, background: "var(--surface-hover)", backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />
      <div
        role="dialog"
        aria-modal="true"
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: width, background: "var(--surface-glass)", backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', borderRadius: '24px', border: "1px solid var(--border)", boxShadow: Sh.float, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
      >
        {children}
      </div>
    </div>
  )
}

function normalizeRecord(value: Record<string, unknown>): MedicalRecord {
  return {
    id: String(value.id ?? ''),
    type: (value.type as RecordType) ?? 'Medical Document',
    title: String(value.title ?? 'Medical record'),
    provider: String(value.provider ?? 'Self-Uploaded'),
    specialty: String(value.specialty ?? 'General'),
    date: String(value.date ?? ''),
    status: (value.status as RecordStatus) ?? 'Available',
    lastUpdated: String(value.lastUpdated ?? value.last_updated ?? ''),
    fileType: value.fileType ? String(value.fileType) : undefined,
    fileSize: value.fileSize ? String(value.fileSize) : undefined,
    summary: value.summary ? String(value.summary) : undefined,
    clinicalNotes: value.clinicalNotes ? String(value.clinicalNotes) : undefined,
    recommendations: value.recommendations ? String(value.recommendations) : undefined,
    canPreview: Boolean(value.canPreview),
    canDownload: Boolean(value.canDownload),
    canDelete: Boolean(value.canDelete),
    clinicalStatus: typeof value.clinicalStatus === 'string' ? value.clinicalStatus : undefined,
    sourceType: value.sourceType === 'medication' || value.sourceType === 'lab-request' ? value.sourceType : undefined,
    // Navigation comes from a finite set of clinical destinations, never an arbitrary payload URL.
    sourceHref: value.sourceType === 'medication' ? '/patient/prescription-care-plan'
      : value.sourceType === 'lab-request' ? '/patient/lab-requests' : undefined,
  }
}

function normalizeTimeline(value: Record<string, unknown>): TimelineEvent {
  return {
    id: String(value.id ?? ''),
    date: String(value.date ?? ''),
    event: String(value.event ?? value.title ?? 'Medical record activity'),
    provider: String(value.provider ?? value.source ?? 'Qarevo Health'),
    recordId: value.recordId ? String(value.recordId) : undefined,
  }
}

function DownloadRecordPicker({ records, onChoose, onClose }: { records: MedicalRecord[]; onChoose: (record: MedicalRecord) => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [])
  const close = () => { if (dialogRef.current?.open) dialogRef.current.close(); onClose() }
  return <dialog ref={dialogRef} aria-label='Choose a record to download' onCancel={event => { event.preventDefault(); close() }} className='m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-theme bg-surface p-5 text-ink shadow-2xl backdrop:bg-slate-950/60 sm:p-7'>
    <h2 className='portal-h2'>Choose a record to download</h2><p className='mb-5 text-sm leading-6 text-muted'>Request access to one attachment at a time. Files are downloaded individually.</p>
    <div className='grid gap-3'>{records.map(record => <PortalButton key={record.id} type='button' style={{ flexDirection: 'column', alignItems: 'flex-start', whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'left' }} onClick={() => { if (dialogRef.current?.open) dialogRef.current.close(); onChoose(record) }}><span className='font-semibold'>{record.title}</span><span className='mt-1 text-xs font-normal text-secondary'>{record.date} · {record.provider} · {record.fileType || 'Attachment'}{record.fileSize ? ` · ${record.fileSize}` : ''}</span></PortalButton>)}</div>
    <div className='mt-5 flex justify-end'><PortalButton autoFocus type='button' onClick={close}>Close record selection</PortalButton></div>
  </dialog>
}

function UploadRecordModal({ onClose, onUpload, onError }: { onClose: () => void; onUpload: (r: MedicalRecord) => void; onError: (message: string) => void }) {
  const [docName, setDocName] = useState('')
  const [docType, setDocType] = useState<RecordType>('Medical Document')
  const [provider, setProvider] = useState('')
  const [date, setDate] = useState('')
  const [desc, setDesc] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      const error = medicalUploadError(selectedFile.size)
      setValidationError(error)
      if (error) {
        e.target.value = ''
        setFile(null)
        return
      }
      setFile(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (isUploading) return
    const error = !docName.trim() ? 'Enter the document name.' : !date ? 'Enter the date of the record.' : !file ? 'Choose a medical document to upload.' : medicalUploadError(file.size)
    setValidationError(error)
    if (error || !file) return
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', docName)
      formData.append('record_type', docType)
      formData.append('description', desc || '')
      if (provider) formData.append('provider_name', provider)
      formData.append('record_date', date)

      const response = await uploadMedicalRecord(formData)

      const uploadedRecord = response.record && typeof response.record === 'object'
        ? normalizeRecord(response.record)
        : {
            id: response.id,
            type: docType,
            title: docName,
            provider: provider || 'Self-Uploaded',
            specialty: 'General',
            date: new Date(response.uploaded_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            status: 'Available' as const,
            lastUpdated: 'Just now',
            summary: desc,
            fileType: file.name.split('.').pop()?.toUpperCase() || 'FILE',
            fileSize: (response.file_size / 1024).toFixed(1) + ' KB',
            canPreview: ['PDF', 'PNG', 'JPG', 'JPEG'].includes((file.name.split('.').pop() || '').toUpperCase()),
            canDownload: true,
            canDelete: true,
          }

      onUpload(uploadedRecord)

      setProgress(100)
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error) {
      console.error('Upload failed:', error)
      onError(getApiErrorDetail(error) ?? 'Upload failed. Please try again.')
      setProgress(0)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose} width="600px">
      <div style={{ padding: '24px 28px', borderBottom: "1px solid var(--border)", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Upload Medical Record</h2>
        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: "1px solid var(--border)", borderRadius: '8px', cursor: 'pointer', padding: '6px 9px', color: T.slate, fontSize: '16px', lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ padding: '28px', overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', margin: '0 0 6px', fontSize: "13px", fontWeight: 700, textTransform: 'uppercase', color: T.slate2 }}>Document Name *</label>
            <input type="text" value={docName} onChange={e => setDocName(e.target.value)} placeholder="e.g. Past Medical History" style={{ width: '100%', height: '44px', padding: '0 14px', borderRadius: '12px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: '14px', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', margin: '0 0 6px', fontSize: "13px", fontWeight: 700, textTransform: 'uppercase', color: T.slate2 }}>Record Type</label>
            <select value={docType} onChange={e => setDocType(e.target.value as RecordType)} style={{ width: '100%', height: '44px', padding: '0 14px', borderRadius: '12px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: '14px', outline: 'none' }}>
              {CATEGORIES.filter(c => c !== 'Lab Request').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', margin: '0 0 6px', fontSize: "13px", fontWeight: 700, textTransform: 'uppercase', color: T.slate2 }}>Date of Record *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', height: '44px', padding: '0 14px', borderRadius: '12px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: '14px', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', margin: '0 0 6px', fontSize: "13px", fontWeight: 700, textTransform: 'uppercase', color: T.slate2 }}>Provider / Facility</label>
            <input type="text" value={provider} onChange={e => setProvider(e.target.value)} placeholder="e.g. City Hospital" style={{ width: '100%', height: '44px', padding: '0 14px', borderRadius: '12px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: '14px', outline: 'none' }} />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', margin: '0 0 6px', fontSize: "13px", fontWeight: 700, textTransform: 'uppercase', color: T.slate2 }}>Description (Optional)</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: '14px', outline: 'none', resize: 'none' }} />
        </div>

        <div>
          <label style={{ display: 'block', margin: '0 0 6px', fontSize: "13px", fontWeight: 700, textTransform: 'uppercase', color: T.slate2 }}>File Upload *</label>
          <div style={{ border: '2px dashed rgba(32,181,223,0.3)', borderRadius: '16px', padding: '30px', textAlign: 'center', background: 'rgba(32,181,223,0.04)' }}>
            {!file ? (
              <>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(32,181,223,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', color: T.link }}>
                  <Ico p={ICONS.search} size={24} sw={1.5} />
                </div>
                <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: T.navy }}>Click or drag file to this area</p>
                <p id='medical-upload-help' style={{ margin: '0 0 16px', fontSize: "13px", color: T.slate }}>Supported formats: PDF, DOC, DOCX, PNG, JPG. Maximum 3 MB per file in development.</p>
                <label style={{ display: 'inline-block', padding: '10px 20px', borderRadius: '10px', background: T.blue, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  Browse Files
                  <input type="file" aria-label='Choose medical document' aria-describedby='medical-upload-help medical-upload-validation' aria-invalid={Boolean(validationError)} accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: "var(--surface)", borderRadius: '12px', border: "1px solid var(--border)", textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(32,181,223,0.1)', color: T.link, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ico p={ICONS.shield} size={20} sw={1.5} />
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{file.name}</p>
                    <p style={{ margin: 0, fontSize: "13px", color: T.slate }}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                </div>
                <button onClick={() => setFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, fontSize: "13px", fontWeight: 700 }}>Remove</button>
              </div>
            )}
          </div>
        </div>

        <p id='medical-upload-validation' role={validationError ? 'alert' : undefined} className='mt-4 text-sm text-ink'>{validationError}</p>
        {isUploading && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: T.navy }}>Uploading...</span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: T.link }}>{progress}%</span>
            </div>
            <div style={{ height: '6px', borderRadius: '999px', background: "var(--surface-hover)", overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: T.blue, transition: 'width 0.2s ease' }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '20px 28px', borderTop: "1px solid var(--border)", display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <HoverBtn onClick={onClose} base={{ padding: '0 20px', minHeight: '44px', borderRadius: '12px', background: "var(--surface-glass)", border: "1px solid var(--border)", color: T.navy, fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' }} on={{ background: "var(--surface-glass)", transform: 'translateY(-1px)' }}>Cancel</HoverBtn>
        <HoverBtn onClick={handleUpload} disabled={isUploading} base={{ padding: '0 24px', minHeight: '44px', borderRadius: '12px', background: (docName && file && date) ? `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)` : "var(--surface-hover)", border: 'none', color: (docName && file && date) ? '#fff' : T.slate2, fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', boxShadow: (docName && file && date) ? '0 5px 16px rgba(32,181,223,0.3)' : 'none' }} on={(docName && file && date && !isUploading) ? { transform: 'translateY(-1px)', boxShadow: '0 8px 22px rgba(52,140,234,0.34)' } : {}}>
          {isUploading ? 'Uploading...' : 'Upload Record'}
        </HoverBtn>
      </div>
    </ModalOverlay>
  )
}

function RecordDetailsModal({ record, onClose, onPreview, onDownload, onDeleteRequest }: { record: MedicalRecord; onClose: () => void; onPreview: () => void; onDownload: () => void; onDeleteRequest: () => void }) {
  return (
    <ModalOverlay onClose={onClose} width="640px">
      <div style={{ padding: '24px 28px', borderBottom: "1px solid var(--border)", display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.link, fontSize: "13px", fontWeight: 700, marginBottom: '8px' }}>{record.type}</span>
          <h2 style={{ margin: '0 0 4px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '22px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{record.title}</h2>
          <p style={{ margin: 0, fontSize: '13px', color: T.slate2 }}>{record.date} • {record.provider} ({record.specialty})</p>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: "1px solid var(--border)", borderRadius: '8px', cursor: 'pointer', padding: '6px 9px', color: T.slate, fontSize: '16px', lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ padding: '28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {record.summary && (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: T.navy }}>Summary</h3>
            <div style={{ padding: '16px', borderRadius: '12px', background: "var(--surface-hover)", border: "1px solid var(--border)", fontSize: '14px', color: T.slate, lineHeight: 1.6 }}>{record.summary}</div>
          </div>
        )}

        {record.clinicalNotes && (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: T.navy }}>Clinical Notes</h3>
            <div style={{ padding: '16px', borderRadius: '12px', background: "var(--surface-hover)", border: "1px solid var(--border)", fontSize: '14px', color: T.slate, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{record.clinicalNotes}</div>
          </div>
        )}

        {record.recommendations && (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: T.navy }}>Recommendations</h3>
            <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(15,158,119,0.05)', border: '1px solid rgba(15,158,119,0.1)', fontSize: '14px', color: T.green, lineHeight: 1.6 }}>{record.recommendations}</div>
          </div>
        )}

        {record.fileType && (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: T.navy }}>Attachments</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '12px', background: "var(--surface)", border: "1px solid var(--border)", boxShadow: '0 2px 8px rgba(4,53,77,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(32,181,223,0.1)', color: T.link, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ico p={ICONS.shield} size={22} sw={1.5} />
                </div>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 700, color: T.navy }}>{record.title}.{record.fileType.toLowerCase()}</p>
                  <p style={{ margin: 0, fontSize: "13px", color: T.slate }}>{record.fileType} Document • {record.fileSize}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {record.canPreview && (
                  <HoverBtn onClick={onPreview} base={{ padding: '0 12px', minHeight: '36px', borderRadius: '8px', border: "1px solid var(--border)", background: "var(--surface)", color: T.navy, fontSize: "13px", fontWeight: 700, cursor: 'pointer' }} on={{ background: "var(--surface-glass)", transform: 'translateY(-1px)' }}>Preview</HoverBtn>
                )}
                {record.canDownload && (
                  <HoverBtn onClick={onDownload} base={{ padding: '0 12px', minHeight: '36px', borderRadius: '8px', border: 'none', background: T.blue, color: '#fff', fontSize: "13px", fontWeight: 700, cursor: 'pointer' }} on={{ background: '#348CEA', transform: 'translateY(-1px)' }}>Download</HoverBtn>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '20px 28px', borderTop: "1px solid var(--border)", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {record.canDelete && (
            <button onClick={onDeleteRequest} style={{ background: 'none', border: 'none', color: T.red, fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: '8px 0', textDecoration: 'underline' }}>Delete Record</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {record.sourceHref && <Link href={record.sourceHref} className='inline-flex min-h-11 items-center rounded-xl border border-theme bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-subtle'>{record.sourceType === 'medication' ? 'View medication instructions' : 'View lab request'}</Link>}
          <HoverBtn onClick={onClose} base={{ padding: '0 20px', minHeight: '44px', borderRadius: '12px', background: "var(--surface-glass)", border: "1px solid var(--border)", color: T.navy, fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' }} on={{ background: "var(--surface-glass)", transform: 'translateY(-1px)' }}>Close</HoverBtn>
        </div>
      </div>
    </ModalOverlay>
  )
}

function PreviewModal({ preview, onClose, onDownload }: { preview: PreviewState; onClose: () => void; onDownload: () => void }) {
  const { record, url, contentType, loading, error } = preview
  const fileLabel = record.fileType ? `${record.title}.${record.fileType.toLowerCase()}` : record.title
  const isImage = Boolean(contentType?.startsWith('image/'))
  const isPdf = contentType === 'application/pdf' || record.fileType === 'PDF'

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px', background: "var(--surface-hover)", backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div aria-hidden onClick={onClose} style={{ position: 'absolute', inset: 0 }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${record.title} preview`}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '900px', maxHeight: '88vh', background: "var(--surface)", borderRadius: '18px', boxShadow: '0 24px 60px rgba(4,53,77,0.28)', border: "1px solid var(--border)", display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            zIndex: 3,
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            border: "1px solid var(--border)",
            background: "var(--surface-glass)",
            color: T.navy,
            fontSize: '24px',
            lineHeight: 1,
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(4,53,77,0.12)',
          }}
        >
          ✕
        </button>
        <div style={{ padding: '20px 72px 18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', borderBottom: "1px solid var(--border)", background: "var(--surface-glass)" }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 800, color: T.navy }}>{fileLabel}</h2>
            <p style={{ margin: 0, fontSize: "13px", color: T.slate }}>{record.date} • {record.provider}</p>
          </div>
          {record.canDownload && (
            <button
              onClick={onDownload}
              style={{ background: 'rgba(32,181,223,0.1)', border: '1px solid rgba(32,181,223,0.18)', borderRadius: '10px', color: T.link, padding: '0 14px', minHeight: '36px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
            >
              Download
            </button>
          )}
        </div>
        <div style={{ minHeight: '420px', maxHeight: 'calc(88vh - 74px)', background: "var(--surface)", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
          {loading ? (
            <p style={{ margin: 0, fontSize: '14px', color: T.slate, fontWeight: 700 }}>Loading secure preview...</p>
          ) : error ? (
            <div style={{ padding: '28px', textAlign: 'center', maxWidth: '460px' }}>
              <Ico p={ICONS.shield} size={48} sw={1.4} color="rgba(239,68,68,0.35)" />
              <p style={{ margin: '16px 0 8px', fontSize: '15px', color: T.navy, fontWeight: 800 }}>Preview unavailable</p>
              <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{error}</p>
            </div>
          ) : url && isImage ? (
            <img src={url} alt={record.title} style={{ width: '100%', height: '100%', objectFit: 'contain', background: "var(--surface)" }} />
          ) : url && isPdf ? (
            <iframe title={record.title} src={url} style={{ width: '100%', minHeight: '70vh', border: 0, background: "var(--surface)" }} />
          ) : (
            <div style={{ padding: '32px', width: '100%', maxWidth: '700px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 800, color: T.navy }}>{record.title}</h3>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: T.slate }}>{record.provider} • {record.date}</p>
              <div style={{ display: 'grid', gap: '14px' }}>
                {[record.summary, record.clinicalNotes, record.recommendations].filter(Boolean).map((text, index) => (
                  <p key={`${record.id}-preview-text-${index}`} style={{ margin: 0, padding: '14px', borderRadius: '12px', background: "var(--surface-hover)", border: "1px solid var(--border)", color: T.slate, fontSize: '14px', lineHeight: 1.65 }}>{text}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DeleteRecordModal({ record, onClose, onConfirm }: { record: MedicalRecord; onClose: () => void; onConfirm: () => void }) {
  return (
    <ModalOverlay onClose={onClose} width="460px">
      <div style={{ padding: '24px 28px' }}>
        <h2 style={{ margin: '0 0 8px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy }}>Delete medical record?</h2>
        <p style={{ margin: '0 0 22px', fontSize: '14px', color: T.slate, lineHeight: 1.6 }}>This will remove &quot;{record.title}&quot; from your medical records. This action cannot be undone.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <HoverBtn onClick={onClose} base={{ padding: '0 18px', minHeight: '42px', borderRadius: '12px', border: "1px solid var(--border)", background: "var(--surface)", color: T.navy, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>Cancel</HoverBtn>
          <HoverBtn onClick={onConfirm} base={{ padding: '0 18px', minHeight: '42px', borderRadius: '12px', border: 'none', background: T.red, color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>Delete</HoverBtn>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─── Main Page Inner ───────────────────────────────────────────────────────────

function MedicalRecordsPageInner() {
  const captureAction = usePortalAction()
  const accountScope = readAccountScope('patient')
  const previewVersion = useRef(0)
  const downloadNonce = useRef(0)
  const handledRecordLink = useRef<string | null>(null)
  const downloadRestoreTarget = useRef<HTMLButtonElement | null>(null)
  const downloadScopeRef = useRef<string | null>(null)
  const [downloadSelection, setDownloadSelection] = useState<{ recordId: string; scope: string | null; nonce: number } | null>(null)
  const [downloadPickerScope, setDownloadPickerScope] = useState<string | null>(null)
  const closeDownload = useCallback(() => {
    setDownloadSelection(null)
    const target = downloadRestoreTarget.current
    if (target?.isConnected && readAccountScope('patient') === downloadScopeRef.current) target.focus()
  }, [])
  const loadDownload = useCallback(() => {
    if (!downloadSelection || downloadSelection.scope !== readAccountScope('patient')) return Promise.reject(new Error('Your account changed. Reload the records before requesting access.'))
    return downloadMedicalRecord(downloadSelection.recordId, { disposition: 'attachment' })
  }, [downloadSelection])
  const searchParams = useSearchParams()
  const recordId = searchParams.get('recordId')
  const resource = usePatientResource<{records?: Record<string, unknown>[]; timeline?: Record<string, unknown>[]}>(
    '/api/v1/patient/medical-records', false, {refreshOnFocus: true, refreshIntervalMs: 30000},
  )
  const records = useMemo(() => (Array.isArray(resource.data?.records) ? resource.data.records : []).map(normalizeRecord), [resource.data])
  const timeline = useMemo(() => (Array.isArray(resource.data?.timeline) ? resource.data.timeline : []).map(normalizeTimeline), [resource.data])
  const loadingRecords = resource.loading
  const [activeTab, setActiveTab] = useState<RecordType | 'All Records'>('All Records')
  const [search, setSearch] = useState('')

  // Modals
  const [isUploading, setIsUploading] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null)
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)
  const closePreview = useCallback(() => { ++previewVersion.current; setPreviewState(null) }, [])
  const [deleteRecord, setDeleteRecord] = useState<MedicalRecord | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const healthResource = usePatientResource<PatientHealthInfo>('/api/v1/patient/settings/health-info')
  const healthInfo = healthResource.data
  // Dialogs are resolved from the current account's current index on every render.
  // A logout, account change or deleted order cannot leave an old patient's data open.
  const activeRecord = selectedRecord ? records.find(record => record.id === selectedRecord.id) : null
  const activePreviewRecord = previewState ? records.find(record => record.id === previewState.record.id) : null
  const activeDeleteRecord = deleteRecord ? records.find(record => record.id === deleteRecord.id) : null
  const activeDownloadRecord = downloadSelection?.scope === accountScope ? records.find(record => record.id === downloadSelection.recordId && record.canDownload) : null

  // Filters
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) ||
                            r.provider.toLowerCase().includes(search.toLowerCase()) ||
                            r.specialty.toLowerCase().includes(search.toLowerCase())
      const matchesTab = activeTab === 'All Records' || r.type === activeTab
      return matchesSearch && matchesTab
    })
  }, [records, search, activeTab])

  // Counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { 'All Records': records.length }
    CATEGORIES.forEach(cat => { c[cat] = records.filter(r => r.type === cat).length })
    return c
  }, [records])

  const downloadableRecords = useMemo(
    () => records.filter((record) => record.canDownload),
    [records],
  )

  const pickerOpen = Boolean(downloadPickerScope && downloadPickerScope === accountScope && downloadableRecords.length > 0)
  const documentAccessOpen = Boolean(activeDownloadRecord) || pickerOpen

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 4000)
  }, [])

  const handleUploadComplete = () => {
    setIsUploading(false)
    showToast('Medical record uploaded successfully.')
    resource.retry()
  }

  const handleDeleteRecord = () => {
    resource.retry()
    showToast('Medical record deleted successfully.')
  }

  const handleDownloadRecord = (record: MedicalRecord) => {
    if (isUploading || activeDeleteRecord) { showToast('Close the upload or delete dialog before downloading a record.'); return }
    if (!record.canDownload || !accountScope || accountScope !== readAccountScope('patient') || !records.some(item => item.id === record.id && item.canDownload)) return
    if (recordId) handledRecordLink.current = `${accountScope}:${recordId}`
    closePreview(); setSelectedRecord(null); setDownloadPickerScope(null)
    const card = Array.from(document.querySelectorAll<HTMLElement>('[data-medical-record-id]')).find(element => element.dataset.medicalRecordId === record.id)
    const target = card?.querySelector<HTMLButtonElement>('button.medical-record-download') ?? document.querySelector<HTMLButtonElement>('button.record-download-selector')
    downloadRestoreTarget.current = target
    downloadScopeRef.current = accountScope
    target?.focus()
    const next = { recordId: record.id, scope: accountScope, nonce: ++downloadNonce.current }
    setDownloadSelection(current => current?.scope === accountScope && records.some(item => item.id === current.recordId && item.canDownload) ? current : next)
  }

  const handleDownloadRecords = () => {
    if (isUploading || activeDeleteRecord) { showToast('Close the upload or delete dialog before downloading a record.'); return }
    if (downloadableRecords.length === 0) { showToast('No downloadable file attachments are available yet.'); return }
    if (downloadableRecords.length === 1) { handleDownloadRecord(downloadableRecords[0]); return }
    if (accountScope && accountScope === readAccountScope('patient')) {
      if (recordId) handledRecordLink.current = `${accountScope}:${recordId}`
      closePreview(); setSelectedRecord(null); setDownloadPickerScope(accountScope)
    }
  }

  const handlePreviewRecord = async (record: MedicalRecord) => {
    if (!accountScope || accountScope !== readAccountScope('patient')) return
    const version = ++previewVersion.current
    if (recordId) handledRecordLink.current = `${accountScope}:${recordId}`
    const action = captureAction()
    setPreviewState({ record, url: null, contentType: null, loading: Boolean(record.canDownload && record.fileType), error: null })
    if (!record.canDownload || !record.fileType) return

    try {
      const response = await downloadMedicalRecord(record.id, { disposition: 'inline' })
      if (version !== previewVersion.current || !action.isCurrent()) return
      setPreviewState({ record, url: response.download_url, contentType: response.content_type, loading: false, error: null })
    } catch (error) {
      if (version !== previewVersion.current || !action.isCurrent()) return
      setPreviewState({
        record,
        url: null,
        contentType: null,
        loading: false,
        error: getApiErrorDetail(error) ?? 'We could not open the secure preview for this record.',
      })
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!deleteRecord) return
    try {
      await deleteMedicalRecord(deleteRecord.id)
      handleDeleteRecord()
      setDeleteRecord(null)
      setSelectedRecord(null)
    } catch (error) {
      console.error('Delete failed:', error)
      showToast(getApiErrorDetail(error) ?? 'Delete failed. Please try again.')
    }
  }

  useEffect(() => {
    const linkKey = `${accountScope}:${recordId}`
    if (!recordId || handledRecordLink.current === linkKey || activeDownloadRecord || downloadPickerScope === accountScope) return

    const intent = previewVersion.current
    const timer = window.setTimeout(() => {
      if (intent !== previewVersion.current || handledRecordLink.current === linkKey) return
      const record = records.find((item) => item.id === recordId)
      if (record) {
        handledRecordLink.current = linkKey
        setActiveTab('All Records')
        setSelectedRecord(record)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [recordId, records, accountScope, activeDownloadRecord, downloadPickerScope])

  return (
    <PatientPortalShell
      eyebrow="Patient Platform"
      title="Medical Records"
      description="Securely access and manage your healthcare records, consultation history, and clinical documents in one place."
      headerActions={
        <>
          <PortalButton disabled={resource.refreshing} onClick={resource.retry}>{resource.refreshing ? 'Refreshing records…' : 'Refresh records'}</PortalButton>
          <HoverBtn
            onClick={handleDownloadRecords}
            className='record-download-selector'
            base={{ minHeight: '44px', padding: '0 16px', borderRadius: '12px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.navy, fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(4,53,77,0.06)', whiteSpace: 'nowrap' }}
            on={{ background: "var(--surface-glass)", transform: 'translateY(-1px)' }}
          >
            Choose a record to download
          </HoverBtn>
          <HoverBtn
            onClick={() => setIsUploading(true)}
            base={{ minHeight: '44px', padding: '0 18px', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, var(--primary-end) 100%)`, color: '#fff', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 5px 16px rgba(32,181,223,0.3)', whiteSpace: 'nowrap' }}
            on={{ transform: 'translateY(-1px)', boxShadow: '0 8px 22px rgba(52,140,234,0.34)' }}
          >
            Upload Medical Record
          </HoverBtn>
        </>
      }
      rightRail={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Important Medical Info */}
          <div style={{ background: "var(--surface-glass)", backdropFilter: 'blur(20px)', borderRadius: '20px', border: "1px solid var(--border)", padding: '20px', boxShadow: Sh.card }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Important Medical Info</h3>
            {healthResource.error && <div role='alert'><p>Medical profile could not be loaded.</p><PortalButton onClick={healthResource.retry}>Retry medical profile</PortalButton></div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: "1px solid var(--border)", paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: T.slate }}>Blood Group</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: healthInfo?.blood_type ? T.red : T.slate2 }}>{healthInfo?.blood_type || (healthResource.loading ? 'Loading…' : healthResource.error ? 'Unavailable' : 'Not set')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: "1px solid var(--border)", paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: T.slate }}>Known Allergies</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy, textAlign: 'right' }}>{healthInfo?.allergies || (healthResource.loading ? 'Loading…' : healthResource.error ? 'Unavailable' : 'Not recorded')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: "1px solid var(--border)", paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: T.slate }}>Conditions</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy, textAlign: 'right' }}>{healthInfo?.medical_conditions || (healthResource.loading ? 'Loading…' : healthResource.error ? 'Unavailable' : 'Not recorded')}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ background: "var(--surface-glass)", backdropFilter: 'blur(20px)', borderRadius: '20px', border: "1px solid var(--border)", padding: '20px', boxShadow: Sh.card }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Care Timeline</h3>
            {timeline.length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>Your uploaded records and clinical documents will build this timeline.</p>
            ) : (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '8px' }}>
                <div style={{ position: 'absolute', left: '12px', top: '10px', bottom: '10px', width: '2px', background: "var(--surface-hover)" }} />
                {timeline.map((evt, idx) => (
                  <div key={evt.id} style={{ position: 'relative', paddingLeft: '24px' }}>
                    <div style={{ position: 'absolute', left: '0', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: idx === 0 ? T.blue : 'rgba(255,255,255,1)', border: `2px solid ${idx === 0 ? T.blue : "var(--border)"}`, boxShadow: idx === 0 ? '0 0 0 3px rgba(32,181,223,0.2)' : 'none' }} />
                    <p style={{ margin: '0 0 2px', fontSize: "13px", fontWeight: 700, color: T.slate2 }}>{evt.date}</p>
                    <p style={{ margin: '0 0 2px', fontSize: '13.5px', fontWeight: 700, color: T.navy }}>{evt.event}</p>
                    <p style={{ margin: 0, fontSize: "13px", color: T.slate }}>{evt.provider}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security Notice */}
          <div style={{ background: 'linear-gradient(135deg, rgba(15,158,119,0.05) 0%, rgba(32,181,223,0.05) 100%)', borderRadius: '20px', border: '1px solid rgba(15,158,119,0.15)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Ico p={ICONS.lock} size={16} sw={2} color={T.green} />
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>Secure & Private</h4>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: "13px", color: T.slate, lineHeight: 1.6 }}>Your medical records are encrypted and stored securely. Only authorized professionals can access them.</p>
            <Link href={PATIENT_ROUTES.settings} style={{ fontSize: "13px", fontWeight: 700, color: T.link, textDecoration: 'none' }}>Privacy Settings →</Link>
          </div>
        </div>
      }
    >
      <style>{`
        .mr-tabs::-webkit-scrollbar { display: none; }
        .mr-card-grid { display: grid; gap: 12px; }
        .mr-overview-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }

        @media (max-width: 900px) {
          .mr-overview-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 500px) {
          .mr-overview-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Overview Cards */}
      <div className="mr-overview-grid">
        {[
          { label: 'Total Records', value: counts['All Records'], filter: 'All Records' },
          { label: 'Consultations', value: counts['Consultation'], filter: 'Consultation' },
          { label: 'Lab Results', value: counts['Lab Result'], filter: 'Lab Result' },
          { label: 'Prescriptions', value: counts['Prescription'], filter: 'Prescription' },
        ].map(item => (
          <button
            key={item.label}
            onClick={() => setActiveTab(item.filter as RecordType | 'All Records')}
            style={{ textAlign: 'left', padding: '16px', borderRadius: '16px', border: `1px solid ${activeTab === item.filter ? 'rgba(32,181,223,0.3)' : "var(--border)"}`, background: activeTab === item.filter ? 'rgba(32,181,223,0.06)' : "var(--surface-glass)", boxShadow: activeTab === item.filter ? '0 4px 12px rgba(32,181,223,0.1)' : '0 2px 8px rgba(4,53,77,0.04)', cursor: 'pointer', transition: 'all 0.15s ease' }}
          >
            <p style={{ margin: '0 0 6px', fontSize: "13px", fontWeight: 700, textTransform: 'uppercase', color: activeTab === item.filter ? T.link : T.slate2 }}>{item.label}</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: T.navy }}>{item.value}</p>
          </button>
        ))}
      </div>

      <div style={{ background: "var(--surface-glass)", backdropFilter: 'blur(20px)', borderRadius: '20px', border: "1px solid var(--border)", boxShadow: Sh.card, padding: '20px' }}>

        {/* Search & Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: T.slate2, pointerEvents: 'none' }}>
              <Ico p={ICONS.search} size={16} sw={1.8} />
            </span>
            <input
              type="search"
              placeholder="Search by document name, physician, or specialty..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', height: '46px', borderRadius: '14px', border: "1px solid var(--border)", padding: '0 16px 0 42px', fontSize: '14px', color: T.navy, background: "var(--surface)", outline: 'none' }}
            />
          </div>

          <div className="mr-tabs" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {['All Records', ...CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat as RecordType | 'All Records')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '999px',
                  border: `1px solid ${activeTab === cat ? T.blue : "var(--border)"}`,
                  background: activeTab === cat ? 'rgba(32,181,223,0.1)' : 'transparent',
                  color: activeTab === cat ? T.link : T.slate,
                  fontSize: '13px',
                  fontWeight: activeTab === cat ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {cat} ({counts[cat] ?? 0})
              </button>
            ))}
          </div>
        </div>

        {/* Record List */}
        {resource.error && <div role='alert' className='mb-4 rounded-xl border border-theme bg-surface-subtle p-4 text-ink'><p>{resource.errorMessage}</p><PortalButton onClick={resource.retry}>Retry medical records</PortalButton></div>}
        <div className="mr-card-grid">
          {loadingRecords ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', background: "var(--surface-hover)", borderRadius: '16px', border: "1px dashed var(--border)" }}>
              <p role='status' style={{ margin: 0, fontSize: '14px', color: T.slate }}>Loading medical records...</p>
            </div>
          ) : resource.error ? null : filteredRecords.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', background: "var(--surface-hover)", borderRadius: '16px', border: "1px dashed var(--border)" }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'rgba(32,181,223,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: T.link }}>
                <Ico p={ICONS.search} size={24} sw={1.5} />
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: T.navy }}>{search ? 'No records match your search' : 'No medical records yet'}</h3>
              <p style={{ margin: '0 0 20px', fontSize: '14px', color: T.slate, maxWidth: '320px', marginLeft: 'auto', marginRight: 'auto' }}>
                {search ? 'Try adjusting your search terms or filters.' : 'Your consultation summaries, prescriptions, lab results, and other healthcare documents will appear here.'}
              </p>
              {search ? (
                <HoverBtn onClick={() => { setSearch(''); setActiveTab('All Records') }} base={{ padding: '0 20px', minHeight: '40px', borderRadius: '10px', border: "1px solid var(--border)", background: "var(--surface)", color: T.navy, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>Clear Filters</HoverBtn>
              ) : (
                <HoverBtn onClick={() => setIsUploading(true)} base={{ padding: '0 20px', minHeight: '40px', borderRadius: '10px', border: 'none', background: T.blue, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }} on={{ background: '#348CEA', transform: 'translateY(-1px)' }}>Upload Medical Record</HoverBtn>
              )}
            </div>
          ) : (
            filteredRecords.map(record => (
              <div key={record.id} data-medical-record-id={record.id} style={{ display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '16px', border: "1px solid var(--border)", background: "var(--surface)", boxShadow: '0 2px 8px rgba(4,53,77,0.03)', transition: 'all 0.15s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.link }}>{record.type}</span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: T.slate2 }}>{record.date}</span>
                      <ClinicalStatusBadge status={record.clinicalStatus ?? record.status} domain={record.sourceType === 'medication' ? 'medication' : record.sourceType === 'lab-request' ? 'lab-request' : 'record'} />
                    </div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 800, color: T.navy }}>{record.title}</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: T.slate }}>{record.provider} <span style={{ color: T.slate2 }}>• {record.specialty}</span></p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
                  <HoverBtn
                    onClick={() => { if (recordId) handledRecordLink.current = `${accountScope}:${recordId}`; closePreview(); setSelectedRecord(record) }}
                    base={{ padding: '0 14px', minHeight: '36px', borderRadius: '10px', border: "1px solid var(--border)", background: "var(--surface)", color: T.navy, fontSize: "13px", fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(4,53,77,0.02)' }}
                    on={{ background: "var(--surface-glass)", transform: 'translateY(-1px)' }}
                  >
                    View Details
                  </HoverBtn>
                  {record.canPreview && (
                    <HoverBtn
                      onClick={() => void handlePreviewRecord(record)}
                      base={{ padding: '0 14px', minHeight: '36px', borderRadius: '10px', border: 'none', background: 'rgba(32,181,223,0.1)', color: T.link, fontSize: "13px", fontWeight: 700, cursor: 'pointer' }}
                      on={{ background: 'rgba(32,181,223,0.15)', transform: 'translateY(-1px)' }}
                    >
                      Preview {record.fileType ? `(${record.fileType})` : ''}
                    </HoverBtn>
                  )}
                  {record.canDownload && (
                    <HoverBtn
                      onClick={() => handleDownloadRecord(record)}
                      className='medical-record-download'
                      ariaLabel={`Download ${record.title}`}
                      base={{ padding: '0 14px', minHeight: '36px', borderRadius: '10px', border: "1px solid var(--border)", background: 'transparent', color: T.slate, fontSize: "13px", fontWeight: 600, cursor: 'pointer' }}
                      on={{ background: "var(--surface-hover)", color: T.navy, transform: 'translateY(-1px)' }}
                    >
                      Download
                    </HoverBtn>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {downloadPickerScope && downloadPickerScope === accountScope && downloadableRecords.length > 0 && <DownloadRecordPicker records={downloadableRecords} onChoose={handleDownloadRecord} onClose={() => setDownloadPickerScope(null)} />}
      {activeDownloadRecord && downloadSelection && <SecureDocumentAccessDialog key={`${downloadSelection.scope}:${downloadSelection.recordId}:${downloadSelection.nonce}`} documentTitle={activeDownloadRecord.title} documentKind='Medical record' expectedFileId={activeDownloadRecord.id} maxLifetimeSeconds={3600} loadDocument={loadDownload} onClose={closeDownload} />}
      {isUploading && <UploadRecordModal onClose={() => setIsUploading(false)} onUpload={handleUploadComplete} onError={showToast} />}
      {!documentAccessOpen && activeRecord && (
        <RecordDetailsModal
          record={activeRecord}
          onClose={() => setSelectedRecord(null)}
          onPreview={() => { void handlePreviewRecord(activeRecord); setSelectedRecord(null) }}
          onDownload={() => void handleDownloadRecord(activeRecord)}
          onDeleteRequest={() => setDeleteRecord(activeRecord)}
        />
      )}
      {!documentAccessOpen && previewState && activePreviewRecord && <PreviewModal preview={{...previewState, record: activePreviewRecord}} onClose={closePreview} onDownload={() => void handleDownloadRecord(activePreviewRecord)} />}
      {activeDeleteRecord && <DeleteRecordModal record={activeDeleteRecord} onClose={() => setDeleteRecord(null)} onConfirm={() => void handleDeleteConfirmed()} />}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderRadius: '14px', background: "var(--surface-glass)", backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(15,158,119,0.22)', boxShadow: '0 8px 28px rgba(4,53,77,0.14)', color: T.navy, fontSize: '13.5px', fontWeight: 600 }}>
          <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(15,158,119,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ico p={ICONS.check} size={13} sw={2.2} color={T.green} />
          </span>
          {toast}
        </div>
      )}
    </PatientPortalShell>
  )
}

export default function PatientMedicalRecordsPage() {
  return (
    <Suspense>
      <MedicalRecordsPageInner />
    </Suspense>
  )
}

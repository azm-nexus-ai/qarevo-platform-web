'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { clearAuthTokens, deleteMedicalRecord, downloadMedicalRecord, getApiErrorDetail, getMedicalRecords, getPatientHealthInfo, isAuthError, uploadMedicalRecord, type PatientHealthInfo } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type RecordType = 'Consultation' | 'Prescription' | 'Lab Result' | 'Diagnosis' | 'Referral' | 'Medical Document'
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

const CATEGORIES: RecordType[] = ['Consultation', 'Prescription', 'Lab Result', 'Diagnosis', 'Referral', 'Medical Document']

// ─── Modals ───────────────────────────────────────────────────────────────────

function ModalOverlay({ onClose, children, width = '520px' }: { onClose: () => void; children: React.ReactNode; width?: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div aria-hidden onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(4,53,77,0.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />
      <div
        role="dialog"
        aria-modal="true"
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: width, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: Sh.float, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
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

async function openRecordDownload(record: MedicalRecord) {
  const response = await downloadMedicalRecord(record.id, { disposition: 'attachment' })
  window.open(response.download_url, '_blank', 'noopener,noreferrer')
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.size > 5 * 1024 * 1024) {
        onError('Please choose a file that is 5MB or smaller.')
        e.target.value = ''
        setFile(null)
        return
      }
      setFile(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!docName || !file || !date) return
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
      <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(4,53,77,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Upload Medical Record</h2>
        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: '1px solid rgba(4,53,77,0.12)', borderRadius: '8px', cursor: 'pointer', padding: '6px 9px', color: T.slate, fontSize: '16px', lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ padding: '28px', overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', margin: '0 0 6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: T.slate2 }}>Document Name *</label>
            <input type="text" value={docName} onChange={e => setDocName(e.target.value)} placeholder="e.g. Past Medical History" style={{ width: '100%', height: '44px', padding: '0 14px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.15)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '14px', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', margin: '0 0 6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: T.slate2 }}>Record Type</label>
            <select value={docType} onChange={e => setDocType(e.target.value as RecordType)} style={{ width: '100%', height: '44px', padding: '0 14px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.15)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '14px', outline: 'none' }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', margin: '0 0 6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: T.slate2 }}>Date of Record *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', height: '44px', padding: '0 14px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.15)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '14px', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', margin: '0 0 6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: T.slate2 }}>Provider / Facility</label>
            <input type="text" value={provider} onChange={e => setProvider(e.target.value)} placeholder="e.g. City Hospital" style={{ width: '100%', height: '44px', padding: '0 14px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.15)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '14px', outline: 'none' }} />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', margin: '0 0 6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: T.slate2 }}>Description (Optional)</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.15)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '14px', outline: 'none', resize: 'none' }} />
        </div>

        <div>
          <label style={{ display: 'block', margin: '0 0 6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: T.slate2 }}>File Upload *</label>
          <div style={{ border: '2px dashed rgba(32,181,223,0.3)', borderRadius: '16px', padding: '30px', textAlign: 'center', background: 'rgba(32,181,223,0.04)' }}>
            {!file ? (
              <>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(32,181,223,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', color: T.blue }}>
                  <Ico p={ICONS.search} size={24} sw={1.5} />
                </div>
                <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: T.navy }}>Click or drag file to this area</p>
                <p style={{ margin: '0 0 16px', fontSize: '12px', color: T.slate }}>Supported formats: PDF, DOC, DOCX, PNG, JPG (Max 5MB)</p>
                <label style={{ display: 'inline-block', padding: '10px 20px', borderRadius: '10px', background: T.blue, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  Browse Files
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#fff', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.1)', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(32,181,223,0.1)', color: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ico p={ICONS.shield} size={20} sw={1.5} />
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{file.name}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: T.slate }}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                </div>
                <button onClick={() => setFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, fontSize: '12px', fontWeight: 700 }}>Remove</button>
              </div>
            )}
          </div>
        </div>

        {isUploading && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: T.navy }}>Uploading...</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: T.blue }}>{progress}%</span>
            </div>
            <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(4,53,77,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: T.blue, transition: 'width 0.2s ease' }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '20px 28px', borderTop: '1px solid rgba(4,53,77,0.08)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <HoverBtn onClick={onClose} base={{ padding: '0 20px', minHeight: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(4,53,77,0.14)', color: T.navy, fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' }} on={{ background: 'rgba(255,255,255,0.98)', transform: 'translateY(-1px)' }}>Cancel</HoverBtn>
        <HoverBtn onClick={handleUpload} base={{ padding: '0 24px', minHeight: '44px', borderRadius: '12px', background: (docName && file && date) ? `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : 'rgba(4,53,77,0.1)', border: 'none', color: (docName && file && date) ? '#fff' : T.slate2, fontSize: '13.5px', fontWeight: 700, cursor: (docName && file && date) ? 'pointer' : 'not-allowed', boxShadow: (docName && file && date) ? '0 5px 16px rgba(32,181,223,0.3)' : 'none' }} on={(docName && file && date && !isUploading) ? { transform: 'translateY(-1px)', boxShadow: '0 8px 22px rgba(52,140,234,0.34)' } : {}}>
          {isUploading ? 'Uploading...' : 'Upload Record'}
        </HoverBtn>
      </div>
    </ModalOverlay>
  )
}

function RecordDetailsModal({ record, onClose, onPreview, onDownload, onDeleteRequest }: { record: MedicalRecord; onClose: () => void; onPreview: () => void; onDownload: () => void; onDeleteRequest: () => void }) {
  return (
    <ModalOverlay onClose={onClose} width="640px">
      <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(4,53,77,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.blue, fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>{record.type}</span>
          <h2 style={{ margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '22px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{record.title}</h2>
          <p style={{ margin: 0, fontSize: '13px', color: T.slate2 }}>{record.date} • {record.provider} ({record.specialty})</p>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: '1px solid rgba(4,53,77,0.12)', borderRadius: '8px', cursor: 'pointer', padding: '6px 9px', color: T.slate, fontSize: '16px', lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ padding: '28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {record.summary && (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: T.navy }}>Summary</h3>
            <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(4,53,77,0.03)', border: '1px solid rgba(4,53,77,0.06)', fontSize: '14px', color: T.slate, lineHeight: 1.6 }}>{record.summary}</div>
          </div>
        )}

        {record.clinicalNotes && (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: T.navy }}>Clinical Notes</h3>
            <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(4,53,77,0.03)', border: '1px solid rgba(4,53,77,0.06)', fontSize: '14px', color: T.slate, lineHeight: 1.6 }}>{record.clinicalNotes}</div>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '12px', background: '#fff', border: '1px solid rgba(4,53,77,0.1)', boxShadow: '0 2px 8px rgba(4,53,77,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(32,181,223,0.1)', color: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ico p={ICONS.shield} size={22} sw={1.5} />
                </div>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 700, color: T.navy }}>{record.title}.{record.fileType.toLowerCase()}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>{record.fileType} Document • {record.fileSize}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {record.canPreview && (
                  <HoverBtn onClick={onPreview} base={{ padding: '0 12px', minHeight: '36px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.14)', background: '#fff', color: T.navy, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }} on={{ background: 'rgba(255,255,255,0.9)', transform: 'translateY(-1px)' }}>Preview</HoverBtn>
                )}
                {record.canDownload && (
                  <HoverBtn onClick={onDownload} base={{ padding: '0 12px', minHeight: '36px', borderRadius: '8px', border: 'none', background: T.blue, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }} on={{ background: '#348CEA', transform: 'translateY(-1px)' }}>Download</HoverBtn>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '20px 28px', borderTop: '1px solid rgba(4,53,77,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {record.canDelete && (
            <button onClick={onDeleteRequest} style={{ background: 'none', border: 'none', color: T.red, fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: '8px 0', textDecoration: 'underline' }}>Delete Record</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <HoverBtn onClick={onClose} base={{ padding: '0 20px', minHeight: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(4,53,77,0.14)', color: T.navy, fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' }} on={{ background: 'rgba(255,255,255,0.98)', transform: 'translateY(-1px)' }}>Close</HoverBtn>
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px', background: 'rgba(4,53,77,0.35)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div aria-hidden onClick={onClose} style={{ position: 'absolute', inset: 0 }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${record.title} preview`}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '900px', maxHeight: '88vh', background: '#fff', borderRadius: '18px', boxShadow: '0 24px 60px rgba(4,53,77,0.28)', border: '1px solid rgba(255,255,255,0.9)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
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
            border: '1px solid rgba(4,53,77,0.12)',
            background: 'rgba(255,255,255,0.96)',
            color: T.navy,
            fontSize: '24px',
            lineHeight: 1,
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(4,53,77,0.12)',
          }}
        >
          ✕
        </button>
        <div style={{ padding: '20px 72px 18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', borderBottom: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.96)' }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 800, color: T.navy }}>{fileLabel}</h2>
            <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>{record.date} • {record.provider}</p>
          </div>
          {record.canDownload && (
            <button
              onClick={onDownload}
              style={{ background: 'rgba(32,181,223,0.1)', border: '1px solid rgba(32,181,223,0.18)', borderRadius: '10px', color: T.blue, padding: '0 14px', minHeight: '36px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}
            >
              Download
            </button>
          )}
        </div>
        <div style={{ minHeight: '420px', maxHeight: 'calc(88vh - 74px)', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
          {loading ? (
            <p style={{ margin: 0, fontSize: '14px', color: T.slate, fontWeight: 700 }}>Loading secure preview...</p>
          ) : error ? (
            <div style={{ padding: '28px', textAlign: 'center', maxWidth: '460px' }}>
              <Ico p={ICONS.shield} size={48} sw={1.4} color="rgba(239,68,68,0.35)" />
              <p style={{ margin: '16px 0 8px', fontSize: '15px', color: T.navy, fontWeight: 800 }}>Preview unavailable</p>
              <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{error}</p>
            </div>
          ) : url && isImage ? (
            <img src={url} alt={record.title} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }} />
          ) : url && isPdf ? (
            <iframe title={record.title} src={url} style={{ width: '100%', minHeight: '70vh', border: 0, background: '#fff' }} />
          ) : (
            <div style={{ padding: '32px', width: '100%', maxWidth: '700px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 800, color: T.navy }}>{record.title}</h3>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: T.slate }}>{record.provider} • {record.date}</p>
              <div style={{ display: 'grid', gap: '14px' }}>
                {[record.summary, record.clinicalNotes, record.recommendations].filter(Boolean).map((text, index) => (
                  <p key={`${record.id}-preview-text-${index}`} style={{ margin: 0, padding: '14px', borderRadius: '12px', background: 'rgba(4,53,77,0.03)', border: '1px solid rgba(4,53,77,0.08)', color: T.slate, fontSize: '14px', lineHeight: 1.65 }}>{text}</p>
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
        <h2 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy }}>Delete medical record?</h2>
        <p style={{ margin: '0 0 22px', fontSize: '14px', color: T.slate, lineHeight: 1.6 }}>This will remove &quot;{record.title}&quot; from your medical records. This action cannot be undone.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <HoverBtn onClick={onClose} base={{ padding: '0 18px', minHeight: '42px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.14)', background: '#fff', color: T.navy, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>Cancel</HoverBtn>
          <HoverBtn onClick={onConfirm} base={{ padding: '0 18px', minHeight: '42px', borderRadius: '12px', border: 'none', background: T.red, color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>Delete</HoverBtn>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ─── Main Page Inner ───────────────────────────────────────────────────────────

function MedicalRecordsPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const recordId = searchParams.get('recordId')
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [activeTab, setActiveTab] = useState<RecordType | 'All Records'>('All Records')
  const [search, setSearch] = useState('')
  const [loadingRecords, setLoadingRecords] = useState(true)

  // Modals
  const [isUploading, setIsUploading] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null)
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)
  const [deleteRecord, setDeleteRecord] = useState<MedicalRecord | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [healthInfo, setHealthInfo] = useState<PatientHealthInfo | null>(null)

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

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 4000)
  }, [])

  const loadRecords = useCallback(async () => {
    try {
      const payload = await getMedicalRecords()
      setRecords((payload.records ?? []).map((item) => normalizeRecord(item)))
      setTimeline((payload.timeline ?? []).map((item) => normalizeTimeline(item)))
    } catch (error) {
      console.error('Failed to load medical records:', error)
      if (isAuthError(error)) {
        clearAuthTokens()
        router.replace('/auth/sign-in')
        return
      }
      setRecords([])
      setTimeline([])
      setToast(getApiErrorDetail(error) ?? 'Medical records could not be loaded.')
    } finally {
      setLoadingRecords(false)
    }
  }, [router])

  const loadHealthInfo = useCallback(async () => {
    try {
      setHealthInfo(await getPatientHealthInfo())
    } catch (error) {
      console.error('Failed to load health info:', error)
      if (isAuthError(error)) {
        clearAuthTokens()
        router.replace('/auth/sign-in')
      }
    }
  }, [router])

  const handleUploadComplete = (newRecord: MedicalRecord) => {
    setRecords((current) => [newRecord, ...current.filter((item) => item.id !== newRecord.id)])
    setIsUploading(false)
    showToast('Medical record uploaded successfully.')
    void loadRecords()
  }

  const handleDeleteRecord = (recordId: string) => {
    setRecords((current) => current.filter(r => r.id !== recordId))
    setTimeline((current) => current.filter((item) => item.recordId !== recordId))
    showToast('Medical record deleted successfully.')
  }

  const handleDownloadRecords = async () => {
    if (downloadableRecords.length === 0) {
      showToast('No downloadable file attachments are available yet.')
      return
    }

    try {
      for (const record of downloadableRecords) {
        await openRecordDownload(record)
      }
    } catch (error) {
      console.error('Download failed:', error)
      showToast(getApiErrorDetail(error) ?? 'One or more downloads failed. Please try downloading the record individually.')
    }
  }

  const handleDownloadRecord = async (record: MedicalRecord) => {
    try {
      await openRecordDownload(record)
    } catch (error) {
      console.error('Download failed:', error)
      showToast(getApiErrorDetail(error) ?? 'Download failed. Please try again.')
    }
  }

  const handlePreviewRecord = async (record: MedicalRecord) => {
    setPreviewState({ record, url: null, contentType: null, loading: Boolean(record.canDownload && record.fileType), error: null })
    if (!record.canDownload || !record.fileType) return

    try {
      const response = await downloadMedicalRecord(record.id, { disposition: 'inline' })
      setPreviewState({ record, url: response.download_url, contentType: response.content_type, loading: false, error: null })
    } catch (error) {
      console.error('Preview failed:', error)
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
      handleDeleteRecord(deleteRecord.id)
      setDeleteRecord(null)
      setSelectedRecord(null)
    } catch (error) {
      console.error('Delete failed:', error)
      showToast(getApiErrorDetail(error) ?? 'Delete failed. Please try again.')
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRecords()
      void loadHealthInfo()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadHealthInfo, loadRecords])

  useEffect(() => {
    if (!recordId) return

    const timer = window.setTimeout(() => {
      const record = records.find((item) => item.id === recordId)
      if (record) {
        setActiveTab('All Records')
        setSelectedRecord(record)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [recordId, records])

  return (
    <PatientPortalShell
      eyebrow="Patient Platform"
      title="Medical Records"
      description="Securely access and manage your healthcare records, consultation history, and clinical documents in one place."
      headerActions={
        <>
          <HoverBtn
            onClick={handleDownloadRecords}
            base={{ minHeight: '44px', padding: '0 16px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.15)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(4,53,77,0.06)', whiteSpace: 'nowrap' }}
            on={{ background: 'rgba(255,255,255,0.98)', transform: 'translateY(-1px)' }}
          >
            Download Records
          </HoverBtn>
          <HoverBtn
            onClick={() => setIsUploading(true)}
            base={{ minHeight: '44px', padding: '0 18px', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 5px 16px rgba(32,181,223,0.3)', whiteSpace: 'nowrap' }}
            on={{ transform: 'translateY(-1px)', boxShadow: '0 8px 22px rgba(52,140,234,0.34)' }}
          >
            Upload Medical Record
          </HoverBtn>
        </>
      }
      rightRail={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Important Medical Info */}
          <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.9)', padding: '20px', boxShadow: Sh.card }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Important Medical Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(4,53,77,0.06)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: T.slate }}>Blood Group</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: healthInfo?.blood_type ? T.red : T.slate2 }}>{healthInfo?.blood_type || 'Not set'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(4,53,77,0.06)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: T.slate }}>Known Allergies</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy, textAlign: 'right' }}>{healthInfo?.allergies || 'Not recorded'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(4,53,77,0.06)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: T.slate }}>Conditions</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy, textAlign: 'right' }}>{healthInfo?.medical_conditions || 'Not recorded'}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.9)', padding: '20px', boxShadow: Sh.card }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Care Timeline</h3>
            {timeline.length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>Your uploaded records and clinical documents will build this timeline.</p>
            ) : (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '8px' }}>
                <div style={{ position: 'absolute', left: '12px', top: '10px', bottom: '10px', width: '2px', background: 'rgba(4,53,77,0.08)' }} />
                {timeline.map((evt, idx) => (
                  <div key={evt.id} style={{ position: 'relative', paddingLeft: '24px' }}>
                    <div style={{ position: 'absolute', left: '0', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: idx === 0 ? T.blue : 'rgba(255,255,255,1)', border: `2px solid ${idx === 0 ? T.blue : 'rgba(4,53,77,0.2)'}`, boxShadow: idx === 0 ? '0 0 0 3px rgba(32,181,223,0.2)' : 'none' }} />
                    <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 700, color: T.slate2 }}>{evt.date}</p>
                    <p style={{ margin: '0 0 2px', fontSize: '13.5px', fontWeight: 700, color: T.navy }}>{evt.event}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>{evt.provider}</p>
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
            <p style={{ margin: '0 0 12px', fontSize: '12px', color: T.slate, lineHeight: 1.6 }}>Your medical records are encrypted and stored securely. Only authorized professionals can access them.</p>
            <Link href={PATIENT_ROUTES.settings} style={{ fontSize: '12px', fontWeight: 700, color: T.blue, textDecoration: 'none' }}>Privacy Settings →</Link>
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
            style={{ textAlign: 'left', padding: '16px', borderRadius: '16px', border: `1px solid ${activeTab === item.filter ? 'rgba(32,181,223,0.3)' : 'rgba(4,53,77,0.08)'}`, background: activeTab === item.filter ? 'rgba(32,181,223,0.06)' : 'rgba(255,255,255,0.85)', boxShadow: activeTab === item.filter ? '0 4px 12px rgba(32,181,223,0.1)' : '0 2px 8px rgba(4,53,77,0.04)', cursor: 'pointer', transition: 'all 0.15s ease' }}
          >
            <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: activeTab === item.filter ? T.blue : T.slate2 }}>{item.label}</p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: T.navy }}>{item.value}</p>
          </button>
        ))}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: Sh.card, padding: '20px' }}>

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
              style={{ width: '100%', height: '46px', borderRadius: '14px', border: '1px solid rgba(4,53,77,0.12)', padding: '0 16px 0 42px', fontSize: '14px', color: T.navy, background: '#fff', outline: 'none' }}
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
                  border: `1px solid ${activeTab === cat ? T.blue : 'rgba(4,53,77,0.1)'}`,
                  background: activeTab === cat ? 'rgba(32,181,223,0.1)' : 'transparent',
                  color: activeTab === cat ? T.blue : T.slate,
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
        <div className="mr-card-grid">
          {loadingRecords ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', background: 'rgba(4,53,77,0.02)', borderRadius: '16px', border: '1px dashed rgba(4,53,77,0.1)' }}>
              <p style={{ margin: 0, fontSize: '14px', color: T.slate }}>Loading medical records...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', background: 'rgba(4,53,77,0.02)', borderRadius: '16px', border: '1px dashed rgba(4,53,77,0.1)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'rgba(32,181,223,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: T.blue }}>
                <Ico p={ICONS.search} size={24} sw={1.5} />
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: T.navy }}>{search ? 'No records match your search' : 'No medical records yet'}</h3>
              <p style={{ margin: '0 0 20px', fontSize: '14px', color: T.slate, maxWidth: '320px', marginLeft: 'auto', marginRight: 'auto' }}>
                {search ? 'Try adjusting your search terms or filters.' : 'Your consultation summaries, prescriptions, lab results, and other healthcare documents will appear here.'}
              </p>
              {search ? (
                <HoverBtn onClick={() => { setSearch(''); setActiveTab('All Records') }} base={{ padding: '0 20px', minHeight: '40px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.15)', background: '#fff', color: T.navy, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }} on={{ transform: 'translateY(-1px)' }}>Clear Filters</HoverBtn>
              ) : (
                <HoverBtn onClick={() => setIsUploading(true)} base={{ padding: '0 20px', minHeight: '40px', borderRadius: '10px', border: 'none', background: T.blue, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }} on={{ background: '#348CEA', transform: 'translateY(-1px)' }}>Upload Medical Record</HoverBtn>
              )}
            </div>
          ) : (
            filteredRecords.map(record => (
              <div key={record.id} style={{ display: 'flex', flexDirection: 'column', padding: '16px', borderRadius: '16px', border: '1px solid rgba(4,53,77,0.08)', background: '#fff', boxShadow: '0 2px 8px rgba(4,53,77,0.03)', transition: 'all 0.15s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.blue }}>{record.type}</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: T.slate2 }}>{record.date}</span>
                    </div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 800, color: T.navy }}>{record.title}</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: T.slate }}>{record.provider} <span style={{ color: T.slate2 }}>• {record.specialty}</span></p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
                  <HoverBtn
                    onClick={() => setSelectedRecord(record)}
                    base={{ padding: '0 14px', minHeight: '36px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.15)', background: '#fff', color: T.navy, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(4,53,77,0.02)' }}
                    on={{ background: 'rgba(255,255,255,0.9)', transform: 'translateY(-1px)' }}
                  >
                    View Details
                  </HoverBtn>
                  {record.canPreview && (
                    <HoverBtn
                      onClick={() => void handlePreviewRecord(record)}
                      base={{ padding: '0 14px', minHeight: '36px', borderRadius: '10px', border: 'none', background: 'rgba(32,181,223,0.1)', color: T.blue, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                      on={{ background: 'rgba(32,181,223,0.15)', transform: 'translateY(-1px)' }}
                    >
                      Preview {record.fileType ? `(${record.fileType})` : ''}
                    </HoverBtn>
                  )}
                  {record.canDownload && (
                    <HoverBtn
                      onClick={() => void handleDownloadRecord(record)}
                      base={{ padding: '0 14px', minHeight: '36px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.1)', background: 'transparent', color: T.slate, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                      on={{ background: 'rgba(4,53,77,0.03)', color: T.navy, transform: 'translateY(-1px)' }}
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

      {isUploading && <UploadRecordModal onClose={() => setIsUploading(false)} onUpload={handleUploadComplete} onError={showToast} />}
      {selectedRecord && (
        <RecordDetailsModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onPreview={() => { void handlePreviewRecord(selectedRecord); setSelectedRecord(null) }}
          onDownload={() => void handleDownloadRecord(selectedRecord)}
          onDeleteRequest={() => setDeleteRecord(selectedRecord)}
        />
      )}
      {previewState && <PreviewModal preview={previewState} onClose={() => setPreviewState(null)} onDownload={() => void handleDownloadRecord(previewState.record)} />}
      {deleteRecord && <DeleteRecordModal record={deleteRecord} onClose={() => setDeleteRecord(null)} onConfirm={() => void handleDeleteConfirmed()} />}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderRadius: '14px', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(15,158,119,0.22)', boxShadow: '0 8px 28px rgba(4,53,77,0.14)', color: T.navy, fontSize: '13.5px', fontWeight: 600 }}>
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

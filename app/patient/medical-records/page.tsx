'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES, isPatientNavActive } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import PatientPortalShell from '@/components/patient/PatientPortalShell'

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

const CATEGORIES: RecordType[] = ['Consultation', 'Prescription', 'Lab Result', 'Diagnosis', 'Referral', 'Medical Document']

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_RECORDS: MedicalRecord[] = [
  {
    id: 'rec-1',
    type: 'Consultation',
    title: 'Consultation Summary',
    provider: 'Dr. Sophia Reed',
    specialty: 'Cardiology',
    date: 'August 5, 2026',
    status: 'Available',
    lastUpdated: 'Aug 5, 2026',
    summary: 'Patient reported occasional shortness of breath. Blood pressure slightly elevated at 130/85. Recommended lifestyle modifications and scheduled a follow-up.',
    clinicalNotes: 'Heart rhythm regular. No murmurs. Lungs clear to auscultation.',
    recommendations: 'Reduce sodium intake. Moderate exercise 3x/week. Monitor BP daily.',
    canPreview: true,
    canDownload: true,
    canDelete: false,
  },
  {
    id: 'rec-2',
    type: 'Prescription',
    title: 'Atorvastatin 20mg',
    provider: 'Dr. Sophia Reed',
    specialty: 'Cardiology',
    date: 'August 5, 2026',
    status: 'Available',
    lastUpdated: 'Aug 5, 2026',
    summary: 'Prescribed for lipid management.',
    fileType: 'PDF',
    fileSize: '45 KB',
    canPreview: true,
    canDownload: true,
    canDelete: false,
  },
  {
    id: 'rec-3',
    type: 'Lab Result',
    title: 'Comprehensive Metabolic Panel',
    provider: 'Qarevo Diagnostics',
    specialty: 'Laboratory',
    date: 'August 2, 2026',
    status: 'Available',
    lastUpdated: 'Aug 3, 2026',
    summary: 'All metabolic indicators within normal limits. Glucose slightly elevated.',
    fileType: 'PDF',
    fileSize: '1.2 MB',
    canPreview: true,
    canDownload: true,
    canDelete: false,
  },
  {
    id: 'rec-4',
    type: 'Referral',
    title: 'Referral to Endocrinology',
    provider: 'Dr. James Whitmore',
    specialty: 'Neurology',
    date: 'July 15, 2026',
    status: 'Available',
    lastUpdated: 'July 15, 2026',
    summary: 'Patient referred for further evaluation of ongoing fatigue and weight fluctuations.',
    fileType: 'PDF',
    fileSize: '120 KB',
    canPreview: true,
    canDownload: true,
    canDelete: false,
  },
  {
    id: 'rec-5',
    type: 'Medical Document',
    title: 'Previous Clinical History',
    provider: 'Self-Uploaded',
    specialty: 'General',
    date: 'July 1, 2026',
    status: 'Available',
    lastUpdated: 'July 1, 2026',
    summary: 'Past medical history records from previous provider.',
    fileType: 'PDF',
    fileSize: '3.4 MB',
    canPreview: true,
    canDownload: true,
    canDelete: true, // Self uploaded
  },
]

const MOCK_TIMELINE: TimelineEvent[] = [
  { id: 't1', date: 'Aug 5, 2026', event: 'Cardiology Follow-up', provider: 'Dr. Sophia Reed', recordId: 'rec-1' },
  { id: 't2', date: 'Aug 5, 2026', event: 'Prescription Issued', provider: 'Dr. Sophia Reed', recordId: 'rec-2' },
  { id: 't3', date: 'Aug 2, 2026', event: 'Blood Test Collected', provider: 'Qarevo Diagnostics', recordId: 'rec-3' },
  { id: 't4', date: 'Jul 15, 2026', event: 'Endocrinology Referral', provider: 'Dr. James Whitmore', recordId: 'rec-4' },
]

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

function UploadRecordModal({ onClose, onUpload }: { onClose: () => void; onUpload: (r: MedicalRecord) => void }) {
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
      setFile(e.target.files[0])
    }
  }

  const handleUpload = () => {
    if (!docName || !file || !date) return
    setIsUploading(true)
    
    // Simulate upload progress
    let p = 0
    const interval = setInterval(() => {
      p += 20
      setProgress(p)
      if (p >= 100) {
        clearInterval(interval)
        setTimeout(() => {
          onUpload({
            id: `rec-up-${Date.now()}`,
            type: docType,
            title: docName,
            provider: provider || 'Self-Uploaded',
            specialty: 'General',
            date: date,
            status: 'Available',
            lastUpdated: 'Just now',
            summary: desc,
            fileType: file.name.split('.').pop()?.toUpperCase() || 'FILE',
            fileSize: (file.size / 1024 / 1024).toFixed(1) + ' MB',
            canPreview: false,
            canDownload: true,
            canDelete: true,
          })
        }, 400)
      }
    }, 200)
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
                <p style={{ margin: '0 0 16px', fontSize: '12px', color: T.slate }}>Supported formats: PDF, PNG, JPG (Max 10MB)</p>
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

function RecordDetailsModal({ record, onClose, onPreview }: { record: MedicalRecord; onClose: () => void; onPreview: () => void }) {
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
                  <HoverBtn base={{ padding: '0 12px', minHeight: '36px', borderRadius: '8px', border: 'none', background: T.blue, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }} on={{ background: '#348CEA', transform: 'translateY(-1px)' }}>Download</HoverBtn>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '20px 28px', borderTop: '1px solid rgba(4,53,77,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {record.canDelete && (
            <button style={{ background: 'none', border: 'none', color: T.red, fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: '8px 0', textDecoration: 'underline' }}>Delete Record</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <HoverBtn onClick={onClose} base={{ padding: '0 20px', minHeight: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(4,53,77,0.14)', color: T.navy, fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' }} on={{ background: 'rgba(255,255,255,0.98)', transform: 'translateY(-1px)' }}>Close</HoverBtn>
        </div>
      </div>
    </ModalOverlay>
  )
}

function PreviewModal({ record, onClose }: { record: MedicalRecord; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', background: 'rgba(4,53,77,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.4)' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#fff' }}>{record.title}.{record.fileType?.toLowerCase()}</h2>
          <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>{record.date} • {record.provider}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', color: '#fff', padding: '0 16px', minHeight: '38px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Download</button>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '28px', lineHeight: 1, cursor: 'pointer', padding: '0 8px' }}>✕</button>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ width: '100%', maxWidth: '800px', height: '100%', background: '#fff', borderRadius: '12px', boxShadow: '0 24px 48px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Ico p={ICONS.shield} size={64} sw={1.2} color="rgba(4,53,77,0.15)" />
          <p style={{ marginTop: '20px', fontSize: '15px', color: T.slate, fontWeight: 600 }}>Document Preview Placeholder</p>
          <p style={{ marginTop: '8px', fontSize: '13px', color: T.slate2 }}>In a real implementation, a PDF viewer or image would render here.</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page Inner ───────────────────────────────────────────────────────────

function MedicalRecordsPageInner() {
  const router = useRouter()
  const [records, setRecords] = useState<MedicalRecord[]>(MOCK_RECORDS)
  const [activeTab, setActiveTab] = useState<RecordType | 'All Records'>('All Records')
  const [search, setSearch] = useState('')
  
  // Modals
  const [isUploading, setIsUploading] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null)
  const [previewRecord, setPreviewRecord] = useState<MedicalRecord | null>(null)
  const [toast, setToast] = useState<string | null>(null)

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

  const handleUploadComplete = (newRecord: MedicalRecord) => {
    setRecords([newRecord, ...records])
    setIsUploading(false)
    setToast('Medical record uploaded successfully.')
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <PatientPortalShell
      eyebrow="Patient Platform"
      title="Medical Records"
      description="Securely access and manage your healthcare records, consultation history, and clinical documents in one place."
      headerActions={
        <>
          <HoverBtn
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
                <span style={{ fontSize: '13px', fontWeight: 700, color: T.red }}>O Positive</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(4,53,77,0.06)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: T.slate }}>Known Allergies</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>Penicillin</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(4,53,77,0.06)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: T.slate }}>Conditions</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>Hypertension</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.9)', padding: '20px', boxShadow: Sh.card }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>Care Timeline</h3>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '8px' }}>
              <div style={{ position: 'absolute', left: '12px', top: '10px', bottom: '10px', width: '2px', background: 'rgba(4,53,77,0.08)' }} />
              {MOCK_TIMELINE.map((evt, idx) => (
                <div key={evt.id} style={{ position: 'relative', paddingLeft: '24px' }}>
                  <div style={{ position: 'absolute', left: '0', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: idx === 0 ? T.blue : 'rgba(255,255,255,1)', border: `2px solid ${idx === 0 ? T.blue : 'rgba(4,53,77,0.2)'}`, boxShadow: idx === 0 ? '0 0 0 3px rgba(32,181,223,0.2)' : 'none' }} />
                  <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 700, color: T.slate2 }}>{evt.date}</p>
                  <p style={{ margin: '0 0 2px', fontSize: '13.5px', fontWeight: 700, color: T.navy }}>{evt.event}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>{evt.provider}</p>
                </div>
              ))}
            </div>
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
                {cat} ({counts[cat]})
              </button>
            ))}
          </div>
        </div>

        {/* Record List */}
        <div className="mr-card-grid">
          {filteredRecords.length === 0 ? (
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
                  {(record.fileType || record.canPreview) && (
                    <HoverBtn
                      onClick={() => setPreviewRecord(record)}
                      base={{ padding: '0 14px', minHeight: '36px', borderRadius: '10px', border: 'none', background: 'rgba(32,181,223,0.1)', color: T.blue, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                      on={{ background: 'rgba(32,181,223,0.15)', transform: 'translateY(-1px)' }}
                    >
                      Preview {record.fileType ? `(${record.fileType})` : ''}
                    </HoverBtn>
                  )}
                  {record.canDownload && (
                    <HoverBtn
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

      {isUploading && <UploadRecordModal onClose={() => setIsUploading(false)} onUpload={handleUploadComplete} />}
      {selectedRecord && <RecordDetailsModal record={selectedRecord} onClose={() => setSelectedRecord(null)} onPreview={() => { setSelectedRecord(null); setPreviewRecord(selectedRecord); }} />}
      {previewRecord && <PreviewModal record={previewRecord} onClose={() => setPreviewRecord(null)} />}
      
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

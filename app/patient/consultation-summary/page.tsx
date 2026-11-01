'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalCard, PortalLinkButton } from '@/components/patient/PatientPortalPrimitives'
import { EmptyRecords, RecordFields, RecordLoadState, type ClinicalRecord } from '@/components/patient/ClinicalRecords'
import { usePatientResource } from '@/lib/use-patient-resource'
function ConsultationSummary() {
  const id = useSearchParams().get('consultationId')
  const resource = usePatientResource<ClinicalRecord>(id ? `/api/v1/patient/consultation-summary?consultation_id=${encodeURIComponent(id)}` : null, true)
  return <PatientPortalShell title='Consultation summary' description='Your clinician-reviewed care summary and follow-up advice.'>
    <RecordLoadState {...resource}>
      {resource.data ? <PortalCard><h2>Clinician-approved consultation summary</h2><p style={{ opacity: 0.75 }}>Revision {String(resource.data.revision ?? '')} · Approved {typeof resource.data.published_at === 'string' ? new Date(resource.data.published_at).toLocaleString() : ''}</p><RecordFields record={resource.data} fields={[['summary', 'Summary'], ['history', 'History'], ['findings', 'Findings'], ['assessment', 'Assessment'], ['plan', 'Care plan'], ['safety_net', 'Safety and follow-up advice'], ['amendment_reason', 'Amendment reason']]} /></PortalCard> : <EmptyRecords title='No consultation summary available' description='There is no recorded summary for this link. Check your appointments or return to your dashboard.' />}
      <div style={{ marginTop: 16 }}><PortalLinkButton href='/patient/appointments'>View my appointments</PortalLinkButton></div>
    </RecordLoadState>
  </PatientPortalShell>
}
export default function ConsultationSummaryPage() {
  return <Suspense fallback={<p role='status'>Loading consultation…</p>}><ConsultationSummary /></Suspense>
}

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
  return <PatientPortalShell title='Consultation summary' description='A summary is shown only when it has been recorded for this consultation.'>
    <RecordLoadState {...resource}>
      {resource.data ? <PortalCard><h2>Recorded consultation summary</h2><RecordFields record={resource.data} fields={[['summary', 'Summary'], ['subjective', 'History'], ['objective', 'Findings'], ['assessment', 'Assessment'], ['plan', 'Plan']]} /></PortalCard> : <EmptyRecords title='No consultation summary available' description='There is no recorded summary for this link. Check your appointments or return to your dashboard.' />}
      <div style={{ marginTop: 16 }}><PortalLinkButton href='/patient/appointments'>View my appointments</PortalLinkButton></div>
    </RecordLoadState>
  </PatientPortalShell>
}
export default function ConsultationSummaryPage() {
  return <Suspense fallback={<p role='status'>Loading consultation…</p>}><ConsultationSummary /></Suspense>
}

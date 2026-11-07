'use client'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalCard, PortalLinkButton } from '@/components/patient/PatientPortalPrimitives'
import { EmptyRecords, RecordFields, RecordLoadState, type ClinicalRecord } from '@/components/patient/ClinicalRecords'
import { usePatientResource } from '@/lib/use-patient-resource'
export default function FollowUpPage() {
  const resource = usePatientResource<ClinicalRecord>('/api/v1/patient/follow-up', true)
  return <PatientPortalShell title='Follow-up care' description='Follow-up instructions recorded for your account.'>
    <RecordLoadState {...resource}>
      {resource.data ? <PortalCard><h2>Your follow-up record</h2><RecordFields record={resource.data} fields={[['title', 'Follow-up'], ['instructions', 'Instructions'], ['summary', 'Summary'], ['status', 'Status']]} /></PortalCard> : <EmptyRecords title='No follow-up instructions recorded' description='Your clinician’s follow-up instructions will appear here when available.' />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}><PortalLinkButton href='/patient/prescription-care-plan'>Prescriptions & Care Plan</PortalLinkButton><PortalLinkButton href='/patient/appointments'>My appointments</PortalLinkButton></div>
    </RecordLoadState>
  </PatientPortalShell>
}

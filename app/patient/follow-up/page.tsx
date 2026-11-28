'use client'
import { useTranslations } from 'next-intl'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalCard, PortalLinkButton } from '@/components/patient/PatientPortalPrimitives'
import { EmptyRecords, RecordFields, RecordLoadState, type ClinicalRecord } from '@/components/patient/ClinicalRecords'
import { usePatientResource } from '@/lib/use-patient-resource'
export default function FollowUpPage() {
  const t = useTranslations('patientCareRecords')
  const resource = usePatientResource<ClinicalRecord>('/api/v1/patient/follow-up', true)
  return <PatientPortalShell title={t('followUpCare')} description={t('followUpInstructionsRecordedFor')}>
    <RecordLoadState {...resource}>
      {resource.data ? <PortalCard><h2>{t('yourFollowUpRecord')}</h2><RecordFields record={resource.data} fields={[['title', 'Follow-up'], ['instructions', 'Instructions'], ['summary', 'Summary'], ['status', 'Status']]} /></PortalCard> : <EmptyRecords title={t('noFollowUpInstructionsRecorded')} description={t('yourClinicianSFollowUp')} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}><PortalLinkButton href='/patient/prescription-care-plan'>{t('prescriptionsCarePlan')}</PortalLinkButton><PortalLinkButton href='/patient/appointments'>{t('myAppointments')}</PortalLinkButton></div>
    </RecordLoadState>
  </PatientPortalShell>
}

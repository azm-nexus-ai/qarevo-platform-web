'use client'
import { useTranslations } from 'next-intl'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalBadge, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import { EmptyRecords, RecordFields, RecordLoadState, recordList, recordText, type ClinicalRecord } from '@/components/patient/ClinicalRecords'
import { usePatientResource } from '@/lib/use-patient-resource'
export default function ReferralsPage() {
  const t = useTranslations('patientCareRecords')
  const resource = usePatientResource<ClinicalRecord>('/api/v1/patient/referrals')
  const referrals = recordList(resource.data?.providers)
  return <PatientPortalShell title={t('referrals')} description={t('specialistReferralsRecordedForYour')}>
    <RecordLoadState {...resource}>
      {referrals.length === 0 ? <EmptyRecords title={t('noReferralsRecorded')} description={t('ifYourClinicianArrangesA')} /> : <div style={{ display: 'grid', gap: 16 }}>{referrals.map((referral, index) => <PortalCard key={recordText(referral.id) || index}>
        <h2>{recordText(referral.name) || recordText(referral.title) || t('specialistReferral')}</h2>
        {recordText(referral.status) && <PortalBadge>{recordText(referral.status)}</PortalBadge>}
        <RecordFields record={referral} fields={[['specialty', 'Specialty'], ['hospital', 'Location'], ['reason', 'Reason for referral'], ['instructions', 'Instructions']]} />
      </PortalCard>)}</div>}
    </RecordLoadState>
  </PatientPortalShell>
}

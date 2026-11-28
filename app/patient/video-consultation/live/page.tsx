import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import ConsultationVideoRoom from '@/components/video/ConsultationVideoRoom'

export default function Page() {
  const t = useTranslations('patientPages')
  return <PatientPortalShell title={t('videoTitle')} description={t('videoDescription')}>
    <Suspense fallback={<p role="status">{t('loadingConsultation')}</p>}><ConsultationVideoRoom role="patient" /></Suspense>
  </PatientPortalShell>
}

import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import ConsultationVideoRoom from '@/components/video/ConsultationVideoRoom'

export default function VideoConsultationPage() {
  const t = useTranslations('patientPages')
  return <Suspense fallback={<p role="status">{t('loadingConsultation')}</p>}><ConsultationVideoRoom role="doctor" /></Suspense>
}

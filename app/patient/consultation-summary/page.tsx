'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import ClinicalPublicationReader from '@/components/clinical/ClinicalPublicationReader'
import { publicationParameters } from '@/lib/clinical-publications'

function ConsultationSummary() {
  const t = useTranslations('patientPages')
  const parameters = useSearchParams()
  const location = publicationParameters(parameters.getAll('consultationId'), parameters.getAll('recordId'))
  return <PatientPortalShell title={t('summaryTitle')} description={t('summaryDescription')}>
    <ClinicalPublicationReader key={JSON.stringify(location)} portal='patient' {...location} />
  </PatientPortalShell>
}
export default function ConsultationSummaryPage() {
  const t = useTranslations('patientPages')
  return <Suspense fallback={<p role='status' className='p-6 text-secondary'>{t('loadingConsultation')}</p>}><ConsultationSummary /></Suspense>
}

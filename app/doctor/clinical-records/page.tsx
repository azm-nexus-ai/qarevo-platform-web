'use client'

import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import ClinicalPublicationReader from '@/components/clinical/ClinicalPublicationReader'
import { publicationParameters } from '@/lib/clinical-publications'

function PublishedClinicalRecords() {
  const t = useTranslations('doctorClinicalRecords')
  const parameters = useSearchParams()
  const location = publicationParameters(parameters.getAll('consultationId'), parameters.getAll('recordId'))
  return <div className='space-y-6'><header><h1 className='text-2xl font-bold text-ink'>{t('title')}</h1><p className='mt-2 max-w-3xl text-sm leading-7 text-secondary'>{t('intro')}</p></header>
    <ClinicalPublicationReader key={JSON.stringify(location)} portal='doctor' {...location} />
  </div>
}
export default function PublishedClinicalRecordsPage() {
  const t = useTranslations('doctorClinicalRecords')
  return <Suspense fallback={<p role='status' className='p-6 text-secondary'>{t('loading')}</p>}><PublishedClinicalRecords /></Suspense>
}

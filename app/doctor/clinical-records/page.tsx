'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ClinicalPublicationReader from '@/components/clinical/ClinicalPublicationReader'
import { publicationParameters } from '@/lib/clinical-publications'

function PublishedClinicalRecords() {
  const parameters = useSearchParams()
  const location = publicationParameters(parameters.getAll('consultationId'), parameters.getAll('recordId'))
  return <div className='space-y-6'><header><h1 className='text-2xl font-bold text-ink'>Published care summaries</h1><p className='mt-2 max-w-3xl text-sm leading-7 text-secondary'>Review the immutable versions shared with your patient. Continue documentation and amendments in the consultation workspace.</p></header>
    <ClinicalPublicationReader key={JSON.stringify(location)} portal='doctor' {...location} />
  </div>
}
export default function PublishedClinicalRecordsPage() {
  return <Suspense fallback={<p role='status' className='p-6 text-secondary'>Loading published care summaries…</p>}><PublishedClinicalRecords /></Suspense>
}

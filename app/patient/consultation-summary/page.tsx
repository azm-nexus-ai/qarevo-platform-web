'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import ClinicalPublicationReader from '@/components/clinical/ClinicalPublicationReader'
import { publicationParameters } from '@/lib/clinical-publications'

function ConsultationSummary() {
  const parameters = useSearchParams()
  const location = publicationParameters(parameters.getAll('consultationId'), parameters.getAll('recordId'))
  return <PatientPortalShell title='Consultation summary' description='Read the latest clinician-published account of your consultation and follow-up advice.'>
    <ClinicalPublicationReader key={JSON.stringify(location)} portal='patient' {...location} />
  </PatientPortalShell>
}
export default function ConsultationSummaryPage() {
  return <Suspense fallback={<p role='status' className='p-6 text-secondary'>Loading consultation…</p>}><ConsultationSummary /></Suspense>
}

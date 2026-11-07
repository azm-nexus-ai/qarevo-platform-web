'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalButton, PortalCard, PortalLinkButton } from '@/components/patient/PatientPortalPrimitives'
import { EmptyRecords, RecordFields, RecordLoadState } from '@/components/patient/ClinicalRecords'
import ClinicalStatusBadge from '@/components/ui/ClinicalStatusBadge'
import { usePatientResource } from '@/lib/use-patient-resource'
import { consultationSummaryId, publishedConsultationSummary, summaryPublicationTime } from '@/lib/patient-consultation-summary'

function ConsultationSummary() {
  const parameters = useSearchParams()
  const supplied = parameters.getAll('consultationId')
  const id = supplied.length === 1 ? consultationSummaryId(supplied[0]) : null
  const resource = usePatientResource<unknown>(id ? `/api/v1/patient/consultation-summary?consultation_id=${encodeURIComponent(id)}` : null, true, { refreshOnFocus: true })
  const summary = id ? publishedConsultationSummary(resource.data, id) : null
  const invalidResponse = resource.data !== null && !summary
  const invalidLink = supplied.length > 0 && !id
  return <PatientPortalShell title='Consultation summary' description='Read the latest clinician-published account of your consultation and follow-up advice.'
    headerActions={id ? <PortalButton type='button' disabled={resource.refreshing} onClick={resource.retry}>{resource.refreshing ? 'Refreshing summary…' : 'Refresh summary'}</PortalButton> : undefined}>
    {!id ? <EmptyRecords title={invalidLink ? 'This summary link is invalid' : 'No consultation summary available'} description='Open a published summary from your medical records or appointment details. The link must identify one consultation.' showDashboardLink={false} />
      : <RecordLoadState loading={resource.loading} error={resource.error || invalidResponse} errorMessage={invalidResponse ? 'A published summary could not be confirmed for this consultation. Retry or contact your care team.' : resource.errorMessage} loadingMessage='Loading your published consultation summary…' retry={resource.retry}>
        {summary ? <PortalCard role='article' aria-label='Published consultation summary'>
          <div className='flex flex-wrap items-start justify-between gap-3'><h2 className='portal-h2'>Clinician-approved consultation summary</h2><ClinicalStatusBadge status='Published' domain='record' /></div>
          <dl className='my-5 grid gap-4 rounded-xl border border-theme bg-surface-subtle p-4 text-sm sm:grid-cols-3'>
            <div><dt className='font-semibold text-secondary'>Published revision</dt><dd className='mt-1 text-ink'>Revision {summary.revision}</dd></div>
            <div><dt className='font-semibold text-secondary'>Published</dt><dd className='mt-1 text-ink'><time dateTime={summary.published_at!}>{summaryPublicationTime(summary.published_at)}</time></dd></div>
            <div><dt className='font-semibold text-secondary'>Document language</dt><dd className='mt-1 text-ink'>{summary.language === 'de' ? 'German' : 'English'}</dd></div>
          </dl>
          {summary.amendment_reason && <section aria-labelledby='summary-amendment-title' className='mb-5 rounded-xl border border-theme bg-surface-subtle p-4'><h3 id='summary-amendment-title' className='portal-h3'>Amendment reason</h3><p className='whitespace-pre-wrap break-words text-sm leading-7 text-secondary'>{summary.amendment_reason}</p></section>}
          <RecordFields record={summary} fields={[
            ['summary', 'Summary'], ['history', 'History'], ['findings', 'Findings'], ['assessment', 'Assessment'], ['plan', 'Care plan'], ['safety_net', 'Safety and follow-up advice'],
          ]} />
        </PortalCard> : <EmptyRecords title='No consultation summary available' description='Your clinician has not published a summary for this consultation. Saved drafts are not shared here. Check again later or contact your care team.' showDashboardLink={false} />}
      </RecordLoadState>}
    {resource.refreshing && !resource.loading && <p role='status' className='mt-4 text-sm text-secondary'>Checking for the latest published revision…</p>}
    <nav aria-label='Consultation summary navigation' className='mt-5 flex flex-wrap gap-3'><PortalLinkButton href='/patient/medical-records'>Back to medical records</PortalLinkButton><PortalLinkButton href='/patient/appointments'>View my appointments</PortalLinkButton></nav>
  </PatientPortalShell>
}
export default function ConsultationSummaryPage() {
  return <Suspense fallback={<p role='status' className='p-6 text-secondary'>Loading consultation…</p>}><ConsultationSummary /></Suspense>
}

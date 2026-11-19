import { Suspense } from 'react'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import ConsultationVideoRoom from '@/components/video/ConsultationVideoRoom'

export default function Page() {
  return <PatientPortalShell title="Video consultation" description="Meet your clinician in your saved consultation room.">
    <Suspense fallback={<p role="status">Loading consultation…</p>}><ConsultationVideoRoom role="patient" /></Suspense>
  </PatientPortalShell>
}

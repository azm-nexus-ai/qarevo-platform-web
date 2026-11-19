import { Suspense } from 'react'
import ConsultationVideoRoom from '@/components/video/ConsultationVideoRoom'

export default function VideoConsultationPage() {
  return <Suspense fallback={<p role="status">Loading consultation…</p>}><ConsultationVideoRoom role="doctor" /></Suspense>
}

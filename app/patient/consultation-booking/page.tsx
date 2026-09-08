'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function ConsultationBookingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId') ?? ''
  const serviceType = searchParams.get('service') || 'video'

  useEffect(() => {
    // Redirect to date-time selection with default service type
    const params = new URLSearchParams()
    params.set('provider_id', physicianId)
    params.set('service_type', serviceType)
    params.set('from', 'redirect')
    router.replace(`/patient/consultation-booking/date-time?${params.toString()}`)
  }, [router, physicianId, serviceType])

  return null
}

function ConsultationBookingPageFallback() {
  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Redirecting to scheduling...</p>
      </div>
    </main>
  )
}

export default function ConsultationBookingPage() {
  return (
    <Suspense fallback={<ConsultationBookingPageFallback />}>
      <ConsultationBookingPageContent />
    </Suspense>
  )
}

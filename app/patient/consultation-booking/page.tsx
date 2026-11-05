'use client'

import { bookingEntryDestination } from '@/lib/booking'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function ConsultationBookingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const destination = bookingEntryDestination(searchParams)

  useEffect(() => { router.replace(destination) }, [router, destination])

  return <p role='status' className='p-6 text-sm text-muted'>Opening appointment options…</p>
}

function ConsultationBookingPageFallback() {
  return (
    <main style={{ minHeight: '100vh', background: "var(--canvas)", display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '14px', color: "var(--text-muted)" }}>Redirecting to scheduling...</p>
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

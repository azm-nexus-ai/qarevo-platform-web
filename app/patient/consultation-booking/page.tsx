'use client'

import { bookingEntryDestination } from '@/lib/booking'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

function ConsultationBookingPageContent() {
  const t = useTranslations('patientPages')
  const router = useRouter()
  const searchParams = useSearchParams()
  const destination = bookingEntryDestination(searchParams)

  useEffect(() => { router.replace(destination) }, [router, destination])

  return <p role='status' className='p-6 text-sm text-muted'>{t('openingOptions')}</p>
}

function ConsultationBookingPageFallback() {
  const t = useTranslations('patientPages')
  return (
    <main style={{ minHeight: '100vh', background: "var(--canvas)", display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '14px', color: "var(--text-muted)" }}>{t('redirectingScheduling')}</p>
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

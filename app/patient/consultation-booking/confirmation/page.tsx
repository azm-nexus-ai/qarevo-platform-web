'use client'

import Link from 'next/link'
import { Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { T, Sh, PAGE_BG } from '@/lib/tokens'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'

function formatFee(value: number) {
  return `$${value}`
}

function readLabel(service: string | null) {
  switch (service) {
    case 'physical':
      return 'In-person Consultation'
    case 'follow-up':
      return 'Follow-up Consultation'
    default:
      return 'Video Consultation'
  }
}

function ConfirmationPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId') ?? ''
  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const service = searchParams.get('service') ?? 'video'
  const fee = Number(searchParams.get('fee') ?? physician?.consultationFee ?? 140)
  const duration = searchParams.get('duration') ?? '30 min'
  const insurance = searchParams.get('insurance') ?? 'Axa'
  const date = searchParams.get('date') ?? 'Today'
  const slot = searchParams.get('slot') ?? '4:30 PM'

  const successHref = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString())
    return `/patient/consultation-booking/success?${next.toString()}`
  }, [searchParams])

  const backHref = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString())
    return `/patient/consultation-booking/review?${next.toString()}`
  }, [searchParams])

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '24px 20px 40px' }}>
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'minmax(0, 1fr) 330px', alignItems: 'start' }}>
          <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.float, padding: '24px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '999px', background: 'rgba(15,158,119,0.1)', border: '1px solid rgba(15,158,119,0.2)', color: T.green, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '14px' }}>
              <Ico p={ICONS.check} size={11} sw={2.4} color={T.green} />
              Confirm Booking
            </div>
            <h1 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '28px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Confirm your appointment request</h1>
            <p style={{ margin: '0 0 18px', fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>A confirmation notice will be sent to you after the clinic accepts the request. Your information remains protected throughout the process.</p>

            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.9)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Provider</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{physician?.name ?? 'Selected physician'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Slot</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{date} · {slot}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Duration</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{duration}</span>
                </div>
              </div>
            </div>
          </section>

          <aside style={{ display: 'grid', gap: '12px' }}>
            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: Sh.card, padding: '18px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Booking Details</p>
              <h3 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy }}>{readLabel(service)}</h3>
              <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                  <span style={{ fontSize: '12px', color: T.slate2 }}>Fee</span>
                  <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700 }}>{formatFee(fee)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                  <span style={{ fontSize: '12px', color: T.slate2 }}>Insurance</span>
                  <span style={{ fontSize: '12px', color: T.green, fontWeight: 700 }}>{insurance}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                  <span style={{ fontSize: '12px', color: T.slate2 }}>Status</span>
                  <span style={{ fontSize: '12px', color: T.blue, fontWeight: 700 }}>Pending review</span>
                </div>
              </div>

              <button
                type='button'
                onClick={() => router.push(successHref)}
                style={{ width: '100%', minHeight: '46px', borderRadius: '13px', border: 'none', background: `linear-gradient(135deg, ${T.green} 0%, #119B78 100%)`, color: '#fff', fontFamily: 'inherit', fontSize: '14px', fontWeight: 700, letterSpacing: '-0.015em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(15,158,119,0.24)' }}
              >
                Confirm Appointment
                <Ico p={ICONS.arrowFwd} size={14} sw={2.2} />
              </button>

              <Link href={backHref} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '10px', color: T.slate2, textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
                <Ico p={ICONS.arrowSm} size={13} sw={2} style={{ transform: 'rotate(180deg)' }} />
                Back to Review
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}

function ConfirmationPageFallback() {
  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '24px 20px 40px' }}>
        <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.float, padding: '24px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Preparing confirmation</p>
          <h1 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Loading your confirmation screen</h1>
          <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>We are preparing the final confirmation details for your booking.</p>
        </div>
      </div>
    </main>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<ConfirmationPageFallback />}>
      <ConfirmationPageContent />
    </Suspense>
  )
}

'use client'

import { useEffect, useState } from 'react'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalBadge, PortalButton, PortalCard, PortalSkeleton } from '@/components/patient/PatientPortalPrimitives'
import Ico from '@/components/ui/Ico'
import { ICONS } from '@/constants/icons'
import { T } from '@/lib/tokens'

const PAYMENT_METHODS = [
  { brand: 'Visa', label: 'Visa ending in 8421', meta: 'Expires 08/28', primary: true },
  { brand: 'Mastercard', label: 'Mastercard ending in 1183', meta: 'Expires 11/27', primary: false },
  { brand: 'Bank', label: 'Zenith Bank transfer profile', meta: 'Verified account', primary: false },
  { brand: 'Apple Pay', label: 'Apple Pay', meta: 'Placeholder', primary: false },
  { brand: 'Google Pay', label: 'Google Pay', meta: 'Placeholder', primary: false },
]

const INVOICES = [
  { id: 'INV-20418', appointment: 'Cardiology consultation', date: '05 Aug 2026', status: 'Paid', amount: '$140.00' },
  { id: 'INV-20411', appointment: 'Lab diagnostics panel', date: '29 Jul 2026', status: 'Pending', amount: '$86.00' },
  { id: 'INV-20372', appointment: 'Follow-up consultation', date: '21 Jul 2026', status: 'Refunded', amount: '$70.00' },
]

const PAYMENT_HISTORY = [
  { title: 'Paid', value: '$1,280', hint: '8 successful payments', tone: 'success' as const },
  { title: 'Pending', value: '$86', hint: '1 open invoice', tone: 'warning' as const },
  { title: 'Refunded', value: '$70', hint: '1 processed refund', tone: 'info' as const },
  { title: 'Cancelled', value: '$0', hint: 'No cancelled charges', tone: 'neutral' as const },
]

export default function PatientBillingPage() {
  const [loading, setLoading] = useState(true)
  const [paymentMessage, setPaymentMessage] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 550)
    return () => window.clearTimeout(timer)
  }, [])

  const rightRail = (
    <div className='grid gap-3'>
      <PortalCard>
        <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Outstanding Balance</p>
        <h2 style={{ margin: '0 0 10px', fontSize: '28px', fontWeight: 800, color: T.navy }}>$86.00</h2>
        <div className='grid gap-2'>
          {[
            ['Insurance Coverage', '$214.00'],
            ['Amount Due', '$86.00'],
            ['Next Auto Draft', '12 Aug 2026'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(4,53,77,0.03)', border: '1px solid rgba(4,53,77,0.06)' }}>
              <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
              <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </div>
        <div className='mt-3 grid gap-2'>
          <PortalButton tone='primary' fullWidth onClick={() => setPaymentMessage('Payment initiated successfully.')}>Pay Now</PortalButton>
          <PortalButton tone='secondary' fullWidth>Download Receipt</PortalButton>
        </div>
      </PortalCard>

      <PortalCard>
        <div className='flex items-center gap-2 mb-2'>
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(15,158,119,0.12)', display: 'grid', placeItems: 'center' }}>
            <Ico p={ICONS.shield} size={15} sw={1.7} color={T.green} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>Insurance Summary</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: T.slate }}>Claims are syncing smoothly with your payer profile.</p>
          </div>
        </div>
        <div className='grid gap-2'>
          <PortalBadge tone='success'>2 approved claims</PortalBadge>
          <PortalBadge tone='info'>1 prior authorization active</PortalBadge>
        </div>
      </PortalCard>
    </div>
  )

  return (
    <PatientPortalShell
      title='Billing & Payments'
      description='Track balances, payment methods, invoices, insurance coverage, and upcoming healthcare charges from one dedicated billing workspace.'
      rightRail={rightRail}
      headerActions={<PortalButton tone='secondary'>Download Receipt</PortalButton>}
    >
      {loading ? (
        <div className='grid gap-4'>
          <PortalSkeleton height={180} />
          <PortalSkeleton height={220} />
          <PortalSkeleton height={220} />
        </div>
      ) : (
        <div className='grid gap-4'>
          {paymentMessage ? <PortalBadge tone='success'>{paymentMessage}</PortalBadge> : null}

          <div className='grid gap-4 xl:grid-cols-3'>
            {[
              { label: 'Current Balance', value: '$300.00', hint: 'Across active invoices' },
              { label: 'Insurance Coverage', value: '$214.00', hint: 'Already applied' },
              { label: 'Amount Due', value: '$86.00', hint: 'Due in 6 days' },
            ].map((item) => (
              <PortalCard key={item.label}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                <h2 style={{ margin: '0 0 6px', fontSize: '28px', fontWeight: 800, color: T.navy }}>{item.value}</h2>
                <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}>{item.hint}</p>
              </PortalCard>
            ))}
          </div>

          <PortalCard>
            <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Payment Methods</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Cards, bank profiles, and digital wallets</h2>
              </div>
              <PortalButton tone='primary'>Add Card</PortalButton>
            </div>
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
              {PAYMENT_METHODS.map((method) => (
                <div key={method.label} className='rounded-2xl border p-4 transition hover:-translate-y-px' style={{ borderColor: method.primary ? 'rgba(32,181,223,0.18)' : 'rgba(4,53,77,0.08)', background: method.primary ? 'rgba(32,181,223,0.05)' : 'rgba(247,250,252,0.9)', boxShadow: method.primary ? '0 10px 26px rgba(32,181,223,0.08)' : 'none' }}>
                  <div className='flex flex-wrap items-start justify-between gap-2 mb-3'>
                    <div>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{method.label}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: T.slate }}>{method.meta}</p>
                    </div>
                    {method.primary ? <PortalBadge tone='info'>Primary</PortalBadge> : <PortalBadge tone='neutral'>{method.brand}</PortalBadge>}
                  </div>
                  <div className='flex gap-2 flex-wrap'>
                    <PortalButton tone='secondary'>Edit</PortalButton>
                    <PortalButton tone='secondary'>Remove</PortalButton>
                  </div>
                </div>
              ))}
            </div>
          </PortalCard>

          <div className='grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]'>
            <PortalCard>
              <div className='mb-4'>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Invoices</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Recent invoices and receipts</h2>
              </div>
              <div className='grid gap-3'>
                {INVOICES.map((invoice) => (
                  <div key={invoice.id} className='rounded-2xl border p-4' style={{ borderColor: 'rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.9)' }}>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                      <div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{invoice.id}</p>
                        <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: T.slate }}>{invoice.appointment}</p>
                        <p style={{ margin: '6px 0 0', fontSize: '12px', color: T.slate2 }}>{invoice.date}</p>
                      </div>
                      <div className='text-right'>
                        <PortalBadge tone={invoice.status === 'Paid' ? 'success' : invoice.status === 'Pending' ? 'warning' : 'info'}>{invoice.status}</PortalBadge>
                        <p style={{ margin: '8px 0 0', fontSize: '16px', fontWeight: 800, color: T.navy }}>{invoice.amount}</p>
                      </div>
                    </div>
                    <div className='mt-3'>
                      <PortalButton tone='secondary'>Download PDF</PortalButton>
                    </div>
                  </div>
                ))}
              </div>
            </PortalCard>

            <PortalCard>
              <div className='mb-4'>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Payment History</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Status at a glance</h2>
              </div>
              <div className='grid gap-3'>
                {PAYMENT_HISTORY.map((item) => (
                  <div key={item.title} style={{ padding: '14px', borderRadius: '16px', background: 'rgba(247,250,252,0.9)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div className='flex items-center justify-between gap-3 mb-2'>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                      <PortalBadge tone={item.tone}>{item.value}</PortalBadge>
                    </div>
                    <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}>{item.hint}</p>
                  </div>
                ))}
              </div>
            </PortalCard>
          </div>

          <div className='grid gap-4 xl:grid-cols-2'>
            <PortalCard>
              <div className='mb-4'>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Upcoming Charges</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Projected healthcare spend</h2>
              </div>
              <div className='grid gap-3'>
                {[
                  ['Next Consultation', '$140.00'],
                  ['Lab Tests', '$86.00'],
                  ['Medication', '$38.00'],
                  ['Insurance Copayment', '$24.00'],
                ].map(([label, amount]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.9)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <span style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{label}</span>
                    <span style={{ fontSize: '13px', color: T.navy, fontWeight: 800 }}>{amount}</span>
                  </div>
                ))}
              </div>
            </PortalCard>

            <PortalCard>
              <div className='mb-4'>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Insurance Summary</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Coverage, claims, and authorizations</h2>
              </div>
              <div className='grid gap-3 sm:grid-cols-2'>
                {[
                  ['Coverage', '82% active'],
                  ['Claims', '2 approved'],
                  ['Remaining Benefits', '$1,240'],
                  ['Authorizations', '1 active'],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{value}</p>
                  </div>
                ))}
              </div>
            </PortalCard>
          </div>
        </div>
      )}
    </PatientPortalShell>
  )
}
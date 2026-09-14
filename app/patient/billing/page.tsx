'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalBadge, PortalButton, PortalCard, PortalSkeleton } from '@/components/patient/PatientPortalPrimitives'
import Ico from '@/components/ui/Ico'
import { ICONS } from '@/constants/icons'
import { clearAuthTokens, getApiErrorDetail, getPatientBilling, isAuthError, type PatientBillingInvoice, type PatientBillingPaymentMethod, type PatientBillingResponse } from '@/lib/api'
import { T } from '@/lib/tokens'

const EMPTY_BILLING: PatientBillingResponse = {
  current_balance: 0,
  insurance_coverage: 0,
  amount_due: 0,
  currency: 'USD',
  payment_provider_enabled: false,
  payment_methods: [],
  invoices: [],
  payment_history: [
    { title: 'Paid', value: '$0', hint: 'No completed payments yet', tone: 'neutral' },
    { title: 'Pending', value: '$0', hint: 'No open invoices', tone: 'neutral' },
    { title: 'Refunded', value: '$0', hint: 'No processed refunds', tone: 'neutral' },
  ],
  upcoming_charges: [],
  insurance_summary: {
    status: 'not_added',
    claims: [],
    authorizations: [],
  },
}

function money(value: number | undefined, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value || 0))
}

function invoiceAmount(invoice: PatientBillingInvoice, currency: string) {
  if (typeof invoice.amount === 'string' && invoice.amount.trim()) return invoice.amount
  return money(0, currency)
}

function invoiceDate(invoice: PatientBillingInvoice) {
  if (!invoice.date) return 'Date unavailable'
  const date = new Date(invoice.date)
  return Number.isNaN(date.getTime()) ? invoice.date : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function cardBrandLabel(method: PatientBillingPaymentMethod) {
  if (method.label) return method.label
  if (method.brand && method.last4) return `${method.brand} ending in ${method.last4}`
  return method.brand || 'Payment method'
}

function cardMeta(method: PatientBillingPaymentMethod) {
  if (method.meta) return method.meta
  if (method.expiry_month || method.expiry_year) return `Expires ${[method.expiry_month, method.expiry_year].filter(Boolean).join('/')}`
  return 'Payment details secured by provider'
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div style={{ border: '1px dashed rgba(4,53,77,0.16)', borderRadius: '18px', padding: '22px', background: 'rgba(247,250,252,0.84)', textAlign: 'center' }}>
      <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 800, color: T.navy }}>{title}</p>
      <p style={{ margin: '0 auto', maxWidth: '460px', fontSize: '13px', lineHeight: 1.55, color: T.slate }}>{body}</p>
      {action ? <div className='mt-4'>{action}</div> : null}
    </div>
  )
}

function PaymentMethodCard({ method }: { method: PatientBillingPaymentMethod }) {
  const brand = method.brand || 'Card'
  const last4 = method.last4 || method.label?.match(/\d{4}$/)?.[0] || '----'

  return (
    <div className='rounded-2xl border p-4 transition hover:-translate-y-px' style={{ borderColor: method.primary ? 'rgba(32,181,223,0.24)' : 'rgba(4,53,77,0.08)', background: method.primary ? 'linear-gradient(135deg, rgba(32,181,223,0.12), rgba(52,140,234,0.08))' : 'rgba(247,250,252,0.9)', boxShadow: method.primary ? '0 10px 26px rgba(32,181,223,0.08)' : 'none' }}>
      <div style={{ minHeight: '126px', borderRadius: '16px', padding: '16px', background: 'linear-gradient(135deg, #04354D 0%, #0C6B86 58%, #20B5DF 100%)', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)' }}>
        <div className='flex items-center justify-between gap-3'>
          <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{brand}</span>
          {method.primary ? <span style={{ fontSize: '11px', fontWeight: 800, borderRadius: '999px', padding: '4px 8px', background: 'rgba(255,255,255,0.18)' }}>Primary</span> : null}
        </div>
        <div>
          <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800 }}>**** {last4}</p>
          <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.78)' }}>{cardMeta(method)}</p>
        </div>
      </div>
      <div className='mt-3'>
        <p style={{ margin: '0 0 3px', fontSize: '14px', fontWeight: 800, color: T.navy }}>{cardBrandLabel(method)}</p>
        <p style={{ margin: 0, fontSize: '12.5px', color: T.slate }}>{cardMeta(method)}</p>
      </div>
    </div>
  )
}

export default function PatientBillingPage() {
  const [loading, setLoading] = useState(true)
  const [billing, setBilling] = useState<PatientBillingResponse>(EMPTY_BILLING)
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadBilling() {
      setLoading(true)
      setErrorMessage('')
      try {
        const data = await getPatientBilling()
        if (mounted) setBilling({ ...EMPTY_BILLING, ...data })
      } catch (error) {
        if (isAuthError(error)) {
          clearAuthTokens()
          window.location.href = '/auth/sign-in'
          return
        }
        if (mounted) setErrorMessage(getApiErrorDetail(error) || 'Billing is temporarily unavailable.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadBilling()
    return () => {
      mounted = false
    }
  }, [])

  const currency = billing.currency || 'USD'
  const paidInvoices = useMemo(() => billing.invoices.filter((invoice) => invoice.status?.toLowerCase() === 'paid'), [billing.invoices])
  const paymentProviderEnabled = Boolean(billing.payment_provider_enabled)
  const hasPaymentMethods = billing.payment_methods.length > 0
  const hasInvoices = billing.invoices.length > 0
  const insurance = billing.insurance_summary || EMPTY_BILLING.insurance_summary
  const insuranceStatus = insurance.status === 'active'
    ? 'Active'
    : insurance.status === 'incomplete'
      ? 'Incomplete'
      : 'Not added'

  const showNotice = (title: string, body: string) => setNotice({ title, body })

  function handleReceiptDownload() {
    const invoice = paidInvoices.find((item) => item.receipt_url || item.pdf_url)
    if (!invoice) {
      showNotice('No receipt available', 'A downloadable receipt will appear after a real paid invoice is created for this account.')
      return
    }
    window.open(invoice.receipt_url || invoice.pdf_url || '', '_blank', 'noopener,noreferrer')
  }

  function handlePayNow() {
    if (billing.amount_due <= 0) {
      showNotice('Nothing to pay', 'This account has no outstanding balance right now, so no payment is required.')
      return
    }
    if (!paymentProviderEnabled) {
      showNotice('Payment unavailable', 'Online payment processing is not connected yet. Once a payment provider is configured, this button can open the real checkout flow.')
      return
    }
  }

  const rightRail = (
    <div className='grid gap-3'>
      <PortalCard>
        <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Outstanding Balance</p>
        <h2 style={{ margin: '0 0 10px', fontSize: '28px', fontWeight: 800, color: T.navy }}>{money(billing.amount_due, currency)}</h2>
        <div className='grid gap-2'>
          {[
            ['Insurance Coverage', money(billing.insurance_coverage, currency)],
            ['Amount Due', money(billing.amount_due, currency)],
            ['Payment Methods', String(billing.payment_methods.length)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(4,53,77,0.03)', border: '1px solid rgba(4,53,77,0.06)' }}>
              <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
              <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </div>
        <div className='mt-3 grid gap-2'>
          <PortalButton tone='primary' fullWidth onClick={handlePayNow}>Pay Now</PortalButton>
          <PortalButton tone='secondary' fullWidth onClick={handleReceiptDownload}>Download Receipt</PortalButton>
        </div>
      </PortalCard>

      <PortalCard>
        <div className='flex items-center gap-2 mb-2'>
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(15,158,119,0.12)', display: 'grid', placeItems: 'center' }}>
            <Ico p={ICONS.shield} size={15} sw={1.7} color={T.green} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>Insurance Summary</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: T.slate }}>{insurance.provider_name || 'No insurance provider connected'}</p>
          </div>
        </div>
        <div className='grid gap-2'>
          <PortalBadge tone={insurance.status === 'active' ? 'success' : insurance.status === 'incomplete' ? 'warning' : 'neutral'}>{insuranceStatus}</PortalBadge>
          {insurance.member_number ? <PortalBadge tone='info'>Member record on file</PortalBadge> : null}
        </div>
      </PortalCard>
    </div>
  )

  return (
    <PatientPortalShell
      title='Billing & Payments'
      description='Track balances, payment methods, invoices, insurance coverage, and upcoming healthcare charges from one dedicated billing workspace.'
      rightRail={rightRail}
    >
      {loading ? (
        <div className='grid gap-4'>
          <PortalSkeleton height={180} />
          <PortalSkeleton height={220} />
          <PortalSkeleton height={220} />
        </div>
      ) : (
        <div className='grid gap-4'>
          {errorMessage ? <PortalBadge tone='danger'>{errorMessage}</PortalBadge> : null}

          <div className='grid gap-4 xl:grid-cols-3'>
            {[
              { label: 'Current Balance', value: money(billing.current_balance, currency), hint: hasInvoices ? 'Across active invoices' : 'No active invoices' },
              { label: 'Insurance Coverage', value: money(billing.insurance_coverage, currency), hint: insurance.provider_name || 'No payer coverage applied' },
              { label: 'Amount Due', value: money(billing.amount_due, currency), hint: billing.amount_due > 0 ? 'Payment required' : 'Nothing due right now' },
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
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Saved cards and payment profiles</h2>
              </div>
              <PortalButton
                tone='primary'
                onClick={() => showNotice(
                  paymentProviderEnabled ? 'Add card unavailable' : 'Payment provider not connected',
                  paymentProviderEnabled
                    ? 'The payment provider is available, but the add-card flow has not been enabled for this build yet.'
                    : 'Saved cards require a real payment provider such as Stripe or Paystack. Until that is connected, Qarevo will not collect or store card details.'
                )}
              >
                Add Card
              </PortalButton>
            </div>
            {hasPaymentMethods ? (
              <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                {billing.payment_methods.map((method, index) => (
                  <PaymentMethodCard key={method.id || `${method.brand || 'method'}-${method.last4 || index}`} method={method} />
                ))}
              </div>
            ) : (
              <EmptyState
                title='No payment methods saved'
                body='New patients will see this empty state until a real payment provider creates a saved card, bank profile, or wallet token.'
              />
            )}
          </PortalCard>

          <div className='grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]'>
            <PortalCard>
              <div className='mb-4'>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Invoices</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Recent invoices and receipts</h2>
              </div>
              {hasInvoices ? (
                <div className='grid gap-3'>
                  {billing.invoices.map((invoice) => (
                    <div key={invoice.id} className='rounded-2xl border p-4' style={{ borderColor: 'rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.9)' }}>
                      <div className='flex flex-wrap items-start justify-between gap-3'>
                        <div>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{invoice.id}</p>
                          <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: T.slate }}>{invoice.appointment || 'Healthcare invoice'}</p>
                          <p style={{ margin: '6px 0 0', fontSize: '12px', color: T.slate2 }}>{invoiceDate(invoice)}</p>
                        </div>
                        <div className='text-right'>
                          <PortalBadge tone={invoice.status === 'Paid' ? 'success' : invoice.status === 'Pending' ? 'warning' : invoice.status === 'Refunded' ? 'info' : 'neutral'}>{invoice.status || 'Open'}</PortalBadge>
                          <p style={{ margin: '8px 0 0', fontSize: '16px', fontWeight: 800, color: T.navy }}>{invoiceAmount(invoice, currency)}</p>
                        </div>
                      </div>
                      <div className='mt-3'>
                        <PortalButton
                          tone='secondary'
                          onClick={() => invoice.pdf_url || invoice.receipt_url ? window.open(invoice.pdf_url || invoice.receipt_url || '', '_blank', 'noopener,noreferrer') : showNotice('PDF unavailable', 'This invoice does not have a downloadable PDF yet.')}
                        >
                          Download PDF
                        </PortalButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title='No invoices yet'
                  body='Invoices will appear here after appointments, lab requests, or payment provider events create real billing records.'
                />
              )}
            </PortalCard>

            <PortalCard>
              <div className='mb-4'>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Payment History</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Status at a glance</h2>
              </div>
              <div className='grid gap-3'>
                {billing.payment_history.map((item) => (
                  <div key={item.title} style={{ padding: '14px', borderRadius: '16px', background: 'rgba(247,250,252,0.9)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div className='flex items-center justify-between gap-3 mb-2'>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                      <PortalBadge tone={item.tone || 'neutral'}>{item.value}</PortalBadge>
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
              {billing.upcoming_charges.length ? (
                <div className='grid gap-3'>
                  {billing.upcoming_charges.map((charge, index) => (
                    <div key={`${charge.label || 'charge'}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.9)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <span style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{charge.label || 'Upcoming charge'}</span>
                      <span style={{ fontSize: '13px', color: T.navy, fontWeight: 800 }}>{typeof charge.amount === 'number' ? money(charge.amount, currency) : charge.amount || money(0, currency)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title='No upcoming charges' body='Projected spend will show after real scheduled appointments, lab orders, or medication billing events exist.' />
              )}
            </PortalCard>

            <PortalCard>
              <div className='mb-4'>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Insurance Summary</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Coverage, claims, and authorizations</h2>
              </div>
              <div className='grid gap-3 sm:grid-cols-2'>
                {[
                  ['Coverage status', insuranceStatus],
                  ['Provider', insurance.provider_name || 'Not added'],
                  ['Claims', String(insurance.claims?.length || 0)],
                  ['Authorizations', String(insurance.authorizations?.length || 0)],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{value}</p>
                  </div>
                ))}
              </div>
              {insurance.status === 'not_added' ? (
                <div className='mt-4'>
                  <Link href='/patient/settings' style={{ color: T.blue, fontSize: '13px', fontWeight: 800, textDecoration: 'none' }}>Add insurance in settings -&gt;</Link>
                </div>
              ) : null}
            </PortalCard>
          </div>
        </div>
      )}
      {notice ? (
        <BillingNoticeDialog
          title={notice.title}
          body={notice.body}
          onClose={() => setNotice(null)}
        />
      ) : null}
    </PatientPortalShell>
  )
}

function BillingNoticeDialog({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <div
      role='presentation'
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        background: 'rgba(4, 53, 77, 0.34)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='billing-notice-title'
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(100%, 420px)',
          borderRadius: '18px',
          border: '1px solid rgba(255,255,255,0.9)',
          background: '#fff',
          boxShadow: '0 24px 70px rgba(4,53,77,0.24)',
          padding: '20px',
        }}
      >
        <div className='mb-4 flex items-start justify-between gap-3'>
          <div>
            <h2 id='billing-notice-title' style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800, color: T.navy }}>{title}</h2>
            <p style={{ margin: 0, color: T.slate, fontSize: '13px', lineHeight: 1.55 }}>{body}</p>
          </div>
          <button
            type='button'
            aria-label='Close billing notice'
            onClick={onClose}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              border: '1px solid rgba(4,53,77,0.1)',
              background: 'rgba(247,250,252,0.92)',
              color: T.navy,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              flex: '0 0 auto',
            }}
          >
            <Ico p={ICONS.x} size={18} sw={1.8} />
          </button>
        </div>
        <PortalButton tone='primary' fullWidth onClick={onClose}>Got it</PortalButton>
      </div>
    </div>
  )
}

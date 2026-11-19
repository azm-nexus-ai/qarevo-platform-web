'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalBadge, PortalButton, PortalCard, PortalSkeleton } from '@/components/patient/PatientPortalPrimitives'
import Ico from '@/components/ui/Ico'
import { ICONS } from '@/constants/icons'
import { clearPortalSession, getApiErrorDetail, getPatientBilling, isAuthError, type PatientBillingInvoice, type PatientBillingPaymentMethod, type PatientBillingReadiness, type PatientBillingResponse } from '@/lib/api'
import { T } from '@/lib/tokens'
import { insurancePresentation } from '@/lib/insurance-presentation'

const EMPTY_BILLING: PatientBillingResponse = {
  status: 'not_configured',
  current_balance: null,
  insurance_coverage: null,
  amount_due: null,
  currency: 'EUR',
  payment_provider_enabled: false,
  payment_methods: [],
  invoices: [],
  payment_history: [],
  upcoming_charges: [],
  insurance_summary: {
    status: 'not_added',
    claims: [],
    authorizations: [],
  },
}

function money(value: number | null | undefined, currency = 'EUR') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not available'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
}

function invoiceAmount(invoice: PatientBillingInvoice, currency: string) {
  if (typeof invoice.amount === 'string' && invoice.amount.trim()) return invoice.amount
  return money(null, currency)
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
    <div style={{ border: "1px dashed var(--border)", borderRadius: '18px', padding: '22px', background: "var(--surface-subtle)", textAlign: 'center' }}>
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
    <div className='rounded-2xl border p-4 transition hover:-translate-y-px' style={{ borderColor: method.primary ? 'rgba(32,181,223,0.24)' : "var(--border)", background: method.primary ? 'linear-gradient(135deg, rgba(32,181,223,0.12), rgba(52,140,234,0.08))' : "var(--surface-subtle)", boxShadow: method.primary ? '0 10px 26px rgba(32,181,223,0.08)' : 'none' }}>
      <div style={{ minHeight: '126px', borderRadius: '16px', padding: '16px', background: 'linear-gradient(135deg, #04354D 0%, #0C6B86 58%, #20B5DF 100%)', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)' }}>
        <div className='flex items-center justify-between gap-3'>
          <span style={{ fontSize: "13px", fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{brand}</span>
          {method.primary ? <span style={{ fontSize: "13px", fontWeight: 800, borderRadius: '999px', padding: '4px 8px', background: 'rgba(255,255,255,0.18)' }}>Primary</span> : null}
        </div>
        <div>
          <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800 }}>**** {last4}</p>
          <p style={{ margin: 0, fontSize: "13px", color: 'rgba(255,255,255,0.78)' }}>{cardMeta(method)}</p>
        </div>
      </div>
      <div className='mt-3'>
        <p style={{ margin: '0 0 3px', fontSize: '14px', fontWeight: 800, color: T.navy }}>{cardBrandLabel(method)}</p>
        <p style={{ margin: 0, fontSize: "13px", color: T.slate }}>{cardMeta(method)}</p>
      </div>
    </div>
  )
}

function BillingReadinessDetails({ readiness }: { readiness?: PatientBillingReadiness }) {
  if (!readiness) return null
  return (
    <>
      <PortalCard>
        <h2 className='mb-2 text-xl font-semibold' style={{ color: T.navy }}>Payment method availability</h2>
        <p className='mb-4 max-w-2xl text-sm leading-6' style={{ color: T.slate }}>These methods are being evaluated. None is currently available for payment.</p>
        <ul aria-label='Requested payment methods' className='grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3'>
          {readiness.requested_methods.map(method => (
            <li key={method.method} className='flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border p-3' style={{ borderColor: 'var(--border)', background: 'var(--surface-subtle)' }}>
              <span className='text-sm font-semibold' style={{ color: T.navy }}>{method.label}</span>
              <PortalBadge tone='neutral'>Not available</PortalBadge>
            </li>
          ))}
        </ul>
      </PortalCard>
      <PortalCard>
        <h2 className='mb-3 text-xl font-semibold' style={{ color: T.navy }}>Invoices and funding</h2>
        <dl className='mb-4 grid gap-3 sm:grid-cols-2'>
          {[
            ['Medical invoices', readiness.medical_invoicing.message],
            ['Online payments', readiness.patient_payments.message],
          ].map(([label, message]) => (
            <div key={label} className='rounded-xl border p-3' style={{ borderColor: 'var(--border)' }}>
              <dt className='mb-2 text-sm font-semibold' style={{ color: T.navy }}>{label}</dt>
              <dd className='m-0 text-sm leading-6' style={{ color: T.slate }}>{message}</dd>
            </div>
          ))}
        </dl>
        <div className='space-y-3 text-sm leading-6' style={{ color: T.slate }}>
          <p>Your treating practice is responsible for any medical invoice. Qarevo’s practice usage fees are handled separately.</p>
          <p>Covered GKV consultations do not use patient checkout. Coverage must still be confirmed for the individual consultation; entering insurance details does not verify it.</p>
          <p>Selecting self-pay does not authorize a charge. A separate, explicit cost agreement is required.</p>
        </div>
      </PortalCard>
    </>
  )
}

export default function PatientBillingPage() {
  const [loading, setLoading] = useState(true)
  const [billing, setBilling] = useState<PatientBillingResponse>(EMPTY_BILLING)
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [reload, setReload] = useState(0)

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
          clearPortalSession()
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
  }, [reload])

  const currency = billing.currency || 'EUR'
  const paidInvoices = useMemo(() => billing.invoices.filter((invoice) => invoice.status?.toLowerCase() === 'paid'), [billing.invoices])
  const hasPaymentMethods = billing.payment_methods.length > 0
  const hasInvoices = billing.invoices.length > 0
  const insurance = billing.insurance_summary || EMPTY_BILLING.insurance_summary
  const insuranceInfo = insurancePresentation({insurance_type:insurance.insurance_type,insurance_provider_name:insurance.provider_name,insurance_number:insurance.member_number})
  const insuranceStatus = insuranceInfo.verificationLabel

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
    // Provider flags or legacy authorization records cannot enable an operation
    // that this build does not implement. Never infer payment from a UI action.
    showNotice('Online checkout unavailable', 'Online checkout is not available. No payment was attempted.')
  }

  const rightRail = (
    <div className='grid gap-3'>
      <PortalCard>
        <p style={{ margin: '0 0 6px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Outstanding Balance</p>
        <h2 style={{ margin: '0 0 10px', fontSize: '28px', fontWeight: 800, color: T.navy }}>{money(billing.amount_due, currency)}</h2>
        <div className='grid gap-2'>
          {[
            ['Insurance Coverage', money(billing.insurance_coverage, currency)],
            ['Amount Due', money(billing.amount_due, currency)],
            ['Payment Methods', String(billing.payment_methods.length)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: "var(--surface-hover)", border: "1px solid var(--border)" }}>
              <span style={{ fontSize: "13px", color: T.slate2 }}>{label}</span>
              <span style={{ fontSize: "13px", color: T.navy, fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </div>
        <div className='mt-3 grid gap-2'>
          <PortalButton tone='primary' fullWidth disabled aria-describedby='billing-checkout-unavailable' onClick={handlePayNow}>Pay Now</PortalButton>
          <p id='billing-checkout-unavailable' className='m-0 text-sm leading-6' style={{ color: T.slate }}>Online checkout is not available. No payment can be attempted.</p>
          <PortalButton tone='secondary' fullWidth onClick={handleReceiptDownload}>Download Receipt</PortalButton>
        </div>
      </PortalCard>

      <PortalCard>
        <div className='flex items-center gap-2 mb-2'>
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'var(--primary-soft)', display: 'grid', placeItems: 'center' }}>
            <Ico p={ICONS.shield} size={15} sw={1.7} color={T.link} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>Insurance Summary</p>
            <p style={{ margin: '2px 0 0', fontSize: "13px", color: T.slate }}>{insurance.provider_name || 'No insurer recorded'}</p>
          </div>
        </div>
        <div className='grid gap-2'>
          <PortalBadge tone={insuranceInfo.tone}>{insuranceStatus}</PortalBadge>
          {insurance.member_number ? <PortalBadge tone='info'>Member record on file</PortalBadge> : null}
        </div>
      </PortalCard>
    </div>
  )

  return (
    <PatientPortalShell
      title='Billing & Payments'
      description='Track balances, payment methods, invoices, insurance coverage, and upcoming healthcare charges from one dedicated billing workspace.'
      rightRail={!loading && !errorMessage && billing.status === 'ready' ? rightRail : undefined}
    >
      {loading ? (
        <div className='grid gap-4'>
          <PortalSkeleton height={180} />
          <PortalSkeleton height={220} />
          <PortalSkeleton height={220} />
        </div>
      ) : errorMessage ? (
        <PortalCard>
          <p role='alert' aria-label='Billing error' className='mb-4'>{errorMessage}</p>
          <PortalButton tone='secondary' onClick={() => setReload(value => value + 1)}>Retry billing</PortalButton>
        </PortalCard>
      ) : billing.status !== 'ready' ? (
        <div className='grid gap-5'>
          <PortalCard>
            <div role='status' aria-label='Billing availability'>
              <PortalBadge tone='neutral'>Not available yet</PortalBadge>
              <h2 className='mt-4 mb-2 text-xl font-semibold' style={{ color: T.navy }}>Payments &amp; invoices</h2>
              <p className='max-w-2xl text-sm leading-6' style={{ color: T.slate }}>Payments and automated invoices are not available yet. Consultation fees and funding terms must be confirmed before a paid booking.</p>
              <p className='mt-3 text-sm leading-6' style={{ color: T.slate }}>A balance and any confirmed insurance contribution will appear when billing becomes available.</p>
            </div>
          </PortalCard>
          <BillingReadinessDetails readiness={billing.readiness} />
          <PortalCard>
            <h2 className='mb-2 text-xl font-semibold' style={{ color: T.navy }}>Your insurance details</h2>
            <PortalBadge tone={insuranceInfo.tone}>{insuranceStatus}</PortalBadge>
            <p className='mt-3 text-sm leading-6' style={{ color: T.slate }}>{insurance.provider_name || 'No insurer has been added.'}</p>
            <p className='mt-2 mb-4 max-w-2xl text-sm leading-6' style={{ color: T.slate }}>{insuranceInfo.notice}</p>
            <Link href='/patient/settings' className='inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold' style={{ color: T.link, border: '1px solid var(--border)', background: 'var(--surface-subtle)' }}>Review insurance details</Link>
          </PortalCard>
        </div>
      ) : (
        <div className='grid gap-4'>
          {errorMessage ? <PortalBadge tone='danger'>{errorMessage}</PortalBadge> : null}

          <div className='grid gap-4 xl:grid-cols-3'>
            {[
              { label: 'Current Balance', value: money(billing.current_balance, currency), hint: hasInvoices ? 'Across active invoices' : 'No active invoices' },
              { label: 'Insurance Coverage', value: money(billing.insurance_coverage, currency), hint: insurance.provider_name || 'No payer coverage applied' },
              { label: 'Amount Due', value: money(billing.amount_due, currency), hint: billing.amount_due === null ? 'Balance unavailable' : billing.amount_due > 0 ? 'Payment required' : 'Nothing due right now' },
            ].map((item) => (
              <PortalCard key={item.label}>
                <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                <h2 style={{ margin: '0 0 6px', fontSize: '28px', fontWeight: 800, color: T.navy }}>{item.value}</h2>
                <p style={{ margin: 0, fontSize: "13px", color: T.slate }}>{item.hint}</p>
              </PortalCard>
            ))}
          </div>

          <PortalCard>
            <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Payment Methods</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Saved cards and payment profiles</h2>
              </div>
              <PortalButton
                tone='primary'
                disabled
                aria-describedby='billing-saved-methods-unavailable'
              >
                Add Card
              </PortalButton>
            </div>
            <p id='billing-saved-methods-unavailable' className='mb-4 text-sm leading-6' style={{ color: T.slate }}>Saving payment methods is not available. No card details are collected on this page.</p>
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
                <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Invoices</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Recent invoices and receipts</h2>
              </div>
              {hasInvoices ? (
                <div className='grid gap-3'>
                  {billing.invoices.map((invoice) => (
                    <div key={invoice.id} className='rounded-2xl border p-4' style={{ borderColor: "var(--border)", background: "var(--surface-subtle)" }}>
                      <div className='flex flex-wrap items-start justify-between gap-3'>
                        <div>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{invoice.id}</p>
                          <p style={{ margin: '4px 0 0', fontSize: "13px", color: T.slate }}>{invoice.appointment || 'Healthcare invoice'}</p>
                          <p style={{ margin: '6px 0 0', fontSize: "13px", color: T.slate2 }}>{invoiceDate(invoice)}</p>
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
                <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Payment History</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Status at a glance</h2>
              </div>
              <div className='grid gap-3'>
                {billing.payment_history.map((item) => (
                  <div key={item.title} style={{ padding: '14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                    <div className='flex items-center justify-between gap-3 mb-2'>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                      <PortalBadge tone={item.tone || 'neutral'}>{item.value}</PortalBadge>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: T.slate }}>{item.hint}</p>
                  </div>
                ))}
              </div>
            </PortalCard>
          </div>

          <div className='grid gap-4 xl:grid-cols-2'>
            <PortalCard>
              <div className='mb-4'>
                <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Upcoming Charges</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Projected healthcare spend</h2>
              </div>
              {billing.upcoming_charges.length ? (
                <div className='grid gap-3'>
                  {billing.upcoming_charges.map((charge, index) => (
                    <div key={`${charge.label || 'charge'}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{charge.label || 'Upcoming charge'}</span>
                      <span style={{ fontSize: '13px', color: T.navy, fontWeight: 800 }}>{typeof charge.amount === 'number' ? money(charge.amount, currency) : charge.amount || money(null, currency)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title='No upcoming charges' body='Projected spend will show after real scheduled appointments, lab orders, or medication billing events exist.' />
              )}
            </PortalCard>

            <PortalCard>
              <div className='mb-4'>
                <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Insurance Summary</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Coverage, claims, and authorizations</h2>
              </div>
              <div className='grid gap-3 sm:grid-cols-2'>
                {[
                  ['Coverage status', insuranceStatus],
                  ['Provider', insurance.provider_name || 'Not added'],
                  ['Claims', String(insurance.claims?.length || 0)],
                  ['Authorizations', String(insurance.authorizations?.length || 0)],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                    <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{value}</p>
                  </div>
                ))}
              </div>
              {insurance.status === 'not_added' ? (
                <div className='mt-4'>
                  <Link href='/patient/settings' style={{ color: T.link, fontSize: '13px', fontWeight: 800, textDecoration: 'none' }}>Add insurance in settings -&gt;</Link>
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
        background: "var(--surface-hover)",
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
          border: "1px solid var(--border)",
          background: "var(--surface)",
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
              border: "1px solid var(--border)",
              background: "var(--surface-subtle)",
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

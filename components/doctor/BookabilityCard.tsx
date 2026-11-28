'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { apiGet } from '@/lib/api'

type Coverage = 'GKV' | 'PKV' | 'SELF_PAY'
type Bookability = { approved: boolean; verification_required: boolean; bookable: Record<Coverage, boolean>; next_step: 'AWAIT_APPROVAL' | 'JOIN_OR_VERIFY_PRACTICE' | 'STATUTORY_ELIGIBILITY' | null }

function valid(value: unknown): value is Bookability {
  const row = value as Bookability | null
  return !!row && typeof row.approved === 'boolean' && !!row.bookable && (['GKV', 'PKV', 'SELF_PAY'] as const).every(key => typeof row.bookable[key] === 'boolean')
}

/** Whether patients can find and book this doctor, per coverage, and what to do next.
 *  Hidden when the API does not offer the check (older deployments). */
export default function BookabilityCard() {
  const t = useTranslations('doctorBookability')
  const [data, setData] = useState<Bookability | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    apiGet<unknown>('/api/v1/doctor/bookability', undefined, controller.signal)
      .then(value => { if (valid(value)) setData(value); else setFailed(true) })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [])
  if (failed || !data) return null
  const all = Object.values(data.bookable).every(Boolean)
  return <section aria-labelledby='bookability-title' style={{ border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--surface)', padding: '18px', display: 'grid', gap: '12px' }}>
    <h2 id='bookability-title' className='portal-h2' style={{ margin: 0 }}>{t('title')}</h2>
    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.55 }}>{all ? t('allBookable') : t('notAll')}</p>
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {(['GKV', 'PKV', 'SELF_PAY'] as const).map(coverage => <li key={coverage} style={{ padding: '6px 12px', borderRadius: '999px', border: '1px solid var(--border)', background: data.bookable[coverage] ? 'var(--success-soft)' : 'var(--surface-subtle)', color: 'var(--text)', fontSize: '13px', fontWeight: 700 }}>
        {data.bookable[coverage] ? '✓' : '✕'} {t(`coverage${coverage === 'SELF_PAY' ? 'SelfPay' : coverage === 'GKV' ? 'Gkv' : 'Pkv'}`)}
        <span className='sr-only'>{data.bookable[coverage] ? t('srBookable') : t('srNotBookable')}</span>
      </li>)}
    </ul>
    {data.next_step === 'AWAIT_APPROVAL' && <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>{t('awaitApproval')}</p>}
    {data.next_step === 'JOIN_OR_VERIFY_PRACTICE' && <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>{t('joinOrVerify')}{' '}
      <Link href='/doctor/practices' style={{ color: 'var(--link)', fontWeight: 700 }}>{t('practices')}</Link>{' · '}
      <Link href='/doctor/independent-practice' style={{ color: 'var(--link)', fontWeight: 700 }}>{t('independent')}</Link></p>}
    {data.next_step === 'STATUTORY_ELIGIBILITY' && <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>{t('statutory')}</p>}
  </section>
}

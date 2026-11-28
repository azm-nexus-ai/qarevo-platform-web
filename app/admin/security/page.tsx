'use client'
import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import TwoFactorSettings from '@/components/admin/TwoFactorSettings'

const subscribe = (update: () => void) => { window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update) }
const requested = () => new URLSearchParams(window.location.search).get('setup') === 'required'

export default function AdminSecurityPage() {
  const t = useTranslations('adminSecurity')
  const setupRequested = useSyncExternalStore(subscribe, requested, () => false)
  return <main style={{ display: 'grid', gap: 24, minWidth: 0, color: 'var(--text)' }}>
    <header style={{ minWidth: 0 }}>
      <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 1.85rem)', margin: 0, overflowWrap: 'anywhere' }}>{t('pageTitle')}</h1>
      <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t('pageIntro')}</p>
    </header>
    <TwoFactorSettings setupRequested={setupRequested} />
  </main>
}

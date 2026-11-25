import { useTranslations } from 'next-intl'
import type { Metadata } from 'next'
import FeatureAvailability from '@/components/ui/FeatureAvailability'

export const metadata: Metadata = { title: 'Impressum — development', robots: { index: false, follow: false } }

export default function ImpressumPage() {
  const t = useTranslations('legalPages')
  return <main style={{ minHeight: '70vh', padding: 'clamp(24px, 6vw, 64px)', background: 'var(--canvas)' }}>
    <FeatureAvailability title={t('impressumAwaitingApproval')} description={t('thisDevelopmentPreviewIsNot')} actions={[{ href: '/privacy', label: t('privacyInformation') }, { href: '/', label: t('returnHome') }]} />
  </main>
}

import { useTranslations } from 'next-intl'
import type { Metadata } from 'next'
import FeatureAvailability from '@/components/ui/FeatureAvailability'
import { PAGE_BG } from '@/lib/tokens'

import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pageTitles')
  return { title: t('cookies'), robots: { index: false, follow: false } }
}

export default function CookiesPage() {
  const t = useTranslations('legalPages')
  return <main style={{ minHeight: '100vh', background: PAGE_BG, padding: 'clamp(24px, 6vw, 64px)' }}>
    <FeatureAvailability title={t('cookieInformationIsUnderReview')} description={t('developmentEnvironmentSyntheticTestData3')} actions={[
      { href: '/privacy', label: t('privacyInformation') }, { href: '/', label: t('returnToHome') },
    ]} />
  </main>
}

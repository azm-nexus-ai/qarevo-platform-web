import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { getTranslations } from 'next-intl/server'

const LandingPage = dynamic(() => import('@/components/marketing/LandingPage'))

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pageTitles')
  return { title: t('home'), description: t('description') }
}

export default function Page() {
  return <LandingPage />
}

import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

const LandingPage = dynamic(() => import('@/components/marketing/LandingPage'))

export const metadata: Metadata = {
  title: 'Qarevo Health — European Healthcare Platform',
  description: 'Discover verified physicians, orchestrate continuous care, and experience the highest standard of clinical intelligence and data governance.',
}

export default function Page() {
  return <LandingPage />
}

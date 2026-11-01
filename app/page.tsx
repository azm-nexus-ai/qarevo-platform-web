import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

const LandingPage = dynamic(() => import('@/components/marketing/LandingPage'))

export const metadata: Metadata = {
  title: 'Qarevo Health — European Healthcare Platform',
  description: 'Qarevo Health connects patients and independent practices through a clinician-led digital care journey. Development preview.',
}

export default function Page() {
  return <LandingPage />
}

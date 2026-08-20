import type { Metadata } from 'next'
import WhitepaperPage from '@/components/marketing/WhitepaperPage'

export const metadata: Metadata = {
  title: 'Clinical AI Whitepaper — Qarevo Health',
  description: 'Explore Qarevo Health\'s clinical intelligence architecture, security model, GDPR compliance, AI safety framework, and infrastructure design.',
}

export default function Page() {
  return <WhitepaperPage />
}

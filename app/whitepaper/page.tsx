import type { Metadata } from 'next'
import FeatureAvailability from '@/components/ui/FeatureAvailability'
import { PAGE_BG } from '@/lib/tokens'

export const metadata: Metadata = { title: 'Technical overview — under review', robots: { index: false, follow: false } }

export default function Page() {
  return <main style={{ minHeight: '100vh', background: PAGE_BG, padding: 'clamp(24px, 6vw, 64px)' }}>
    <FeatureAvailability title="Our technical overview is being updated" description="The earlier whitepaper described capabilities and certifications that have not been verified for the current platform. An updated overview will reflect tested functionality and documented evidence. This development environment is for synthetic testing." actions={[
      { href: '/privacy', label: 'Privacy information' }, { href: '/', label: 'Return to Home' },
    ]} />
  </main>
}

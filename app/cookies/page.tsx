import type { Metadata } from 'next'
import FeatureAvailability from '@/components/ui/FeatureAvailability'
import { PAGE_BG } from '@/lib/tokens'

export const metadata: Metadata = { title: 'Cookie information — development', robots: { index: false, follow: false } }

export default function CookiesPage() {
  return <main style={{ minHeight: '100vh', background: PAGE_BG, padding: 'clamp(24px, 6vw, 64px)' }}>
    <FeatureAvailability title="Cookie information is under review" description="Development environment — synthetic test data only. The supplied cookie text remains a draft. The storage inventory, provider details and any required consent controls must be checked against the implementation before an approved policy is published. Display preferences are currently remembered in your browser." actions={[
      { href: '/privacy', label: 'Privacy information' }, { href: '/', label: 'Return to Home' },
    ]} />
  </main>
}

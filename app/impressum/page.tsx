import type { Metadata } from 'next'
import FeatureAvailability from '@/components/ui/FeatureAvailability'

export const metadata: Metadata = { title: 'Impressum — development', robots: { index: false, follow: false } }

export default function ImpressumPage() {
  return <main style={{ minHeight: '70vh', padding: 'clamp(24px, 6vw, 64px)', background: 'var(--canvas)' }}>
    <FeatureAvailability title='Impressum awaiting approval' description='This development preview is not open for real-patient care. The company, representative, register and contact details in the supplied legal drafts must be confirmed and approved before the legal notice is published.' actions={[{ href: '/privacy', label: 'Privacy information' }, { href: '/', label: 'Return home' }]} />
  </main>
}

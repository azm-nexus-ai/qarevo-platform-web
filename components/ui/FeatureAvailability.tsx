import Link from 'next/link'
import { T, Sh } from '@/lib/tokens'

type Props = {
  title: string
  description: string
  actions: { href: string; label: string }[]
}

/** Honest, accessible availability state shared by patient and clinician flows. */
export default function FeatureAvailability({ title, description, actions }: Props) {
  return (
    <section aria-labelledby="feature-availability-title" style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: 'clamp(24px, 5vw, 48px)', border: '1px solid var(--border)', borderRadius: 24, background: 'var(--surface)', boxShadow: Sh.card }}>
      <span style={{ display: 'inline-block', marginBottom: 16, padding: '6px 12px', borderRadius: 99, background: 'var(--surface-subtle)', color: T.slate, fontSize: 13, fontWeight: 700 }}>Development preview</span>
      <h1 id="feature-availability-title" style={{ margin: '0 0 16px', color: T.navy, fontSize: 'clamp(24px, 4vw, 34px)', lineHeight: 1.2, letterSpacing: '-0.03em' }}>{title}</h1>
      <p style={{ margin: '0 0 28px', color: T.slate, fontSize: 16, lineHeight: 1.7 }}>{description}</p>
      <nav aria-label="Available next steps" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {actions.map(({ href, label }) => <Link key={href} href={href} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '10px 18px', border: '1px solid var(--border)', borderRadius: 12, color: T.link, fontSize: 15, fontWeight: 650, textDecoration: 'none' }}>{label}</Link>)}
      </nav>
    </section>
  )
}

import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import AIItem from '@/components/cards/AIItem'

export default function DashboardSection() {
  return <section id="clinical-intelligence" aria-labelledby="clinical-approach-title" style={{ background: 'var(--surface-subtle)', padding: '48px 24px 64px' }}>
    <div style={{ maxWidth: 1032, margin: '0 auto' }}>
      <p style={{ color: T.link, fontSize: 13, fontWeight: 650 }}>CLINICIAN-LED CARE</p>
      <h2 id="clinical-approach-title" style={{ color: T.navy, fontSize: 'clamp(24px, 4vw, 34px)', letterSpacing: '-0.03em' }}>Technology supports the clinician</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 24 }}>
        {[{ icon: ICONS.user, title: 'Your information, in context', body: 'The consultation starts with your own account and saved intake. Sample medical records are not presented as your care.' }, { icon: ICONS.cpu, title: 'Optional assistance, explicit choice', body: 'AI drafting remains optional and under validation. Generated drafts require clinician review and cannot independently approve care.' }].map(item => <div key={item.title} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: Sh.float }}><AIItem {...item} /></div>)}
      </div>
    </div>
  </section>
}

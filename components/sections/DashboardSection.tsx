import { useTranslations } from 'next-intl'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import AIItem from '@/components/cards/AIItem'

export default function DashboardSection() {
  const t = useTranslations('landing')
  return <section id="clinical-intelligence" aria-labelledby="clinical-approach-title" style={{ background: 'var(--surface-subtle)', padding: '48px 24px 64px' }}>
    <div style={{ maxWidth: 1032, margin: '0 auto' }}>
      <p style={{ color: T.link, fontSize: 13, fontWeight: 650 }}>{t('clinician.eyebrow')}</p>
      <h2 id="clinical-approach-title" style={{ color: T.navy, fontSize: 'clamp(24px, 4vw, 34px)', letterSpacing: '-0.03em' }}>{t('clinician.title')}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 24 }}>
        {[{ icon: ICONS.user, title: t('clinician.contextTitle'), body: t('clinician.contextText') }, { icon: ICONS.cpu, title: t('clinician.aiTitle'), body: t('clinician.aiText') }].map(item => <div key={item.title} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: Sh.float }}><AIItem {...item} /></div>)}
      </div>
    </div>
  </section>
}

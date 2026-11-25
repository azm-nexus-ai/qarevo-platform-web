import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { T, PAGE_BG } from '@/lib/tokens'

export default function PrivacyPage() {
  const t = useTranslations('legalPages')
  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <section style={{ width: '100%', maxWidth: '640px', background: "var(--surface-glass)", backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', borderRadius: '22px', border: "1px solid var(--border)", boxShadow: 'inset 0 1px 0 #fff, 0 20px 60px rgba(4,53,77,0.1)', padding: '32px' }}>
        <h1 style={{ margin: '0 0 10px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>{t('privacyPolicy')}</h1>
        <p style={{ margin: '0 0 16px', fontSize: '14px', color: T.slate, lineHeight: 1.65 }}>{t('developmentEnvironmentSyntheticTestData')}</p>
        <Link href='/' style={{ color: T.link, fontWeight: 700, textDecoration: 'none', fontSize: '14px' }}>{t('returnToHome')}</Link>
      </section>
    </main>
  )
}

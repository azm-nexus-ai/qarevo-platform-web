'use client'
import { useTranslations } from 'next-intl'

import { useRouter } from 'next/navigation'
import { T, Glass } from '@/lib/tokens'
import HoverBtn from '@/components/buttons/HoverBtn'
import BrandScene3D from '@/components/brand/BrandScene3D'
import styles from './HeroSection.module.css'

export default function HeroSection() {
  const t = useTranslations('landing')
  const router = useRouter()

  return (
    <div id="hero" style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto' }} className="container-pad">
        <section className={`section-pad ${styles.hero}`}>
          <div className={styles.visual}><BrandScene3D size={360} /></div>
          <div className={styles.copy}>
          <h1
            style={{
              fontSize: 'clamp(28px, 6vw, 68px)',
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: '-0.038em',
              color: T.navy,
              maxWidth: '740px',
              margin: '0 0 24px',
            }}
          >
            {t('heroLine1')}{' '}
            <span style={{ color: T.slate2, fontWeight: 700 }}>{t('heroLine2')}</span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(15px, 2vw, 17.5px)',
              lineHeight: 1.72,
              color: T.slate,
              maxWidth: '520px',
              margin: '0 0 40px',
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            {t('weAreBuildingAClearer')}
          </p>

          <div className="hero-btns">
            <HoverBtn
              onClick={() => router.push('/auth')}
              base={{
                background: T.blue,
                border: 'none',
                cursor: 'pointer',
                padding: '13px 30px',
                borderRadius: '11px',
                fontSize: '15px',
                fontWeight: 600,
                color: '#fff',
                letterSpacing: '-0.015em',
                boxShadow: '0 1px 4px rgba(32,181,223,0.28), 0 4px 20px rgba(32,181,223,0.22)',
              }}
              on={{
                transform: 'translateY(-1.5px)',
                boxShadow: '0 3px 10px rgba(32,181,223,0.35), 0 10px 36px rgba(32,181,223,0.22)',
              }}
            >
              {t('bookAConsultation')}
            </HoverBtn>
            <HoverBtn
              onClick={() => router.push('/whitepaper')}
              base={{
                cursor: 'pointer',
                padding: '12px 26px',
                borderRadius: '11px',
                fontSize: '15px',
                fontWeight: 500,
                color: T.navy2,
                letterSpacing: '-0.015em',
                ...Glass.pill,
              }}
              on={{ background: "var(--surface-glass)", border: "1px solid var(--border)" }}
            >
              {t('readTheWhitepaper')}
            </HoverBtn>
          </div>
          </div>
        </section>
      </div>
    </div>
  )
}

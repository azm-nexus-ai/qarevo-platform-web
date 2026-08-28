'use client'

import { useRouter } from 'next/navigation'
import { T, Glass } from '@/lib/tokens'
import HoverBtn from '@/components/buttons/HoverBtn'

export default function HeroSection() {
  const router = useRouter()

  return (
    <div id="hero" style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto' }} className="container-pad">
        <section className="section-pad" style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 'clamp(32px, 6vw, 68px)',
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: '-0.038em',
              color: T.navy,
              maxWidth: '740px',
              margin: '0 auto 24px',
            }}
          >
            European healthcare,{' '}
            <span style={{ color: T.slate2, fontWeight: 700 }}>engineered for precision.</span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(15px, 2vw, 17.5px)',
              lineHeight: 1.72,
              color: T.slate,
              maxWidth: '500px',
              margin: '0 auto 44px',
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            Discover verified physicians, orchestrate continuous care, and experience the highest
            standard of clinical intelligence and data governance.
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
              Book a Consultation
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
              on={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(4,53,77,0.13)' }}
            >
              Read the Whitepaper
            </HoverBtn>
          </div>
        </section>
      </div>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { T, PAGE_BG } from '@/lib/tokens'
import { setOnboardingStage } from '@/lib/auth-flow'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import TrustCard from '@/components/cards/TrustCard'
import { ProfileSetupLogo } from '@/components/branding/ProfileSetupBrandAssets'

const LEFT_BG = [
  'radial-gradient(ellipse 80% 60% at 18% 12%,  rgba(32,181,223,0.32) 0%, transparent 52%)',
  'radial-gradient(ellipse 60% 55% at 88% 18%,  rgba(32,181,223,0.22) 0%, transparent 50%)',
  'radial-gradient(ellipse 70% 65% at 50% 98%,  rgba(52,140,234,0.24) 0%, transparent 56%)',
  'radial-gradient(ellipse 50% 45% at 90% 80%,  rgba(165,224,218,0.16) 0%, transparent 50%)',
  T.navy,
].join(', ')

function JourneyIllustration() {
  return (
    <div style={{ position: 'relative', width: '270px', height: '270px', margin: '0 auto', flexShrink: 0 }}>
      {[0, 30, 58].map((inset, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset,
            borderRadius: '50%',
            border: `1px solid rgba(255,255,255,${0.06 + i * 0.04})`,
            animation: `orbFloat 4.8s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          inset: '92px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 35% 30%, rgba(52,140,234,0.34) 0%, rgba(32,181,223,0.16) 54%, transparent 76%)',
          border: '1px solid rgba(52,140,234,0.28)',
          boxShadow: '0 0 56px rgba(32,181,223,0.34), inset 0 1px 0 rgba(255,255,255,0.26)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'corePulse 3.2s ease-in-out infinite',
        }}
      >
        <Ico p={ICONS.check} size={35} sw={1.2} color='rgba(255,255,255,0.92)' />
      </div>

      {[
        { angle: 0, icon: ICONS.check, bg: 'rgba(9,173,112,0.26)', border: 'rgba(165,224,218,0.34)' },
        { angle: 90, icon: ICONS.shield, bg: 'rgba(32,181,223,0.28)', border: 'rgba(52,140,234,0.34)' },
        { angle: 180, icon: ICONS.activity, bg: 'rgba(52,140,234,0.28)', border: 'rgba(52,140,234,0.34)' },
        { angle: 270, icon: ICONS.steth, bg: 'rgba(32,181,223,0.28)', border: 'rgba(165,224,218,0.34)' },
      ].map(({ angle, icon, bg, border }, i) => {
        const r = 106
        const rad = (angle - 90) * Math.PI / 180
        const x = 135 + r * Math.cos(rad)
        const y = 135 + r * Math.sin(rad)

        return (
          <div
            key={angle}
            style={{
              position: 'absolute',
              left: `${x - 20}px`,
              top: `${y - 20}px`,
              width: '40px',
              height: '40px',
              borderRadius: '13px',
              background: bg,
              border: `1px solid ${border}`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: `chipFloat 4.6s ease-in-out ${i * 0.25}s infinite`,
            }}
          >
            <Ico p={icon} size={16} sw={1.5} color='rgba(255,255,255,0.9)' />
          </div>
        )
      })}

      <svg viewBox='0 0 270 26' style={{ position: 'absolute', bottom: '8px', left: 0, width: '100%', opacity: 0.44 }}>
        <polyline
          points='0,13 46,13 62,3 71,23 80,3 89,23 101,13 270,13'
          fill='none'
          stroke='rgba(52,140,234,0.85)'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <circle cx='89' cy='23' r='2.4' fill='rgba(52,140,234,0.9)' />
      </svg>
    </div>
  )
}

function LeftPanel() {
  return (
    <div
      style={{
        width: '380px',
        flexShrink: 0,
        background: LEFT_BG,
        position: 'sticky',
        top: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '44px 44px 44px',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1.2px)',
          backgroundSize: '22px 22px',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-80px',
          left: '-60px',
          width: '380px',
          height: '380px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(32,181,223,0.2) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '-80px',
          right: '-60px',
          width: '340px',
          height: '340px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(52,140,234,0.18) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Link href='/' style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          <ProfileSetupLogo priority style={{ filter: 'brightness(0) invert(1)', opacity: 0.92 }} />
        </Link>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <JourneyIllustration />
        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '24px',
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.035em',
              lineHeight: 1.18,
              margin: '0 0 10px',
            }}
          >
            A healthier future starts now.<br />
            <span style={{ color: 'rgba(147,197,253,0.9)' }}>Welcome to your care journey.</span>
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.52)', lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
            Every next step is designed to be secure, personal, and effortless as you begin your Qarevo Health experience.
          </p>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
        {[
          { icon: ICONS.lock, label: 'Secure Foundation', sub: 'Encrypted identity and health records' },
          { icon: ICONS.brain, label: 'Smart Care Intelligence', sub: 'AI-assisted recommendations tailored to you' },
          { icon: ICONS.steth, label: 'Trusted Clinical Network', sub: 'Access verified physicians across specialties' },
        ].map(({ icon, label, sub }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              gap: '13px',
              alignItems: 'flex-start',
              padding: '13px 0',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '9px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px',
              }}
            >
              <Ico p={icon} size={14} sw={1.5} color='rgba(147,197,253,0.9)' />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '-0.015em', marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepTimeline() {
  const steps = useMemo(
    () => [
      { icon: ICONS.user, title: 'Complete Your Profile', sub: 'Set your personal and care preferences' },
      { icon: ICONS.activity, title: 'Tell Us About Your Health', sub: 'Share key details for tailored support' },
      { icon: ICONS.steth, title: 'Discover Physicians', sub: 'Find verified specialists you can trust' },
      { icon: ICONS.calendar, title: 'Book Your First Consultation', sub: 'Schedule care that fits your routine' },
    ],
    [],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {steps.map((step, i) => (
        <div
          key={step.title}
          style={{
            opacity: 0,
            animation: `fadeUp 0.4s ease ${0.1 + i * 0.09}s forwards`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px 13px',
              borderRadius: '12px',
              background: 'rgba(4,53,77,0.024)',
              border: '1px solid rgba(4,53,77,0.06)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '9px',
                background: T.blueLight,
                border: `1px solid ${T.blueMid}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px',
              }}
            >
              <Ico p={step.icon} size={14} sw={1.75} color={T.blue} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.015em', marginBottom: '2px' }}>{step.title}</div>
              <div style={{ fontSize: '12px', color: T.slate2, letterSpacing: '-0.005em' }}>{step.sub}</div>
            </div>
            <Ico p={ICONS.check} size={12} sw={2.5} color={T.green} />
          </div>

          {i < steps.length - 1 ? (
            <div style={{ padding: '4px 0 4px 15px', color: 'rgba(130,152,175,0.72)' }} aria-hidden>
              <Ico p={ICONS.arrowSm} size={12} sw={2} style={{ transform: 'rotate(90deg)' }} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export default function AccountCreatedPage() {
  const [exploreHover, setExploreHover] = useState(false)
  const router = useRouter()

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
      <style>{`
        * { box-sizing: border-box; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(9px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes corePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.035); }
        }

        @keyframes orbFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        @keyframes chipFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        @media (max-width: 900px) {
          .created-left {
            display: none !important;
          }

          .created-card {
            padding: 30px 22px 24px !important;
            border-radius: 20px !important;
          }

          .created-wrap {
            padding: 24px 16px !important;
          }
        }
      `}</style>

      <div className='created-left'>
        <LeftPanel />
      </div>

      <div className='created-wrap' style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '44px 24px', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: '500px' }}>
          <section
            className='created-card'
            aria-live='polite'
            style={{
              background: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(34px) saturate(200%)',
              WebkitBackdropFilter: 'blur(34px) saturate(200%)',
              borderRadius: '24px',
              border: '1px solid rgba(255,255,255,0.92)',
              boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 28px 68px rgba(4,53,77,0.1)',
              padding: '38px 38px 30px',
              animation: 'fadeUp 0.38s ease both',
            }}
          >
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '16px',
                  background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
                  boxShadow: '0 4px 16px rgba(32,181,223,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'corePulse 2.8s ease-in-out infinite',
                }}
              >
                <Ico p={ICONS.check} size={24} sw={1.25} color='#fff' />
              </div>
            </div>

            <header style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h1
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: '25px',
                  fontWeight: 800,
                  color: T.navy,
                  letterSpacing: '-0.035em',
                  lineHeight: 1.2,
                  margin: '0 0 9px',
                }}
              >
                Welcome to Qarevo Health!
              </h1>
              <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.68, margin: 0, letterSpacing: '-0.01em' }}>
                Your account has been successfully created.
              </p>
              <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.68, margin: '8px 0 0', letterSpacing: '-0.01em' }}>
                You are now ready to experience a smarter, more connected approach to healthcare, from finding trusted physicians to managing consultations and ongoing care, all in one secure platform.
              </p>
            </header>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 14px',
                borderRadius: '100px',
                background: T.greenLight,
                border: '1px solid rgba(9,173,112,0.26)',
                marginBottom: '14px',
              }}
            >
              <Ico p={ICONS.check} size={10} sw={3} color={T.green} />
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: T.teal, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Account Created Successfully
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                Next steps
              </p>
              <StepTimeline />
            </div>

            <div
              style={{
                padding: '14px 14px 12px',
                borderRadius: '12px',
                background: 'rgba(4,53,77,0.025)',
                border: `1px solid ${T.borderFaint}`,
                marginBottom: '16px',
              }}
            >
              <p style={{ fontSize: '13px', color: T.navy2, lineHeight: 1.62, margin: 0, letterSpacing: '-0.005em' }}>
                Healthcare should feel personal, simple, and always within reach. We&apos;re excited to help you take the next step in your health journey.
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <TrustCard label='Secure & Encrypted' sub='End-to-end protected' icon={ICONS.lock} accent={T.blue} />
                <TrustCard label='AI-Assisted Healthcare' sub='Smart clinical guidance' icon={ICONS.brain} accent={T.purple} />
                <TrustCard label='Verified Physicians' sub='Trusted specialists only' icon={ICONS.steth} accent={T.teal} />
                <TrustCard label='Personalized Care' sub='Tailored to your needs' icon={ICONS.activity} accent={T.cyan} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <HoverBtn
                base={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: '13px',
                  border: 'none',
                  background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '15px',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 3px 10px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.14)',
                  minHeight: '48px',
                }}
                on={{
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 18px rgba(32,181,223,0.3), inset 0 1px 0 rgba(255,255,255,0.14)',
                  filter: 'brightness(1.02)',
                }}
                onClick={() => {
                  setOnboardingStage('personal-information')
                  router.push('/auth/profile-setup/personal-information')
                }}
              >
                <span>Continue Setup</span>
                <Ico p={ICONS.arrowFwd} size={15} sw={2.2} />
              </HoverBtn>

              <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <Link
                  href='/'
                  onMouseEnter={() => setExploreHover(true)}
                  onMouseLeave={() => setExploreHover(false)}
                  style={{
                    color: exploreHover ? T.blue : T.slate2,
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    letterSpacing: '-0.01em',
                    transition: 'color 0.15s ease',
                  }}
                >
                  Explore Platform
                </Link>
                <span style={{ color: T.border }}>•</span>
                <Link href='/' style={{ color: T.slate2, fontSize: '13px', fontWeight: 600, textDecoration: 'none', letterSpacing: '-0.01em' }}>
                  Return to Home
                </Link>
              </div>
            </div>

            <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid rgba(4,53,77,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '18px', flexWrap: 'wrap' }}>
                {[
                  { icon: ICONS.shield, label: 'Secure verification' },
                  { icon: ICONS.lock, label: 'End-to-end encrypted' },
                  { icon: ICONS.activity, label: 'HIPAA · GDPR compliant' },
                  { icon: ICONS.brain, label: 'Medical-grade privacy' },
                ].map(({ icon, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Ico p={icon} size={11} sw={1.75} color={T.slate2} />
                    <span style={{ fontSize: '11.5px', fontWeight: 500, color: T.slate2, letterSpacing: '-0.005em' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <p style={{ textAlign: 'center', fontSize: '12px', color: T.slate2, marginTop: '20px', letterSpacing: '-0.005em', lineHeight: 1.5 }}>
            <Link href='/terms' style={{ color: T.blue, fontWeight: 500, textDecoration: 'none' }}>
              Terms
            </Link>
            {' · '}
            <Link href='/privacy' style={{ color: T.blue, fontWeight: 500, textDecoration: 'none' }}>
              Privacy Policy
            </Link>
            {' · '}
            <Link href='/support' style={{ color: T.blue, fontWeight: 500, textDecoration: 'none' }}>
              Support
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

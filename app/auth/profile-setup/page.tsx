'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { T, PAGE_BG } from '@/lib/tokens'
import { setOnboardingStage } from '@/lib/auth-flow'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import TrustCard from '@/components/cards/TrustCard'
import { ProfileSetupLogo, ProfileSetupMark } from '@/components/branding/ProfileSetupBrandAssets'

const LEFT_BG = [
  'radial-gradient(ellipse 80% 60% at 18% 12%,  rgba(32,181,223,0.32) 0%, transparent 52%)',
  'radial-gradient(ellipse 60% 55% at 88% 18%,  rgba(32,181,223,0.22) 0%, transparent 50%)',
  'radial-gradient(ellipse 70% 65% at 50% 98%,  rgba(52,140,234,0.24) 0%, transparent 56%)',
  'radial-gradient(ellipse 50% 45% at 90% 80%,  rgba(165,224,218,0.16) 0%, transparent 50%)',
  T.navy,
].join(', ')

function JourneyVisual() {
  return (
    <div style={{ position: 'relative', width: '260px', height: '260px', margin: '0 auto', flexShrink: 0 }}>
      {[0, 28, 56].map((inset, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset,
            borderRadius: '50%',
            border: `1px solid rgba(255,255,255,${0.06 + i * 0.04})`,
            animation: `floatRing 5s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          inset: '86px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 35% 30%, rgba(52,140,234,0.33) 0%, rgba(32,181,223,0.16) 55%, transparent 78%)',
          border: '1px solid rgba(52,140,234,0.26)',
          boxShadow: '0 0 56px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ProfileSetupMark priority />
      </div>

      {[
        { angle: 0, icon: ICONS.user, bg: 'rgba(9,173,112,0.26)', border: 'rgba(165,224,218,0.3)' },
        { angle: 90, icon: ICONS.brain, bg: 'rgba(32,181,223,0.28)', border: 'rgba(52,140,234,0.3)' },
        { angle: 180, icon: ICONS.activity, bg: 'rgba(52,140,234,0.28)', border: 'rgba(52,140,234,0.3)' },
        { angle: 270, icon: ICONS.shield, bg: 'rgba(32,181,223,0.28)', border: 'rgba(165,224,218,0.3)' },
      ].map(({ angle, icon, bg, border }, i) => {
        const r = 102
        const rad = (angle - 90) * Math.PI / 180
        const x = 130 + r * Math.cos(rad)
        const y = 130 + r * Math.sin(rad)
        return (
          <div
            key={angle}
            style={{
              position: 'absolute',
              left: `${x - 19}px`,
              top: `${y - 19}px`,
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: bg,
              border: `1px solid ${border}`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: `floatNode 4.4s ease-in-out ${i * 0.22}s infinite`,
            }}
          >
            <Ico p={icon} size={15} sw={1.5} color='rgba(255,255,255,0.88)' />
          </div>
        )
      })}

      <svg viewBox='0 0 260 24' style={{ position: 'absolute', bottom: '8px', left: 0, width: '100%', opacity: 0.42 }}>
        <polyline
          points='0,12 42,12 58,2 66,22 74,2 82,22 95,12 260,12'
          fill='none'
          stroke='rgba(52,140,234,0.85)'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <circle cx='82' cy='22' r='2.5' fill='rgba(52,140,234,0.9)' />
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
          <ProfileSetupLogo priority />
        </Link>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <JourneyVisual />
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
            Personalized care begins here.<br />
            <span style={{ color: 'rgba(147,197,253,0.9)' }}>Built around your health story.</span>
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
            Your profile helps us match you with the right physicians and enable more meaningful, secure consultations.
          </p>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
        {[
          { icon: ICONS.user, label: 'Patient-Centered Onboarding', sub: 'Designed to reduce friction and uncertainty' },
          { icon: ICONS.brain, label: 'AI-Assisted Personalization', sub: 'Smarter recommendations from day one' },
          { icon: ICONS.shield, label: 'Private by Design', sub: 'Healthcare-grade data protection and trust' },
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

function SetupTimeline() {
  const steps = useMemo(
    () => [
      { title: 'Personal Information', sub: 'Basic identity details to create your patient profile' },
      { title: 'Contact Information', sub: 'Preferred channels for care updates and reminders' },
      { title: 'Medical History', sub: 'Health background to support safer consultations' },
      { title: 'Allergies & Medications', sub: 'Critical safety information for physicians' },
      { title: 'Insurance & Consent', sub: 'Coverage details and consent preferences' },
      { title: 'Profile Complete', sub: 'Unlock your personalized healthcare experience' },
    ],
    [],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {steps.map((step, i) => (
        <div key={step.title} style={{ opacity: 0, animation: `fadeUp 0.34s ease ${0.1 + i * 0.07}s forwards` }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '11px',
              padding: '11px 12px',
              borderRadius: '12px',
              background: 'rgba(4,53,77,0.024)',
              border: '1px solid rgba(4,53,77,0.06)',
            }}
          >
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '9px',
                background: T.blueLight,
                border: `1px solid ${T.blueMid}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Ico p={ICONS.check} size={11} sw={2.6} color={T.blue} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.015em', marginBottom: '2px' }}>{step.title}</div>
              <div style={{ fontSize: '12px', color: T.slate2, letterSpacing: '-0.005em' }}>{step.sub}</div>
            </div>
          </div>
          {i < steps.length - 1 ? (
            <div style={{ padding: '3px 0 3px 14px', color: 'rgba(130,152,175,0.72)' }} aria-hidden>
              <Ico p={ICONS.arrowSm} size={11} sw={2} style={{ transform: 'rotate(90deg)' }} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export default function ProfileSetupPage() {
  const router = useRouter()

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatRing {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes floatNode {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @media (max-width: 900px) {
          .onboard-left { display: none !important; }
          .onboard-card { padding: 30px 22px 24px !important; border-radius: 20px !important; }
          .onboard-wrap { padding: 24px 16px !important; }
        }
      `}</style>

      <div className='onboard-left'>
        <LeftPanel />
      </div>

      <div className='onboard-wrap' style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '46px 24px', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: '520px' }}>
          <section
            className='onboard-card'
            aria-live='polite'
            style={{
              background: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(34px) saturate(200%)',
              WebkitBackdropFilter: 'blur(34px) saturate(200%)',
              borderRadius: '24px',
              border: '1px solid rgba(255,255,255,0.92)',
              boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 28px 68px rgba(4,53,77,0.1)',
              padding: '38px 38px 30px',
              animation: 'fadeUp 0.35s ease',
            }}
          >
            <header style={{ marginBottom: '16px' }}>
              <h1
                style={{
                  margin: '0 0 8px',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: '25px',
                  fontWeight: 800,
                  color: T.navy,
                  letterSpacing: '-0.035em',
                  lineHeight: 1.2,
                }}
              >
                Welcome to Your Health Journey
              </h1>
              <p style={{ margin: '0 0 10px', fontSize: '14px', color: T.slate, lineHeight: 1.68, letterSpacing: '-0.01em' }}>
                Before we connect you with trusted healthcare professionals, let&apos;s take a few moments to personalize your healthcare experience.
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.68, letterSpacing: '-0.01em' }}>
                Completing your profile allows us to better understand your needs, recommend suitable physicians, improve consultations, and provide a more personalized healthcare experience.
              </p>
            </header>

            <div
              style={{
                marginBottom: '14px',
                padding: '12px 14px',
                borderRadius: '12px',
                background: 'rgba(4,53,77,0.024)',
                border: '1px solid rgba(4,53,77,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Profile Setup</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>Step 1 of 6</p>
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Estimated Completion</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>3-5 Minutes</p>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <SetupTimeline />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Why we need this
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <TrustCard label='Better Doctor Recommendations' sub='Tailored physician suggestions for your needs.' icon={ICONS.steth} accent={T.blue} />
                <TrustCard label='Personalized Care' sub='More effective consultations with better context.' icon={ICONS.activity} accent={T.teal} />
                <TrustCard label='Secure Medical Records' sub='Enterprise-grade encryption and protection.' icon={ICONS.lock} accent={T.cyan} />
                <TrustCard label='AI-Powered Healthcare' sub='Intelligent health insights and guidance.' icon={ICONS.brain} accent={T.purple} />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {[
                  { icon: ICONS.lock, label: 'Secure & Encrypted' },
                  { icon: ICONS.steth, label: 'Verified Healthcare Professionals' },
                  { icon: ICONS.shield, label: 'HIPAA-Oriented Security' },
                  { icon: ICONS.brain, label: 'AI-Assisted Healthcare' },
                  { icon: ICONS.activity, label: 'Private Medical Records' },
                ].map(({ icon, label }) => (
                  <span
                    key={label}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 11px',
                      borderRadius: '100px',
                      background: 'rgba(4,53,77,0.03)',
                      border: '1px solid rgba(4,53,77,0.08)',
                      color: T.slate2,
                      fontSize: '11.5px',
                      fontWeight: 600,
                      letterSpacing: '-0.005em',
                    }}
                  >
                    <Ico p={icon} size={11} sw={1.75} color={T.slate2} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <HoverBtn
                onClick={() => {
                  setOnboardingStage('personal-information')
                  router.push('/auth/profile-setup/personal-information')
                }}
                base={{
                  width: '100%',
                  minHeight: '48px',
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
                }}
                on={{ transform: 'translateY(-1px)', boxShadow: '0 8px 18px rgba(32,181,223,0.3), inset 0 1px 0 rgba(255,255,255,0.14)' }}
              >
                <span>Start Profile Setup</span>
                <Ico p={ICONS.arrowFwd} size={15} sw={2.2} />
              </HoverBtn>

              <Link
                href='/auth/account-created'
                style={{
                  textAlign: 'center',
                  color: T.slate2,
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  letterSpacing: '-0.01em',
                }}
              >
                Back
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

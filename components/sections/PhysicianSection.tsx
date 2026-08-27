'use client'

import { useRouter } from 'next/navigation'
import { T, Sh, Glass } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'

export default function PhysicianSection() {
  const router = useRouter()

  const features = [
    { icon: ICONS.steth, title: 'Verified Physicians', desc: 'Board-certified specialists across Europe' },
    { icon: ICONS.video, title: 'Virtual Consultations', desc: 'HD video with AI-assisted diagnostics' },
    { icon: ICONS.brain, title: 'Clinical Intelligence', desc: 'AI-powered treatment recommendations' },
    { icon: ICONS.shield, title: 'Secure Platform', desc: 'HIPAA & GDPR compliant infrastructure' },
  ]

  return (
    <div
      id="for-physicians"
      style={{
        position: 'relative',
        zIndex: 1,
        background: 'rgba(255,255,255,0.52)',
        backdropFilter: 'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        borderTop: '1px solid rgba(255,255,255,0.72)',
        borderBottom: '1px solid rgba(255,255,255,0.56)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(4,53,77,0.02)',
      }}
    >
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '88px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '72px', alignItems: 'center' }}>
          {/* Left: Content */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px 6px 10px',
                borderRadius: '100px',
                marginBottom: '24px',
                background: 'rgba(32,181,223,0.08)',
                border: '1px solid rgba(32,181,223,0.18)',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: T.blue,
                  boxShadow: `0 0 0 2px rgba(32,181,223,0.2), 0 0 6px rgba(32,181,223,0.3)`,
                  display: 'block',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: T.blue, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                For Healthcare Providers
              </span>
            </div>

            <h2
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 'clamp(28px, 4vw, 42px)',
                fontWeight: 800,
                lineHeight: 1.12,
                letterSpacing: '-0.035em',
                color: T.navy,
                margin: '0 0 20px',
              }}
            >
              Join the network of{' '}
              <span style={{ color: T.blue, fontWeight: 700 }}>verified physicians</span>
            </h2>

            <p
              style={{
                fontSize: '15px',
                lineHeight: 1.72,
                color: T.slate,
                margin: '0 0 36px',
                letterSpacing: '-0.01em',
                maxWidth: '420px',
              }}
            >
              Expand your practice with AI-powered clinical tools, secure patient management, and seamless care coordination across Europe.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '36px' }}>
              {features.map((feature) => (
                <div key={feature.title} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      background: 'rgba(32,181,223,0.1)',
                      border: '1px solid rgba(32,181,223,0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    <Ico p={feature.icon} size={15} sw={1.6} color={T.blue} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: T.navy, letterSpacing: '-0.015em', marginBottom: '3px' }}>
                      {feature.title}
                    </div>
                    <div style={{ fontSize: '13px', color: T.slate2, lineHeight: 1.5, letterSpacing: '-0.005em' }}>
                      {feature.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <HoverBtn
                onClick={() => router.push('/auth/doctor-register')}
                base={{
                  background: T.blue,
                  border: 'none',
                  cursor: 'pointer',
                  padding: '13px 28px',
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
                Register as Physician
              </HoverBtn>
              <HoverBtn
                onClick={() => router.push('/auth/doctor/login')}
                base={{
                  cursor: 'pointer',
                  padding: '12px 24px',
                  borderRadius: '11px',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: T.navy2,
                  letterSpacing: '-0.015em',
                  ...Glass.pill,
                }}
                on={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(4,53,77,0.13)' }}
              >
                Physician Sign In
              </HoverBtn>
            </div>
          </div>

          {/* Right: Visual */}
          <div style={{ position: 'relative', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Background glow */}
            <div
              style={{
                position: 'absolute',
                width: '320px',
                height: '320px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(32,181,223,0.15) 0%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />

            {/* Central card */}
            <div
              style={{
                position: 'relative',
                width: '280px',
                padding: '28px',
                borderRadius: '20px',
                background: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 8px 32px rgba(4,53,77,0.08), 0 24px 64px rgba(4,53,77,0.06)',
              }}
            >
              {/* Profile header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '18px',
                    fontWeight: 700,
                    boxShadow: '0 4px 16px rgba(32,181,223,0.3)',
                  }}
                >
                  DR
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: T.navy, letterSpacing: '-0.015em', marginBottom: '2px' }}>
                    Dr. Sarah Chen
                  </div>
                  <div style={{ fontSize: '12px', color: T.slate2, letterSpacing: '-0.005em' }}>
                    Cardiology • Berlin
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(9,173,112,0.08)', border: '1px solid rgba(9,173,112,0.15)' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: T.green, letterSpacing: '-0.02em', marginBottom: '2px' }}>
                    247
                  </div>
                  <div style={{ fontSize: '11px', color: T.slate2, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                    Patients
                  </div>
                </div>
                <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(32,181,223,0.08)', border: '1px solid rgba(32,181,223,0.15)' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: T.blue, letterSpacing: '-0.02em', marginBottom: '2px' }}>
                    4.9
                  </div>
                  <div style={{ fontSize: '11px', color: T.slate2, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                    Rating
                  </div>
                </div>
              </div>

              {/* Activity */}
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(4,53,77,0.03)', border: '1px solid rgba(4,53,77,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Ico p={ICONS.activity} size={14} sw={1.6} color={T.blue} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>
                    Today's Schedule
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(4,53,77,0.06)' }}>
                    <span style={{ fontSize: '12px', color: T.slate }}>09:00 AM</span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: T.navy }}>Patient Consultation</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                    <span style={{ fontSize: '12px', color: T.slate }}>11:30 AM</span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: T.navy }}>Follow-up Call</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating elements */}
            <div
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 4px 20px rgba(4,53,77,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Ico p={ICONS.check} size={16} sw={2.5} color={T.green} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>
                License Verified
              </span>
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: '40px',
                left: '0px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 4px 20px rgba(4,53,77,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Ico p={ICONS.shield} size={16} sw={1.75} color={T.blue} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>
                HIPAA Compliant
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

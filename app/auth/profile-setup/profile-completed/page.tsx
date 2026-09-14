'use client'

import Link from 'next/link'
import { PAGE_BG, T } from '@/lib/tokens'
import { markOnboardingCompleted } from '@/lib/auth-flow'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { ProfileSetupLogo, ProfileSetupMark } from '@/components/branding/ProfileSetupBrandAssets'

const LEFT_BG = [
  'radial-gradient(ellipse 80% 60% at 18% 12%,  rgba(32,181,223,0.32) 0%, transparent 52%)',
  'radial-gradient(ellipse 60% 55% at 88% 18%,  rgba(32,181,223,0.22) 0%, transparent 50%)',
  'radial-gradient(ellipse 70% 65% at 50% 98%,  rgba(52,140,234,0.24) 0%, transparent 56%)',
  'radial-gradient(ellipse 50% 45% at 90% 80%,  rgba(165,224,218,0.16) 0%, transparent 50%)',
  T.navy,
].join(', ')

function CompletionVisual() {
  return (
    <div style={{ position: 'relative', width: '268px', height: '268px', margin: '0 auto', flexShrink: 0 }}>
      {[0, 28, 58].map((inset, index) => (
        <div key={index} style={{ position: 'absolute', inset, borderRadius: '50%', border: `1px solid rgba(255,255,255,${0.06 + index * 0.04})` }} />
      ))}
      <div style={{ position: 'absolute', inset: '84px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, rgba(52,140,234,0.34) 0%, rgba(32,181,223,0.16) 55%, transparent 78%)', border: '1px solid rgba(52,140,234,0.26)', boxShadow: '0 0 56px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ProfileSetupMark priority />
      </div>
      {[
        { angle: 0, icon: ICONS.lock, bg: 'rgba(9,173,112,0.26)', border: 'rgba(165,224,218,0.3)' },
        { angle: 90, icon: ICONS.brain, bg: 'rgba(32,181,223,0.28)', border: 'rgba(52,140,234,0.3)' },
        { angle: 180, icon: ICONS.shield, bg: 'rgba(52,140,234,0.28)', border: 'rgba(52,140,234,0.3)' },
        { angle: 270, icon: ICONS.activity, bg: 'rgba(32,181,223,0.28)', border: 'rgba(165,224,218,0.3)' },
      ].map(({ angle, icon, bg, border }) => {
        const radius = 102
        const radians = ((angle - 90) * Math.PI) / 180
        const x = 134 + radius * Math.cos(radians)
        const y = 134 + radius * Math.sin(radians)

        return (
          <div key={angle} style={{ position: 'absolute', left: `${x - 19}px`, top: `${y - 19}px`, width: '38px', height: '38px', borderRadius: '12px', background: bg, border: `1px solid ${border}`, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', boxShadow: '0 4px 12px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ico p={icon} size={15} sw={1.5} color='rgba(255,255,255,0.88)' />
          </div>
        )
      })}
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
        padding: '44px',
        overflow: 'hidden',
      }}
    >
      <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1.2px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', top: '-80px', left: '-60px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(32,181,223,0.2) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-80px', right: '-60px', width: '340px', height: '340px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,140,234,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Link href='/' style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          <ProfileSetupLogo priority />
        </Link>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <CompletionVisual />
        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.18, margin: '0 0 10px' }}>
            Onboarding complete.<br />
            <span style={{ color: 'rgba(147,197,253,0.9)' }}>Your profile is ready.</span>
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.72, margin: 0, letterSpacing: '-0.01em' }}>
            You’ve finished setting up your patient profile. Qarevo Health is now ready to support your care journey.
          </p>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
        {[
          { icon: ICONS.lock, label: 'Protected Data', sub: 'Your records stay secure and encrypted' },
          { icon: ICONS.shield, label: 'Ready for Care', sub: 'Your profile now supports better consultations' },
          { icon: ICONS.check, label: 'A Smooth Finish', sub: 'You are ready to explore Qarevo Health' },
        ].map(({ icon, label, sub }) => (
          <div key={label} style={{ display: 'flex', gap: '13px', alignItems: 'flex-start', padding: '13px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
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

export default function ProfileCompletedPage() {
  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex' }}>
      <style>{`
        * { box-sizing: border-box; }
        @media (max-width: 900px) {
          .pc-left { display: none !important; }
          .pc-wrap { padding: 24px 16px !important; }
          .pc-card { padding: 28px 22px 24px !important; border-radius: 20px !important; }
        }
      `}</style>

      <div className='pc-left'>
        <LeftPanel />
      </div>

      <div className='pc-wrap' style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '44px 24px 64px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: '760px' }}>
          <section className='pc-card' style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(34px) saturate(200%)', WebkitBackdropFilter: 'blur(34px) saturate(200%)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.92)', boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 28px 68px rgba(4,53,77,0.1)', padding: '36px 32px' }}>
            <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(4,53,77,0.024)', border: '1px solid rgba(4,53,77,0.06)', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Profile Setup</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>Step 6 of 6</p>
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>100% Complete</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>Welcome to Qarevo Health</p>
              </div>
            </div>

            <header style={{ marginBottom: '18px', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '18px', margin: '0 auto 14px', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, boxShadow: '0 4px 16px rgba(32,181,223,0.35), inset 0 1px 0 rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ico p={ICONS.check} size={26} sw={1.8} color='#fff' />
              </div>
              <h1 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', lineHeight: 1.2 }}>Profile Completed</h1>
              <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.65, letterSpacing: '-0.01em' }}>
                Your onboarding is complete. You can now begin using Qarevo Health with a profile that is secure, personalized, and ready for care.
              </p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '18px' }}>
              {[
                { icon: ICONS.lock, label: 'Protected', sub: 'Your information is encrypted' },
                { icon: ICONS.brain, label: 'Informed', sub: 'Your care profile is ready' },
                { icon: ICONS.shield, label: 'Secure', sub: 'Privacy-first healthcare access' },
              ].map(({ icon, label, sub }) => (
                <div key={label} style={{ padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(4,53,77,0.06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: T.blueLight, border: `1px solid ${T.blueMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ico p={icon} size={15} sw={1.7} color={T.blue} />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.015em' }}>{label}</div>
                  <div style={{ fontSize: '12px', color: T.slate2, lineHeight: 1.5 }}>{sub}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '16px', padding: '12px 13px', borderRadius: '12px', background: 'rgba(4,53,77,0.024)', border: '1px solid rgba(4,53,77,0.06)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: T.blueLight, border: `1px solid ${T.blueMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico p={ICONS.info} size={13} sw={1.75} color={T.blue} />
              </div>
              <div>
                <p style={{ margin: '0 0 3px', fontSize: '12.5px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>What happens next?</p>
                <p style={{ margin: 0, fontSize: '12.5px', color: T.slate2, lineHeight: 1.55, letterSpacing: '-0.005em' }}>
                  Your profile is now ready. Continue to your dashboard to begin exploring your care experience.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Link
                href='/patient/dashboard'
                onClick={() => markOnboardingCompleted()}
                style={{ width: '100%', minHeight: '48px', borderRadius: '13px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 3px 10px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.14)' }}
              >
                Continue to Dashboard
                <Ico p={ICONS.arrowFwd} size={15} sw={2.2} />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { T, Sh, PAGE_BG } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { getApiErrorDetail, resendVerificationEmail, storeAuthTokens, verifyEmailCode } from '@/lib/api'
import { setOnboardingStage } from '@/lib/auth-flow'

const SIGNUP_STORAGE_KEY = 'qarevo.auth.signup.v1'
const masked = (e: string) => e.replace(/(.{2}).+(@.+)/, '$1•••$2')

function readSignupEmail() {
  if (typeof window === 'undefined') return ''
  try {
    const raw = window.localStorage.getItem(SIGNUP_STORAGE_KEY)
    const stored = raw ? (JSON.parse(raw) as { email?: string }) : null
    return stored?.email?.trim().toLowerCase() || ''
  } catch {
    return ''
  }
}

// ─── Countdown ─────────────────────────────────────────────────────────────────
function useCountdown(initial: number) {
  const [secs, setSecs] = useState(initial)
  const [running, setRunning] = useState(true)
  const id = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!running) return
    id.current = setInterval(() => {
      setSecs(s => { if (s <= 1) { setRunning(false); return 0 } return s - 1 })
    }, 1000)
    return () => { if (id.current) clearInterval(id.current) }
  }, [running])
  const restart = (n = initial) => { setSecs(n); setRunning(true) }
  return { secs, done: !running, restart }
}

// ─── Envelope illustration ─────────────────────────────────────────────────────
function EnvelopeScene({ verified }: { verified: boolean }) {
  const [phase, setPhase] = useState(0)
  useEffect(() => { const t = setInterval(() => setPhase(p => (p + 1) % 4), 2400); return () => clearInterval(t) }, [])
  const glow = phase % 2 === 0

  return (
    <div style={{ position: 'relative', width: '280px', height: '200px', margin: '0 auto', userSelect: 'none' }}>
      {/* Background halo */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: verified ? '260px' : '240px',
        height: verified ? '260px' : '240px',
        borderRadius: '50%',
        background: verified
          ? 'radial-gradient(circle, rgba(9,173,112,0.09) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(32,181,223,0.08) 0%, transparent 70%)',
        transition: 'all 0.7s ease',
        pointerEvents: 'none',
      }} />

      {/* Outer orbit ring */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: '200px', height: '200px', borderRadius: '50%',
        border: `1px dashed ${verified ? 'rgba(9,173,112,0.14)' : 'rgba(32,181,223,0.1)'}`,
        transition: 'border-color 0.6s ease',
      }} />

      {/* Pulse ring */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%,-50%) scale(${glow ? 1.06 : 0.97})`,
        width: '160px', height: '160px', borderRadius: '50%',
        border: `1.5px solid ${verified ? `rgba(9,173,112,${glow ? 0.22 : 0.07})` : `rgba(32,181,223,${glow ? 0.18 : 0.06})`}`,
        transition: 'all 1.2s cubic-bezier(0.34,1.56,0.64,1)',
      }} />

      {/* Envelope SVG */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: '110px', height: '84px',
        filter: `drop-shadow(0 12px 28px ${verified ? 'rgba(9,173,112,0.32)' : 'rgba(32,181,223,0.28)'})`,
        transition: 'filter 0.6s ease',
      }}>
        <svg width="110" height="84" viewBox="0 0 110 84" fill="none">
          {/* Envelope body */}
          <rect x="2" y="18" width="106" height="64" rx="10" fill={verified ? 'url(#envGrad_v)' : 'url(#envGrad_u)'} />
          <rect x="2" y="18" width="106" height="64" rx="10" stroke={verified ? 'rgba(9,173,112,0.35)' : 'rgba(32,181,223,0.3)'} strokeWidth="1.5"/>

          {/* Envelope flap */}
          <path
            d={verified ? "M2 18 L55 52 L108 18" : "M2 18 L55 52 L108 18"}
            fill={verified ? 'url(#flapGrad_v)' : 'url(#flapGrad_u)'}
            stroke={verified ? 'rgba(9,173,112,0.25)' : 'rgba(32,181,223,0.2)'}
            strokeWidth="1.2"
          />

          {/* Bottom fold lines */}
          <path d="M2 82 L44 50" stroke={verified ? 'rgba(9,173,112,0.18)' : 'rgba(32,181,223,0.15)'} strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M108 82 L66 50" stroke={verified ? 'rgba(9,173,112,0.18)' : 'rgba(32,181,223,0.15)'} strokeWidth="1.2" strokeLinecap="round"/>

          {/* Paper lines or check */}
          {!verified ? (
            <>
              <rect x="32" y="38" width="46" height="4" rx="2" fill="rgba(255,255,255,0.45)"/>
              <rect x="38" y="46" width="34" height="3" rx="1.5" fill="rgba(255,255,255,0.28)"/>
              <rect x="42" y="53" width="26" height="3" rx="1.5" fill="rgba(255,255,255,0.18)"/>
            </>
          ) : (
            <g transform="translate(37, 36)">
              <circle cx="18" cy="18" r="16" fill="rgba(9,173,112,0.25)" stroke="rgba(9,173,112,0.4)" strokeWidth="1.2"/>
              <polyline points="9,18 16,25 27,12" stroke="rgba(165,224,218,0.95)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </g>
          )}

          {/* Seal dot */}
          <circle cx="55" cy="52" r="5" fill={verified ? T.green : T.blue} opacity="0.7"/>
          <circle cx="55" cy="52" r="2.5" fill="white" opacity="0.8"/>

          <defs>
            <linearGradient id="envGrad_u" x1="2" y1="18" x2="108" y2="82" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E72FF" stopOpacity="0.22"/>
              <stop offset="100%" stopColor="#0891B2" stopOpacity="0.14"/>
            </linearGradient>
            <linearGradient id="envGrad_v" x1="2" y1="18" x2="108" y2="82" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#09AD70" stopOpacity="0.22"/>
              <stop offset="100%" stopColor="#0E8A5F" stopOpacity="0.14"/>
            </linearGradient>
            <linearGradient id="flapGrad_u" x1="2" y1="18" x2="108" y2="52" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#20B5DF" stopOpacity="0.18"/>
              <stop offset="100%" stopColor="#20B5DF" stopOpacity="0.06"/>
            </linearGradient>
            <linearGradient id="flapGrad_v" x1="2" y1="18" x2="108" y2="52" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#09AD70" stopOpacity="0.18"/>
              <stop offset="100%" stopColor="#09AD70" stopOpacity="0.06"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Floating orbit chips */}
      {[
        { x: 18,  y: 44,  icon: ICONS.shield,   bg: 'rgba(32,181,223,0.1)',   bdr: 'rgba(32,181,223,0.22)',   delay: '0s'    },
        { x: 222, y: 38,  icon: ICONS.lock,     bg: 'rgba(32,181,223,0.1)',   bdr: 'rgba(32,181,223,0.22)',   delay: '0.5s'  },
        { x: 12,  y: 130, icon: ICONS.activity, bg: 'rgba(52,140,234,0.1)',  bdr: 'rgba(52,140,234,0.22)',  delay: '1.1s'  },
        { x: 226, y: 126, icon: ICONS.check,    bg: 'rgba(9,173,112,0.1)',   bdr: 'rgba(9,173,112,0.22)',   delay: '0.75s' },
      ].map(({ x, y, icon, bg, bdr, delay }) => (
        <div key={`${x}${y}`} style={{
          position: 'absolute', left: x, top: y,
          width: '34px', height: '34px', borderRadius: '10px',
          background: bg, border: `1px solid ${bdr}`,
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 2px 10px rgba(4,53,77,0.08), inset 0 1px 0 rgba(255,255,255,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: `chipFloat 3.6s ease-in-out ${delay} infinite`,
        }}>
          <Ico p={icon} size={14} sw={1.75} color={T.navy} />
        </div>
      ))}

      {/* ECG */}
      <svg viewBox="0 0 280 14" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', opacity: 0.3 }}>
        <polyline points="0,7 50,7 64,1 70,13 76,1 82,13 94,7 280,7"
          fill="none" stroke={verified ? T.green : T.blue} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="82" cy="13" r="2" fill={verified ? T.green : T.blue} />
      </svg>
    </div>
  )
}

// ─── OTP input ─────────────────────────────────────────────────────────────────
function OtpInput({ email, onComplete }: { email: string; onComplete: () => void }) {
  const [values, setValues] = useState(['', '', '', '', '', ''])
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const verifyCode = async (code: string) => {
    setLoading(true)
    setError('')
    try {
      const response = await verifyEmailCode({ email, code })
      if (response.access_token && response.refresh_token) {
        storeAuthTokens({
          access_token: response.access_token,
          refresh_token: response.refresh_token,
          token_type: response.token_type,
          expires_in: response.expires_in,
          user_id: response.user_id,
          role: response.role || 'PATIENT',
        })
      }
      setSuccess(true)
      setOnboardingStage('account-created')
      setTimeout(onComplete, 900)
    } catch (error) {
      setValues(['', '', '', '', '', ''])
      refs.current[0]?.focus()
      setError(getApiErrorDetail(error) || 'Incorrect code. Please check your email and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (i: number, val: string) => {
    if (loading || success) return
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...values]
    next[i] = digit
    setValues(next)
    setError('')
    if (digit && i < 5) refs.current[i + 1]?.focus()
    if (next.every(v => v !== '')) {
      void verifyCode(next.join(''))
    }
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !values[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    if (loading || success) return
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = [...values]
    text.split('').forEach((d, i) => { next[i] = d })
    setValues(next)
    refs.current[Math.min(text.length, 5)]?.focus()
    setError('')
    if (text.length === 6) {
      void verifyCode(text)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '10px' }}>
        {values.map((v, i) => {
          const filled = v !== ''
          return (
            <input
              key={i}
              ref={el => { refs.current[i] = el }}
              maxLength={1}
              inputMode="numeric"
              value={v}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
              disabled={loading || success}
              style={{
                width: '48px', height: '56px', textAlign: 'center',
                fontSize: '22px', fontWeight: 700, color: T.navy,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                borderRadius: '12px',
                border: `2px solid ${error ? 'rgba(220,38,38,0.4)' : success ? 'rgba(9,173,112,0.5)' : filled ? 'rgba(32,181,223,0.4)' : 'rgba(4,53,77,0.1)'}`,
                background: error ? '#FFF5F5' : success ? '#F0FDF8' : filled ? T.blueLight : 'rgba(255,255,255,0.75)',
                outline: 'none',
                boxShadow: filled ? `0 0 0 3px rgba(32,181,223,0.06)` : 'none',
                transition: 'all 0.15s ease',
                caretColor: T.blue,
                letterSpacing: 0,
              }}
            />
          )
        })}
      </div>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
          <Ico p={ICONS.info} size={12} sw={1.75} color={T.red} />
          <span style={{ fontSize: '12.5px', color: T.red, letterSpacing: '-0.005em' }}>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
          <Ico p={ICONS.check} size={12} sw={2.5} color={T.green} />
          <span style={{ fontSize: '12.5px', color: T.teal, fontWeight: 600, letterSpacing: '-0.005em' }}>Code verified — activating your account…</span>
        </div>
      )}
      {loading && (
        <p style={{ textAlign: 'center', fontSize: '11.5px', color: T.slate2, margin: '8px 0 0', letterSpacing: '-0.005em' }}>
          Verifying code...
        </p>
      )}
    </div>
  )
}

// ─── Step bar ──────────────────────────────────────────────────────────────────
function StepBar({ step }: { step: 0 | 1 | 2 }) {
  const steps = ['Create Account', 'Verify Email', 'Get Started']
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '0', marginBottom: '36px' }}>
      {steps.map((label, i) => {
        const done = i < step, active = i === step
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: done ? T.green : active ? T.blue : 'rgba(4,53,77,0.05)',
                border: `2px solid ${done ? T.green : active ? T.blue : 'rgba(4,53,77,0.1)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: active ? `0 0 0 4px rgba(32,181,223,0.1)` : done ? `0 0 0 3px rgba(9,173,112,0.1)` : 'none',
                transition: 'all 0.35s ease', flexShrink: 0,
              }}>
                {done
                  ? <Ico p={ICONS.check} size={11} sw={3} color="#fff" />
                  : <span style={{ fontSize: '11px', fontWeight: 700, color: active ? '#fff' : T.slate2 }}>{i + 1}</span>}
              </div>
              <span style={{ fontSize: '10.5px', fontWeight: done || active ? 600 : 400, color: done ? T.green : active ? T.blue : T.slate2, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: '52px', height: '2px', margin: '13px 6px 0', borderRadius: '2px', background: done ? T.green : 'rgba(4,53,77,0.07)', transition: 'background 0.4s ease', flexShrink: 0 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Tip accordion item ────────────────────────────────────────────────────────
function TipRow({ icon, title, body }: { icon: string | readonly string[]; title: string; body: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderRadius: '12px', border: `1px solid ${open ? 'rgba(32,181,223,0.18)' : 'rgba(4,53,77,0.07)'}`, background: open ? 'rgba(234,241,255,0.55)' : 'rgba(255,255,255,0.6)', overflow: 'hidden', transition: 'all 0.2s ease', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '13px 14px', display: 'flex', alignItems: 'center', gap: '11px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
      >
        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: open ? 'rgba(32,181,223,0.1)' : 'rgba(4,53,77,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s ease' }}>
          <Ico p={icon} size={13} sw={1.75} color={open ? T.blue : T.slate} />
        </div>
        <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: T.navy, letterSpacing: '-0.015em' }}>{title}</span>
        <div style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }}>
          <Ico p={ICONS.arrowFwd} size={12} sw={2} color={T.slate2} />
        </div>
      </button>
      {open && (
        <div style={{ padding: '0 14px 13px 53px', fontSize: '13px', color: T.slate, lineHeight: 1.6, letterSpacing: '-0.005em', animation: 'expandDown 0.2s ease both' }}>
          {body}
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function VerifyEmailPage() {
  const router = useRouter()
  const { secs, done: canResend, restart } = useCountdown(60)
  const [verified,   setVerified]   = useState(false)
  const [resendOk,   setResendOk]   = useState(false)
  const [resendError, setResendError] = useState('')
  const [emailModal, setEmailModal] = useState(false)
  const [tab,        setTab]        = useState<'link' | 'code'>('link')
  const [email] = useState(readSignupEmail)

  const handleResend = async () => {
    if (!canResend) return
    setResendOk(false)
    setResendError('')
    if (!email) {
      setResendError('Enter your email again to resend the verification code.')
      return
    }
    try {
      await resendVerificationEmail({ email })
      setResendOk(true)
      restart(90)
      setTimeout(() => setResendOk(false), 4000)
    } catch (error) {
      setResendError(getApiErrorDetail(error) || 'We could not resend the verification email right now.')
    }
  }

  const m = email ? masked(email) : 'your email address'

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px 56px' }}>
      <style>{`
        * { box-sizing: border-box; }
        input[type=text], input[type=number] { -webkit-tap-highlight-color: transparent; }
        @keyframes fadeUp     { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes popIn      { 0% { opacity:0; transform:scale(0.78); } 65% { transform:scale(1.05); } 100% { opacity:1; transform:scale(1); } }
        @keyframes slideToast { from { opacity:0; transform:translateY(-6px); max-height:0; } to { opacity:1; transform:translateY(0); max-height:60px; } }
        @keyframes expandDown { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
        @keyframes chipFloat  { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-5px); } }
        @keyframes spin       { to { transform:rotate(360deg); } }
        @keyframes successOrb { 0% { opacity:0; transform:scale(0.5); } 60% { transform:scale(1.12); } 100% { opacity:1; transform:scale(1); } }
        .pri-btn { transition: all 0.14s ease !important; }
        .pri-btn:hover { filter: brightness(1.06); transform: translateY(-1px); }
        .pri-btn:active { transform: translateY(0); filter: brightness(0.97); }
        .ghost:hover { background: rgba(4,53,77,0.04) !important; }
        .tab-btn { transition: all 0.18s ease !important; }
      `}</style>

      {/* Logo */}
      <div style={{ marginBottom: '28px', animation: 'fadeUp 0.45s ease both' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, boxShadow: '0 3px 12px rgba(32,181,223,0.3), inset 0 1px 0 rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ico p={ICONS.heart} size={16} sw={1.25} color="#fff" />
          </div>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: '16px', color: T.navy, letterSpacing: '-0.035em' }}>Qarevo Health</span>
        </Link>
      </div>

      {!verified ? (
        <div style={{ width: '100%', maxWidth: '520px', animation: 'fadeUp 0.5s 0.04s ease both' }}>

          {/* Main card */}
          <div style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(36px) saturate(200%)',
            WebkitBackdropFilter: 'blur(36px) saturate(200%)',
            borderRadius: '28px',
            border: '1px solid rgba(255,255,255,0.92)',
            boxShadow: 'inset 0 1px 0 #fff, 0 2px 8px rgba(4,53,77,0.04), 0 16px 40px rgba(4,53,77,0.09), 0 48px 96px rgba(4,53,77,0.06)',
            padding: '44px 44px 40px',
            marginBottom: '14px',
          }}>
            <StepBar step={1} />

            {/* Illustration */}
            <div style={{ padding: '4px 0 28px' }}>
              <EnvelopeScene verified={false} />
            </div>

            {/* Headline */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', lineHeight: 1.18, margin: '0 0 10px' }}>
                Verify Your Email Address
              </h1>
              <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.72, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
                {"A verification email has been sent to"}
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 16px', borderRadius: '100px', background: T.blueLight, border: `1px solid ${T.blueMid}` }}>
                <Ico p={ICONS.ema} size={12} sw={1.75} color={T.blue} />
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: T.blue, letterSpacing: '-0.015em' }}>{m}</span>
              </div>
            </div>

            {!email && (
              <div role="alert" style={{ padding: '11px 13px', borderRadius: '12px', background: 'rgba(254,242,242,0.88)', border: '1px solid rgba(220,38,38,0.22)', color: T.red, fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                We could not find the email from your sign-up session. Please return to sign up and enter your email again.
              </div>
            )}

            {/* Tab switcher: link vs code */}
            <div style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '13px', background: 'rgba(4,53,77,0.05)', marginBottom: '24px' }}>
              {(['link', 'code'] as const).map(t => (
                <button key={t} className="tab-btn" onClick={() => setTab(t)} style={{
                  flex: 1, padding: '9px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: tab === t ? '#fff' : 'transparent',
                  boxShadow: tab === t ? '0 1px 6px rgba(4,53,77,0.1), inset 0 1px 0 rgba(255,255,255,0.9)' : 'none',
                  fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                  color: tab === t ? T.navy : T.slate2, letterSpacing: '-0.01em',
                }}>
                  {t === 'link' ? 'Verify via link' : 'Enter code manually'}
                </button>
              ))}
            </div>

            {/* Link tab */}
            {tab === 'link' && (
              <div>
                <p style={{ textAlign: 'center', fontSize: '13.5px', color: T.slate2, lineHeight: 1.68, margin: '0 0 20px', letterSpacing: '-0.01em' }}>
                  Click the secure verification link in your email to activate your Qarevo Health account. Your medical data remains protected until verification is complete.
                </p>

                {/* Open Email App */}
                <button className="pri-btn" onClick={() => setEmailModal(true)} style={{
                  width: '100%', padding: '14px 20px', borderRadius: '13px', border: 'none',
                  background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
                  color: '#fff', fontFamily: 'inherit', fontSize: '15px', fontWeight: 700,
                  letterSpacing: '-0.02em', cursor: 'pointer', marginBottom: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                  boxShadow: '0 3px 10px rgba(32,181,223,0.32), inset 0 1px 0 rgba(255,255,255,0.14)',
                }}>
                  <svg width="16" height="14" viewBox="0 0 20 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="1" width="18" height="16" rx="3"/><path d="M1 5l9 7 9-7"/>
                  </svg>
                  Open Email App
                  <Ico p={ICONS.arrowFwd} size={14} sw={2.2} />
                </button>

                <button type="button" onClick={() => setTab('code')} style={{
                  width: '100%', padding: '12px 20px', borderRadius: '13px',
                  border: `1.5px solid ${T.border}`,
                  background: 'rgba(4,53,77,0.03)',
                  color: T.navy, fontFamily: 'inherit', fontSize: '14px', fontWeight: 600,
                  letterSpacing: '-0.015em', cursor: 'pointer', marginBottom: '16px', textDecoration: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}>
                  <Ico p={ICONS.lock} size={13} sw={1.75} color={T.blue} />
                  Enter Verification Code
                </button>
              </div>
            )}

            {/* Code tab */}
            {tab === 'code' && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ textAlign: 'center', fontSize: '13.5px', color: T.slate2, lineHeight: 1.65, margin: '0 0 20px', letterSpacing: '-0.01em' }}>
                  Enter the 6-digit code from your verification email.
                </p>
                {email ? (
                  <OtpInput email={email} onComplete={() => setVerified(true)} />
                ) : (
                  <Link href="/auth/sign-up" style={{
                    width: '100%', padding: '12px 20px', borderRadius: '13px',
                    border: `1.5px solid ${T.border}`,
                    background: 'rgba(4,53,77,0.03)',
                    color: T.navy, fontFamily: 'inherit', fontSize: '14px', fontWeight: 600,
                    letterSpacing: '-0.015em', cursor: 'pointer', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}>
                    Return to Sign Up
                  </Link>
                )}
              </div>
            )}

            {/* Resend toast */}
            {resendOk && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', background: T.greenLight, border: `1px solid rgba(9,173,112,0.25)`, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', animation: 'slideToast 0.28s ease both', overflow: 'hidden' }}>
                <Ico p={ICONS.check} size={12} sw={2.5} color={T.green} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: T.teal, letterSpacing: '-0.01em' }}>New verification email sent. Check your inbox.</span>
              </div>
            )}

            {resendError && (
              <div role="alert" style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(254,242,242,0.88)', border: '1px solid rgba(220,38,38,0.22)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: T.red, fontSize: '13px', lineHeight: 1.45 }}>
                <Ico p={ICONS.info} size={12} sw={1.75} color={T.red} />
                <span>{resendError}</span>
              </div>
            )}

            {/* Resend + Change row */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="ghost" onClick={handleResend} disabled={!canResend} style={{
                flex: 1, padding: '10px 14px', borderRadius: '11px',
                border: `1.5px solid ${canResend ? T.border : 'rgba(4,53,77,0.06)'}`,
                background: 'transparent', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                color: canResend ? T.blue : T.slate2, cursor: canResend ? 'pointer' : 'not-allowed',
                letterSpacing: '-0.01em', transition: 'all 0.14s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}>
                {!canResend
                  ? <><span style={{ width: '11px', height: '11px', border: `1.5px solid ${T.slate2}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.9s linear infinite', display: 'inline-block', flexShrink: 0 }} />Resend in {secs}s</>
                  : <><Ico p={ICONS.arrowFwd} size={12} sw={2} />Resend Email</>}
              </button>
              <Link href="/auth/sign-up" style={{
                flex: 1, padding: '10px 14px', borderRadius: '11px',
                border: `1.5px solid ${T.border}`,
                background: 'transparent', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                color: T.slate, letterSpacing: '-0.01em', textDecoration: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}>
                <Ico p={ICONS.ema} size={12} sw={1.75} />
                Change Email
              </Link>
            </div>

          </div>

          {/* Help accordion */}
          <div style={{ marginBottom: '18px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 9px 4px' }}>Need help?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <TipRow
                icon={ICONS.search}
                title="Check your spam or junk folder"
                body="Verification emails can occasionally be filtered. Search for 'Qarevo Health' or 'noreply@qarevo.health' in all folders."
              />
              <TipRow
                icon={ICONS.ema}
                title="Is the email address correct?"
                body={email ? `Your link was sent to ${m}. If this is wrong, click Change Email above and re-enter your address.` : 'Return to sign up and enter your email again.'}
              />
              <TipRow
                icon={ICONS.info}
                title="Email not arrived after 5 minutes?"
                body="Contact our support team at support@qarevo.health. We respond within minutes during business hours."
              />
            </div>
          </div>

          {/* Trust strip */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '12px 20px' }}>
            {[
              { icon: ICONS.shield,   label: 'Secure verification'    },
              { icon: ICONS.lock,     label: 'End-to-end encrypted'   },
              { icon: ICONS.activity, label: 'HIPAA · GDPR compliant' },
              { icon: ICONS.brain,    label: 'Medical-grade privacy'  },
            ].map(({ icon, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Ico p={icon} size={11} sw={1.75} color={T.slate2} />
                <span style={{ fontSize: '11.5px', fontWeight: 500, color: T.slate2, letterSpacing: '-0.005em' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

      ) : (
        /* ── Verified ────────────────────────────────────────── */
        <div style={{ width: '100%', maxWidth: '480px', animation: 'fadeUp 0.45s ease both' }}>
          <div style={{
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(36px) saturate(200%)',
            WebkitBackdropFilter: 'blur(36px) saturate(200%)',
            borderRadius: '28px',
            border: '1px solid rgba(255,255,255,0.94)',
            boxShadow: 'inset 0 1px 0 #fff, 0 4px 16px rgba(4,53,77,0.06), 0 32px 72px rgba(4,53,77,0.1)',
            padding: '44px 44px 40px',
            textAlign: 'center',
          }}>
            <StepBar step={2} />

            {/* Success illustration */}
            <div style={{ marginBottom: '28px' }}>
              <EnvelopeScene verified={true} />
            </div>

            {/* Confirmed badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', borderRadius: '100px', background: T.greenLight, border: '1px solid rgba(9,173,112,0.25)', marginBottom: '18px', animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
              <Ico p={ICONS.check} size={10} sw={3} color={T.green} />
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: T.teal, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Email Verified</span>
            </div>

            <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', lineHeight: 1.2, margin: '0 0 10px' }}>
              Your account is now active
            </h1>
            <p style={{ fontSize: '14.5px', color: T.slate, lineHeight: 1.72, margin: '0 0 28px', letterSpacing: '-0.01em' }}>
              Welcome to Qarevo Health. Your patient portal is secured and fully activated. All medical records are protected with end-to-end encryption.
            </p>

            {/* CTA */}
            <button className="pri-btn" onClick={() => router.push('/auth/account-created')} style={{
              width: '100%', padding: '14px 20px', borderRadius: '13px', border: 'none',
              background: `linear-gradient(135deg, ${T.green} 0%, #07C268 100%)`,
              color: '#fff', fontFamily: 'inherit', fontSize: '15px', fontWeight: 700,
              letterSpacing: '-0.02em', cursor: 'pointer', marginBottom: '24px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 4px 14px rgba(9,173,112,0.38), inset 0 1px 0 rgba(255,255,255,0.16)',
            }}>
              Continue
              <Ico p={ICONS.arrowFwd} size={15} sw={2.2} />
            </button>

            {/* What's next */}
            <div style={{ paddingTop: '22px', borderTop: '1px solid rgba(4,53,77,0.06)' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px', textAlign: 'left' }}>{"What's next"}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {[
                  { icon: ICONS.steth,    label: 'Book a consultation',     sub: 'Connect with a verified specialist'     },
                  { icon: ICONS.activity, label: 'Review your health summary', sub: 'AI-powered clinical insights'         },
                  { icon: ICONS.shield,   label: 'Complete your profile',    sub: 'Secure your personal health information' },
                ].map(({ icon, label, sub }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 13px', borderRadius: '12px', background: 'rgba(4,53,77,0.024)', border: '1px solid rgba(4,53,77,0.06)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.14s ease' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: T.blueLight, border: `1px solid ${T.blueMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Ico p={icon} size={14} sw={1.75} color={T.blue} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.015em', marginBottom: '2px' }}>{label}</div>
                      <div style={{ fontSize: '12px', color: T.slate2, letterSpacing: '-0.005em' }}>{sub}</div>
                    </div>
                    <Ico p={ICONS.arrowFwd} size={12} sw={2} color={T.slate2} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <p style={{ textAlign: 'center', fontSize: '12px', color: T.slate2, marginTop: '22px', letterSpacing: '-0.005em', lineHeight: 1.5 }}>
        <Link href="/terms"   style={{ color: T.blue, fontWeight: 500, textDecoration: 'none' }}>Terms</Link>
        {' · '}
        <Link href="/privacy" style={{ color: T.blue, fontWeight: 500, textDecoration: 'none' }}>Privacy Policy</Link>
        {' · '}
        <Link href="/support" style={{ color: T.blue, fontWeight: 500, textDecoration: 'none' }}>Support</Link>
      </p>

      {/* Email modal */}
      {emailModal && (
        <div onClick={() => setEmailModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(4,53,77,0.42)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
            borderRadius: '22px', border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: '0 8px 32px rgba(4,53,77,0.16), 0 40px 90px rgba(4,53,77,0.12)',
            padding: '36px 32px 28px', maxWidth: '348px', width: '100%', textAlign: 'center',
            animation: 'popIn 0.32s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '15px', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, boxShadow: '0 4px 18px rgba(32,181,223,0.34)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <svg width="24" height="22" viewBox="0 0 24 22" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="1" width="22" height="18" rx="3.5"/>
                <path d="M1 5.5l11 8 11-8"/>
              </svg>
            </div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em', margin: '0 0 8px' }}>Open your inbox</h2>
            <p style={{ fontSize: '13.5px', color: T.slate, lineHeight: 1.65, margin: '0 0 22px', letterSpacing: '-0.01em' }}>
              {'Look for an email from '}
              <strong style={{ color: T.navy }}>noreply@qarevo.health</strong>
              {' — subject: "Confirm your Qarevo Health account".'}
            </p>
            {[
              { label: 'Open Gmail',   href: 'https://mail.google.com'  },
              { label: 'Open Outlook', href: 'https://outlook.live.com' },
            ].map(({ label, href }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer noopener" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                padding: '11px 16px', borderRadius: '11px', marginBottom: '8px',
                background: '#fff', border: `1.5px solid rgba(4,53,77,0.09)`,
                color: T.navy, textDecoration: 'none', fontSize: '13.5px', fontWeight: 600,
                letterSpacing: '-0.01em', boxShadow: Sh.inner,
              }}>
                {label}
                <Ico p={ICONS.arrowFwd} size={12} sw={2} color={T.slate2} />
              </a>
            ))}
            <button onClick={() => setEmailModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: T.slate2, fontFamily: 'inherit', letterSpacing: '-0.01em', padding: '8px 12px', marginTop: '4px' }}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

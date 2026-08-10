'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { T, Sh, PAGE_BG } from '@/lib/tokens'
import { setAuthenticatedOnboardingStage } from '@/lib/auth-flow'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'

// ─── Config ────────────────────────────────────────────────────────────────────
const DEMO_CODE     = '847291'
const DEMO_EMAIL    = 'emma.harrison@gmail.com'
const DEMO_PHONE    = '+44 ••• ••• 4821'
const RESEND_SECS   = 60
const MAX_ATTEMPTS  = 3

type VerifyMode = 'email' | 'phone'
type ErrorKind  = 'invalid' | 'expired' | 'network' | 'toomany' | null

// ─── Countdown ─────────────────────────────────────────────────────────────────
function useCountdown(initial: number) {
  const [secs, setSecs] = useState(initial)
  const [running, setRunning] = useState(true)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!running) return
    ref.current = setInterval(() => {
      setSecs(s => {
        if (s <= 1) { setRunning(false); return 0 }
        return s - 1
      })
    }, 1000)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [running])

  const restart = (n = initial) => { setSecs(n); setRunning(true) }
  return { secs, expired: !running, restart }
}

// ─── Shield + shield rings illustration ────────────────────────────────────────
function SecurityIllustration({ state }: { state: 'idle' | 'success' | 'error' }) {
  const [pulse, setPulse] = useState(false)
  const [scanLine, setScanLine] = useState(0)

  useEffect(() => {
    const t1 = setInterval(() => setPulse(p => !p), 2200)
    const t2 = setInterval(() => setScanLine(l => (l + 1) % 100), 30)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [])

  const coreColor  = state === 'success' ? T.green   : state === 'error' ? T.red   : T.blue
  const glowColor  = state === 'success' ? 'rgba(9,173,112,0.28)'  : state === 'error' ? 'rgba(220,38,38,0.22)' : 'rgba(32,181,223,0.24)'
  const ringColor  = state === 'success' ? 'rgba(9,173,112,0.14)'  : state === 'error' ? 'rgba(220,38,38,0.12)' : 'rgba(32,181,223,0.1)'

  return (
    <div style={{ position: 'relative', width: '220px', height: '220px', margin: '0 auto', userSelect: 'none' }}>

      {/* Mesh rings */}
      {[0, 26, 52, 78].map((inset, i) => (
        <div key={i} style={{
          position: 'absolute', inset, borderRadius: '50%',
          border: `1px solid ${ringColor}`,
          opacity: 1 - i * 0.18,
          transform: `scale(${pulse && i === 1 ? 1.04 : 1})`,
          transition: 'transform 1.1s cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      ))}

      {/* Outer glow halo */}
      <div style={{
        position: 'absolute', inset: '26px', borderRadius: '50%',
        background: `radial-gradient(circle at 50% 50%, ${glowColor} 0%, transparent 68%)`,
        transition: 'background 0.6s ease',
      }} />

      {/* Shield shape */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -52%)',
        filter: `drop-shadow(0 10px 24px ${glowColor}) drop-shadow(0 2px 6px ${glowColor})`,
        transition: 'filter 0.5s ease',
      }}>
        <svg width="82" height="92" viewBox="0 0 82 92" fill="none">
          {/* Shield body */}
          <path
            d="M41 4L8 16V44C8 62.6 22.8 79.8 41 84C59.2 79.8 74 62.6 74 44V16L41 4Z"
            fill={`url(#shieldGrad_${state})`}
            stroke={`${coreColor}55`}
            strokeWidth="1.5"
          />
          {/* Inner highlight */}
          <path
            d="M41 10L14 20V44C14 59.8 26.6 74.6 41 78.4C55.4 74.6 68 59.8 68 44V20L41 10Z"
            fill={`url(#shieldInner_${state})`}
            opacity="0.6"
          />
          {/* Scan line */}
          {state === 'idle' && (
            <line
              x1="12" x2="70"
              y1={14 + (scanLine / 100) * 64} y2={14 + (scanLine / 100) * 64}
              stroke={`${coreColor}40`} strokeWidth="1" strokeLinecap="round"
              style={{ clipPath: 'inset(0 0 0 0 round 0 0 20px 20px)' }}
            />
          )}
          {/* Icon inside shield */}
          {state === 'success' ? (
            <polyline points="28,46 38,56 56,36" stroke="rgba(165,224,218,0.95)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          ) : state === 'error' ? (
            <>
              <line x1="32" y1="34" x2="50" y2="54" stroke="rgba(248,113,113,0.9)" strokeWidth="3.5" strokeLinecap="round"/>
              <line x1="50" y1="34" x2="32" y2="54" stroke="rgba(248,113,113,0.9)" strokeWidth="3.5" strokeLinecap="round"/>
            </>
          ) : (
            <>
              <rect x="32" y="34" width="18" height="14" rx="3" stroke="rgba(147,197,253,0.85)" strokeWidth="1.8" fill="none"/>
              <rect x="37" y="30" width="8" height="8" rx="4" stroke="rgba(147,197,253,0.6)" strokeWidth="1.6" fill="none"/>
              <circle cx="41" cy="42" r="2" fill="rgba(147,197,253,0.9)"/>
              <line x1="41" y1="44" x2="41" y2="46" stroke="rgba(147,197,253,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
            </>
          )}
          <defs>
            <linearGradient id={`shieldGrad_${state}`} x1="8" y1="4" x2="74" y2="84" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={coreColor} stopOpacity="0.18"/>
              <stop offset="100%" stopColor={coreColor} stopOpacity="0.07"/>
            </linearGradient>
            <linearGradient id={`shieldInner_${state}`} x1="14" y1="10" x2="68" y2="78" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="white" stopOpacity="0.22"/>
              <stop offset="100%" stopColor="white" stopOpacity="0.04"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Orbit trust chips */}
      {[
        { angle: 315, icon: ICONS.lock,     bg: 'rgba(32,181,223,0.08)',  bdr: 'rgba(32,181,223,0.18)',  delay: '0s'    },
        { angle: 45,  icon: ICONS.shield,   bg: 'rgba(32,181,223,0.08)',  bdr: 'rgba(32,181,223,0.18)',  delay: '0.6s'  },
        { angle: 225, icon: ICONS.activity, bg: 'rgba(9,173,112,0.08)',  bdr: 'rgba(9,173,112,0.18)',  delay: '1.1s'  },
        { angle: 135, icon: ICONS.check,    bg: 'rgba(52,140,234,0.08)', bdr: 'rgba(52,140,234,0.18)', delay: '0.35s' },
      ].map(({ angle, icon, bg, bdr, delay }) => {
        const r = 92, rad = (angle - 90) * Math.PI / 180
        const cx = 110 + r * Math.cos(rad), cy = 110 + r * Math.sin(rad)
        return (
          <div key={angle} style={{
            position: 'absolute', left: cx - 17, top: cy - 17,
            width: '34px', height: '34px', borderRadius: '10px',
            background: bg, border: `1px solid ${bdr}`,
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 2px 10px rgba(4,53,77,0.07), inset 0 1px 0 rgba(255,255,255,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: `floatChip 3.8s ease-in-out ${delay} infinite`,
          }}>
            <Ico p={icon} size={14} sw={1.75} color={state === 'success' ? T.green : state === 'error' ? T.red : T.blue} />
          </div>
        )
      })}

      {/* ECG baseline */}
      <svg viewBox="0 0 220 12" style={{ position: 'absolute', bottom: '2px', left: 0, width: '100%', opacity: 0.28 }}>
        <polyline
          points="0,6 40,6 52,1 58,11 64,1 70,11 80,6 220,6"
          fill="none"
          stroke={coreColor}
          strokeWidth="1.3"
          strokeLinecap="round" strokeLinejoin="round"
        />
        <circle cx="70" cy="11" r="1.8" fill={coreColor}/>
      </svg>
    </div>
  )
}

// ─── Progress bar ──────────────────────────────────────────────────────────────
function StepBar({ step }: { step: 0 | 1 | 2 }) {
  const steps = ['Account Created', 'Verify Identity', 'All Set']
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginBottom: '32px' }}>
      {steps.map((label, i) => {
        const done = i < step, active = i === step
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: done ? T.green : active ? T.blue : 'rgba(4,53,77,0.05)',
                border: `2px solid ${done ? T.green : active ? T.blue : 'rgba(4,53,77,0.1)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                boxShadow: active ? '0 0 0 4px rgba(32,181,223,0.1)' : done ? '0 0 0 3px rgba(9,173,112,0.1)' : 'none',
                transition: 'all 0.35s ease',
              }}>
                {done
                  ? <Ico p={ICONS.check} size={11} sw={3} color="#fff" />
                  : <span style={{ fontSize: '11px', fontWeight: 700, color: active ? '#fff' : T.slate2 }}>{i + 1}</span>}
              </div>
              <span style={{ fontSize: '10.5px', fontWeight: done || active ? 600 : 400, color: done ? T.green : active ? T.blue : T.slate2, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: '48px', height: '2px', margin: '13px 5px 0', borderRadius: '2px', background: done ? T.green : 'rgba(4,53,77,0.07)', transition: 'background 0.4s ease', flexShrink: 0 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── OTP cells ─────────────────────────────────────────────────────────────────
interface OtpProps {
  value: string[]
  onChange: (v: string[]) => void
  onComplete: (code: string) => void
  error: boolean
  success: boolean
  disabled: boolean
}

function OtpCells({ value, onChange, onComplete, error, success, disabled }: OtpProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { inputs.current[0]?.focus() }, [])

  const update = (i: number, digit: string) => {
    const next = [...value]
    next[i] = digit
    onChange(next)
    if (digit && i < 5) {
      inputs.current[i + 1]?.focus()
    }
    if (next.every(d => d !== '')) {
      onComplete(next.join(''))
    }
  }

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    update(i, digit)
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[i]) {
        update(i, '')
      } else if (i > 0) {
        update(i - 1, '')
        inputs.current[i - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < 5) {
      inputs.current[i + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = ['', '', '', '', '', '']
    digits.split('').forEach((d, i) => { next[i] = d })
    onChange(next)
    const focusIdx = Math.min(digits.length, 5)
    inputs.current[focusIdx]?.focus()
    if (digits.length === 6) onComplete(digits)
  }

  const cellStyle = (i: number): React.CSSProperties => {
    const filled   = value[i] !== ''
    const isActive = !disabled && (filled || value.findIndex(d => d === '') === i)
    return {
      width: '54px', height: '62px',
      textAlign: 'center', fontSize: '24px', fontWeight: 800,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      color: error ? T.red : success ? T.green : T.navy,
      borderRadius: '14px',
      border: `2px solid ${
        error   ? 'rgba(220,38,38,0.45)'  :
        success ? 'rgba(9,173,112,0.5)'   :
        filled  ? 'rgba(32,181,223,0.45)'  :
        isActive ? 'rgba(32,181,223,0.28)' : 'rgba(4,53,77,0.1)'
      }`,
      background: error   ? 'rgba(254,242,242,0.9)' :
                  success ? 'rgba(240,253,248,0.9)'  :
                  filled  ? 'rgba(234,241,255,0.9)'  : 'rgba(255,255,255,0.75)',
      outline: 'none',
      boxShadow: isActive && !error && !success
        ? '0 0 0 4px rgba(32,181,223,0.08), inset 0 1px 0 rgba(255,255,255,0.8)'
        : filled ? 'inset 0 1px 0 rgba(255,255,255,0.8)' : 'none',
      transition: 'all 0.15s ease',
      caretColor: T.blue,
      cursor: disabled ? 'not-allowed' : 'text',
      opacity: disabled ? 0.55 : 1,
      letterSpacing: 0,
    }
  }

  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }} onPaste={handlePaste}>
      {value.map((v, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={v}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          style={cellStyle(i)}
          aria-label={`Digit ${i + 1} of 6`}
        />
      ))}
    </div>
  )
}

// ─── Error banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ kind, onDismiss }: { kind: ErrorKind; onDismiss: () => void }) {
  if (!kind) return null
  const map: Record<NonNullable<ErrorKind>, { icon: string | readonly string[]; title: string; body: string; color: string; bg: string; bdr: string }> = {
    invalid: {
      icon: ICONS.info, title: 'Incorrect code',
      body: 'The code you entered does not match. Please check your email and try again.',
      color: T.red, bg: 'rgba(254,242,242,0.9)', bdr: 'rgba(220,38,38,0.22)',
    },
    expired: {
      icon: ICONS.info, title: 'Code expired',
      body: 'Your verification code has expired. Request a new one using the Resend button below.',
      color: T.amber, bg: 'rgba(255,251,235,0.9)', bdr: 'rgba(217,119,6,0.22)',
    },
    network: {
      icon: ICONS.activity, title: 'Connection error',
      body: 'We could not reach our servers. Please check your connection and try again.',
      color: T.slate, bg: 'rgba(248,250,252,0.95)', bdr: 'rgba(4,53,77,0.12)',
    },
    toomany: {
      icon: ICONS.shield, title: 'Too many attempts',
      body: 'For your security, this code has been invalidated. Please request a new code.',
      color: T.red, bg: 'rgba(254,242,242,0.9)', bdr: 'rgba(220,38,38,0.22)',
    },
  }
  const e = map[kind]
  return (
    <div style={{
      display: 'flex', gap: '10px', alignItems: 'flex-start',
      padding: '13px 14px', borderRadius: '12px',
      background: e.bg, border: `1px solid ${e.bdr}`,
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      animation: 'shakeIn 0.38s ease both',
    }}>
      <div style={{ flexShrink: 0, marginTop: '1px' }}>
        <Ico p={e.icon} size={14} sw={1.75} color={e.color} />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: e.color, letterSpacing: '-0.01em' }}>{e.title}</p>
        <p style={{ margin: 0, fontSize: '12.5px', color: T.slate, lineHeight: 1.55, letterSpacing: '-0.005em' }}>{e.body}</p>
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.slate2, padding: '2px', flexShrink: 0, display: 'flex' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
        </svg>
      </button>
    </div>
  )
}

// ─── Destination chip ──────────────────────────────────────────────────────────
function DestChip({ mode, onSwitch }: { mode: VerifyMode; onSwitch: () => void }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0', borderRadius: '100px', background: T.blueLight, border: `1px solid ${T.blueMid}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 13px' }}>
        <Ico p={mode === 'email' ? ICONS.ema : ICONS.activity} size={11} sw={1.75} color={T.blue} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: T.blue, letterSpacing: '-0.01em', fontFamily: 'monospace' }}>
          {mode === 'email' ? 'em•••@gmail.com' : DEMO_PHONE}
        </span>
      </div>
      <button onClick={onSwitch} style={{ padding: '6px 11px 6px 6px', background: 'none', border: 'none', borderLeft: `1px solid ${T.blueMid}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600, color: T.blue, letterSpacing: '-0.01em' }}>
        Change
        <Ico p={ICONS.arrowFwd} size={10} sw={2} color={T.blue} />
      </button>
    </div>
  )
}

// ─── Timer ring ────────────────────────────────────────────────────────────────
function TimerRing({ secs, total }: { secs: number; total: number }) {
  const r = 18, c = 2 * Math.PI * r
  const progress = (secs / total) * c
  const color = secs > 20 ? T.blue : secs > 8 ? T.amber : T.red
  return (
    <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
      <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(4,53,77,0.07)" strokeWidth="3"/>
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${progress} ${c}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s linear, stroke 0.3s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 800, color, letterSpacing: '-0.02em', lineHeight: 1, transition: 'color 0.3s ease' }}>{secs}</span>
        <span style={{ fontSize: '8px', fontWeight: 500, color: T.slate2, letterSpacing: '0.02em', textTransform: 'uppercase' }}>sec</span>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function OtpPage() {
  const router = useRouter()
  const { secs, expired, restart } = useCountdown(RESEND_SECS)
  const [digits,    setDigits]    = useState(['', '', '', '', '', ''])
  const [mode,      setMode]      = useState<VerifyMode>('email')
  const [errorKind, setErrorKind] = useState<ErrorKind>(null)
  const [attempts,  setAttempts]  = useState(0)
  const [verified,  setVerified]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [resendOk,  setResendOk]  = useState(false)

  const filled     = digits.every(d => d !== '')
  const tooMany    = attempts >= MAX_ATTEMPTS
  const illState   = verified ? 'success' : errorKind ? 'error' : 'idle'

  const handleComplete = useCallback((code: string) => {
    if (tooMany) { setErrorKind('toomany'); return }
    setLoading(true)
    setErrorKind(null)
    setTimeout(() => {
      setLoading(false)
      if (code === DEMO_CODE) {
        setVerified(true)
        setAuthenticatedOnboardingStage('account-created')
        setTimeout(() => router.push('/auth/account-created'), 1800)
      } else if (expired) {
        setErrorKind('expired')
        setDigits(['', '', '', '', '', ''])
      } else {
        const next = attempts + 1
        setAttempts(next)
        if (next >= MAX_ATTEMPTS) {
          setErrorKind('toomany')
        } else {
          setErrorKind('invalid')
        }
        setDigits(['', '', '', '', '', ''])
      }
    }, 800)
  }, [attempts, expired, tooMany, router])

  const handleVerify = () => {
    if (!filled || loading || tooMany) return
    handleComplete(digits.join(''))
  }

  const handleResend = () => {
    if (!expired || loading) return
    setAttempts(0)
    setErrorKind(null)
    setDigits(['', '', '', '', '', ''])
    setResendOk(true)
    restart(RESEND_SECS)
    setTimeout(() => setResendOk(false), 4000)
  }

  const switchMode = () => {
    setMode(m => m === 'email' ? 'phone' : 'email')
    setDigits(['', '', '', '', '', ''])
    setErrorKind(null)
    setAttempts(0)
  }

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px 56px' }}>
      <style>{`
        * { box-sizing: border-box; }
        input { -webkit-tap-highlight-color: transparent; }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes popIn    { 0% { opacity:0; transform:scale(0.76); } 65% { transform:scale(1.06); } 100% { opacity:1; transform:scale(1); } }
        @keyframes shakeIn  { 0%,100% { transform:translateX(0); opacity:1; } 0% { opacity:0; transform:translateX(-8px); } 15%,45%,75% { transform:translateX(-4px); } 30%,60%,90% { transform:translateX(4px); } }
        @keyframes floatChip { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-5px); } }
        @keyframes successPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(9,173,112,0.3); } 50% { box-shadow: 0 0 0 12px rgba(9,173,112,0); } }
        @keyframes spin     { to { transform:rotate(360deg); } }
        @keyframes slideIn  { from { opacity:0; transform:translateY(-5px); } to { opacity:1; transform:translateY(0); } }
        .pri-btn { transition: all 0.14s ease !important; }
        .pri-btn:not(:disabled):hover { filter:brightness(1.06); transform:translateY(-1px); }
        .pri-btn:not(:disabled):active { transform:translateY(0); filter:brightness(0.97); }
        .ghost:hover { background:rgba(4,53,77,0.04) !important; }
      `}</style>

      {/* Logo */}
      <div style={{ marginBottom: '28px', animation: 'fadeUp 0.4s ease both' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} aria-label='Qarevo Health home'>
          <Image
            src='/brand/Untitled design - 2026-08-03T165058.603.png'
            alt='Qarevo Health'
            width={160}
            height={34}
            priority
            unoptimized
            style={{ width: '160px', height: 'auto' }}
          />
        </Link>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: '480px',
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(36px) saturate(200%)',
        WebkitBackdropFilter: 'blur(36px) saturate(200%)',
        borderRadius: '28px',
        border: '1px solid rgba(255,255,255,0.94)',
        boxShadow: 'inset 0 1px 0 #fff, 0 2px 8px rgba(4,53,77,0.04), 0 16px 48px rgba(4,53,77,0.1), 0 56px 96px rgba(4,53,77,0.06)',
        padding: '44px 44px 40px',
        marginBottom: '16px',
        animation: 'fadeUp 0.48s 0.04s ease both',
      }}>

        <StepBar step={1} />

        {/* Illustration */}
        <div style={{ padding: '0 0 24px' }}>
          <SecurityIllustration state={illState} />
        </div>

        {/* Success overlay */}
        {verified ? (
          <div style={{ textAlign: 'center', animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 14px', borderRadius: '100px', background: 'rgba(9,173,112,0.1)', border: '1px solid rgba(9,173,112,0.25)', marginBottom: '16px' }}>
              <Ico p={ICONS.check} size={10} sw={3} color={T.green} />
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: T.teal, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Identity Confirmed</span>
            </div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '22px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', margin: '0 0 10px' }}>
              Verification successful
            </h1>
            <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.7, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
              Your identity has been confirmed. Redirecting you now…
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '20px', color: T.slate2 }}>
              <span style={{ width: '14px', height: '14px', border: `2px solid ${T.green}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              <span style={{ fontSize: '13px', fontWeight: 500, letterSpacing: '-0.01em' }}>Taking you to your account…</span>
            </div>
          </div>
        ) : (
          <>
            {/* Headline */}
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '23px', fontWeight: 800, color: T.navy, letterSpacing: '-0.035em', lineHeight: 1.2, margin: '0 0 10px' }}>
                Verify Your Identity
              </h1>
              <p style={{ fontSize: '14px', color: T.slate, lineHeight: 1.7, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
                {mode === 'email'
                  ? "We've sent a 6-digit security code to your email."
                  : "We've sent a 6-digit security code to your phone."}
              </p>
              <DestChip mode={mode} onSwitch={switchMode} />
            </div>

            {/* Error banner */}
            {errorKind && (
              <div style={{ marginBottom: '16px' }}>
                <ErrorBanner kind={errorKind} onDismiss={() => setErrorKind(null)} />
              </div>
            )}

            {/* Resend toast */}
            {resendOk && (
              <div style={{ padding: '10px 14px', borderRadius: '11px', background: 'rgba(235,248,245,0.9)', border: '1px solid rgba(9,173,112,0.25)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', animation: 'slideIn 0.28s ease both' }}>
                <Ico p={ICONS.check} size={12} sw={2.5} color={T.green} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: T.teal, letterSpacing: '-0.01em' }}>
                  New code sent. Check your {mode === 'email' ? 'inbox' : 'messages'}.
                </span>
              </div>
            )}

            {/* OTP + timer row */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: T.slate2, letterSpacing: '-0.01em' }}>
                  Enter 6-digit code
                </span>
                {!expired
                  ? <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: T.slate2, letterSpacing: '-0.01em' }}>Expires in</span>
                      <TimerRing secs={secs} total={RESEND_SECS} />
                    </div>
                  : <span style={{ fontSize: '12px', fontWeight: 600, color: T.red, letterSpacing: '-0.01em' }}>Code expired</span>}
              </div>
              <OtpCells
                value={digits}
                onChange={setDigits}
                onComplete={handleComplete}
                error={!!errorKind && errorKind !== 'network'}
                success={verified}
                disabled={loading || tooMany || verified}
              />
              {attempts > 0 && !tooMany && (
                <p style={{ textAlign: 'center', fontSize: '12px', color: T.amber, marginTop: '8px', letterSpacing: '-0.005em', fontWeight: 500 }}>
                  {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} remaining
                </p>
              )}
              {/* Demo hint */}
              <p style={{ textAlign: 'center', fontSize: '11.5px', color: T.slate2, margin: '8px 0 0', letterSpacing: '-0.005em' }}>
                {'Demo code: '}
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: T.blue, letterSpacing: '0.1em' }}>{DEMO_CODE}</span>
              </p>
            </div>

            {/* Verify CTA */}
            <button
              className="pri-btn"
              onClick={handleVerify}
              disabled={!filled || loading || tooMany}
              style={{
                width: '100%', padding: '14px 20px', borderRadius: '13px', border: 'none',
                background: !filled || tooMany
                  ? 'rgba(4,53,77,0.06)'
                  : `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
                color: !filled || tooMany ? T.slate2 : '#fff',
                fontFamily: 'inherit', fontSize: '15px', fontWeight: 700,
                letterSpacing: '-0.02em',
                cursor: !filled || loading || tooMany ? 'not-allowed' : 'pointer',
                marginBottom: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: filled && !tooMany ? '0 3px 10px rgba(32,181,223,0.3), inset 0 1px 0 rgba(255,255,255,0.14)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {loading
                ? <><span style={{ width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />Verifying…</>
                : <>Verify Code <Ico p={ICONS.arrowFwd} size={14} sw={2.2} /></>}
            </button>

            {/* Back */}
            <Link href="/auth/verify-email" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '12px', borderRadius: '13px',
              border: `1.5px solid ${T.border}`,
              background: 'transparent', fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 600,
              color: T.slate, letterSpacing: '-0.01em', textDecoration: 'none',
              transition: 'all 0.14s ease',
            }}>
              <Ico p={ICONS.arrowSm} size={13} sw={2} style={{ transform: 'rotate(180deg)' }} />
              Back to Email Verification
            </Link>

            {/* Resend row */}
            <div style={{ marginTop: '22px', paddingTop: '20px', borderTop: '1px solid rgba(4,53,77,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: T.slate2, letterSpacing: '-0.01em' }}>
                {"Didn't receive the code?"}
              </p>
              <button
                className="ghost"
                onClick={handleResend}
                disabled={!expired || loading}
                style={{
                  background: 'transparent', border: 'none', cursor: expired && !loading ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 700,
                  color: expired && !loading ? T.blue : T.slate2,
                  letterSpacing: '-0.01em', padding: '6px 14px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'all 0.14s ease',
                }}
              >
                {!expired
                  ? <><span style={{ width: '12px', height: '12px', border: `1.5px solid ${T.slate2}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.9s linear infinite', display: 'inline-block' }} />Resend in {secs}s</>
                  : <><Ico p={ICONS.arrowFwd} size={13} sw={2} />Resend Code</>}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Trust strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '10px 18px', animation: 'fadeUp 0.5s 0.1s ease both' }}>
        {[
          { icon: ICONS.shield,   label: 'Identity-verified access'    },
          { icon: ICONS.lock,     label: 'End-to-end encrypted'        },
          { icon: ICONS.activity, label: 'HIPAA · GDPR compliant'      },
          { icon: ICONS.brain,    label: 'Medical-grade security'      },
        ].map(({ icon, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Ico p={icon} size={11} sw={1.75} color={T.slate2} />
            <span style={{ fontSize: '11.5px', fontWeight: 500, color: T.slate2, letterSpacing: '-0.005em' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <p style={{ textAlign: 'center', fontSize: '12px', color: T.slate2, marginTop: '18px', letterSpacing: '-0.005em', lineHeight: 1.5 }}>
        <Link href="/terms"   style={{ color: T.blue, fontWeight: 500, textDecoration: 'none' }}>Terms</Link>
        {' · '}
        <Link href="/privacy" style={{ color: T.blue, fontWeight: 500, textDecoration: 'none' }}>Privacy Policy</Link>
        {' · '}
        <Link href="/support" style={{ color: T.blue, fontWeight: 500, textDecoration: 'none' }}>Support</Link>
      </p>
    </div>
  )
}

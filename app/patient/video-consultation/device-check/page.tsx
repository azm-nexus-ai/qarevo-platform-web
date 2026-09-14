'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { T, Sh, Glass } from '@/lib/tokens'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import PatientPortalShell from '@/components/patient/PatientPortalShell'

// ─── Types ───────────────────────────────────────────────────────────────────

type TestPhase = 'idle' | 'running' | 'success' | 'failure'

type StepId = 'camera' | 'microphone' | 'speakers' | 'connection'

type TestStep = {
  id: StepId
  label: string
  icon: string | readonly string[]
  status: 'pending' | 'checking' | 'pass' | 'fail'
  detail: string
}

type TroubleshootItem = {
  title: string
  body: string
  detail: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const troubleshootingItems: TroubleshootItem[] = [
  { title: 'Camera not detected', body: 'Check your browser camera permissions and ensure the device is not in use by another app.', detail: 'Try refreshing the page and selecting a different camera source.' },
  { title: 'Microphone not working', body: 'Confirm your browser has microphone access and your device is not muted.', detail: 'Try another input source or reconnect a headset.' },
  { title: 'Poor internet connection', body: 'Move closer to your router or switch to a more stable network.', detail: 'Close bandwidth-heavy apps to improve call quality.' },
  { title: 'Browser not supported', body: 'Use the latest version of Chrome, Edge, or Safari for best compatibility.', detail: 'Disable extensions that may block camera or microphone access.' },
]

const INITIAL_STEPS: TestStep[] = [
  { id: 'camera',     label: 'Camera',      icon: ICONS.video,     status: 'pending', detail: '' },
  { id: 'microphone', label: 'Microphone',   icon: ['M12 5a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0V8a3 3 0 0 1 3-3z', 'M7 10a5 5 0 0 0 10 0', 'M12 15v4', 'M8 19h8'],  status: 'pending', detail: '' },
  { id: 'speakers',   label: 'Speakers',    icon: ['M11 5a1 1 0 0 1 1.62-.78l4.67 3.75A1 1 0 0 1 17 9H4a1 1 0 0 1-.29-1.96L11 5z', 'M13.5 9.5v5', 'M16.5 7.5v9'],  status: 'pending', detail: '' },
  { id: 'connection', label: 'Connection',  icon: ICONS.activity,  status: 'pending', detail: '' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Subcomponents ────────────────────────────────────────────────────────────

/** Simulated camera preview — no real camera access */
function CameraPreview({ phase }: { phase: TestPhase }) {
  const [scanLine, setScanLine] = useState(0)

  useEffect(() => {
    if (phase !== 'running') return
    const timer = window.setInterval(() => setScanLine((v) => (v + 2) % 100), 30)
    return () => window.clearInterval(timer)
  }, [phase])

  if (phase === 'idle') {
    return (
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '20px', background: 'linear-gradient(135deg, #061826 0%, #0a2236 100%)', border: '1px solid rgba(4,53,77,0.18)', aspectRatio: '16/9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '18px', display: 'grid', placeItems: 'center', background: 'rgba(32,181,223,0.12)', border: '1px solid rgba(32,181,223,0.2)' }}>
          <Ico p={ICONS.video} size={22} sw={1.6} color="rgba(32,181,223,0.7)" />
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, textAlign: 'center', maxWidth: '220px', lineHeight: 1.5 }}>
          Run device test to preview your camera
        </p>
      </div>
    )
  }

  if (phase === 'running') {
    return (
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '20px', background: 'linear-gradient(135deg, #061826 0%, #0a2236 100%)', border: '1px solid rgba(32,181,223,0.22)', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Scan line */}
        <div style={{ position: 'absolute', left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, rgba(32,181,223,0.8), transparent)', top: `${scanLine}%`, transition: 'top 0.03s linear', zIndex: 2, pointerEvents: 'none' }} />
        {/* Grid overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(32,181,223,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(32,181,223,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', zIndex: 1 }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '999px', border: '2px solid rgba(32,181,223,0.3)', borderTopColor: T.blue, animation: 'dc-spin 0.8s linear infinite' }} />
          <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: 700, letterSpacing: '0.04em' }}>Scanning camera…</p>
        </div>
        <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', background: 'rgba(32,181,223,0.18)', border: '1px solid rgba(32,181,223,0.28)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: T.blue, animation: 'dc-pulse 1s ease-in-out infinite' }} />
          <span style={{ fontSize: '10px', fontWeight: 700, color: T.blue, letterSpacing: '0.06em' }}>CHECKING</span>
        </div>
      </div>
    )
  }

  if (phase === 'success') {
    return (
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(4,53,77,0.88) 0%, rgba(32,181,223,0.55) 100%)', border: '1px solid rgba(32,181,223,0.28)', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Subtle bokeh background */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 40%, rgba(32,181,223,0.18), transparent 50%), radial-gradient(circle at 70% 60%, rgba(52,140,234,0.14), transparent 44%)', pointerEvents: 'none' }} />
        {/* Patient avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', zIndex: 1 }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.1))', border: '1px solid rgba(255,255,255,0.26)', display: 'grid', placeItems: 'center', boxShadow: '0 8px 24px rgba(4,53,77,0.3)' }}>
            <Ico p={ICONS.user} size={28} sw={1.6} color="rgba(255,255,255,0.9)" />
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.82)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Your preview</div>
        </div>
        {/* HD badge — top-left */}
        <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)', boxShadow: Sh.inner }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '999px', background: T.green }} />
          <span style={{ fontSize: '10px', fontWeight: 700, color: T.navy }}>HD Preview · Ready</span>
        </div>
        {/* Camera label — bottom-right */}
        <div style={{ position: 'absolute', right: '12px', bottom: '12px', padding: '5px 10px', borderRadius: '999px', background: 'rgba(4,53,77,0.78)', color: '#fff', fontSize: '10px', fontWeight: 700 }}>
          Camera 1 · 720p
        </div>
        {/* Mirror label — bottom-left */}
        <div style={{ position: 'absolute', left: '12px', bottom: '12px', padding: '5px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '10px', fontWeight: 700 }}>
          Mirror mode
        </div>
      </div>
    )
  }

  // failure
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '20px', background: 'linear-gradient(135deg, #1a0808 0%, #200f0f 100%)', border: '1px solid rgba(220,38,38,0.2)', aspectRatio: '16/9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
      <div style={{ width: '52px', height: '52px', borderRadius: '18px', display: 'grid', placeItems: 'center', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.2)' }}>
        <Ico p={ICONS.video} size={20} sw={1.6} color="rgba(220,38,38,0.7)" />
      </div>
      <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Camera check required</p>
    </div>
  )
}

/** Step status icon */
function StepStatusIcon({ status }: { status: TestStep['status'] }) {
  if (status === 'checking') {
    return <div style={{ width: '18px', height: '18px', borderRadius: '999px', border: '2px solid rgba(32,181,223,0.3)', borderTopColor: T.blue, animation: 'dc-spin 0.8s linear infinite', flexShrink: 0 }} />
  }
  if (status === 'pass') {
    return (
      <div style={{ width: '22px', height: '22px', borderRadius: '8px', display: 'grid', placeItems: 'center', background: 'rgba(16,185,129,0.14)', flexShrink: 0 }}>
        <Ico p={ICONS.check} size={11} sw={2.6} color={T.green} />
      </div>
    )
  }
  if (status === 'fail') {
    return (
      <div style={{ width: '22px', height: '22px', borderRadius: '8px', display: 'grid', placeItems: 'center', background: 'rgba(245,158,11,0.14)', flexShrink: 0 }}>
        <Ico p={['M12 9v4', 'M12 17h.01']} size={11} sw={2.4} color={T.amber} />
      </div>
    )
  }
  // pending
  return <div style={{ width: '22px', height: '22px', borderRadius: '8px', background: 'rgba(4,53,77,0.07)', border: '1px solid rgba(4,53,77,0.1)', flexShrink: 0 }} />
}

// ─── Right rail content ───────────────────────────────────────────────────────

interface RightRailProps {
  phase: TestPhase
  steps: TestStep[]
  physician: typeof PHYSICIANS[number] | undefined
  date: string
  slot: string
  networkStatus: string
  latency: string
  onJoin: () => void
  onRetry: () => void
}

function DeviceCheckRightRail({ phase, steps, physician, date, slot, networkStatus, latency, onJoin, onRetry }: RightRailProps) {
  if (phase === 'idle') {
    return (
      <section className="device-card">
        <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Device Check</p>
        <h2 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>A calm handoff into your visit</h2>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: T.slate, lineHeight: 1.7 }}>
          Run a quick device test to make sure your camera, microphone, speakers, and connection are ready for your consultation.
        </p>
        <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
          <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(32,181,223,0.08)', border: '1px solid rgba(32,181,223,0.16)' }}>
            <div style={{ fontSize: '11px', color: T.slate2, textTransform: 'uppercase', marginBottom: '4px' }}>Doctor</div>
            <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{physician?.name ?? 'Selected physician'}</div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
            <div style={{ fontSize: '11px', color: T.slate2, textTransform: 'uppercase', marginBottom: '4px' }}>Appointment</div>
            <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{date} · {slot}</div>
          </div>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(32,181,223,0.06)', border: '1px dashed rgba(32,181,223,0.22)', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '12px', color: T.blue, fontWeight: 600, lineHeight: 1.6 }}>
            Click <strong>Run Device Test</strong> to begin the pre-consultation check.
          </p>
        </div>
      </section>
    )
  }

  if (phase === 'running') {
    return (
      <section className="device-card">
        <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Running checks</p>
        <h2 style={{ margin: '0 0 12px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Checking your setup…</h2>
        <div style={{ display: 'grid', gap: '8px' }}>
          {steps.map((step) => (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', background: step.status === 'checking' ? 'rgba(32,181,223,0.06)' : step.status === 'pass' ? 'rgba(16,185,129,0.06)' : 'rgba(247,250,252,0.86)', border: `1px solid ${step.status === 'checking' ? 'rgba(32,181,223,0.18)' : step.status === 'pass' ? 'rgba(16,185,129,0.14)' : 'rgba(4,53,77,0.08)'}`, transition: 'all 0.25s ease' }}>
              <StepStatusIcon status={step.status} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{step.label}</p>
                <p style={{ margin: '1px 0 0', fontSize: '11px', color: step.status === 'checking' ? T.blue : step.status === 'pass' ? T.green : T.slate2 }}>
                  {step.status === 'pending' ? 'Waiting…' : step.status === 'checking' ? `Checking ${step.label.toLowerCase()}…` : step.status === 'pass' ? 'Ready' : 'Check required'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (phase === 'success') {
    return (
      <section className="device-card">
        <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: T.green, letterSpacing: '0.06em', textTransform: 'uppercase' }}>All checks passed</p>
        <h2 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>You&apos;re ready to join</h2>
        <p style={{ margin: '0 0 14px', fontSize: '13px', color: T.slate, lineHeight: 1.7 }}>
          Your camera, microphone, speakers, and connection are all ready for your consultation.
        </p>
        <div style={{ display: 'grid', gap: '7px', marginBottom: '16px' }}>
          {steps.map((step) => (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '12px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.14)' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '8px', display: 'grid', placeItems: 'center', background: 'rgba(16,185,129,0.14)', flexShrink: 0 }}>
                <Ico p={ICONS.check} size={11} sw={2.6} color={T.green} />
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{step.label}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: T.green }}>{step.id === 'connection' ? 'Good' : 'Ready'}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: '8px', marginBottom: '10px' }}>
          <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(32,181,223,0.08)', border: '1px solid rgba(32,181,223,0.16)' }}>
            <div style={{ fontSize: '11px', color: T.slate2, textTransform: 'uppercase', marginBottom: '4px' }}>Doctor</div>
            <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{physician?.name ?? 'Selected physician'}</div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
            <div style={{ fontSize: '11px', color: T.slate2, textTransform: 'uppercase', marginBottom: '4px' }}>Connection</div>
            <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{networkStatus} · {latency}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onJoin}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', minHeight: '46px', padding: '0 16px', borderRadius: '12px', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '14px', fontWeight: 700, border: 'none', boxShadow: '0 8px 22px rgba(32,181,223,0.32)', cursor: 'pointer', letterSpacing: '-0.01em' }}
        >
          Join Consultation
          <Ico p={ICONS.arrowSm} size={13} sw={2} color="#fff" />
        </button>
      </section>
    )
  }

  // failure
  return (
    <section className="device-card">
      <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: T.amber, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Attention needed</p>
      <h2 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>A few things need attention</h2>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: T.slate, lineHeight: 1.7 }}>
        One or more checks need attention. Please resolve the issues and run the test again.
      </p>
      <div style={{ display: 'grid', gap: '7px', marginBottom: '14px' }}>
        {steps.map((step) => (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '12px', background: step.status === 'fail' ? 'rgba(245,158,11,0.07)' : 'rgba(16,185,129,0.06)', border: `1px solid ${step.status === 'fail' ? 'rgba(245,158,11,0.18)' : 'rgba(16,185,129,0.14)'}` }}>
            <StepStatusIcon status={step.status} />
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{step.label}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: step.status === 'fail' ? T.amber : T.green }}>
                {step.status === 'fail' ? 'Check required' : (step.id === 'connection' ? 'Good' : 'Ready')}
              </span>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onRetry}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', minHeight: '46px', padding: '0 16px', borderRadius: '12px', background: 'rgba(245,158,11,0.12)', color: T.amber, fontSize: '14px', fontWeight: 700, border: '1px solid rgba(245,158,11,0.24)', cursor: 'pointer' }}
      >
        Run Test Again
      </button>
    </section>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

function DeviceCheckPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId') ?? 'sophia-reed'
  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const service = searchParams.get('service') ?? 'video'
  const fee = Number(searchParams.get('fee') ?? physician?.consultationFee ?? 140)
  const duration = searchParams.get('duration') ?? '30 min'
  const insurance = searchParams.get('insurance') ?? 'Axa'
  const date = searchParams.get('date') ?? 'Today'
  const slot = searchParams.get('slot') ?? '4:30 PM'
  const notes = searchParams.get('notes') ?? ''

  // ── State machine ────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<TestPhase>('idle')
  const [steps, setSteps] = useState<TestStep[]>(INITIAL_STEPS)

  // Connection stats (shown after success)
  const [networkStatus, setNetworkStatus] = useState('Good')
  const [latency, setLatency] = useState('18 ms')
  const [downloadSpeed, setDownloadSpeed] = useState('42 Mbps')
  const [uploadSpeed, setUploadSpeed] = useState('18 Mbps')

  // Accordion
  const [expanded, setExpanded] = useState<string | null>(null)

  // Mic animation (always running for the mic section)
  const [micInput, setMicInput] = useState(72)
  const [muted, setMuted] = useState(false)
  const [soundPlayed, setSoundPlayed] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMicInput((v) => (v >= 100 ? 20 : v + 6))
    }, 320)
    return () => window.clearInterval(timer)
  }, [])

  // ── Run device test ──────────────────────────────────────────────────────
  const handleRunChecks = () => {
    setPhase('running')
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'pending' as const })))

    const STEP_IDS: StepId[] = ['camera', 'microphone', 'speakers', 'connection']
    const DELAY = 700 // ms between each step starting

    // Kick off each step sequentially: pending → checking → pass
    STEP_IDS.forEach((id, index) => {
      // Start checking
      window.setTimeout(() => {
        setSteps((prev) => prev.map((s) => s.id === id ? { ...s, status: 'checking' } : s))
      }, index * DELAY)

      // Mark as pass (checking lasts 600ms)
      window.setTimeout(() => {
        setSteps((prev) => prev.map((s) => s.id === id ? { ...s, status: 'pass' } : s))
      }, index * DELAY + 600)
    })

    // Resolve after all steps complete
    const totalDuration = STEP_IDS.length * DELAY + 700
    window.setTimeout(() => {
      // Always success in prototype
      setNetworkStatus('Excellent')
      setLatency('12 ms')
      setDownloadSpeed('78 Mbps')
      setUploadSpeed('34 Mbps')
      setPhase('success')
    }, totalDuration)
  }

  const handleRetry = () => {
    setSteps(INITIAL_STEPS)
    setPhase('idle')
  }

  const handleJoin = () => {
    if (phase !== 'success') return
    const query = new URLSearchParams({
      physicianId,
      service,
      fee: String(fee),
      duration,
      insurance,
      date,
      slot,
      notes,
      cameraReady: 'true',
      microphoneReady: 'true',
      speakerReady: 'true',
      networkStatus,
      latency,
      downloadSpeed,
      uploadSpeed,
    })
    router.push(`/patient/video-consultation/live?${query.toString()}`)
  }

  // ── Progress indicator ───────────────────────────────────────────────────
  const progressDisplay = useMemo(() => {
    switch (phase) {
      case 'success':
        return { waitingRoom: '✓', deviceCheck: '✓', consultation: '●', waitingRoomColor: T.green, deviceCheckColor: T.green, consultationColor: T.blue }
      default:
        return { waitingRoom: '✓', deviceCheck: '●', consultation: '○', waitingRoomColor: T.green, deviceCheckColor: T.blue, consultationColor: T.slate2 }
    }
  }, [phase])

  // ── Hero CTA ─────────────────────────────────────────────────────────────
  let heroCta: { label: string; onClick?: () => void; disabled: boolean; style: React.CSSProperties }
  switch (phase) {
    case 'idle':
      heroCta = { label: 'Run Device Test', onClick: handleRunChecks, disabled: false, style: { background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', boxShadow: '0 8px 22px rgba(32,181,223,0.26)', cursor: 'pointer' } }
      break
    case 'running':
      heroCta = { label: 'Testing…', onClick: undefined, disabled: true, style: { background: 'rgba(4,53,77,0.08)', color: T.slate2, cursor: 'not-allowed' } }
      break
    case 'success':
      heroCta = { label: 'Join Consultation', onClick: handleJoin, disabled: false, style: { background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', boxShadow: '0 8px 22px rgba(32,181,223,0.28)', cursor: 'pointer' } }
      break
    case 'failure':
      heroCta = { label: 'Run Test Again', onClick: handleRetry, disabled: false, style: { background: 'rgba(245,158,11,0.12)', color: T.amber, border: '1px solid rgba(245,158,11,0.24)', cursor: 'pointer' } }
      break
  }

  const waitingRoomHref = `/patient/video-consultation/waiting-room?${searchParams.toString()}`

  const rightRailContent = (
    <DeviceCheckRightRail
      phase={phase}
      steps={steps}
      physician={physician}
      date={date}
      slot={slot}
      networkStatus={networkStatus}
      latency={latency}
      onJoin={handleJoin}
      onRetry={handleRetry}
    />
  )

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes dc-spin { to { transform: rotate(360deg); } }
        @keyframes dc-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes dc-fade-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .device-hero { position: relative; overflow: hidden; padding: 28px; border-radius: 28px; background: linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(247,250,252,0.92) 100%); border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.float}; }
        .device-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at top left, rgba(32,181,223,0.12), transparent 36%), radial-gradient(circle at 85% 10%, rgba(52,140,234,0.1), transparent 28%); pointer-events: none; }
        .device-grid { display: grid; gap: 14px; margin-top: 14px; }
        .device-card { background: rgba(255,255,255,0.9); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%); border-radius: 24px; border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.card}; padding: 20px; }
        .device-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: rgba(32,181,223,0.1); color: ${T.blue}; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
        .device-success-banner { animation: dc-fade-in 0.4s ease; }
        .waveform { display: flex; align-items: center; gap: 3px; height: 36px; }
        .waveform span { display: inline-block; width: 3px; border-radius: 999px; background: ${T.blue}; animation: dc-pulse 0.9s ease-in-out infinite; }
        .mobile-join { display: none; }
        @media (max-width: 860px) {
          .mobile-join { display: grid; gap: 10px; margin-top: 16px; padding: 0 4px 24px; }
          .device-hero h1 { font-size: 22px !important; }
        }
        @media (max-width: 600px) {
          .device-hero { padding: 20px 16px; }
          .device-card { padding: 16px; }
        }
      `}</style>
      <PatientPortalShell
        eyebrow="Device Readiness"
        title="Device & Connection Check"
        description="Verify your camera, microphone, and connection quality for a smooth virtual consultation experience."
        rightRail={rightRailContent}
      >
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="device-hero" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div className="device-pill" style={{ marginBottom: '10px' }}>
                <Ico p={ICONS.video} size={10} sw={2.2} color={T.blue} />
                Device &amp; Connection Check
              </div>
              <h1 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '30px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>
                {phase === 'success'
                  ? "Your device is ready — join when you're set"
                  : phase === 'failure'
                  ? "A few things need your attention"
                  : "Let\u2019s make sure everything is ready before you join"}
              </h1>
              <p style={{ margin: '0 0 18px', maxWidth: '680px', fontSize: '14px', color: T.slate, lineHeight: 1.75 }}>
                {phase === 'success'
                  ? "Your camera, microphone, speakers, and connection have all passed the check. You can now join your consultation with confidence."
                  : phase === 'failure'
                  ? "One or more checks did not pass. Please review the results in the panel and run the test again."
                  : "We will verify your camera, microphone, speakers, and connection quality so you can step into the consultation with confidence."}
              </p>

              {/* Hero CTA row */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={heroCta.onClick}
                  disabled={heroCta.disabled}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    minHeight: '46px',
                    padding: '0 20px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 700,
                    border: 'none',
                    transition: 'all 0.22s ease',
                    letterSpacing: '-0.01em',
                    ...(heroCta.style as React.CSSProperties),
                  }}
                >
                  {phase === 'running' && (
                    <div style={{ width: '14px', height: '14px', borderRadius: '999px', border: '2px solid rgba(4,53,77,0.18)', borderTopColor: T.slate, animation: 'dc-spin 0.8s linear infinite' }} />
                  )}
                  {heroCta.label}
                  {phase === 'success' && <Ico p={ICONS.arrowSm} size={13} sw={2} color="#fff" />}
                </button>
                <Link
                  href={waitingRoomHref}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '46px', padding: '0 16px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}
                >
                  Back to Waiting Room
                </Link>
              </div>
            </div>

            {/* Progress widget */}
            <div style={{ minWidth: '220px', borderRadius: '20px', padding: '16px', background: 'rgba(255,255,255,0.74)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: Sh.glow }}>
              <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Progress</p>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  { label: 'Waiting Room', symbol: progressDisplay.waitingRoom, color: progressDisplay.waitingRoomColor },
                  { label: 'Device Check',  symbol: progressDisplay.deviceCheck,  color: progressDisplay.deviceCheckColor },
                  { label: 'Consultation', symbol: progressDisplay.consultation, color: progressDisplay.consultationColor },
                ].map((step) => (
                  <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', color: step.color, fontWeight: 800, lineHeight: 1, minWidth: '16px', textAlign: 'center' }}>{step.symbol}</span>
                    <span style={{ fontSize: '12px', color: step.label === 'Device Check' ? T.navy : T.slate2, fontWeight: step.label === 'Device Check' ? 700 : 500, lineHeight: 1 }}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Success banner ─────────────────────────────────────────────── */}
        {phase === 'success' && (
          <div className="device-success-banner" style={{ padding: '14px 18px', borderRadius: '16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'rgba(16,185,129,0.14)', flexShrink: 0 }}>
              <Ico p={ICONS.check} size={14} sw={2.6} color={T.green} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>Your device is ready</p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: T.slate }}>Camera, microphone, speakers, and connection are all confirmed. Click <strong>Join Consultation</strong> when you&apos;re ready.</p>
            </div>
          </div>
        )}

        {/* ── Failure banner ──────────────────────────────────────────────── */}
        {phase === 'failure' && (
          <div className="device-success-banner" style={{ padding: '14px 18px', borderRadius: '16px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'rgba(245,158,11,0.14)', flexShrink: 0 }}>
              <Ico p={['M12 9v4', 'M12 17h.01']} size={14} sw={2.4} color={T.amber} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>A few things need your attention</p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: T.slate }}>Please resolve the issues highlighted below and click <strong>Run Test Again</strong>.</p>
            </div>
          </div>
        )}

        <div className="device-grid">
          {/* Camera Preview */}
          <section className="device-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Live camera preview</p>
                <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>
                  {phase === 'success' ? 'Camera is ready for your consultation' : phase === 'running' ? 'Scanning your camera…' : 'Camera preview'}
                </h2>
              </div>
              {phase === 'success' && (
                <div style={{ ...Glass.chip, borderRadius: '999px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: T.green }}>Mirror mode</div>
              )}
            </div>
            <CameraPreview phase={phase} />
          </section>

          {/* Microphone section */}
          <section className="device-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Microphone test</p>
                <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Speak naturally and watch the input respond</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: T.slate2 }}>Input level</span>
                  <div className="waveform" aria-hidden="true">
                    {[10, 24, 36, 18, 28, 42, 24].map((height, index) => (
                      <span key={index} style={{ height: `${Math.max(height, micInput / 2)}px`, animationDelay: `${index * 0.06}s` }} />
                    ))}
                  </div>
                </div>
                <div style={{ ...Glass.chip, borderRadius: '999px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: T.blue }}>{muted ? 'Muted' : 'Listening'}</div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setMuted((v) => !v)} style={{ border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.92)', color: T.navy, padding: '8px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  {muted ? 'Unmute' : 'Mute'}
                </button>
                <button type="button" style={{ border: 'none', background: 'rgba(32,181,223,0.12)', color: T.blue, padding: '8px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  Test Microphone
                </button>
              </div>
            </div>
          </section>

          {/* Speaker section */}
          <section className="device-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Speaker test</p>
                <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Hear a test sound clearly</h2>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={() => setSoundPlayed(true)} style={{ border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', padding: '8px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                Play Test Sound
              </button>
              <div style={{ ...Glass.chip, borderRadius: '999px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: soundPlayed ? T.green : T.slate2 }}>
                {soundPlayed ? 'I heard the sound' : 'Volume ready'}
              </div>
            </div>
          </section>

          {/* Connection section */}
          <section className="device-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Internet connection</p>
                <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Network quality is performing well</h2>
              </div>
              <div style={{ ...Glass.chip, borderRadius: '999px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, color: T.green }}>{networkStatus}</div>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {[
                ['Connection Status', networkStatus],
                ['Latency', latency],
                ['Download Speed', downloadSpeed],
                ['Upload Speed', uploadSpeed],
                ['Connection Quality', phase === 'success' ? 'Excellent' : 'Measuring…'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                  <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
                  <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Device compatibility — updated based on test results */}
          <section className="device-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Device compatibility</p>
                <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>
                  {phase === 'success' ? 'Everything required is available' : 'Checking device compatibility'}
                </h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {[
                { label: 'Browser', detail: 'Chrome 128+ detected', tone: T.green, state: 'Ready' },
                { label: 'Camera',      detail: phase === 'success' ? 'Camera detected and live' : phase === 'idle' ? 'Run test to check' : 'Checking…',       tone: phase === 'success' ? T.green : T.slate2, state: phase === 'success' ? 'Ready' : phase === 'idle' ? '—' : 'Checking…' },
                { label: 'Microphone', detail: phase === 'success' ? 'Audio input is active' : phase === 'idle' ? 'Run test to check' : 'Checking…',           tone: phase === 'success' ? T.green : T.slate2, state: phase === 'success' ? 'Ready' : phase === 'idle' ? '—' : 'Checking…' },
                { label: 'Speakers',   detail: phase === 'success' ? 'Output device detected' : phase === 'idle' ? 'Run test to check' : 'Checking…',          tone: phase === 'success' ? T.green : T.slate2, state: phase === 'success' ? 'Ready' : phase === 'idle' ? '—' : 'Checking…' },
                { label: 'OS', detail: 'macOS Sonoma detected', tone: T.green, state: 'Ready' },
                { label: 'Permissions', detail: phase === 'success' ? 'All required access granted' : 'Granted on test completion', tone: phase === 'success' ? T.green : T.slate2, state: phase === 'success' ? 'Ready' : '—' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.label}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: T.slate }}>{item.detail}</p>
                  </div>
                  <span style={{ fontSize: '12px', color: item.tone, fontWeight: 700, whiteSpace: 'nowrap' }}>{item.state}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Privacy check */}
          <section className="device-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Privacy check</p>
                <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>A private and calm setting</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {["You\u2019re in a private location", 'Background noise is minimal', 'Lighting is sufficient', 'Camera is positioned correctly'].map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                  <div style={{ width: '28px', height: '28px', minWidth: '28px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'rgba(32,181,223,0.12)', color: T.green }}>
                    <Ico p={ICONS.check} size={12} sw={2.4} color={T.green} />
                  </div>
                  <span style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Troubleshooting */}
          <section className="device-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Troubleshooting</p>
                <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Helpful guidance if anything needs attention</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {troubleshootingItems.map((item) => {
                const isOpen = expanded === item.title
                return (
                  <div key={item.title} style={{ borderRadius: '14px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.86)', overflow: 'hidden' }}>
                    <button type="button" onClick={() => setExpanded(isOpen ? null : item.title)} style={{ width: '100%', border: 'none', background: 'transparent', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{item.title}</span>
                      <Ico p={ICONS.arrowSm} size={13} sw={1.8} color={T.blue} />
                    </button>
                    {isOpen && <p style={{ margin: '0 0 12px', padding: '0 14px 12px', fontSize: '12px', color: T.slate, lineHeight: 1.65 }}>{item.body}<br />{item.detail}</p>}
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* ── Mobile CTA ──────────────────────────────────────────────────── */}
        <div className="mobile-join">
          {phase === 'success' ? (
            <button
              type="button"
              onClick={handleJoin}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '46px', padding: '0 16px', borderRadius: '12px', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '14px', fontWeight: 700, border: 'none', boxShadow: '0 8px 22px rgba(32,181,223,0.28)', cursor: 'pointer' }}
            >
              Join Consultation
              <Ico p={ICONS.arrowSm} size={13} sw={2} color="#fff" />
            </button>
          ) : phase === 'failure' ? (
            <button
              type="button"
              onClick={handleRetry}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '46px', padding: '0 16px', borderRadius: '12px', background: 'rgba(245,158,11,0.12)', color: T.amber, fontSize: '14px', fontWeight: 700, border: '1px solid rgba(245,158,11,0.24)', cursor: 'pointer' }}
            >
              Run Test Again
            </button>
          ) : phase === 'running' ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '46px', padding: '0 16px', borderRadius: '12px', background: 'rgba(4,53,77,0.06)', color: T.slate2, fontSize: '13px', fontWeight: 700 }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '999px', border: '2px solid rgba(4,53,77,0.16)', borderTopColor: T.slate, animation: 'dc-spin 0.8s linear infinite' }} />
              Testing…
            </div>
          ) : (
            <button
              type="button"
              onClick={handleRunChecks}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '46px', padding: '0 16px', borderRadius: '12px', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '14px', fontWeight: 700, border: 'none', boxShadow: '0 8px 22px rgba(32,181,223,0.26)', cursor: 'pointer' }}
            >
              Run Device Test
            </button>
          )}
          <Link
            href={waitingRoomHref}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '46px', padding: '0 16px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(255,255,255,0.94)', color: T.navy, fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}
          >
            Back to Waiting Room
          </Link>
        </div>
      </PatientPortalShell>
    </>
  )
}

export default function DeviceCheckPage() {
  return (
    <Suspense>
      <DeviceCheckPageContent />
    </Suspense>
  )
}

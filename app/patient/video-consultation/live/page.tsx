'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PAGE_BG, T, Sh } from '@/lib/tokens'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { useLocalMedia } from '@/lib/hooks/useLocalMedia'

// ─── Helpers ──────────────────────────────────────────────────────────────────

type MessageItem = {
  id: number
  from: 'doctor' | 'patient' | 'system'
  text: string
  time: string
}

type FileItem = {
  name: string
  type: string
  size: string
}

function formatElapsed(totalSeconds: number) {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

// ─── SelfView ─────────────────────────────────────────────────────────────────
// Thin component that attaches a MediaStream to a <video> element via a ref.
// AWS Chime integration: pass the local tile's MediaStream as `stream`.

interface SelfViewProps {
  stream: MediaStream | null
  cameraOn: boolean
  cameraLoading: boolean
  cameraError: { message: string } | null
  onTryAgain: () => void
}

function SelfView({ stream, cameraOn, cameraLoading, cameraError, onTryAgain }: SelfViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (stream && cameraOn) {
      el.srcObject = stream
      el.play().catch(() => {/* autoplay blocked — user gesture will cover this */})
    } else {
      el.srcObject = null
    }
  }, [stream, cameraOn])

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    top: '20px',
    right: '20px',
    width: '190px',
    height: '130px',
    borderRadius: '18px',
    overflow: 'hidden',
    zIndex: 2,
    border: '1px solid rgba(255,255,255,0.8)',
    boxShadow: Sh.glow,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  }

  // Error state
  if (cameraError) {
    return (
      <div style={{ ...baseStyle, background: 'rgba(4,53,77,0.82)', padding: '10px', textAlign: 'center', gap: '6px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
          {cameraError.message}
        </div>
        <button
          type="button"
          onClick={onTryAgain}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '28px', padding: '0 10px', borderRadius: '999px', border: 'none', background: 'rgba(32,181,223,0.9)', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
          aria-label="Try again to access camera"
        >
          Try Again
        </button>
      </div>
    )
  }

  // Loading state
  if (cameraLoading) {
    return (
      <div style={{ ...baseStyle, background: 'rgba(4,53,77,0.82)' }}>
        <div style={{ width: '22px', height: '22px', borderRadius: '999px', border: '2px solid rgba(32,181,223,0.3)', borderTopColor: T.blue, animation: 'spin 0.8s linear infinite' }} />
        <div style={{ marginTop: '6px', fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Starting camera…</div>
      </div>
    )
  }

  // Camera on — show live feed
  if (stream && cameraOn) {
    return (
      <div style={baseStyle}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' /* mirror */ }}
          aria-label="Your camera preview"
        />
        <div style={{ position: 'absolute', bottom: '6px', left: '8px', fontSize: '9px', fontWeight: 700, color: '#fff', background: 'rgba(4,53,77,0.54)', padding: '2px 6px', borderRadius: '999px' }}>
          You
        </div>
      </div>
    )
  }

  // Camera off — avatar placeholder
  return (
    <div style={{ ...baseStyle, background: 'linear-gradient(135deg, rgba(4,53,77,0.88), rgba(32,181,223,0.55))' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '14px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.12)' }}>
        <Ico p={ICONS.user} size={16} sw={1.8} color="rgba(255,255,255,0.9)" />
      </div>
      <div style={{ marginTop: '6px', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Camera Off
      </div>
    </div>
  )
}

// ─── Error banner ──────────────────────────────────────────────────────────────

function MediaErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 12px', borderRadius: '12px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.16)', marginBottom: '8px' }}>
      <span style={{ fontSize: '12px', color: T.red, fontWeight: 600 }}>{message}</span>
      <button type="button" onClick={onDismiss} style={{ border: 'none', background: 'none', color: T.red, fontSize: '14px', cursor: 'pointer', lineHeight: 1 }} aria-label="Dismiss error">✕</button>
    </div>
  )
}

// ─── Main page content ────────────────────────────────────────────────────────

function LiveConsultationPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId') ?? 'sophia-reed'
  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const date = searchParams.get('date') ?? 'Today'
  const slot = searchParams.get('slot') ?? '4:30 PM'
  const networkStatus = searchParams.get('networkStatus') ?? 'Excellent'
  const latency = searchParams.get('latency') ?? '12 ms'
  const duration = searchParams.get('duration') ?? '30 min'
  const insurance = searchParams.get('insurance') ?? 'Axa'
  const notes = searchParams.get('notes') ?? ''

  // ── Real media ──────────────────────────────────────────────────────────────
  const {
    cameraStream, cameraOn, cameraLoading, cameraError, toggleCamera, clearCameraError,
    micMuted, micLoading, micError, toggleMic, clearMicError,
    stopAll,
  } = useLocalMedia()

  // ── Session state ───────────────────────────────────────────────────────────
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [speakerOn, setSpeakerOn] = useState(true)
  const [shareOn, setShareOn] = useState(false)
  const [captionsOn, setCaptionsOn] = useState(true)
  const [chatOpen, setChatOpen] = useState(true)
  const [docsOpen, setDocsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [raiseHand, setRaiseHand] = useState(false)
  const [reaction, setReaction] = useState<'spark' | 'thumbs' | null>(null)
  const [recordingOn] = useState(true)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [typing, setTyping] = useState(true)
  const [messages, setMessages] = useState<MessageItem[]>([
    { id: 1, from: 'doctor', text: "Good morning. I can see your symptoms from the intake notes and I'm ready to review them now.", time: '09:12' },
    { id: 2, from: 'patient', text: "Thank you. I've been feeling fatigued and a bit lightheaded, especially in the evenings.", time: '09:13' },
    { id: 3, from: 'system', text: 'Consultation notes are auto-saving in the clinical panel.', time: '09:14' },
  ])
  const [notesDraft, setNotesDraft] = useState(
    'Subjective: Patient reports fatigue and lightheadedness over the past week.\nObjective: No acute distress.\nAssessment: Potentially related to hydration and recurring stress.\nPlan: Continue hydration, monitor symptoms, and review again in 48 hours.'
  )

  // ── Timer ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = window.setInterval(() => setElapsedSeconds((v) => v + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  // ── Cleanup on unmount (belt-and-suspenders — hook also cleans up internally) ─
  useEffect(() => {
    return () => { stopAll() }
  }, [stopAll])

  // ── Chat typing indicator ──────────────────────────────────────────────────
  useEffect(() => {
    if (!chatOpen) return
    const timer = window.setTimeout(() => setTyping(false), 1400)
    return () => window.clearTimeout(timer)
  }, [chatOpen, messages.length])

  const doctorName = physician?.name ?? 'Dr. Sophia Reed'
  const specialty = physician?.specialty ?? 'Internal Medicine'
  const formattedElapsed = useMemo(() => formatElapsed(elapsedSeconds), [elapsedSeconds])

  const quickReplies = ['Can you explain this next step?', 'I would like a written summary', 'Please note my current concerns']
  const documentFiles: FileItem[] = [
    { name: 'Lab Results.pdf', type: 'Lab report', size: '2.2 MB' },
    { name: 'Medication List.pdf', type: 'Prescription', size: '384 KB' },
    { name: 'Insurance Card.png', type: 'Insurance', size: '1.4 MB' },
  ]

  const handleQuickReply = (reply: string) => {
    setMessages((current) => [...current, { id: Date.now(), from: 'patient', text: reply, time: 'Now' }])
    setTyping(true)
    window.setTimeout(() => {
      setMessages((current) => [...current, { id: Date.now() + 1, from: 'doctor', text: 'Understood. I will capture that in our notes and keep the plan aligned with your concerns.', time: 'Now' }])
      setTyping(false)
    }, 900)
  }

  // Stop all tracks BEFORE navigating away
  const handleEndConsultation = useCallback(() => {
    stopAll()
    const query = new URLSearchParams({
      physicianId, date, slot, duration, insurance, notes,
      elapsed: String(elapsedSeconds), networkStatus, latency,
      physicianName: doctorName, specialty,
      messageCount: String(messages.length),
    })
    router.push(`/patient/consultation-summary?${query.toString()}`)
  }, [stopAll, physicianId, date, slot, duration, insurance, notes, elapsedSeconds, networkStatus, latency, doctorName, specialty, messages.length, router])

  // ── Camera button handler (async) ──────────────────────────────────────────
  const handleCameraClick = useCallback(() => {
    clearCameraError()
    toggleCamera()
  }, [clearCameraError, toggleCamera])

  // ── Mic button handler (async) ────────────────────────────────────────────
  const handleMicClick = useCallback(() => {
    clearMicError()
    toggleMic()
  }, [clearMicError, toggleMic])

  // ── Aria labels ────────────────────────────────────────────────────────────
  const cameraAriaLabel = cameraLoading ? 'Starting camera…' : cameraOn ? 'Turn off camera' : 'Turn on camera'
  const micAriaLabel = micLoading ? 'Starting microphone…' : micMuted ? 'Unmute microphone' : 'Mute microphone'

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, position: 'relative', padding: '18px 18px 100px' }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .consult-shell { max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
        .consult-header, .consult-video-card, .consult-side-card, .control-dock, .modal-card { background: rgba(255,255,255,0.86); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); border: 1px solid rgba(255,255,255,0.9); box-shadow: ${Sh.card}; }
        .consult-header { border-radius: 24px; padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
        .consult-body { display: grid; grid-template-columns: minmax(0, 1.35fr) 390px; gap: 16px; align-items: start; }
        .consult-video-card { border-radius: 28px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .video-stage { position: relative; min-height: 560px; border-radius: 24px; overflow: hidden; background: linear-gradient(135deg, rgba(4,53,77,0.95) 0%, rgba(32,181,223,0.82) 100%); display: flex; align-items: center; justify-content: center; }
        .video-stage::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.23), transparent 24%), radial-gradient(circle at 80% 8%, rgba(165,224,218,0.24), transparent 22%), radial-gradient(circle at 50% 100%, rgba(255,255,255,0.18), transparent 32%); pointer-events: none; }
        .video-stage::after { content: ''; position: absolute; inset: 0; background: linear-gradient(120deg, rgba(255,255,255,0.06), transparent 40%, rgba(255,255,255,0.08)); pointer-events: none; }
        .doctor-card { position: relative; z-index: 1; width: min(880px, 100%); padding: 28px; border-radius: 24px; background: rgba(255,255,255,0.14); backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.2); box-shadow: inset 0 1px 0 rgba(255,255,255,0.14); }
        .video-badges { position: absolute; inset: 0 auto auto 20px; display: flex; flex-direction: column; gap: 8px; padding: 20px 0 0 0; z-index: 2; }
        .video-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; background: rgba(255,255,255,0.86); color: ${T.navy}; border: 1px solid rgba(255,255,255,0.82); box-shadow: ${Sh.inner}; }
        .video-controls { position: absolute; inset: auto 16px 16px 16px; display: flex; justify-content: center; z-index: 2; }
        .video-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; padding: 10px; border-radius: 999px; background: rgba(255,255,255,0.16); backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.26); }
        .meta-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .meta-pill { padding: 11px 12px; border-radius: 14px; background: rgba(247,250,252,0.82); border: 1px solid rgba(4,53,77,0.08); }
        .consult-side-panel { display: flex; flex-direction: column; gap: 12px; }
        .consult-side-card { border-radius: 20px; padding: 16px; }
        .control-dock { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); width: min(1160px, calc(100% - 24px)); border-radius: 999px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; z-index: 30; }
        .control-pill { border: 1px solid rgba(255,255,255,0.72); background: rgba(255,255,255,0.72); color: ${T.navy}; padding: 0 12px; min-height: 44px; border-radius: 999px; display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; }
        .control-pill:hover, .control-pill:focus-visible { transform: translateY(-1px); box-shadow: ${Sh.glow}; outline: none; }
        .control-pill.active { background: rgba(32,181,223,0.16); color: ${T.blue}; border-color: rgba(32,181,223,0.24); }
        .control-pill.muted { background: rgba(220,38,38,0.1); color: ${T.red}; border-color: rgba(220,38,38,0.16); }
        .control-pill.leave { background: rgba(220,38,38,0.1); color: ${T.red}; border-color: rgba(220,38,38,0.16); }
        .control-pill:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .surface-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
        .chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(4,53,77,0.48); display: grid; place-items: center; z-index: 40; padding: 16px; }
        .modal-card { width: min(480px, 100%); border-radius: 24px; padding: 24px; }
        .focus-ring:focus-visible { outline: 2px solid ${T.blue}; outline-offset: 2px; }
        @media (max-width: 1180px) { .consult-body { grid-template-columns: 1fr; } .consult-side-panel { order: 2; } }
        @media (max-width: 860px) { .control-dock { flex-wrap: wrap; justify-content: center; border-radius: 24px; padding: 10px; } .meta-row { grid-template-columns: 1fr 1fr; } .video-stage { min-height: 440px; } }
        @media (max-width: 640px) { .consult-header { padding: 16px; } .consult-video-card { padding: 12px; } .video-stage { min-height: 360px; } .meta-row { grid-template-columns: 1fr; } .control-dock { bottom: 10px; width: calc(100% - 12px); } }
      `}</style>
      <div className="consult-shell">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="consult-header" aria-label="Consultation header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '14px', display: 'grid', placeItems: 'center', background: 'rgba(32,181,223,0.14)', color: T.blue }}>
              <Ico p={ICONS.steth} size={18} sw={1.8} />
            </div>
            <div>
              <div className="badge" style={{ marginBottom: '6px', background: 'rgba(32,181,223,0.1)', color: T.blue }}>
                <Ico p={ICONS.check} size={10} sw={2.3} />
                Verified Participant
              </div>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{doctorName}</h1>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: T.slate }}>{specialty} • {date} • {slot}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="chip" style={{ background: 'rgba(165,224,218,0.28)', color: T.navy }}>
              <Ico p={ICONS.zap} size={12} sw={1.8} />
              {formattedElapsed}
            </div>
            <div className="chip" style={{ background: 'rgba(247,250,252,0.9)', color: T.green }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: T.green, display: 'inline-block' }} />
              {networkStatus}
            </div>
            <div className="chip" style={{ background: recordingOn ? 'rgba(32,181,223,0.12)' : 'rgba(4,53,77,0.06)', color: recordingOn ? T.blue : T.slate2 }}>
              <Ico p={ICONS.video} size={12} sw={1.8} />
              {recordingOn ? 'Recording • On' : 'Recording • Off'}
            </div>
            <div className="chip" style={{ background: 'rgba(247,250,252,0.9)', color: T.navy }}>
              <Ico p={ICONS.shield} size={12} sw={1.8} />
              E2E Encrypted
            </div>
            <button type="button" onClick={() => setConfirmEndOpen(true)} className="focus-ring control-pill leave" style={{ minWidth: '120px', justifyContent: 'center' }}>
              End Consultation
            </button>
          </div>
        </header>

        {/* ── Error banners (media) ──────────────────────────────────────── */}
        {cameraError && (
          <MediaErrorBanner
            message={`Camera: ${cameraError.message}`}
            onDismiss={clearCameraError}
          />
        )}
        {micError && (
          <MediaErrorBanner
            message={`Microphone: ${micError.message}`}
            onDismiss={clearMicError}
          />
        )}

        <div className="consult-body">
          {/* ── Video stage ──────────────────────────────────────────────── */}
          <section className="consult-video-card" aria-label="Live consultation video stage">
            <div className="video-stage">

              {/* Patient self-view (real camera feed or placeholder) */}
              <SelfView
                stream={cameraStream}
                cameraOn={cameraOn}
                cameraLoading={cameraLoading}
                cameraError={cameraError}
                onTryAgain={handleCameraClick}
              />

              {/* Network quality badges (top-left) */}
              <div className="video-badges">
                <div className="video-badge">
                  <Ico p={ICONS.check} size={10} sw={2.4} color={T.green} />
                  HD video ready
                </div>
                <div className="video-badge">
                  <Ico p={ICONS.activity} size={10} sw={2.4} color={T.blue} />
                  {networkStatus} · {latency}
                </div>
              </div>

              {/*
               * ── Physician video area ──────────────────────────────────────
               * AWS Chime integration point:
               *   Replace this placeholder card with:
               *   <video ref={remoteVideoRef} autoPlay playsInline style={{...}} />
               *   where remoteVideoRef.current.srcObject = chimeTileStream
               */}
              <div className="doctor-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '14px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.16)', color: '#fff' }}>
                    <Ico p={ICONS.user} size={16} sw={1.9} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.82)' }}>Physician</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{doctorName}</div>
                  </div>
                </div>
                <h2 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Clinical consultation in progress</h2>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.84)', fontSize: '14px', lineHeight: 1.75, maxWidth: '640px' }}>
                  The conversation is secure, calm, and focused on your care. Your physician can view supporting documents and notes without leaving the room.
                </p>
              </div>

              {/* In-video controls */}
              <div className="video-controls">
                <div className="video-actions">
                  <button
                    type="button"
                    onClick={handleMicClick}
                    disabled={micLoading}
                    className={`focus-ring control-pill${micMuted && !micLoading ? ' muted' : ''}`}
                    aria-label={micAriaLabel}
                    aria-pressed={!micMuted}
                    title={micAriaLabel}
                  >
                    {micLoading ? (
                      <div style={{ width: '14px', height: '14px', borderRadius: '999px', border: '2px solid rgba(32,181,223,0.3)', borderTopColor: T.blue, animation: 'spin 0.8s linear infinite' }} />
                    ) : (
                      <Ico p={['M12 5a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0V8a3 3 0 0 1 3-3z', 'M7 10a5 5 0 0 0 10 0', 'M12 15v4', 'M8 19h8']} size={14} />
                    )}
                    {micMuted ? 'Unmute' : 'Mute'}
                  </button>

                  <button
                    type="button"
                    onClick={handleCameraClick}
                    disabled={cameraLoading}
                    className={`focus-ring control-pill${cameraOn ? ' active' : ''}`}
                    aria-label={cameraAriaLabel}
                    aria-pressed={cameraOn}
                    title={cameraAriaLabel}
                  >
                    {cameraLoading ? (
                      <div style={{ width: '14px', height: '14px', borderRadius: '999px', border: '2px solid rgba(32,181,223,0.3)', borderTopColor: T.blue, animation: 'spin 0.8s linear infinite' }} />
                    ) : (
                      <Ico p={ICONS.video} size={14} />
                    )}
                    {cameraOn ? 'Camera On' : 'Camera Off'}
                  </button>

                  <button type="button" onClick={() => setSpeakerOn((v) => !v)} className={`focus-ring control-pill${!speakerOn ? ' muted' : ''}`} aria-pressed={speakerOn} aria-label={speakerOn ? 'Mute speaker' : 'Unmute speaker'}>
                    <Ico p={['M11 5a1 1 0 0 1 1.62-.78l4.67 3.75A1 1 0 0 1 17 9H4a1 1 0 0 1-.29-1.96L11 5z', 'M13.5 9.5v5', 'M16.5 7.5v9', 'M19.5 10.5v3']} size={14} />
                    {speakerOn ? 'Speaker' : 'Muted'}
                  </button>

                  <button type="button" onClick={() => setShareOn((v) => !v)} className={`focus-ring control-pill${shareOn ? ' active' : ''}`} aria-pressed={shareOn} aria-label={shareOn ? 'Stop sharing' : 'Share screen'}>
                    <Ico p={['M12 14v-7', 'M8 8l4-4 4 4', 'M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5']} size={14} />
                    Share
                  </button>
                </div>
              </div>
            </div>

            {/* ── Meta row ──────────────────────────────────────────────── */}
            <div className="meta-row">
              <div className="meta-pill">
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: T.slate2, marginBottom: '4px' }}>Internet</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{networkStatus}</div>
              </div>
              <div className="meta-pill">
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: T.slate2, marginBottom: '4px' }}>Latency</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{latency}</div>
              </div>
              <div className="meta-pill">
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: T.slate2, marginBottom: '4px' }}>Camera</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: cameraOn ? T.green : T.slate2 }}>{cameraOn ? 'Active' : 'Off'}</div>
              </div>
              <div className="meta-pill">
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: T.slate2, marginBottom: '4px' }}>Microphone</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: micMuted ? T.slate2 : T.green }}>{micMuted ? 'Muted' : 'Active'}</div>
              </div>
            </div>
          </section>

          {/* ── Side panel ──────────────────────────────────────────────── */}
          <aside className="consult-side-panel">
            <section className="consult-side-card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.slate2 }}>Clinical workspace</div>
                  <h2 style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 800, color: T.navy }}>Patient context</h2>
                </div>
                <button type="button" onClick={() => setPanelCollapsed((v) => !v)} className="focus-ring control-pill" style={{ minHeight: '36px', padding: '0 10px', fontSize: '11px' }}>
                  {panelCollapsed ? 'Expand' : 'Collapse'}
                </button>
              </div>

              {!panelCollapsed && (
                <div style={{ display: 'grid', gap: '10px' }}>
                  <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: T.slate2, marginBottom: '8px' }}>Patient info</div>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      {[
                        ['Patient', 'Ava Addo'],
                        ['Age / Gender', '34 • Female'],
                        ['Blood Group', 'O+'],
                        ['Allergies', 'Penicillin'],
                        ['Current Medications', 'Lisinopril 10mg'],
                      ].map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12.5px', color: T.slate }}>
                          <span style={{ color: T.slate2 }}>{label}</span>
                          <span style={{ color: T.navy, fontWeight: 700, textAlign: 'right' }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: T.slate2 }}>SOAP notes</div>
                      <div className="chip" style={{ background: 'rgba(32,181,223,0.12)', color: T.blue }}>Auto-saving</div>
                    </div>
                    <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={7} className="focus-ring" style={{ width: '100%', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.08)', padding: '10px 12px', fontSize: '12px', color: T.navy, lineHeight: 1.6, resize: 'vertical', background: 'rgba(255,255,255,0.9)' }} aria-label="Clinical notes" />
                    <div style={{ marginTop: '8px', fontSize: '11px', color: T.slate2 }}>Last updated {date} • {slot}</div>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: T.slate2, marginBottom: '8px' }}>Live vitals</div>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {[['Heart rate', '78 bpm'], ['Blood pressure', '120/78'], ['Blood oxygen', '98%'], ['Temperature', '36.8°C']].map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.86)', border: '1px solid rgba(4,53,77,0.06)' }}>
                          <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
                          <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700 }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: T.slate2 }}>AI assistant</div>
                      <div className="chip" style={{ background: 'rgba(165,224,218,0.26)', color: T.navy }}>Review required</div>
                    </div>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {[['Consultation summary', 'Placeholder summary ready for physician review'], ['Medication suggestions', 'Suggested follow-up considerations'], ['Clinical reminders', 'Recheck symptoms after 48 hours']].map(([label, value]) => (
                        <div key={label} style={{ padding: '8px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(4,53,77,0.06)' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: T.navy }}>{label}</div>
                          <div style={{ fontSize: '12px', color: T.slate, marginTop: '3px' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: T.slate2 }}>Documents</div>
                      <button type="button" onClick={() => setDocsOpen((v) => !v)} className="focus-ring control-pill" style={{ minHeight: '32px', padding: '0 10px', fontSize: '11px' }}>{docsOpen ? 'Hide' : 'Open'}</button>
                    </div>
                    {docsOpen && (
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {documentFiles.map((file) => (
                          <div key={file.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.84)', border: '1px solid rgba(4,53,77,0.06)' }}>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: T.navy }}>{file.name}</div>
                              <div style={{ fontSize: '11px', color: T.slate2 }}>{file.type} • {file.size}</div>
                            </div>
                            <button type="button" className="focus-ring control-pill" style={{ minHeight: '30px', padding: '0 10px', fontSize: '11px' }}>View</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '12px', borderRadius: '14px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: T.slate2 }}>Live chat</div>
                      <button type="button" onClick={() => setChatOpen((v) => !v)} className="focus-ring control-pill" style={{ minHeight: '32px', padding: '0 10px', fontSize: '11px' }}>{chatOpen ? 'Hide' : 'Show'}</button>
                    </div>
                    {chatOpen && (
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {messages.map((message) => (
                          <div key={message.id} style={{ padding: '8px 10px', borderRadius: '10px', background: message.from === 'doctor' ? 'rgba(32,181,223,0.10)' : message.from === 'patient' ? 'rgba(165,224,218,0.18)' : 'rgba(255,255,255,0.86)', border: '1px solid rgba(4,53,77,0.06)' }}>
                            <div style={{ fontSize: '11px', color: T.slate2, marginBottom: '4px' }}>{message.from === 'doctor' ? 'Physician' : message.from === 'patient' ? 'Patient' : 'System'} • {message.time}</div>
                            <div style={{ fontSize: '12px', color: T.navy, lineHeight: 1.6 }}>{message.text}</div>
                          </div>
                        ))}
                        {typing && <div style={{ fontSize: '11px', color: T.slate2 }}>Physician is typing…</div>}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                          {quickReplies.map((reply) => (
                            <button key={reply} type="button" onClick={() => handleQuickReply(reply)} className="focus-ring control-pill" style={{ minHeight: '32px', padding: '0 10px', fontSize: '11px' }}>{reply}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </aside>
        </div>

        {/* ── Fixed control dock ───────────────────────────────────────────── */}
        <footer className="control-dock" role="toolbar" aria-label="Consultation controls">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              id="dock-mic-btn"
              onClick={handleMicClick}
              disabled={micLoading}
              className={`focus-ring control-pill${micMuted && !micLoading ? ' muted' : ''}`}
              aria-label={micAriaLabel}
              aria-pressed={!micMuted}
              title={micAriaLabel}
            >
              {micLoading ? (
                <div style={{ width: '14px', height: '14px', borderRadius: '999px', border: '2px solid rgba(32,181,223,0.3)', borderTopColor: T.blue, animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <Ico p={['M12 5a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0V8a3 3 0 0 1 3-3z', 'M7 10a5 5 0 0 0 10 0', 'M12 15v4', 'M8 19h8']} size={14} />
              )}
              Microphone
            </button>

            <button
              type="button"
              id="dock-camera-btn"
              onClick={handleCameraClick}
              disabled={cameraLoading}
              className={`focus-ring control-pill${cameraOn ? ' active' : ''}`}
              aria-label={cameraAriaLabel}
              aria-pressed={cameraOn}
              title={cameraAriaLabel}
            >
              {cameraLoading ? (
                <div style={{ width: '14px', height: '14px', borderRadius: '999px', border: '2px solid rgba(32,181,223,0.3)', borderTopColor: T.blue, animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <Ico p={ICONS.video} size={14} />
              )}
              Camera
            </button>

            <button type="button" onClick={() => setSpeakerOn((v) => !v)} className={`focus-ring control-pill${!speakerOn ? ' muted' : ''}`} aria-pressed={speakerOn} aria-label={speakerOn ? 'Mute speaker' : 'Unmute speaker'}>
              <Ico p={['M11 5a1 1 0 0 1 1.62-.78l4.67 3.75A1 1 0 0 1 17 9H4a1 1 0 0 1-.29-1.96L11 5z', 'M13.5 9.5v5', 'M16.5 7.5v9', 'M19.5 10.5v3']} size={14} />
              Speaker
            </button>

            <button type="button" onClick={() => setShareOn((v) => !v)} className={`focus-ring control-pill${shareOn ? ' active' : ''}`} aria-pressed={shareOn} aria-label={shareOn ? 'Stop sharing' : 'Share screen'}>
              <Ico p={['M12 14v-7', 'M8 8l4-4 4 4', 'M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5']} size={14} />
              Screen Share
            </button>

            <button type="button" onClick={() => setChatOpen((v) => !v)} className={`focus-ring control-pill${chatOpen ? ' active' : ''}`} aria-pressed={chatOpen} aria-label={chatOpen ? 'Hide chat' : 'Show chat'}>
              <Ico p={ICONS.ema} size={14} />
              Chat
            </button>

            <button type="button" onClick={() => setDocsOpen((v) => !v)} className={`focus-ring control-pill${docsOpen ? ' active' : ''}`} aria-pressed={docsOpen} aria-label={docsOpen ? 'Hide documents' : 'Show documents'}>
              <Ico p={ICONS.shield} size={14} />
              Documents
            </button>

            <button type="button" onClick={() => setCaptionsOn((v) => !v)} className={`focus-ring control-pill${captionsOn ? ' active' : ''}`} aria-pressed={captionsOn} aria-label={captionsOn ? 'Turn off captions' : 'Turn on captions'}>
              <Ico p={ICONS.info} size={14} />
              Captions
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setSettingsOpen((v) => !v)} className={`focus-ring control-pill${settingsOpen ? ' active' : ''}`} aria-pressed={settingsOpen} aria-label="Settings">
              <Ico p={ICONS.cpu} size={14} />
              Settings
            </button>
            <button type="button" onClick={() => setRaiseHand((v) => !v)} className={`focus-ring control-pill${raiseHand ? ' active' : ''}`} aria-pressed={raiseHand} aria-label={raiseHand ? 'Lower hand' : 'Raise hand'}>
              <Ico p={ICONS.heart} size={14} />
              Raise Hand
            </button>
            <button type="button" onClick={() => setReaction((v) => (v === 'spark' ? null : 'spark'))} className={`focus-ring control-pill${reaction === 'spark' ? ' active' : ''}`} aria-pressed={reaction === 'spark'} aria-label="Send reaction">
              <Ico p={ICONS.zap} size={14} />
              Reaction
            </button>
            <button type="button" className="focus-ring control-pill" aria-label="More options">
              <Ico p={ICONS.activity} size={14} />
              More
            </button>
            <button type="button" id="dock-leave-btn" onClick={() => setConfirmEndOpen(true)} className="focus-ring control-pill leave" aria-label="End consultation">
              Leave
            </button>
          </div>
        </footer>
      </div>

      {/* ── End consultation confirmation modal ──────────────────────────── */}
      {confirmEndOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="end-consultation-title" onClick={(e) => { if (e.target === e.currentTarget) setConfirmEndOpen(false) }}>
          <section className="modal-card">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '999px', background: 'rgba(220,38,38,0.08)', color: T.red, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <Ico p={ICONS.check} size={10} sw={2.4} />
              End consultation
            </div>
            <h2 id="end-consultation-title" style={{ margin: '12px 0 8px', fontSize: '22px', fontWeight: 800, color: T.navy }}>Are you sure you want to end this consultation?</h2>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>
              This will hand off the visit to the post-consultation workflow with notes, documents, and conversation history preserved.
              {cameraOn && ' Your camera will be turned off.'}
              {!micMuted && ' Your microphone will be muted.'}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setConfirmEndOpen(false)} className="focus-ring control-pill" style={{ minHeight: '44px', padding: '0 14px' }}>
                Continue Consultation
              </button>
              <button type="button" id="confirm-end-btn" onClick={handleEndConsultation} className="focus-ring control-pill leave" style={{ minHeight: '44px', padding: '0 14px' }}>
                End Consultation
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function LiveConsultationPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: '100vh', background: PAGE_BG, padding: '24px', color: T.navy }}>Preparing your live consultation room…</main>}>
      <LiveConsultationPageContent />
    </Suspense>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalBadge, PortalButton, PortalCard, PortalLinkButton } from '@/components/patient/PatientPortalPrimitives'

type Status = 'idle' | 'checking' | 'pass' | 'fail'
type CheckId = 'browser' | 'camera' | 'microphone' | 'speakers' | 'connection'

const CHECKS: CheckId[] = ['browser', 'camera', 'microphone', 'speakers', 'connection']
const IDLE: Record<CheckId, Status> = { browser: 'idle', camera: 'idle', microphone: 'idle', speakers: 'idle', connection: 'idle' }
/** Above this round trip a video call is likely to stutter. */
const SLOW_ROUND_TRIP_MS = 400
const TONES: Record<Status, 'neutral' | 'info' | 'success' | 'warning'> = { idle: 'neutral', checking: 'info', pass: 'success', fail: 'warning' }

/**
 * A device check that reports only what this browser actually measured:
 * camera and microphone through getUserMedia, a live input level, a test tone the
 * patient confirms, and a round trip to Qarevo. Nothing is simulated or assumed.
 */
export default function DeviceCheckPage() {
  const t = useTranslations('patientDeviceCheck')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const frameRef = useRef(0)
  const [status, setStatus] = useState<Record<CheckId, Status>>(IDLE)
  const [errors, setErrors] = useState<Partial<Record<CheckId, string>>>({})
  const [level, setLevel] = useState(0)
  const [roundTrip, setRoundTrip] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [tonePlayed, setTonePlayed] = useState(false)

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    void audioRef.current?.close().catch(() => undefined)
    audioRef.current = null
  }, [])
  useEffect(() => stop, [stop])

  const mark = (id: CheckId, value: Status, error?: string) => {
    setStatus(previous => ({ ...previous, [id]: value }))
    setErrors(previous => ({ ...previous, [id]: error }))
  }

  const mediaError = (error: unknown) => {
    const name = error instanceof DOMException ? error.name : ''
    if (name === 'NotAllowedError' || name === 'SecurityError') return t('errorPermission')
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return t('errorNotFound')
    if (name === 'NotReadableError') return t('errorInUse')
    if (name === 'NotSupportedError') return t('errorBrowser')
    return t('errorUnknown')
  }

  const audio = () => {
    if (!audioRef.current) audioRef.current = new AudioContext()
    return audioRef.current
  }

  /** Shows the real microphone input level, so the patient can see their voice arrive. */
  const listen = (track: MediaStreamTrack) => {
    const context = audio(), analyser = context.createAnalyser()
    analyser.fftSize = 512
    context.createMediaStreamSource(new MediaStream([track])).connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)
    const tick = () => {
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const sample of samples) sum += ((sample - 128) / 128) ** 2
      setLevel(Math.min(100, Math.round(Math.sqrt(sum / samples.length) * 300)))
      frameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  /** Each device is requested on its own, so a missing camera does not fail the microphone. */
  const capture = async (kind: 'camera' | 'microphone') => {
    mark(kind, 'checking')
    try {
      const stream = await navigator.mediaDevices.getUserMedia(kind === 'camera' ? { video: true } : { audio: true })
      const track = (kind === 'camera' ? stream.getVideoTracks() : stream.getAudioTracks())[0]
      if (!track || track.readyState !== 'live') { stream.getTracks().forEach(item => item.stop()); mark(kind, 'fail', t('errorNotFound')); return }
      if (!streamRef.current) streamRef.current = new MediaStream()
      streamRef.current.addTrack(track)
      if (kind === 'camera' && videoRef.current) {
        videoRef.current.srcObject = new MediaStream([track])
        void videoRef.current.play().catch(() => undefined)
      }
      if (kind === 'microphone') listen(track)
      mark(kind, 'pass')
    } catch (error) {
      mark(kind, 'fail', mediaError(error))
    }
  }

  const measure = async () => {
    mark('connection', 'checking')
    if (!navigator.onLine) { mark('connection', 'fail', t('errorOffline')); return }
    try {
      const samples: number[] = []
      for (let index = 0; index < 3; index++) {
        const started = performance.now()
        const response = await fetch(`/brand/qarevo-mark.png?probe=${Date.now()}-${index}`, { method: 'HEAD', cache: 'no-store' })
        if (!response.ok) throw new Error('probe failed')
        samples.push(performance.now() - started)
      }
      const fastest = Math.round(Math.min(...samples))
      setRoundTrip(fastest)
      mark('connection', fastest <= SLOW_ROUND_TRIP_MS ? 'pass' : 'fail', fastest <= SLOW_ROUND_TRIP_MS ? undefined : t('errorSlow'))
    } catch {
      mark('connection', 'fail', t('errorConnection'))
    }
  }

  const run = async () => {
    if (running) return
    stop()
    setRunning(true); setStatus(IDLE); setErrors({}); setLevel(0); setRoundTrip(null); setTonePlayed(false)
    if (videoRef.current) videoRef.current.srcObject = null
    const supported = Boolean(navigator.mediaDevices?.getUserMedia) && typeof RTCPeerConnection !== 'undefined' && typeof AudioContext !== 'undefined'
    mark('browser', supported ? 'pass' : 'fail', supported ? undefined : t('errorBrowser'))
    if (supported) {
      await capture('camera')
      await capture('microphone')
      mark('speakers', 'checking')
    }
    await measure()
    setRunning(false)
  }

  const playTone = () => {
    const context = audio(), oscillator = context.createOscillator(), gain = context.createGain()
    oscillator.frequency.value = 523
    gain.gain.setValueAtTime(0.15, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.8)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(); oscillator.stop(context.currentTime + 0.8)
    setTonePlayed(true)
  }

  const ready = CHECKS.every(id => status[id] === 'pass')
  const failed = CHECKS.filter(id => status[id] === 'fail')
  const started = status.browser !== 'idle'

  return (
    <PatientPortalShell eyebrow={t('eyebrow')} title={t('title')} description={t('description')}>
      <div className='grid gap-4'>
        <PortalCard>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <p role='status' className='m-0 text-sm leading-6 text-secondary'>
              {running ? t('running') : ready ? t('ready') : failed.length ? t('attention', { count: failed.length }) : started ? t('confirmSpeakers') : t('intro')}
            </p>
            <div className='flex flex-wrap gap-2'>
              <PortalButton tone='primary' onClick={() => void run()} disabled={running}>{started ? t('runAgain') : t('run')}</PortalButton>
              {ready && <PortalLinkButton href='/patient/appointments'>{t('toAppointments')}</PortalLinkButton>}
            </div>
          </div>
        </PortalCard>

        <div className='grid gap-4 lg:grid-cols-2'>
          <PortalCard>
            <h2 className='mb-3 text-lg font-semibold text-ink'>{t('cameraPreview')}</h2>
            <video ref={videoRef} muted playsInline aria-label={t('cameraPreview')} className='aspect-video w-full rounded-xl bg-surface-subtle object-cover' style={{ transform: 'scaleX(-1)' }} />
            {status.camera !== 'pass' && <p className='mt-3 text-sm text-secondary'>{t('previewHint')}</p>}
          </PortalCard>
          <PortalCard>
            <h2 className='mb-3 text-lg font-semibold text-ink'>{t('microphoneLevel')}</h2>
            <div role='meter' aria-label={t('microphoneLevel')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={level} className='h-3 w-full overflow-hidden rounded-full bg-surface-subtle'>
              <div className='h-full rounded-full transition-[width]' style={{ width: `${level}%`, background: 'linear-gradient(90deg, #20B5DF 0%, var(--primary-end) 100%)' }} />
            </div>
            <p className='mt-3 text-sm text-secondary'>{status.microphone === 'pass' ? t('speakHint') : t('microphoneHint')}</p>
            <h2 className='mt-5 mb-3 text-lg font-semibold text-ink'>{t('speakerTest')}</h2>
            <div className='flex flex-wrap gap-2'>
              <PortalButton onClick={playTone} disabled={status.browser !== 'pass'}>{t('playTone')}</PortalButton>
              <PortalButton onClick={() => mark('speakers', 'pass')} disabled={!tonePlayed}>{t('heardTone')}</PortalButton>
              <PortalButton onClick={() => mark('speakers', 'fail', t('errorSpeakers'))} disabled={!tonePlayed}>{t('notHeardTone')}</PortalButton>
            </div>
          </PortalCard>
        </div>

        <PortalCard>
          <h2 className='mb-3 text-lg font-semibold text-ink'>{t('results')}</h2>
          <ul className='grid list-none gap-3 p-0'>
            {CHECKS.map(id => (
              <li key={id} className='flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-xl border border-theme p-3'>
                <div className='min-w-0'>
                  <p className='m-0 font-semibold text-ink'>{t(`check.${id}`)}</p>
                  {id === 'connection' && roundTrip !== null && <p className='m-0 mt-1 text-sm text-secondary'>{t('roundTrip', { ms: roundTrip })}</p>}
                  {errors[id] && <p className='m-0 mt-1 text-sm text-ink'>{errors[id]}</p>}
                </div>
                <PortalBadge tone={TONES[status[id]]}>{t(`status.${status[id]}`)}</PortalBadge>
              </li>
            ))}
          </ul>
          <p className='mt-4 mb-0 text-sm leading-6 text-secondary'>{t('privacy')}</p>
        </PortalCard>
      </div>
    </PatientPortalShell>
  )
}

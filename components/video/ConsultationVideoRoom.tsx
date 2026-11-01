'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiGet, apiPost, getApiErrorDetail } from '@/lib/api'
import type { ChimeJoinResponse } from '@/lib/chime'
import type { VideoConnection, VideoState, VideoTile } from '@/lib/video-connection'
import FeatureAvailability from '@/components/ui/FeatureAvailability'

type Props = { role: 'patient' | 'doctor' }
type Consultation = { consultation_id: string; status: string; scheduled_at: string | null }

function Tile({ tile, connection }: { tile: VideoTile; connection: VideoConnection | null }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (video.current) connection?.bindTile(tile.id, video.current) }, [connection, tile.id])
  return <figure className="qarevo-video-tile">
    <video ref={video} autoPlay playsInline muted={tile.local} aria-label={tile.local ? 'Your camera preview' : 'Other participant video'} />
    <figcaption>{tile.local ? 'You' : 'Other participant'}{!tile.active ? ' · Camera paused' : ''}</figcaption>
  </figure>
}

export default function ConsultationVideoRoom({ role }: Props) {
  const params = useSearchParams()
  const id = params.get('consultationId')
  const validId = Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<VideoState | 'ready'>('ready')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tiles, setTiles] = useState<VideoTile[]>([])
  const [others, setOthers] = useState(0)
  const [microphone, setMicrophone] = useState(true)
  const [camera, setCamera] = useState(false)
  const [cameraOnJoin, setCameraOnJoin] = useState(true)
  const [cameraBusy, setCameraBusy] = useState(false)
  const [ending, setEnding] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [revision, setRevision] = useState(0)
  const audio = useRef<HTMLAudioElement>(null)
  const connection = useRef<VideoConnection | null>(null)
  const attempt = useRef(0)
  const busy = useRef(false)

  useEffect(() => {
    let active = true
    setConsultation(null); setError(''); setLoading(true)
    if (!validId) { setLoading(false); return }
    apiGet<Consultation>(`/api/v1/consultations/${id}`).then(data => { if (active) setConsultation(data) })
      .catch(error => { if (active) setError(getApiErrorDetail(error) || 'Your consultation could not be verified.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, validId, revision])

  useEffect(() => {
    const stop = () => { attempt.current++; void connection.current?.stop(); connection.current = null; busy.current = false }
    const restored = (event: PageTransitionEvent) => { if (event.persisted) { setState('closed'); setTiles([]); setOthers(0); setNotice('This page was restored. Join again to reconnect your devices.') } }
    window.addEventListener('pagehide', stop)
    window.addEventListener('pageshow', restored)
    return () => { window.removeEventListener('pagehide', stop); window.removeEventListener('pageshow', restored); stop() }
  }, [id])

  async function join() {
    if (!id || !consultation || busy.current || !audio.current) return
    busy.current = true
    const version = ++attempt.current
    setState('connecting'); setError(''); setNotice(''); setTiles([]); setOthers(0)
    try {
      await connection.current?.stop()
      const payload = await apiPost<ChimeJoinResponse>(`/api/v1/consultations/${id}/video-session/join`, {})
      if (version !== attempt.current) return
      const { createVideoConnection } = await import('@/lib/video-connection')
      if (version !== attempt.current) return
      const current = () => version === attempt.current
      const room = await createVideoConnection(payload, audio.current, {
        state(next, message) { if (current()) { setState(next); if (message) setNotice(message) } },
        tile(tile) { if (current()) setTiles(items => [...items.filter(item => item.id !== tile.id), tile]) },
        removeTile(tileId) { if (current()) setTiles(items => items.filter(item => item.id !== tileId)) },
        participants(count) { if (current()) setOthers(count) },
        warning(message) { if (current()) setNotice(message) },
      })
      if (!current()) { await room.stop(); return }
      connection.current = room
      const enabled = await room.start(cameraOnJoin)
      if (current()) { setCamera(Boolean(enabled)); setMicrophone(true) }
    } catch (error) {
      if (version === attempt.current) {
        setState('closed')
        setError(getApiErrorDetail(error) || (error instanceof Error && error.name === 'NotAllowedError'
          ? 'Microphone access was denied. Allow access in browser settings, then retry.' : 'The call could not connect. Check your device permissions and connection, then retry.'))
      }
    } finally { if (version === attempt.current) busy.current = false }
  }
  async function leave() {
    attempt.current++; busy.current = false
    const room = connection.current; connection.current = null
    setState('closed'); setTiles([]); setOthers(0); setNotice('You left the call. You can rejoin while the appointment is active.')
    await room?.stop()
  }
  async function toggleCamera() {
    if (cameraBusy) return
    setCameraBusy(true); setError('')
    try { setCamera(Boolean(await connection.current?.setCamera(!camera))) }
    catch { setError('Camera access failed. Check browser permissions or continue with audio.') }
    finally { setCameraBusy(false) }
  }
  async function endCall() {
    if (ending || !id) return
    setEnding(true); setError('')
    try {
      await apiPost(`/api/v1/consultations/${id}/video-session/end`, { consultation_id: id })
      await leave(); setConfirmEnd(false); setConsultation(null)
      setNotice('The video call has ended. Complete and review the clinical record in your workspace.')
    } catch (error) { setError(getApiErrorDetail(error) || 'The call could not be ended for everyone. Retry or leave this device.') }
    finally { setEnding(false) }
  }
  const connected = state === 'connected' || state === 'reconnecting'
  if (!validId) return <FeatureAvailability title="Select your saved appointment" description="Open the video room from an appointment or your clinical workspace. A consultation must be verified before you can join." actions={[
    { href: `/${role}/appointments`, label: 'View appointments' },
    ...(role === 'patient' ? [{ href: '/patient/video-consultation/device-check', label: 'Check camera and microphone' }] : []),
  ]} />

  return <section className="qarevo-video-room" aria-labelledby="video-room-title">
    <style>{`
      .qarevo-video-room { padding: clamp(20px, 4vw, 32px); border-radius: 24px; border: 1px solid var(--border); background: var(--surface); color: var(--ink); }
      .qarevo-video-room button, .qarevo-video-room a { min-height: 44px; border-radius: 12px; padding: 10px 16px; border: 1px solid var(--border); color: var(--link); display: inline-flex; align-items: center; gap: 8px; }
      .qarevo-video-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 16px; margin: 24px 0; }
      .qarevo-video-tile { position: relative; overflow: hidden; border-radius: 16px; background: #071c29; aspect-ratio: 16/10; }
      .qarevo-video-tile video { width: 100%; height: 100%; object-fit: contain; }
      .qarevo-video-tile figcaption { position: absolute; bottom: 10px; left: 10px; padding: 5px 10px; border-radius: 8px; background: #071c29dd; color: white; font-size: 14px; }
    `}</style>
    <h1 id="video-room-title" className="text-2xl font-semibold tracking-tight">Consultation video room</h1>
    <p className="mt-2 text-muted">Join from a private space. This call does not record audio or video.</p>
    <audio ref={audio} autoPlay />
    <p className="mt-5 font-medium" role="status" aria-live="polite">{loading ? 'Verifying your appointment…' : state === 'connecting' ? 'Connecting and checking device access…' : state === 'reconnecting' ? 'Connection interrupted. Reconnecting…' : state === 'connected' ? (others ? 'Connected · Other participant present' : 'Connected · Waiting for the other participant') : notice || 'Ready when you are. The room opens 15 minutes before your appointment.'}</p>
    {notice && connected && <p className="mt-3 text-muted">{notice}</p>}
    {error && <p role="alert" className="mt-4 text-red-700 dark:text-red-300">{error}</p>}
    <div className="qarevo-video-grid">{tiles.map(tile => <Tile key={tile.id} tile={tile} connection={connection.current} />)}</div>
    {!connected && state !== 'connecting' && consultation && <>
      <label className="mb-4 flex items-center gap-3"><input type="checkbox" checked={cameraOnJoin} onChange={event => setCameraOnJoin(event.target.checked)} />Enable camera when joining</label>
      <button onClick={join}>Join consultation</button>
    </>}
    {!loading && !consultation && error && <button onClick={() => setRevision(value => value + 1)}>Retry appointment check</button>}
    {(connected || state === 'connecting') && <div className="flex flex-wrap gap-3">
      {connected && <>
        <button aria-pressed={!microphone} onClick={() => setMicrophone(connection.current?.setMicrophone(!microphone) || false)}>{microphone ? 'Mute microphone' : 'Unmute microphone'}</button>
        <button aria-pressed={camera} disabled={cameraBusy} onClick={toggleCamera}>{cameraBusy ? 'Updating camera…' : camera ? 'Turn camera off' : 'Turn camera on'}</button>
        <button onClick={() => { void audio.current?.play().catch(() => setError('Audio playback is blocked. Check browser sound permissions.')) }}>Enable speaker audio</button>
      </>}
      <button onClick={leave}>Leave call</button>
      {role === 'doctor' && connected && <button onClick={() => setConfirmEnd(true)}>End call for everyone</button>}
    </div>}
    {confirmEnd && <div className="mt-5 rounded-xl border border-theme p-4">
      <p>End the video call for both participants? Clinical documentation must still be completed separately.</p>
      <div className="mt-3 flex flex-wrap gap-3"><button disabled={ending} onClick={endCall}>{ending ? 'Ending call…' : 'Confirm end call'}</button><button onClick={() => setConfirmEnd(false)}>Keep call open</button></div>
    </div>}
    <div className="mt-6 flex flex-wrap gap-3">
      <Link href={`/${role}/appointments`}>Back to appointments</Link>
      {role === 'doctor' && <Link href={`/doctor/workspace/${id}`}>Open clinical workspace</Link>}
    </div>
  </section>
}

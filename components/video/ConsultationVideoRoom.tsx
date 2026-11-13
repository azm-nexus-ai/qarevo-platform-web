'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiPost, getApiErrorDetail } from '@/lib/api'
import { usePatientResource } from '@/lib/use-patient-resource'
import type { ChimeJoinResponse } from '@/lib/chime'
import type { VideoConnection, VideoState, VideoTile } from '@/lib/video-connection'
import FeatureAvailability from '@/components/ui/FeatureAvailability'
import '@/components/doctor/doctor-clinical.css'
import './consultation-room.css'

type Props = { role: 'patient' | 'doctor' }
type Consultation = { consultation_id: string; status: string | null; scheduled_at: string | null; patient_name?: string | null; provider_names?: string[]; episode_id?: string | null }

function MediaTile({ tile, connection, local, name, camera }: { tile?: VideoTile; connection: VideoConnection | null; local: boolean; name: string; camera?: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (tile && video.current) connection?.bindTile(tile.id, video.current) }, [connection, tile])
  return <figure className='consultation-media-tile'>
    {tile ? <video ref={video} autoPlay playsInline muted={local} aria-label={local ? 'Your camera preview' : `${name} video`} /> : <div className='consultation-media-placeholder'><span aria-hidden='true'>{name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('')}</span><p>{local ? camera ? 'Preparing your camera' : 'Your camera is off' : 'Waiting for the other participant'}</p></div>}
    <figcaption><strong>{local ? 'You' : name}</strong><span>{tile ? tile.active ? 'Camera on' : 'Camera paused' : 'Camera off'}</span></figcaption>
  </figure>
}

export default function ConsultationVideoRoom({ role }: Props) {
  const params = useSearchParams()
  const id = params.get('consultationId')
  const validId = Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
  if (!validId || !id) return <FeatureAvailability title='Select your saved appointment' description='Open the video room from an appointment or your clinical workspace. A consultation must be verified before you can join.' actions={[
    { href: `/${role}/appointments`, label: 'View appointments' },
    ...(role === 'patient' ? [{ href: '/patient/video-consultation/device-check', label: 'Check camera and microphone' }] : []),
  ]} />
  return <VerifiedVideoRoom key={id} role={role} id={id}/>
}

function VerifiedVideoRoom({ role, id }: Props & { id: string }) {
  const {data:consultation,loading,errorMessage:metadataError,retry} = usePatientResource<Consultation>(`/api/v1/consultations/${id}`)
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
  const [ended, setEnded] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  const endDialog = useRef<HTMLDialogElement>(null)
  const connection = useRef<VideoConnection | null>(null)
  const attempt = useRef(0)
  const busy = useRef(false)

  useEffect(() => {
    const stop = () => { attempt.current++; void connection.current?.stop(); connection.current = null; busy.current = false }
    const restored = (event: PageTransitionEvent) => { if (event.persisted) { setState('closed'); setTiles([]); setOthers(0); setNotice('This page was restored. Join again to reconnect your devices.') } }
    window.addEventListener('pagehide', stop); window.addEventListener('pageshow', restored)
    return () => { window.removeEventListener('pagehide', stop); window.removeEventListener('pageshow', restored); stop() }
  }, [])
  useEffect(() => { const dialog=endDialog.current; if(confirmEnd) dialog?.showModal(); return()=>dialog?.close() },[confirmEnd])

  async function join() {
    if (!consultation || busy.current || !audio.current || ended) return
    busy.current = true
    const version = ++attempt.current
    setState('connecting'); setError(''); setNotice(''); setTiles([]); setOthers(0)
    try {
      await connection.current?.stop()
      // Only an explicit join starts these tasks. SDK loading overlaps the API
      // handshake instead of adding a second network waterfall after it.
      const [payload,{createVideoConnection},sdk] = await Promise.all([
        apiPost<ChimeJoinResponse>(`/api/v1/consultations/${id}/video-session/join`, {}),
        import('@/lib/video-connection'),
        import('amazon-chime-sdk-js'),
      ])
      if (version !== attempt.current) return
      const current = () => version === attempt.current
      const room = await createVideoConnection(payload, audio.current, {
        state(next, message) { if (current()) { setState(next); if (message) setNotice(message) } },
        tile(tile) { if (current()) setTiles(items => [...items.filter(item => item.id !== tile.id), tile]) },
        removeTile(tileId) { if (current()) setTiles(items => items.filter(item => item.id !== tileId)) },
        participants(count) { if (current()) setOthers(count) },
        warning(message) { if (current()) setNotice(message) },
      },()=>Promise.resolve(sdk))
      if (!current()) { await room.stop(); return }
      connection.current = room
      const enabled = await room.start(cameraOnJoin)
      if (current()) { setCamera(Boolean(enabled)); setMicrophone(true) }
    } catch (failure) {
      if (version === attempt.current) {
        setState('closed')
        setError(getApiErrorDetail(failure) || (failure instanceof Error && failure.name === 'NotAllowedError'
          ? 'Microphone access was denied. Allow access in browser settings, then retry.' : 'The call could not connect. Check your device permissions and connection, then retry.'))
      }
    } finally { if (version === attempt.current) busy.current = false }
  }
  async function leave() {
    attempt.current++; busy.current = false
    const room = connection.current; connection.current = null
    setState('closed'); setTiles([]); setOthers(0); setCamera(false); setNotice('You left the call. You can rejoin while the appointment is active.')
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
    if (ending) return
    setEnding(true); setError('')
    try {
      await apiPost(`/api/v1/consultations/${id}/video-session/end`, { consultation_id: id })
      await leave(); setConfirmEnd(false); setEnded(true)
      setNotice('The video call has ended. Complete and review the clinical record in your workspace.')
    } catch (failure) { setError(getApiErrorDetail(failure) || 'The call could not be ended for everyone. Retry or leave this device.') }
    finally { setEnding(false) }
  }
  const connected = state === 'connected' || state === 'reconnecting'
  const closedByServer = ['ENDED','CANCELLED','COMPLETED'].includes(consultation?.status || '')
  const canJoin = Boolean(consultation && !ended && !closedByServer)
  const otherName = role === 'doctor' ? consultation?.patient_name || 'Patient' : consultation?.provider_names?.join(', ') || 'Clinician'
  const localTile=tiles.find(tile=>tile.local)
  const remoteTiles=tiles.filter(tile=>!tile.local)
  const status = loading ? 'Verifying appointment' : ended || closedByServer ? 'Consultation ended' : state === 'connecting' ? 'Connecting' : state === 'reconnecting' ? 'Reconnecting' : connected ? 'Connected' : 'Not connected'
  return <section className='consultation-room' aria-labelledby='video-room-title' aria-busy={loading}>
    <header className='consultation-room-header'><div><p className='consultation-eyebrow'>Private consultation</p><h1 id='video-room-title'>Consultation video room</h1><p className='consultation-room-subtitle'>Join from a private space. Recording is not available in this room.</p></div><span className='consultation-connection-status' data-connected={connected}>{status}</span></header>
    <audio ref={audio} autoPlay/>
    <div className='consultation-context'><div><span>{role==='doctor'?'Patient':'Clinician'}</span><strong>{otherName}</strong></div><div><span>Appointment</span><strong>{consultation?.scheduled_at?new Date(consultation.scheduled_at).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'Time verified at join'}</strong></div><div><span>Participants</span><strong>{connected?`${others+1} connected`:'Waiting to join'}</strong></div></div>
    <p className='consultation-live-status' role='status' aria-live='polite'>{loading?'Verifying your appointment…':state==='connecting'?'Connecting and checking device access…':state==='reconnecting'?'Connection interrupted. Reconnecting…':state==='connected'?(others?'Connected · Other participant present':'Connected · Waiting for the other participant'):notice||(closedByServer?'This consultation is no longer open for video.':'Ready when you are. Joining verifies appointment timing and access.')}</p>
    {(error || metadataError)&&<div role='alert' className='consultation-error'>{error || metadataError}{!consultation&&metadataError&&<button className='clinical-action' onClick={retry}>Retry appointment check</button>}</div>}
    <div className='consultation-video-grid' aria-label='Consultation participants'>
      <MediaTile tile={localTile} connection={connection.current} local name='You' camera={camera}/>
      {remoteTiles.length?remoteTiles.map(tile=><MediaTile key={tile.id} tile={tile} connection={connection.current} local={false} name={otherName}/>):<MediaTile connection={connection.current} local={false} name={otherName}/>}
    </div>
    {!connected && state!=='connecting' && canJoin&&<div className='consultation-prejoin'><label><input type='checkbox' checked={cameraOnJoin} onChange={event=>setCameraOnJoin(event.target.checked)}/>Enable camera when joining</label><button className='clinical-action clinical-action--primary' disabled={loading} onClick={join}>Join consultation</button></div>}
    {(connected||state==='connecting')&&<div className='consultation-controls' aria-label='Call controls'>
      {connected&&<><button className='clinical-action' aria-pressed={!microphone} onClick={()=>setMicrophone(connection.current?.setMicrophone(!microphone)||false)}>{microphone?'Mute microphone':'Unmute microphone'}</button><button className='clinical-action' aria-pressed={camera} disabled={cameraBusy} onClick={toggleCamera}>{cameraBusy?'Updating camera…':camera?'Turn camera off':'Turn camera on'}</button><button className='clinical-action' onClick={()=>{void audio.current?.play().catch(()=>setError('Audio playback is blocked. Check browser sound permissions.'))}}>Enable speaker audio</button></>}
      <button className='clinical-action clinical-action--danger' onClick={leave}>Leave call</button>{role==='doctor'&&connected&&<button className='clinical-action clinical-action--danger' onClick={()=>setConfirmEnd(true)}>End call for everyone</button>}
    </div>}
    <dialog ref={endDialog} className='consultation-end-dialog' aria-labelledby='end-call-title' onCancel={()=>setConfirmEnd(false)}><h2 id='end-call-title'>End this consultation call?</h2><p>This ends video for both participants. Clinical documentation must still be completed separately.</p><div className='clinical-actions'><button className='clinical-action' disabled={ending} onClick={()=>setConfirmEnd(false)}>Keep call open</button><button className='clinical-action clinical-action--danger' disabled={ending} onClick={endCall}>{ending?'Ending call…':'Confirm end call'}</button></div></dialog>
    <footer className='consultation-room-footer'><Link className='clinical-action' href={`/${role}/appointments`}>Back to appointments</Link>{role==='doctor'&&<Link className='clinical-action' href={`/doctor/workspace/${id}`}>Open clinical workspace</Link>}{role==='doctor'&&consultation?.episode_id&&<Link className='clinical-action clinical-action--ai' href={`/doctor/episodes/${consultation.episode_id}`}>View AI Draft & Intake</Link>}</footer>
  </section>
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
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
  const t = useTranslations('videoRoom')
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (tile && video.current) connection?.bindTile(tile.id, video.current) }, [connection, tile])
  return <figure className='consultation-media-tile'>
    {tile ? <video ref={video} autoPlay playsInline muted={local} aria-label={local ? t('localPreview') : t('remoteVideo', { name })} /> : <div className='consultation-media-placeholder'><span aria-hidden='true'>{name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('')}</span><p>{local ? camera ? t('preparingCamera') : t('cameraOffSelf') : t('waitingOther')}</p></div>}
    <figcaption><strong>{local ? t('you') : name}</strong><span>{tile ? tile.active ? t('cameraOn') : t('cameraPaused') : t('cameraOff')}</span></figcaption>
  </figure>
}

export default function ConsultationVideoRoom({ role }: Props) {
  const t = useTranslations('videoRoom')
  const params = useSearchParams()
  const id = params.get('consultationId')
  const validId = Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
  if (!validId || !id) return <FeatureAvailability title={t('selectAppointment')} description={t('selectAppointmentText')} actions={[
    { href: `/${role}/appointments`, label: t('viewAppointments') },
    ...(role === 'patient' ? [{ href: '/patient/video-consultation/device-check', label: t('checkDevices') }] : []),
  ]} />
  return <VerifiedVideoRoom key={id} role={role} id={id}/>
}

function VerifiedVideoRoom({ role, id }: Props & { id: string }) {
  const t = useTranslations('videoRoom'), dateLocale = useLocale().startsWith('de') ? 'de-DE' : []
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
    const restored = (event: PageTransitionEvent) => { if (event.persisted) { setState('closed'); setTiles([]); setOthers(0); setNotice(t('restored')) } }
    window.addEventListener('pagehide', stop); window.addEventListener('pageshow', restored)
    return () => { window.removeEventListener('pagehide', stop); window.removeEventListener('pageshow', restored); stop() }
  }, [t])
  useEffect(() => { const dialog=endDialog.current; if(confirmEnd) dialog?.showModal(); return()=>dialog?.close() },[confirmEnd])

  async function join() {
    if (!consultation || busy.current || !audio.current || ended) return
    busy.current = true
    const version = ++attempt.current
    setState('connecting'); setError(''); setNotice(''); setTiles([]); setOthers(0)
    try {
      await connection.current?.stop()
      // Only an explicit join starts these tasks. The join payload names the provider,
      // so its media client (Chime SDK or the simulated one) loads after the handshake.
      const payload = await apiPost<ChimeJoinResponse>(`/api/v1/consultations/${id}/video-session/join`, {})
      if (version !== attempt.current) return
      const current = () => version === attempt.current
      const callbacks = {
        state(next: VideoState, message?: string) { if (current()) { setState(next); if (message) setNotice(message) } },
        tile(tile: VideoTile) { if (current()) setTiles(items => [...items.filter(item => item.id !== tile.id), tile]) },
        removeTile(tileId: number) { if (current()) setTiles(items => items.filter(item => item.id !== tileId)) },
        participants(count: number) { if (current()) setOthers(count) },
        warning(message: string) { if (current()) setNotice(message) },
      }
      // The provider named in the join payload decides the media client.
      const simulated = await import('@/lib/simulated-video-connection')
      const room: VideoConnection = simulated.isSimulatedPayload(payload)
        ? await simulated.createSimulatedConnection(payload, audio.current, callbacks)
        : await (await import('@/lib/video-connection')).createVideoConnection(payload, audio.current, callbacks)
      if (!current()) { await room.stop(); return }
      connection.current = room
      const enabled = await room.start(cameraOnJoin)
      if (current()) { setCamera(Boolean(enabled)); setMicrophone(true) }
    } catch (failure) {
      if (version === attempt.current) {
        setState('closed')
        setError(getApiErrorDetail(failure) || (failure instanceof Error && failure.name === 'NotAllowedError'
          ? t('micDenied') : t('connectFailed')))
      }
    } finally { if (version === attempt.current) busy.current = false }
  }
  async function leave() {
    attempt.current++; busy.current = false
    const room = connection.current; connection.current = null
    setState('closed'); setTiles([]); setOthers(0); setCamera(false); setNotice(t('leftCall'))
    await room?.stop()
  }
  async function toggleCamera() {
    if (cameraBusy) return
    setCameraBusy(true); setError('')
    try { setCamera(Boolean(await connection.current?.setCamera(!camera))) }
    catch { setError(t('cameraFailed')) }
    finally { setCameraBusy(false) }
  }
  async function endCall() {
    if (ending) return
    setEnding(true); setError('')
    try {
      await apiPost(`/api/v1/consultations/${id}/video-session/end`, { consultation_id: id })
      await leave(); setConfirmEnd(false); setEnded(true)
      setNotice(t('endedDoctor'))
    } catch (failure) { setError(getApiErrorDetail(failure) || t('endFailed')) }
    finally { setEnding(false) }
  }
  const connected = state === 'connected' || state === 'reconnecting'
  const closedByServer = ['ENDED','CANCELLED','COMPLETED'].includes(consultation?.status || '')
  const canJoin = Boolean(consultation && !ended && !closedByServer)
  const otherName = role === 'doctor' ? consultation?.patient_name || t('patient') : consultation?.provider_names?.join(', ') || t('clinician')
  const localTile=tiles.find(tile=>tile.local)
  const remoteTiles=tiles.filter(tile=>!tile.local)
  const status = loading ? t('statusVerifying') : ended || closedByServer ? t('statusEnded') : state === 'connecting' ? t('statusConnecting') : state === 'reconnecting' ? t('statusReconnecting') : connected ? t('statusConnected') : t('statusNotConnected')
  return <section className='consultation-room' aria-labelledby='video-room-title' aria-busy={loading}>
    <header className='consultation-room-header'><div><p className='consultation-eyebrow'>{t('eyebrow')}</p><h1 id='video-room-title'>{t('title')}</h1><p className='consultation-room-subtitle'>{t('privacyNote')}</p></div><span className='consultation-connection-status' data-connected={connected}>{status}</span></header>
    <audio ref={audio} autoPlay/>
    <div className='consultation-context'><div><span>{role==='doctor'?t('patient'):t('clinician')}</span><strong>{otherName}</strong></div><div><span>{t('appointment')}</span><strong>{consultation?.scheduled_at?new Date(consultation.scheduled_at).toLocaleString(dateLocale, {dateStyle:'medium',timeStyle:'short'}):t('timeAtJoin')}</strong></div><div><span>{t('participants')}</span><strong>{connected?t('connectedCount', { count: others + 1 }):t('waitingToJoin')}</strong></div></div>
    <p className='consultation-live-status' role='status' aria-live='polite'>{loading?t('verifyingAppointment'):state==='connecting'?t('connectingDevices'):state==='reconnecting'?t('interrupted'):state==='connected'?(others?t('connectedPresent'):t('connectedWaiting')):notice||(closedByServer?t('closed'):t('readyToJoin'))}</p>
    {(error || metadataError)&&<div role='alert' className='consultation-error'>{error || metadataError}{!consultation&&metadataError&&<button className='clinical-action' onClick={retry}>{t('retryCheck')}</button>}</div>}
    <div className='consultation-video-grid' aria-label={t('participantsLabel')}>
      <MediaTile tile={localTile} connection={connection.current} local name={t('you')} camera={camera}/>
      {remoteTiles.length?remoteTiles.map(tile=><MediaTile key={tile.id} tile={tile} connection={connection.current} local={false} name={otherName}/>):<MediaTile connection={connection.current} local={false} name={otherName}/>}
    </div>
    {!connected && state!=='connecting' && canJoin&&<div className='consultation-prejoin'><label><input type='checkbox' checked={cameraOnJoin} onChange={event=>setCameraOnJoin(event.target.checked)}/>{t('enableCamera')}</label><button className='clinical-action clinical-action--primary' disabled={loading} onClick={join}>{t('join')}</button></div>}
    {(connected||state==='connecting')&&<div className='consultation-controls' aria-label={t('controls')}>
      {connected&&<><button className='clinical-action' aria-pressed={!microphone} onClick={()=>setMicrophone(connection.current?.setMicrophone(!microphone)||false)}>{microphone?t('mute'):t('unmute')}</button><button className='clinical-action' aria-pressed={camera} disabled={cameraBusy} onClick={toggleCamera}>{cameraBusy?t('updatingCamera'):camera?t('cameraTurnOff'):t('cameraTurnOn')}</button><button className='clinical-action' onClick={()=>{void audio.current?.play().catch(()=>setError(t('audioBlocked')))}}>{t('enableAudio')}</button></>}
      <button className='clinical-action clinical-action--danger' onClick={leave}>{t('leave')}</button>{role==='doctor'&&connected&&<button className='clinical-action clinical-action--danger' onClick={()=>setConfirmEnd(true)}>{t('endForAll')}</button>}
    </div>}
    <dialog ref={endDialog} className='consultation-end-dialog' aria-labelledby='end-call-title' onCancel={()=>setConfirmEnd(false)}><h2 id='end-call-title'>{t('confirmTitle')}</h2><p>{t('confirmText')}</p><div className='clinical-actions'><button className='clinical-action' disabled={ending} onClick={()=>setConfirmEnd(false)}>{t('keepOpen')}</button><button className='clinical-action clinical-action--danger' disabled={ending} onClick={endCall}>{ending?t('ending'):t('confirmEnd')}</button></div></dialog>
    <footer className='consultation-room-footer'><Link className='clinical-action' href={`/${role}/appointments`}>{t('backToAppointments')}</Link>{role==='doctor'&&<Link className='clinical-action' href={`/doctor/workspace/${id}`}>{t('openWorkspace')}</Link>}{role==='doctor'&&consultation?.episode_id&&<Link className='clinical-action clinical-action--ai' href={`/doctor/episodes/${consultation.episode_id}`}>{t('viewDraft')}</Link>}</footer>
  </section>
}

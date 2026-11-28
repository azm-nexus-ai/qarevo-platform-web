/** Development video provider: synthetic media, real provider-event semantics.
 * The API's simulated provider acts as the media server. This client reports
 * connect and disconnect with its join token, reads presence from provider
 * events, and renders animated synthetic tiles instead of camera or microphone
 * streams. It never asks for device permissions. Same surface as the Chime connection. */
import { apiPost } from './api'
import type { ChimeJoinResponse } from './chime'
import type { VideoState, VideoTile } from './video-connection'

type Events = {
  state: (state: VideoState, message?: string) => void
  tile: (tile: VideoTile) => void
  removeTile: (id: number) => void
  participants: (count: number) => void
  warning: (message: string) => void
}
type Presence = { others_connected: number; roles: string[]; ended: boolean }

const LOCAL_TILE = 1, REMOTE_TILE = 2
export const SIMULATED_POLL_MS = 3000

export function isSimulatedPayload(payload: ChimeJoinResponse) {
  return payload.media_placement?.Provider === 'simulated'
}

function syntheticStream(label: string, hue: number): MediaStream | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 320; canvas.height = 180
  const context = canvas.getContext('2d')
  if (!context || typeof canvas.captureStream !== 'function') return null
  let frame = 0
  const draw = () => {
    frame++
    context.fillStyle = `hsl(${(hue + frame / 4) % 360} 45% 32%)`
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#fff'; context.font = '600 16px system-ui, sans-serif'; context.textAlign = 'center'
    context.fillText(label, canvas.width / 2, canvas.height / 2)
    context.font = '12px system-ui, sans-serif'
    context.fillText('Synthetic video – development provider', canvas.width / 2, canvas.height / 2 + 22)
  }
  draw()
  const timer = setInterval(draw, 200)
  const stream = canvas.captureStream(5)
  stream.getTracks().forEach(track => track.addEventListener('ended', () => clearInterval(timer)))
  ;(stream as MediaStream & { stopSynthetic?: () => void }).stopSynthetic = () => { clearInterval(timer); stream.getTracks().forEach(track => track.stop()) }
  return stream
}

export async function createSimulatedConnection(payload: ChimeJoinResponse, _audio: HTMLAudioElement, events: Events) {
  let closed = false, camera = false, remote = false, timer: ReturnType<typeof setInterval> | undefined, stopping: Promise<void> | undefined
  const streams = new Map<number, MediaStream & { stopSynthetic?: () => void }>()
  const signal = (kind: 'CONNECTED' | 'DISCONNECTED') => apiPost('/api/v1/video/simulated/signal', { join_token: payload.join_token, signal: kind })
  const showRemote = (present: boolean) => {
    if (present && !remote) { remote = true; events.tile({ id: REMOTE_TILE, local: false, active: true }) }
    if (!present && remote) { remote = false; streams.get(REMOTE_TILE)?.stopSynthetic?.(); streams.delete(REMOTE_TILE); events.removeTile(REMOTE_TILE) }
  }
  async function poll() {
    if (closed) return
    try {
      const presence = await apiPost<Presence>('/api/v1/video/simulated/presence', { join_token: payload.join_token })
      if (closed) return
      if (presence.ended) { events.state('closed', 'The video room has ended.'); void stop(false); return }
      events.participants(presence.others_connected)
      showRemote(presence.others_connected > 0)
    } catch { if (!closed) events.warning('Connection quality is poor. Trying again…') }
  }
  const offline = () => { if (!closed) { events.state('reconnecting'); void signal('DISCONNECTED').catch(() => undefined) } }
  const online = async () => {
    if (closed) return
    try { await signal('CONNECTED'); if (!closed) { events.state('connected'); void poll() } }
    catch { if (!closed) events.state('closed', 'The connection closed. You can try joining again.') }
  }
  async function stop(report = true) {
    if (stopping) return stopping
    closed = true
    if (timer) clearInterval(timer)
    window.removeEventListener('offline', offline); window.removeEventListener('online', online)
    stopping = (async () => {
      streams.forEach(stream => stream.stopSynthetic?.()); streams.clear()
      if (report) await signal('DISCONNECTED').catch(() => undefined)
    })()
    return stopping
  }
  return {
    stop: () => stop(true),
    bindTile(id: number, video: HTMLVideoElement) {
      if (closed) return
      const stream = streams.get(id) ?? syntheticStream(id === LOCAL_TILE ? 'You' : 'Other participant', id === LOCAL_TILE ? 200 : 20)
      if (!stream) return
      streams.set(id, stream)
      video.srcObject = stream
      void video.play?.().catch(() => undefined)
    },
    setMicrophone(enabled: boolean) { return !closed && enabled },
    async setCamera(enabled: boolean) {
      if (closed) return false
      if (enabled && !camera) { camera = true; events.tile({ id: LOCAL_TILE, local: true, active: true }) }
      if (!enabled && camera) { camera = false; streams.get(LOCAL_TILE)?.stopSynthetic?.(); streams.delete(LOCAL_TILE); events.removeTile(LOCAL_TILE) }
      return camera
    },
    async start(enableCamera: boolean) {
      events.state('connecting')
      await signal('CONNECTED')
      if (closed) return false
      window.addEventListener('offline', offline); window.addEventListener('online', online)
      events.state('connected')
      if (enableCamera) { camera = true; events.tile({ id: LOCAL_TILE, local: true, active: true }) }
      await poll()
      timer = setInterval(() => void poll(), SIMULATED_POLL_MS)
      return camera
    },
  }
}

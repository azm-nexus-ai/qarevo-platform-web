import type { AudioVideoObserver, VideoTileState } from 'amazon-chime-sdk-js'
import type { ChimeJoinResponse } from './chime'

export type VideoState = 'connecting' | 'connected' | 'reconnecting' | 'closed'
export type VideoTile = { id: number; local: boolean; active: boolean }
type Events = {
  state: (state: VideoState, message?: string) => void
  tile: (tile: VideoTile) => void
  removeTile: (id: number) => void
  participants: (count: number) => void
  warning: (message: string) => void
}

/** Credentials live only in this connection; never persist or log the payload. */
export async function createVideoConnection(
  payload: ChimeJoinResponse, audio: HTMLAudioElement, events: Events,
  loadSdk: () => Promise<typeof import('amazon-chime-sdk-js')> = () => import('amazon-chime-sdk-js'),
) {
  const sdk = await loadSdk()
  const logger = new sdk.NoOpLogger()
  const devices = new sdk.DefaultDeviceController(logger)
  const meeting = new sdk.DefaultMeetingSession(new sdk.MeetingSessionConfiguration({
    MeetingId: payload.meeting_id, MediaPlacement: payload.media_placement,
  }, { AttendeeId: payload.attendee_id, JoinToken: payload.join_token }), logger, devices)
  const av = meeting.audioVideo
  const others = new Set<string>()
  let closed = false
  let camera = false
  let stopping: Promise<void> | undefined
  const observer: AudioVideoObserver = {
    audioVideoDidStartConnecting(reconnecting) { if (!closed) events.state(reconnecting ? 'reconnecting' : 'connecting') },
    audioVideoDidStart() { if (!closed) events.state('connected') },
    audioVideoDidStop(status) {
      if (closed) return
      const message = status.statusCode() === sdk.MeetingSessionStatusCode.MeetingEnded
        ? 'The video room has ended.' : 'The connection closed. You can try joining again.'
      events.state('closed', message)
      void stop()
    },
    videoTileDidUpdate(tile: VideoTileState) {
      if (!closed && tile.tileId !== null && tile.boundAttendeeId && !tile.isContent)
        events.tile({ id: tile.tileId, local: Boolean(tile.localTile), active: Boolean(tile.active) })
    },
    videoTileWasRemoved(id) { if (!closed) events.removeTile(id) },
  }
  const presence = (id: string, present: boolean) => {
    if (closed || id === payload.attendee_id || id.endsWith('#content')) return
    if (present) others.add(id); else others.delete(id)
    events.participants(others.size)
  }
  av.addObserver(observer)
  av.realtimeSubscribeToAttendeeIdPresence(presence)

  async function releaseInputs() {
    await Promise.allSettled([devices.stopAudioInput(), devices.stopVideoInput()])
  }
  async function stop() {
    if (stopping) return stopping
    closed = true
    av.removeObserver(observer)
    av.realtimeUnsubscribeToAttendeeIdPresence(presence)
    av.stopLocalVideoTile()
    av.stop()
    av.unbindAudioElement()
    stopping = (async () => {
      await releaseInputs()
      await Promise.allSettled([meeting.destroy(), devices.destroy()])
    })()
    return stopping
  }
  async function setCamera(enabled: boolean) {
    if (closed) return false
    if (!enabled) {
      av.stopLocalVideoTile(); await devices.stopVideoInput(); camera = false
      return false
    }
    const inputs = await devices.listVideoInputDevices()
    if (closed) return false
    if (!inputs.length) throw new Error('No camera was found. You can continue with audio.')
    await devices.startVideoInput(inputs[0].deviceId)
    if (closed) { await devices.stopVideoInput(); return false }
    av.startLocalVideoTile(); camera = true
    return true
  }
  return {
    stop,
    bindTile(id: number, video: HTMLVideoElement) { if (!closed) av.bindVideoElement(id, video) },
    setMicrophone(enabled: boolean) {
      if (closed) return false
      if (!enabled) { av.realtimeMuteLocalAudio(); return false }
      return av.realtimeUnmuteLocalAudio()
    },
    setCamera,
    async start(enableCamera: boolean) {
      try {
        await av.bindAudioElement(audio)
        const inputs = await devices.listAudioInputDevices()
        if (closed) return
        if (!inputs.length) throw new Error('No microphone was found. Connect a microphone and retry.')
        await devices.startAudioInput(inputs[0].deviceId)
        if (closed) { await releaseInputs(); return }
        if (enableCamera) {
          try { await setCamera(true) }
          catch { events.warning('Camera access failed. Audio can continue; check browser permissions to enable your camera.') }
        }
        if (!closed) av.start()
        return camera
      } catch (error) {
        await stop()
        throw error
      }
    },
  }
}

export type VideoConnection = Awaited<ReturnType<typeof createVideoConnection>>

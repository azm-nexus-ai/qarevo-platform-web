'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Permission / Error Types ────────────────────────────────────────────────

export type MediaPermission = 'unknown' | 'granted' | 'denied' | 'unavailable'

export type LocalMediaError = {
  type: 'permission_denied' | 'not_found' | 'not_readable' | 'not_supported' | 'unknown'
  message: string
}

function classifyError(err: unknown): LocalMediaError {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return { type: 'permission_denied', message: 'Access was denied. Click "Try Again" to grant permission.' }
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return { type: 'not_found', message: 'No device was found. Please connect a camera or microphone.' }
      case 'NotReadableError':
      case 'TrackStartError':
        return { type: 'not_readable', message: 'The device is already in use by another application.' }
      default:
        return { type: 'unknown', message: 'An unexpected error occurred. Please try again.' }
    }
  }
  return { type: 'unknown', message: 'An unexpected error occurred. Please try again.' }
}

function isMediaDevicesSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  )
}

// ─── Hook Return Type ─────────────────────────────────────────────────────────

export interface LocalMediaState {
  cameraStream: MediaStream | null
  cameraOn: boolean
  cameraLoading: boolean
  cameraError: LocalMediaError | null
  cameraPermission: MediaPermission
  toggleCamera: () => Promise<void>
  clearCameraError: () => void
  micStream: MediaStream | null
  micMuted: boolean
  micLoading: boolean
  micError: LocalMediaError | null
  micPermission: MediaPermission
  toggleMic: () => Promise<void>
  clearMicError: () => void
  /** Stop ALL tracks and release all media devices. Call before navigating away. */
  stopAll: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useLocalMedia
 *
 * Manages the patient's local camera and microphone streams.
 *
 * AWS Chime integration path:
 *   Replace this hook's internals with useChimeMeeting() which provides the
 *   same cameraStream / micStream MediaStream references. The consultation
 *   UI (video element, controls) does not need to change.
 */
export function useLocalMedia(): LocalMediaState {
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraError, setCameraError] = useState<LocalMediaError | null>(null)
  const [cameraPermission, setCameraPermission] = useState<MediaPermission>('unknown')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)

  const micStreamRef = useRef<MediaStream | null>(null)
  const [micMuted, setMicMuted] = useState(true)
  const [micLoading, setMicLoading] = useState(false)
  const [micError, setMicError] = useState<LocalMediaError | null>(null)
  const [micPermission, setMicPermission] = useState<MediaPermission>('unknown')
  const [micStream, setMicStream] = useState<MediaStream | null>(null)

  const toggleCamera = useCallback(async () => {
    if (!isMediaDevicesSupported()) {
      setCameraError({ type: 'not_supported', message: 'Your browser does not support camera access.' })
      setCameraPermission('unavailable')
      return
    }
    if (cameraStreamRef.current) {
      const tracks = cameraStreamRef.current.getVideoTracks()
      const next = !cameraOn
      tracks.forEach((t) => { t.enabled = next })
      setCameraOn(next)
      return
    }
    setCameraLoading(true)
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      cameraStreamRef.current = stream
      setCameraStream(stream)
      setCameraOn(true)
      setCameraPermission('granted')
    } catch (err) {
      const classified = classifyError(err)
      setCameraError(classified)
      setCameraPermission(classified.type === 'permission_denied' ? 'denied' : 'unavailable')
    } finally {
      setCameraLoading(false)
    }
  }, [cameraOn])

  const toggleMic = useCallback(async () => {
    if (!isMediaDevicesSupported()) {
      setMicError({ type: 'not_supported', message: 'Your browser does not support microphone access.' })
      setMicPermission('unavailable')
      return
    }
    if (micStreamRef.current) {
      const tracks = micStreamRef.current.getAudioTracks()
      const next = micMuted
      tracks.forEach((t) => { t.enabled = next })
      setMicMuted(!micMuted)
      return
    }
    setMicLoading(true)
    setMicError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream
      setMicStream(stream)
      setMicMuted(false)
      setMicPermission('granted')
    } catch (err) {
      const classified = classifyError(err)
      setMicError(classified)
      setMicPermission(classified.type === 'permission_denied' ? 'denied' : 'unavailable')
    } finally {
      setMicLoading(false)
    }
  }, [micMuted])

  const stopAll = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop())
      cameraStreamRef.current = null
      setCameraStream(null)
      setCameraOn(false)
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
      setMicStream(null)
      setMicMuted(true)
    }
  }, [])

  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
      cameraStreamRef.current = null
      micStreamRef.current?.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }
  }, [])

  return {
    cameraStream, cameraOn, cameraLoading, cameraError, cameraPermission,
    toggleCamera, clearCameraError: () => setCameraError(null),
    micStream, micMuted, micLoading, micError, micPermission,
    toggleMic, clearMicError: () => setMicError(null),
    stopAll,
  }
}

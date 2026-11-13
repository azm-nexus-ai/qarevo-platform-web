'use client'
import { useEffect, useState } from 'react'
import { ApiError } from '@/lib/api'

/** A visible retry timer; the backend remains the authority for every attempt. */
export function useLoginCooldown() {
  const [until, setUntil] = useState(0)
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!until) return
    const tick = () => setSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000)))
    const timer = setInterval(tick, 1000)
    window.addEventListener('focus', tick)
    return () => { clearInterval(timer); window.removeEventListener('focus', tick) }
  }, [until])
  function record(error: unknown) {
    if (!(error instanceof ApiError) || error.status !== 429) { setUntil(0); setSeconds(0); return }
    let delay = 60
    try {
      const body = JSON.parse(error.body)
      const value = body.detail?.retry_after_seconds ?? body.retry_after_seconds
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) delay = Math.min(Math.ceil(value), 86400)
    } catch { /* A generic IP throttle can omit account-specific timing. */ }
    setUntil(Date.now() + delay * 1000); setSeconds(delay)
  }
  const message = !until ? null : seconds > 0
    ? `Too many failed sign-in attempts. Try again in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}. Password recovery remains available.`
    : 'The retry window has ended. You can try signing in again, or reset your password.'
  return { seconds, message, record }
}

'use client'
import { useEffect, useState } from 'react'

/** Seconds left until a deadline. Computed from the clock, so a throttled background
 *  tab or a slow render never stretches a resend cooldown. */
export function useCountdown(initialSeconds = 0) {
  const [until, setUntil] = useState(() => initialSeconds > 0 ? Date.now() + initialSeconds * 1000 : 0)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!until) return
    const tick = () => setNow(Date.now())
    tick()
    const timer = window.setInterval(tick, 1000)
    window.addEventListener('focus', tick)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick) }
  }, [until])
  const seconds = until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0
  return { seconds, start: (value: number) => { setNow(Date.now()); setUntil(Date.now() + Math.max(0, value) * 1000) } }
}

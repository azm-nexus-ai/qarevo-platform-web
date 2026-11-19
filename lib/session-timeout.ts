/** Server-authoritative deadlines. No identity, token or health data is stored here. */
export type SessionStatus = {
  server_time: string
  idle_expires_at: string
  absolute_expires_at: string
  warning_seconds: number
  idle_timeout_seconds: number
}

export function sessionTiming(status: SessionStatus, receivedAt: number, requestDuration: number) {
  const server = Date.parse(status.server_time)
  const idle = Date.parse(status.idle_expires_at)
  const absolute = Date.parse(status.absolute_expires_at)
  if (![server, idle, absolute, status.warning_seconds].every(Number.isFinite) || status.warning_seconds < 0) {
    throw new Error('Session status is unavailable. Please retry.')
  }
  // Deduct the whole round trip conservatively. Local clock changes cannot extend this deadline.
  return {
    deadline: receivedAt + Math.max(0, Math.min(idle, absolute) - server - requestDuration),
    warningMs: status.warning_seconds * 1000,
    absolute: absolute <= idle,
  }
}

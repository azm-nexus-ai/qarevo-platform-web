export const DOCTOR_AUTH_SESSION_KEY = 'qarevo.doctor.auth.v1'

export type DoctorAuthSession = {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  email_verified: boolean
  phone_verified: boolean
  user_id: string
  provider_id: string
  updated_at: string
}

type DoctorAuthPayload = Omit<DoctorAuthSession, 'updated_at'>

export function readDoctorAuthSession(): DoctorAuthSession | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(DOCTOR_AUTH_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DoctorAuthSession>
    if (!parsed.access_token || !parsed.refresh_token || !parsed.provider_id) return null
    return parsed as DoctorAuthSession
  } catch {
    return null
  }
}

export function setDoctorAuthSession(payload: DoctorAuthPayload) {
  if (typeof window === 'undefined') return

  const session: DoctorAuthSession = {
    ...payload,
    updated_at: new Date().toISOString(),
  }
  window.localStorage.setItem(DOCTOR_AUTH_SESSION_KEY, JSON.stringify(session))
}

export function clearDoctorAuthSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(DOCTOR_AUTH_SESSION_KEY)
}

export function getDoctorAccessToken() {
  return readDoctorAuthSession()?.access_token ?? null
}

export function getDoctorProviderId() {
  return readDoctorAuthSession()?.provider_id ?? null
}

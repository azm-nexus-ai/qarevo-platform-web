'use client'
import { useTranslations } from 'next-intl'
import { ApiError } from './api'

/** The structured parts of an API error, without leaking free text into the UI. */
export type ApiErrorInfo = { status: number | null; code: string | null; retryAfter: number | null; attemptsRemaining: number | null; approvalPending: boolean }

export function apiErrorInfo(error: unknown): ApiErrorInfo {
  const info: ApiErrorInfo = { status: null, code: null, retryAfter: null, attemptsRemaining: null, approvalPending: false }
  if (!(error instanceof ApiError)) return info
  info.status = error.status
  try {
    const detail = (JSON.parse(error.body) as { detail?: unknown })?.detail
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      const value = detail as Record<string, unknown>
      if (typeof value.error_code === 'string' && /^[A-Z_]{3,60}$/.test(value.error_code)) info.code = value.error_code
      if (Number.isInteger(value.retry_after_seconds) && (value.retry_after_seconds as number) > 0) info.retryAfter = value.retry_after_seconds as number
      if (Number.isInteger(value.lock_duration_seconds) && !info.retryAfter) info.retryAfter = value.lock_duration_seconds as number
      if (Number.isInteger(value.attempts_remaining)) info.attemptsRemaining = value.attempts_remaining as number
      info.approvalPending = value.approval_pending === true
    }
  } catch { /* non-JSON bodies are never shown */ }
  return info
}

const CODES: Record<string, string> = {
  CODE_INVALID: 'codeInvalid', CODE_SPENT: 'codeSpent', CODE_EXPIRED: 'codeExpired', CODE_REPLACED: 'codeReplaced',
  CODE_USED: 'codeUsed', CODE_MISSING: 'codeMissing', CODE_ATTEMPTS_LOCKED: 'codeAttemptsLocked',
  CODE_RESEND_COOLDOWN: 'codeResendCooldown', CODE_SEND_LIMIT: 'codeSendLimit', EMAIL_DELIVERY_UNAVAILABLE: 'emailDeliveryUnavailable',
  EMAIL_ALREADY_VERIFIED: 'emailAlreadyVerified', EMAIL_VERIFICATION_LOCKED: 'codeSendLimit', LINK_REPLACED: 'linkReplaced',
  LINK_USED: 'linkUsed', LINK_EXPIRED: 'linkExpired', LINK_INVALID: 'linkInvalid', TOO_MANY_LOGIN_ATTEMPTS: 'tooManyLoginAttempts',
  ACCOUNT_NOT_ACTIVE: 'accountNotActive', EMAIL_VERIFICATION_PENDING: 'emailVerificationPending',
  CLINICIAN_APPROVAL_REQUIRED: 'clinicianApprovalRequired', MFA_EMAIL_RESEND_FAILED: 'resendFailed',
}

/** Localised message for an authentication error, with waits and remaining tries. */
export function useAuthErrorMessage() {
  const t = useTranslations('authErrors')
  const wait = (seconds: number | null) => {
    const value = Math.max(1, seconds ?? 60)
    return value < 90 ? t('waitSeconds', { count: value }) : t('waitMinutes', { count: Math.ceil(value / 60) })
  }
  return (error: unknown, fallback: 'signIn' | 'code' | 'generic' = 'generic') => {
    const info = apiErrorInfo(error)
    const key = info.code ? CODES[info.code] : undefined
    if (key === 'codeInvalid' && info.attemptsRemaining !== null) return t('codeInvalid', { count: info.attemptsRemaining })
    if (key === 'emailAlreadyVerified' && info.approvalPending) return t('emailAlreadyVerifiedApproval')
    if (key) return t(key, { wait: wait(info.retryAfter), count: info.attemptsRemaining ?? 0 })
    if (info.status === 401) return fallback === 'signIn' ? t('invalidCredentials') : t('sessionExpired')
    if (info.status === 429) return t('rateLimited', { wait: wait(info.retryAfter) })
    if (info.status === 503) return t('serviceUnavailable')
    if (info.status === null) return t('network')
    return fallback === 'code' ? t('codeNotAccepted') : t('generic')
  }
}

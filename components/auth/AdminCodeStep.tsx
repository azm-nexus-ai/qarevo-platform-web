'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiPost, type AdminLoginResponse } from '@/lib/api'
import { apiErrorInfo, useAuthErrorMessage } from '@/lib/auth-errors'
import { useCountdown } from '@/lib/use-countdown'
import { usePortalAction } from '@/lib/portal-action'

/** Second step of administrator sign-in: an emailed code, or the authenticator app (with a recovery-code fallback). */
export default function AdminCodeStep({ onDone, onRestart, method = 'email' }: { onDone: (response: AdminLoginResponse) => void; onRestart: () => void; method?: 'email' | 'totp' }) {
  const t = useTranslations('auth.adminSignIn.mfa')
  const errorMessage = useAuthErrorMessage()
  const captureAction = usePortalAction()
  const countdown = useCountdown(60)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [ended, setEnded] = useState(false)
  const app = method === 'totp'
  // Authenticator sign-in can fall back to a single-use recovery code.
  const [recovery, setRecovery] = useState(false)

  const fail = (failure: unknown) => {
    const info = apiErrorInfo(failure)
    if (info.status === 401) setEnded(true)
    if (info.code === 'CODE_RESEND_COOLDOWN' && info.retryAfter) countdown.start(info.retryAfter)
    setError(errorMessage(failure, 'code'))
  }
  async function verify(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    const recoveryCode = code.trim()
    if (recovery ? recoveryCode.replace(/[^a-z0-9]/gi, '').length < 10 : !/^\d{6}$/.test(code)) { setError(t(recovery ? 'recoveryRequired' : 'codeRequired')); return }
    setBusy(true); setError(''); setNotice('')
    const action = captureAction()
    let response: AdminLoginResponse | undefined
    try {
      response = app
        ? await apiPost<AdminLoginResponse>('/api/v1/auth/admin/mfa/verify-app', recovery ? { recovery_code: recoveryCode } : { code })
        : await apiPost<AdminLoginResponse>('/api/v1/auth/admin/mfa/verify', { code })
      if (action.isCurrent({ completedSession: response.browser_session })) onDone(response)
    } catch (failure) {
      if (action.isCurrent()) { fail(failure); setCode('') }
    } finally {
      if (action.isCurrent({ completedSession: response?.browser_session })) setBusy(false)
    }
  }
  async function resend() {
    if (busy || countdown.seconds > 0) return
    setBusy(true); setError(''); setNotice('')
    const action = captureAction()
    try {
      await apiPost('/api/v1/auth/admin/mfa/resend', {})
      if (action.isCurrent()) { setNotice(t('sent')); countdown.start(60) }
    } catch (failure) {
      if (action.isCurrent()) fail(failure)
    } finally {
      if (action.isCurrent()) setBusy(false)
    }
  }
  return <form noValidate onSubmit={verify} style={{ display: 'grid', gap: '14px' }}>
    <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.55, color: 'var(--text-secondary)' }}>{app ? t(recovery ? 'recoveryIntro' : 'appIntro') : t('intro')}</p>
    <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
      {recovery ? t('recoveryLabel') : app ? t('appCodeLabel') : t('codeLabel')}
      {recovery
        ? <input key='recovery' value={code} onChange={event => { setCode(event.target.value.slice(0, 32)); setError('') }} autoComplete='off' autoCapitalize='none' spellCheck={false} aria-invalid={Boolean(error)} disabled={ended}
            placeholder='xxxxx-xxxxx' style={{ minHeight: 48, padding: '0 14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '17px', letterSpacing: '0.08em', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
        : <input key='code' value={code} onChange={event => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
            inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-invalid={Boolean(error)} disabled={ended}
            style={{ minHeight: 48, padding: '0 14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '18px', letterSpacing: '0.3em' }} />}
    </label>
    {error && <div role="alert" style={{ padding: '12px', borderRadius: '10px', background: 'var(--danger-soft)', fontSize: '14px', lineHeight: 1.45, color: 'var(--text)', display: 'grid', gap: '8px' }}>
      <span>{error}</span>
      {ended && <button type="button" onClick={onRestart} style={{ justifySelf: 'start', minHeight: 40, padding: '0 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer' }}>{t('restart')}</button>}
    </div>}
    {notice && !error && <div role="status" style={{ padding: '12px', borderRadius: '10px', background: 'var(--success-soft)', fontSize: '14px', color: 'var(--text)' }}>{notice}</div>}
    <button type="submit" disabled={busy || ended} style={{ minHeight: 48, borderRadius: '12px', border: 'none', background: 'var(--primary)', color: 'var(--on-primary, #fff)', fontSize: '15px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
      {busy ? t('checking') : t('verify')}
    </button>
    {app ? <button type='button' onClick={() => { setRecovery(value => !value); setCode(''); setError('') }} disabled={busy || ended} style={{ minHeight: 44, background: 'none', border: 'none', color: 'var(--link)', fontWeight: 600, cursor: 'pointer' }}>
      {recovery ? t('useApp') : t('useRecovery')}
    </button> : <button type="button" onClick={resend} disabled={busy || ended || countdown.seconds > 0} style={{ minHeight: 44, background: 'none', border: 'none', color: countdown.seconds > 0 ? 'var(--text-muted)' : 'var(--link)', fontWeight: 600, cursor: 'pointer' }}>
      {countdown.seconds > 0 ? t('resendIn', { seconds: countdown.seconds }) : t('resend')}
    </button>}
  </form>
}

'use client'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { ApiError, acceptAdminInvitation, validateAdminInvitation, clearPortalSession, getApiErrorDetail, getLoginThrottleMessage } from '@/lib/api'
import { ValidationSummary } from '@/components/ui/ValidationFeedback'
import { usePortalAction } from '@/lib/portal-action'

type Status = 'checking' | 'valid' | 'unavailable' | 'error' | 'complete'

export default function AcceptAdminInvitation() {
  const t = useTranslations('auth')
  const captureAction = usePortalAction()
  const token = useRef<string | null>(null)
  const [status, setStatus] = useState<Status>('checking')
  const [retry, setRetry] = useState(0)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const recheck = () => {
      setPassword(''); setConfirmation(''); setErrors({}); setSaving(false); setStatus('checking')
      setRetry(value => value + 1)
    }
    const receiveLink = () => {
      // Fragment-only navigation keeps this component mounted, including when
      // reopening a consumed link in the same tab.
      token.current = new URLSearchParams(window.location.hash.slice(1)).get('token') || ''
      window.history.replaceState(window.history.state, '', window.location.pathname)
      recheck()
    }
    const restorePage = (event: PageTransitionEvent) => { if (event.persisted) recheck() }
    window.addEventListener('hashchange', receiveLink)
    window.addEventListener('pageshow', restorePage)
    return () => {
      window.removeEventListener('hashchange', receiveLink)
      window.removeEventListener('pageshow', restorePage)
    }
  }, [])

  useEffect(() => {
    // The ref survives Strict Mode effect cleanup without losing the URL secret.
    if (token.current === null) {
      token.current = new URLSearchParams(window.location.hash.slice(1)).get('token') || ''
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
    if (!token.current) { setStatus('unavailable'); return }
    let current = true
    let expiryTimer: ReturnType<typeof setTimeout> | undefined
    setStatus('checking')
    setErrors({})
    const unavailable = () => {
      token.current = ''
      setPassword(''); setConfirmation(''); setStatus('unavailable')
    }
    void validateAdminInvitation(token.current).then(result => {
      if (!current) return
      if (!result.valid) { unavailable(); return }
      const remaining = Date.parse(result.expires_at) - Date.now()
      if (!Number.isFinite(remaining) || remaining <= 0) { unavailable(); return }
      setStatus('valid')
      expiryTimer = setTimeout(() => { if (token.current) unavailable() }, Math.min(remaining, 2_147_483_647))
    }).catch(error => {
      if (!current) return
      if (error instanceof ApiError && error.status === 422) { unavailable(); return }
      setErrors({ server: getLoginThrottleMessage(error) || t('adminInvitation.weCouldNotCheckThis') })
      setStatus('error')
    })
    return () => { current = false; clearTimeout(expiryTimer) }
  }, [retry, t])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (status !== 'valid' || !token.current || saving) return
    const next: Record<string, string> = {}
    if (password.length < 8 || password.length > 128 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) next.password = 'Use 8–128 characters, including uppercase, lowercase, a number and a special character.'
    if (!confirmation || password !== confirmation) next.confirmation = t('adminInvitation.enterTheSamePasswordIn')
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    const action = captureAction()
    const submittedToken = token.current
    try {
      await acceptAdminInvitation(submittedToken, password)
      if (!action.isCurrent() || token.current !== submittedToken) return
      clearPortalSession(action.portal); token.current = ''; setPassword(''); setConfirmation(''); setStatus('complete')
    } catch (error) {
      if (!action.isCurrent() || token.current !== submittedToken) return
      if (error instanceof ApiError && error.status === 400) {
        token.current = ''; setPassword(''); setConfirmation(''); setStatus('unavailable')
      } else setErrors({ server: getLoginThrottleMessage(error) || getApiErrorDetail(error) || t('adminInvitation.weCouldNotActivateThis') })
    } finally { if (action.isCurrent() && token.current === submittedToken) setSaving(false) }
  }

  return <main className='invitation-page'><section>
    <h1>{status === 'complete' ? t('adminInvitation.administratorAccountReady') : status === 'unavailable' ? t('adminInvitation.invitationUnavailable') : t('adminInvitation.acceptYourAdministratorInvitation')}</h1>
    {status === 'checking' ? <p role='status'>{t('adminInvitation.checkingYourInvitation')}</p> : status === 'complete' ? <>
      <p>{t('adminInvitation.yourMailboxHasBeenVerified')}</p>
      <Link href='/auth/admin/login'>{t('adminInvitation.continueToAdministratorSignIn')}</Link>
    </> : status === 'unavailable' ? <>
      <p>{t('adminInvitation.thisInvitationIsInvalidExpired')}</p>
      <p><Link href='/auth/admin/login'>{t('adminInvitation.administratorSignIn')}</Link></p>
      <p><Link href='/auth/admin/forgot-password'>{t('adminInvitation.forgotYourPassword')}</Link></p>
      <p>{t('adminInvitation.ifYouHaveNotActivated')}</p>
    </> : status === 'error' ? <>
      <ValidationSummary errors={errors}/>
      <button type='button' onClick={() => setRetry(value => value + 1)}>{t('adminInvitation.retryInvitationCheck')}</button>
    </> : <>
      <p>{t('adminInvitation.chooseYourOwnPasswordTo')}</p>
      <form noValidate onSubmit={submit}><ValidationSummary errors={errors}/>
        <label htmlFor='invite-password'>{t('adminInvitation.newPasswordRequired')}</label><input id='invite-password' type='password' autoComplete='new-password' required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} aria-invalid={!!errors.password} aria-describedby={errors.password?'invite-password-hint invite-password-error':'invite-password-hint'}/>
        <p id='invite-password-hint'>{t('adminInvitation.n8128CharactersWithUppercase')}</p>{errors.password&&<p id='invite-password-error' role='alert'>{errors.password}</p>}
        <label htmlFor='invite-confirm'>{t('adminInvitation.confirmPasswordRequired')}</label><input id='invite-confirm' type='password' autoComplete='new-password' required maxLength={128} value={confirmation} onChange={e=>setConfirmation(e.target.value)} aria-invalid={!!errors.confirmation} aria-describedby={errors.confirmation?'invite-confirm-error':undefined}/>{errors.confirmation&&<p id='invite-confirm-error' role='alert'>{errors.confirmation}</p>}
        <button disabled={saving} type='submit'>{saving?t('adminInvitation.activating'):t('adminInvitation.activateAdministratorAccount')}</button>
      </form>
    </>}
  </section><style jsx>{`
    .invitation-page{min-height:70vh;display:grid;place-items:center;padding:32px 20px;background:var(--canvas);color:var(--text)}
    section{width:100%;max-width:540px;padding:clamp(24px,5vw,40px);border:1px solid var(--border);border-radius:20px;background:var(--surface)}
    h1{font-size:28px;line-height:1.2;letter-spacing:-.03em}p{font-size:14px;line-height:1.7;color:var(--text-secondary)}
    label{display:block;font-size:14px;font-weight:600;margin-top:20px}input{width:100%;min-height:44px;margin-top:8px;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font-size:16px}
    button{width:100%;min-height:44px;margin-top:24px;padding:12px;border:0;border-radius:10px;background:var(--link);color:var(--surface);font-weight:700}button:disabled{opacity:.6}p[role=alert]{color:var(--danger)}
  `}</style></main>
}

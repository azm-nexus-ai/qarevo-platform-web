'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ApiError, acceptAdminInvitation, validateAdminInvitation, clearPortalSession, getApiErrorDetail, getLoginThrottleMessage } from '@/lib/api'
import { ValidationSummary } from '@/components/ui/ValidationFeedback'

type Status = 'checking' | 'valid' | 'unavailable' | 'error' | 'complete'

export default function AcceptAdminInvitation() {
  const token = useRef<string | null>(null)
  const [status, setStatus] = useState<Status>('checking')
  const [retry, setRetry] = useState(0)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const recheck = () => {
      setPassword(''); setConfirmation(''); setErrors({}); setStatus('checking')
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
      setErrors({ server: getLoginThrottleMessage(error) || 'We could not check this invitation. Please retry.' })
      setStatus('error')
    })
    return () => { current = false; clearTimeout(expiryTimer) }
  }, [retry])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (status !== 'valid' || !token.current || saving) return
    const next: Record<string, string> = {}
    if (password.length < 8 || password.length > 128 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) next.password = 'Use 8–128 characters, including uppercase, lowercase, a number and a special character.'
    if (!confirmation || password !== confirmation) next.confirmation = 'Enter the same password in both fields.'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    try {
      await acceptAdminInvitation(token.current, password)
      clearPortalSession(); token.current = ''; setPassword(''); setConfirmation(''); setStatus('complete')
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        token.current = ''; setPassword(''); setConfirmation(''); setStatus('unavailable')
      } else setErrors({ server: getLoginThrottleMessage(error) || getApiErrorDetail(error) || 'We could not activate this invitation. Please try again.' })
    } finally { setSaving(false) }
  }

  return <main className='invitation-page'><section>
    <h1>{status === 'complete' ? 'Administrator account ready' : status === 'unavailable' ? 'Invitation unavailable' : 'Accept your administrator invitation'}</h1>
    {status === 'checking' ? <p role='status'>Checking your invitation…</p> : status === 'complete' ? <>
      <p>Your mailbox has been verified and your password is set. This invitation has been used and cannot be used again.</p>
      <Link href='/auth/admin/login'>Continue to administrator sign-in</Link>
    </> : status === 'unavailable' ? <>
      <p>This invitation is invalid, expired or already used. If you already activated your account, sign in with the password you chose.</p>
      <p><Link href='/auth/admin/login'>Administrator sign-in</Link></p>
      <p><Link href='/auth/admin/forgot-password'>Forgot your password?</Link></p>
      <p>If you have not activated your account, ask the owner for a new invitation.</p>
    </> : status === 'error' ? <>
      <ValidationSummary errors={errors}/>
      <button type='button' onClick={() => setRetry(value => value + 1)}>Retry invitation check</button>
    </> : <>
      <p>Choose your own password to activate the access granted by the application owner. This link can be used once and expires after 24 hours.</p>
      <form noValidate onSubmit={submit}><ValidationSummary errors={errors}/>
        <label htmlFor='invite-password'>New password (Required)</label><input id='invite-password' type='password' autoComplete='new-password' required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} aria-invalid={!!errors.password} aria-describedby={errors.password?'invite-password-hint invite-password-error':'invite-password-hint'}/>
        <p id='invite-password-hint'>8–128 characters, with uppercase, lowercase, a number and a special character.</p>{errors.password&&<p id='invite-password-error' role='alert'>{errors.password}</p>}
        <label htmlFor='invite-confirm'>Confirm password (Required)</label><input id='invite-confirm' type='password' autoComplete='new-password' required maxLength={128} value={confirmation} onChange={e=>setConfirmation(e.target.value)} aria-invalid={!!errors.confirmation} aria-describedby={errors.confirmation?'invite-confirm-error':undefined}/>{errors.confirmation&&<p id='invite-confirm-error' role='alert'>{errors.confirmation}</p>}
        <button disabled={saving} type='submit'>{saving?'Activating…':'Activate administrator account'}</button>
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

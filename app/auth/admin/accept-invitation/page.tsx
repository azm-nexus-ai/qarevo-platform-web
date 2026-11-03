'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { acceptAdminInvitation, clearAuthTokens, getApiErrorDetail, getLoginThrottleMessage } from '@/lib/api'
import { ValidationSummary } from '@/components/ui/ValidationFeedback'

export default function AcceptAdminInvitation() {
  const [token,setToken]=useState('')
  const [ready,setReady]=useState(false)
  const [password,setPassword]=useState('')
  const [confirmation,setConfirmation]=useState('')
  const [errors,setErrors]=useState<Record<string,string>>({})
  const [saving,setSaving]=useState(false)
  const [complete,setComplete]=useState(false)
  const tokenRead=useRef(false)
  useEffect(()=>{
    if(tokenRead.current)return
    tokenRead.current=true
    const value=new URLSearchParams(window.location.hash.slice(1)).get('token') || ''
    setToken(value)
    window.history.replaceState(window.history.state,'',window.location.pathname)
    setReady(true)
  },[])
  async function submit(event:React.FormEvent) {
    event.preventDefault()
    const next:Record<string,string>={}
    if (password.length<8 || password.length>128 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) next.password='Use 8–128 characters, including uppercase, lowercase, a number and a special character.'
    if (password!==confirmation) next.confirmation='The passwords do not match.'
    setErrors(next)
    if(Object.keys(next).length || !token || saving)return
    setSaving(true)
    try { await acceptAdminInvitation(token,password); clearAuthTokens(); setToken('');setPassword('');setConfirmation('');setComplete(true) }
    catch(error) { setErrors({server:getLoginThrottleMessage(error) || getApiErrorDetail(error) || 'We could not activate this invitation. Please try again.'}) }
    finally {setSaving(false)}
  }
  return <main className='invitation-page'><section>
    <h1>{complete?'Administrator account ready':'Accept your administrator invitation'}</h1>
    {!ready?<p>Preparing your invitation…</p>:complete?<><p>Your mailbox has been verified and your password is set. Sign in to manage Qarevo Health.</p><Link href='/auth/admin/login'>Continue to administrator sign-in</Link></>:!token?<><p>Open the complete invitation link from your email. If it has expired or been revoked, ask the owner for a new invitation.</p><Link href='/auth/admin/login'>Administrator sign-in</Link></>:<>
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

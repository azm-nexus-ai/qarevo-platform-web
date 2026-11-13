'use client'
import Link from 'next/link'
import { useEffect, useLayoutEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiPost, type BrowserSessionResponse } from '@/lib/api'
import { readPortalIdentity } from '@/lib/portal-scope'
import { usePracticeAction } from '@/lib/use-practice-action'
import { PRACTICE_AUTH, fragmentInvitation, invitationInspection, object, practice, practiceMember, practiceControl, uuid } from '@/lib/practice'
import { PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import RoleHomeLink from '@/components/branding/RoleHomeLink'
import { PracticeGate, PracticeBoundaryNote, ActionFeedback } from './PracticeShared'

function Entry({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <main className='mx-auto flex min-h-[75dvh] w-full max-w-2xl flex-col justify-center gap-5 px-4 py-10 sm:px-7'><RoleHomeLink aria-label='Qarevo Health home'><AuthenticatedLogo width={170} /></RoleHomeLink><header><p className='mb-2 text-xs font-semibold uppercase tracking-widest text-secondary'>Independent practices</p><h1 className='text-3xl font-extrabold tracking-tight text-ink'>{title}</h1><p className='mt-3 text-sm leading-7 text-secondary'>{description}</p></header><PracticeBoundaryNote />{children}</main> }
function verifiedSession(value: unknown) { if (!object(value) || !object(value.browser_session) || value.browser_session.role !== 'PRACTICE' || !uuid(value.browser_session.user_id) || !uuid(value.browser_session.session_id)) throw new Error('The practice session could not be verified. Please sign in again.'); return value as unknown as BrowserSessionResponse }
function challengeResult(value: unknown) { if (!object(value) || !uuid(value.challenge_id) || typeof value.expires_in !== 'number' || !Number.isInteger(value.expires_in) || value.expires_in < 1 || value.expires_in > 900 || typeof value.resend_after !== 'number' || !Number.isInteger(value.resend_after) || value.resend_after < 0 || value.resend_after > 300) throw new Error('Sign-in verification could not be started. Please try again.'); return { id: value.challenge_id, expires: Date.now() + value.expires_in * 1000, resend: Date.now() + value.resend_after * 1000 } }

export function PracticeLogin() { return <Entry title='Practice Sign In' description='Use your existing account password, then verify your mailbox. Your patient, clinician and platform-administrator sessions stay separate.'><PracticeGate><PracticeLoginForm /></PracticeGate></Entry> }
function PracticeLoginForm() {
  const router = useRouter(), action = usePracticeAction('practice-login'), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [show, setShow] = useState(false)
  const [code, setCode] = useState(''), [challenge, setChallenge] = useState<ReturnType<typeof challengeResult> | null>(null), [now, setNow] = useState(0), [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => { if (!challenge) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [challenge])
  const remaining = challenge ? Math.max(0, Math.ceil((challenge.resend - now) / 1000)) : 0
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (action.busy) return
    const next: Record<string, string> = {}
    if (challenge) { if (!/^\d{6}$/.test(code)) next.code = 'Enter the six-digit verification code from your email.' }
    else { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 255) next.email = 'Enter a valid email address.'; if (!password || password.length > 128) next.password = 'Enter your account password (at most 128 characters).' }
    setErrors(next); if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    if (challenge) await action.run(signal => apiPost(PRACTICE_AUTH + '/verify', { challenge_id: challenge.id, code }, undefined, signal), result => { verifiedSession(result); setCode(''); router.replace('/practice/dashboard'); return 'Practice sign-in verified.' }, undefined, true)
    else await action.run(signal => apiPost(PRACTICE_AUTH + '/login', { email: email.trim(), password }, undefined, signal), result => { setChallenge(challengeResult(result)); setNow(Date.now()); setPassword(''); return 'If these details can access a practice workspace, a verification code has been requested. Check your inbox and spam folder.' })
  }
  return <PortalCard><form noValidate onSubmit={submit} aria-busy={action.busy} className='grid gap-4'><ValidationSummary errors={errors} />
    {!challenge ? <><div><label htmlFor='practice-email' className='mb-2 block text-sm font-semibold text-ink'>Email (Required)</label><input id='practice-email' type='email' autoComplete='username' maxLength={255} value={email} onChange={event => setEmail(event.target.value)} className={practiceControl} aria-invalid={!!errors.email} aria-describedby='practice-email-error' /><FieldFeedback name='practice-email' error={errors.email} /></div>
      <div><label htmlFor='practice-password' className='mb-2 block text-sm font-semibold text-ink'>Password (Required)</label><div className='flex min-w-0 flex-wrap gap-2'><input id='practice-password' type={show ? 'text' : 'password'} autoComplete='current-password' maxLength={128} value={password} onChange={event => setPassword(event.target.value)} className={practiceControl + ' flex-1'} aria-invalid={!!errors.password} aria-describedby='practice-password-error' /><PortalButton type='button' onClick={() => setShow(value => !value)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</PortalButton></div><FieldFeedback name='practice-password' error={errors.password} /></div></>
      : <><p className='text-sm leading-7 text-secondary'>Enter the code sent to your mailbox. Codes expire after five minutes. We do not disclose whether an account exists.</p><div><label htmlFor='practice-code' className='mb-2 block text-sm font-semibold text-ink'>Verification code (Required)</label><input id='practice-code' inputMode='numeric' autoComplete='one-time-code' maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} className={practiceControl} aria-invalid={!!errors.code} aria-describedby='practice-code-error' /><FieldFeedback name='practice-code' error={errors.code} /></div>{now >= challenge.expires && <p role='status' className='text-sm text-secondary'>This code has expired. Start again to request a new sign-in code.</p>}</>}
    <ActionFeedback action={action} /><PortalButton type='submit' tone='primary' disabled={action.busy}>{action.busy ? 'Confirming…' : challenge ? 'Verify and open practice workspace' : 'Continue securely'}</PortalButton>
    {challenge && <div className='flex flex-wrap gap-3'><PortalButton type='button' disabled={action.busy || remaining > 0} onClick={() => void action.run(signal => apiPost(PRACTICE_AUTH + '/resend', { challenge_id: challenge.id }, undefined, signal), result => { setChallenge(challengeResult(result)); setNow(Date.now()); return 'If the sign-in request is eligible, a code has been requested again. Inbox delivery is not confirmed.' })}>{remaining ? `Resend available in ${remaining}s` : 'Resend verification code'}</PortalButton><PortalButton type='button' disabled={action.busy} onClick={() => { setChallenge(null); setCode(''); setErrors({}) }}>Start again</PortalButton></div>}
    <Link href='/auth/practice/forgot-password' className='text-sm font-semibold text-brand underline underline-offset-4'>Forgot your password?</Link>
  </form></PortalCard>
}

function useInvitationToken() {
  const [value, setValue] = useState<{ token: string | null; epoch: string } | null>(null)
  useLayoutEffect(() => { const read = () => { const token = fragmentInvitation(window.location.hash); window.history.replaceState(window.history.state, '', window.location.pathname); setValue({ token, epoch: crypto.randomUUID() }) }; read(); window.addEventListener('hashchange', read); return () => window.removeEventListener('hashchange', read) }, [])
  return value
}
export function PracticeInvitationEntry({ clinician = false }: { clinician?: boolean }) {
  const invitation = useInvitationToken()
  return <Entry title={clinician ? 'Join a practice' : 'Set up practice access'} description='Review the invitation and confirm the identity that received it. Invitation links are single-use and expire.'>{!invitation ? <p role='status'>Opening your invitation…</p> : !invitation.token ? <PortalCard><p role='alert'>This invitation link is missing or invalid. Open the original invitation email or ask the practice administrator for a new invitation.</p></PortalCard> : <PracticeGate><InvitationForm key={invitation.epoch} token={invitation.token} clinician={clinician} /></PracticeGate>}</Entry>
}
function InvitationForm({ token, clinician }: { token: string; clinician: boolean }) {
  const router = useRouter(), action = usePracticeAction('practice-invitation'), [inspection, setInspection] = useState<ReturnType<typeof invitationInspection>>(null), [attempt, setAttempt] = useState(0)
  const [password, setPassword] = useState(''), [show, setShow] = useState(false), [first, setFirst] = useState(''), [last, setLast] = useState(''), [confirmed, setConfirmed] = useState(false), [errors, setErrors] = useState<Record<string, string>>({})
  const inspect = action.run
  useEffect(() => { void inspect(signal => apiPost(PRACTICE_AUTH + '/invitations/inspect', { token }, undefined, signal), result => { const parsed = invitationInspection(result); if (!parsed || parsed.role !== (clinician ? 'CLINICIAN' : 'OWNER')) throw new Error('This invitation belongs to a different practice role. Open its original sign-in link.'); setInspection(parsed); return '' }) }, [attempt, clinician, inspect, token])
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!inspection || action.busy) return
    const next: Record<string, string> = {}
    if (!confirmed) next.confirmed = 'Confirm that you understand the administrative scope of practice membership.'
    if (!clinician) { if (!password || password.length > 128) next.password = 'Enter the invited account’s current password or choose a password for a new account.'
      if (!inspection.existing_account) { if (!first.trim() || first.trim().length > 100) next.first = 'Enter a first name using 1–100 characters.'; if (!last.trim() || last.trim().length > 100) next.last = 'Enter a last name using 1–100 characters.'; if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) next.password = 'Use 8–128 characters including uppercase, lowercase, a number and a special character.' }
    }
    setErrors(next); if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    await action.run(signal => apiPost(clinician ? '/api/v1/doctor/practices/invitations/accept' : PRACTICE_AUTH + '/invitations/accept-owner', clinician ? { token } : { token, password, ...(!inspection.existing_account ? { first_name: first.trim(), last_name: last.trim() } : {}) }, undefined, signal), result => {
      if (!object(result)) throw new Error('Practice membership could not be confirmed. Refresh and review your memberships.')
      const saved = practice(result.practice), member = saved && practiceMember(result.membership, saved.id)
      if (!saved || !member || member.role !== (clinician ? 'CLINICIAN' : 'OWNER') || member.status !== 'ACTIVE') throw new Error('Practice membership could not be confirmed. Refresh and review your memberships.')
      if (!clinician) verifiedSession(result)
      setPassword(''); router.replace(clinician ? '/doctor/practices' : '/practice/dashboard'); return 'Practice membership confirmed. Clinical permissions are unchanged.'
    }, undefined, !clinician)
  }
  const signedClinician = Boolean(readPortalIdentity('doctor'))
  return <PortalCard><ActionFeedback action={action} />{!inspection ? <>{!action.error && <p role='status'>Checking your invitation…</p>}{action.error && <PortalButton type='button' disabled={action.busy} onClick={() => setAttempt(value => value + 1)}>Retry invitation</PortalButton>}</> : <><h2 className='text-xl font-semibold text-ink'>{inspection.practice_name}</h2><p className='my-3 text-sm leading-7 text-secondary'>Invited role: {inspection.role.toLowerCase()}. Mailbox: {inspection.email_hint}. Expires {new Date(inspection.expires_at).toLocaleString()}.</p>
    {clinician && !signedClinician ? <div className='space-y-4 text-sm leading-7 text-secondary'><p>Sign in with the approved physician account that received this invitation, then reopen the original invitation email. The invitation token is not saved in your browser.</p><Link href='/auth/doctor/login' className='q-button q-button-primary'>Physician Sign In</Link></div> : <form noValidate onSubmit={submit} className='grid gap-4' aria-busy={action.busy}><ValidationSummary errors={errors} />
      {!clinician && <>{!inspection.existing_account && <div className='grid gap-4 sm:grid-cols-2'>{[['first', 'First name', first, setFirst], ['last', 'Last name', last, setLast]].map(([key, label, value, change]) => <div key={key as string}><label htmlFor={'owner-' + key} className='mb-2 block text-sm font-semibold'>{label as string} (Required)</label><input id={'owner-' + key} maxLength={100} value={value as string} onChange={event => (change as (value: string) => void)(event.target.value)} className={practiceControl} aria-invalid={!!errors[key as string]} /><FieldFeedback name={'owner-' + key} error={errors[key as string]} /></div>)}</div>}
        <div><label htmlFor='owner-password' className='mb-2 block text-sm font-semibold'>{inspection.existing_account ? 'Current account password' : 'Create account password'} (Required)</label><div className='flex flex-wrap gap-2'><input id='owner-password' type={show ? 'text' : 'password'} maxLength={128} autoComplete={inspection.existing_account ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} className={practiceControl + ' flex-1'} aria-invalid={!!errors.password} /><PortalButton type='button' onClick={() => setShow(value => !value)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</PortalButton></div><FieldFeedback name='owner-password' error={errors.password} /></div></>}
      <div><label className='flex items-start gap-3 text-sm leading-7'><input type='checkbox' className='mt-1 h-5 w-5 shrink-0' checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I understand that practice membership grants administrative affiliation only and does not authorize access to patient records or clinical practice. (Required)</label><FieldFeedback name='owner-confirmed' error={errors.confirmed} /></div>
      <PortalButton type='submit' tone='primary' disabled={action.busy}>{action.busy ? 'Confirming membership…' : clinician ? 'Accept clinician membership' : 'Accept owner invitation'}</PortalButton>
    </form>}</>}</PortalCard>
}

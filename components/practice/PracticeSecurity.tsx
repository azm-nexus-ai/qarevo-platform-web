'use client'
import { useState } from 'react'
import { apiDelete, apiPost } from '@/lib/api'
import { usePortalResource } from '@/lib/use-portal-resource'
import { usePracticeAction } from '@/lib/use-practice-action'
import { object, uuid, practiceControl } from '@/lib/practice'
import { PortalBadge, PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import { PracticeScope, PracticeBoundaryNote, PracticeGate, PracticeReadState, ActionFeedback } from './PracticeShared'

type Session = { id: string; current: boolean; device_name: string; created_at: string; last_seen_at: string; expires_at: string }
function sessions(value: unknown) {
  if (!object(value) || typeof value.password_change_available !== 'boolean' || !object(value.mfa) || value.mfa.method !== 'email' || value.mfa.enabled !== true || !Array.isArray(value.sessions) || value.sessions.length > 100 || typeof value.has_more !== 'boolean') return null
  const rows: Session[] = [], seen = new Set<string>()
  for (const row of value.sessions) { if (!object(row) || !uuid(row.id) || seen.has(row.id) || typeof row.current !== 'boolean' || typeof row.device_name !== 'string' || !['created_at', 'last_seen_at', 'expires_at'].every(key => typeof row[key] === 'string' && Number.isFinite(Date.parse(row[key])))) return null; seen.add(row.id); rows.push(row as unknown as Session) }
  return { rows, password: value.password_change_available, more: value.has_more }
}
export default function PracticeSecurity() { return <PracticeScope><div className='grid min-w-0 gap-5'><h1 className='text-3xl font-extrabold tracking-tight text-ink'>Practice security</h1><PracticeBoundaryNote /><PracticeGate><SecurityContent /></PracticeGate></div></PracticeScope> }
function SecurityContent() {
  const resource = usePortalResource<unknown>('/api/v1/practice/security', false, { abortOnCleanup: true, refreshOnFocus: true }), data = sessions(resource.data), action = usePracticeAction('practice-security')
  const [currentPassword, setCurrentPassword] = useState(''), [newPassword, setNewPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [show, setShow] = useState(false), [globalConfirmed, setGlobalConfirmed] = useState(false), [sessionConfirmed, setSessionConfirmed] = useState(false), [errors, setErrors] = useState<Record<string, string>>({})
  const confirmResult = (value: unknown) => { if (!object(value) || typeof value.message !== 'string') throw new Error('The security change could not be confirmed. Refresh the session list.'); return value.message }
  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const next: Record<string, string> = {}
    if (!currentPassword) next.current = 'Enter your current account password.'
    if (newPassword.length < 8 || newPassword.length > 128 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) next.password = 'Use 8–128 characters including uppercase, lowercase, a number and a special character.'
    if (newPassword !== confirmation) next.confirmation = 'The new passwords must match.'
    if (!globalConfirmed) next.global = 'Confirm that all of this account’s portal sessions will be signed out.'
    setErrors(next); if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    const body = { current_password: currentPassword, new_password: newPassword }; setCurrentPassword(''); setNewPassword(''); setConfirmation('')
    await action.run(signal => apiPost('/api/v1/practice/security/password', body, undefined, signal), confirmResult)
  }
  return <><PracticeReadState resource={resource} invalid={resource.data !== null && !data} />{data && <>
    <PortalCard><h2 className='text-xl font-semibold text-ink'>Mailbox verification</h2><p className='mt-3 text-sm leading-7 text-secondary'>An email verification code is required at every practice sign-in. This administrative session does not reuse another portal’s authentication.</p><PortalBadge tone='success'>Email verification required</PortalBadge></PortalCard>
    <PortalCard><h2 className='text-xl font-semibold text-ink'>Account password</h2><p className='my-3 text-sm leading-7 text-secondary'>Your password belongs to your underlying account. Changing it signs out this account’s patient, physician, administrator and practice sessions.</p>
      {!data.password ? <p role='status'>Password changes are unavailable for this account. Use its existing account-recovery flow.</p> : <form noValidate onSubmit={changePassword} className='mt-4 grid gap-4' aria-busy={action.busy}><ValidationSummary errors={errors} />
        {([['current', 'Current password', currentPassword, setCurrentPassword, 'current-password'], ['password', 'New password', newPassword, setNewPassword, 'new-password'], ['confirmation', 'Confirm new password', confirmation, setConfirmation, 'new-password']] as const).map(([key, label, value, setter, autocomplete]) => <div key={key}><label htmlFor={'practice-security-' + key} className='mb-2 block text-sm font-semibold text-ink'>{label} (Required)</label><input id={'practice-security-' + key} type={show ? 'text' : 'password'} autoComplete={autocomplete} maxLength={128} value={value} onChange={event => setter(event.target.value)} className={practiceControl} aria-invalid={!!errors[key]} /><FieldFeedback name={'practice-security-' + key} error={errors[key]} /></div>)}
        <PortalButton type='button' onClick={() => setShow(value => !value)} aria-label={show ? 'Hide passwords' : 'Show passwords'}>{show ? 'Hide passwords' : 'Show passwords'}</PortalButton>
        <label className='flex items-start gap-3 text-sm leading-7 text-ink'><input type='checkbox' className='mt-1 h-5 w-5 shrink-0' checked={globalConfirmed} onChange={event => setGlobalConfirmed(event.target.checked)} />I understand that this account will be signed out across all portals. (Required)</label><FieldFeedback name='practice-security-global' error={errors.global} />
        <PortalButton type='submit' tone='primary' disabled={action.busy}>{action.busy ? 'Changing password…' : 'Change account password'}</PortalButton></form>}
    </PortalCard>
    <PortalCard><h2 className='text-xl font-semibold text-ink'>Practice browser sessions</h2><p className='my-3 text-sm leading-7 text-secondary'>These are practice sessions only. Ordinary practice sign-out leaves other portals signed in.</p>{data.more && <p role='status' className='text-sm text-secondary'>The first 100 active practice sessions are shown. Additional sessions exist.</p>}
      <label className='my-4 flex items-start gap-3 text-sm leading-7 text-ink'><input type='checkbox' className='mt-1 h-5 w-5 shrink-0' checked={sessionConfirmed} onChange={event => setSessionConfirmed(event.target.checked)} />I understand the selected practice browsers will be signed out.</label>{errors.sessions && <p role='alert' className='my-3 text-sm text-ink'>{errors.sessions}</p>}
      <ul className='grid gap-3'>{data.rows.map(row => <li key={row.id} className='flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-xl border border-theme p-4'><div className='min-w-0'><h3 className='font-semibold text-ink'>{row.device_name}</h3><p className='mt-1 text-sm text-secondary'>Last active {new Date(row.last_seen_at).toLocaleString()}</p></div>{row.current ? <PortalBadge tone='info'>Current browser</PortalBadge> : <PortalButton type='button' disabled={action.busy} onClick={() => { if (!sessionConfirmed) { setErrors(previous => ({ ...previous, sessions: 'Confirm the sign-out effect before selecting a session.' })); return }; void action.run(signal => apiDelete('/api/v1/practice/security/sessions/' + row.id, undefined, signal), confirmResult, resource.retry) }}>Sign out this practice session</PortalButton>}</li>)}</ul>
      <div className='mt-5 flex flex-wrap gap-3'><PortalButton type='button' disabled={action.busy} onClick={() => { if (!sessionConfirmed) { setErrors(previous => ({ ...previous, sessions: 'Confirm the sign-out effect before continuing.' })); return }; void action.run(signal => apiPost('/api/v1/practice/security/sessions/revoke-others', {}, undefined, signal), confirmResult, resource.retry) }}>Sign out other practice browsers</PortalButton><PortalButton type='button' disabled={resource.refreshing || action.busy} onClick={resource.retry}>Refresh practice sessions</PortalButton></div>
    </PortalCard><ActionFeedback action={action} />
  </>}</>
}

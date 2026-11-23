'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useDates } from '@/i18n/format'
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
export default function PracticeSecurity() { const t = useTranslations('practiceWs.security'); return <PracticeScope><div className='grid min-w-0 gap-5'><h1 className='text-3xl font-extrabold tracking-tight text-ink'>{t('title')}</h1><PracticeBoundaryNote /><PracticeGate><SecurityContent /></PracticeGate></div></PracticeScope> }
function SecurityContent() {
  const t = useTranslations('practiceWs.security'), f = useTranslations('practiceWs.fields'), dates = useDates()
  const resource = usePortalResource<unknown>('/api/v1/practice/security', false, { abortOnCleanup: true, refreshOnFocus: true }), data = sessions(resource.data), action = usePracticeAction('practice-security')
  const [currentPassword, setCurrentPassword] = useState(''), [newPassword, setNewPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [show, setShow] = useState(false), [globalConfirmed, setGlobalConfirmed] = useState(false), [sessionConfirmed, setSessionConfirmed] = useState(false), [errors, setErrors] = useState<Record<string, string>>({})
  const confirmResult = (value: unknown) => { if (!object(value) || typeof value.message !== 'string') throw new Error(t('unconfirmed')); return value.message }
  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const next: Record<string, string> = {}
    if (!currentPassword) next.current = t('currentRequired')
    if (newPassword.length < 8 || newPassword.length > 128 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) next.password = t('passwordRule')
    if (newPassword !== confirmation) next.confirmation = t('mismatch')
    if (!globalConfirmed) next.global = t('globalRequired')
    setErrors(next); if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    const body = { current_password: currentPassword, new_password: newPassword }; setCurrentPassword(''); setNewPassword(''); setConfirmation('')
    await action.run(signal => apiPost('/api/v1/practice/security/password', body, undefined, signal), confirmResult)
  }
  return <><PracticeReadState resource={resource} invalid={resource.data !== null && !data} />{data && <>
    <PortalCard><h2 className='text-xl font-semibold text-ink'>{t('mailboxTitle')}</h2><p className='mt-3 text-sm leading-7 text-secondary'>{t('mailboxText')}</p><PortalBadge tone='success'>{t('mailboxBadge')}</PortalBadge></PortalCard>
    <PortalCard><h2 className='text-xl font-semibold text-ink'>{t('passwordTitle')}</h2><p className='my-3 text-sm leading-7 text-secondary'>{t('passwordText')}</p>
      {!data.password ? <p role='status'>{t('passwordUnavailable')}</p> : <form noValidate onSubmit={changePassword} className='mt-4 grid gap-4' aria-busy={action.busy}><ValidationSummary errors={errors} />
        {([['current', t('currentPassword'), currentPassword, setCurrentPassword, 'current-password'], ['password', t('newPassword'), newPassword, setNewPassword, 'new-password'], ['confirmation', t('confirmPassword'), confirmation, setConfirmation, 'new-password']] as const).map(([key, label, value, setter, autocomplete]) => <div key={key}><label htmlFor={'practice-security-' + key} className='mb-2 block text-sm font-semibold text-ink'>{f('required', { label })}</label><input id={'practice-security-' + key} type={show ? 'text' : 'password'} autoComplete={autocomplete} maxLength={128} value={value} onChange={event => setter(event.target.value)} className={practiceControl} aria-invalid={!!errors[key]} /><FieldFeedback name={'practice-security-' + key} error={errors[key]} /></div>)}
        <PortalButton type='button' onClick={() => setShow(value => !value)} aria-label={show ? t('hidePasswords') : t('showPasswords')}>{show ? t('hidePasswords') : t('showPasswords')}</PortalButton>
        <label className='flex items-start gap-3 text-sm leading-7 text-ink'><input type='checkbox' className='mt-1 h-5 w-5 shrink-0' checked={globalConfirmed} onChange={event => setGlobalConfirmed(event.target.checked)} />{t('globalConfirm')}</label><FieldFeedback name='practice-security-global' error={errors.global} />
        <PortalButton type='submit' tone='primary' disabled={action.busy}>{action.busy ? t('changing') : t('change')}</PortalButton></form>}
    </PortalCard>
    <PortalCard><h2 className='text-xl font-semibold text-ink'>{t('sessionsTitle')}</h2><p className='my-3 text-sm leading-7 text-secondary'>{t('sessionsText')}</p>{data.more && <p role='status' className='text-sm text-secondary'>{t('sessionsMore')}</p>}
      <label className='my-4 flex items-start gap-3 text-sm leading-7 text-ink'><input type='checkbox' className='mt-1 h-5 w-5 shrink-0' checked={sessionConfirmed} onChange={event => setSessionConfirmed(event.target.checked)} />{t('sessionConfirm')}</label>{errors.sessions && <p role='alert' className='my-3 text-sm text-ink'>{errors.sessions}</p>}
      <ul className='grid gap-3'>{data.rows.map(row => <li key={row.id} className='flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-xl border border-theme p-4'><div className='min-w-0'><h3 className='font-semibold text-ink'>{row.device_name}</h3><p className='mt-1 text-sm text-secondary'>{t('lastActive', { time: dates.dateTime(row.last_seen_at) })}</p></div>{row.current ? <PortalBadge tone='info'>{t('currentBrowser')}</PortalBadge> : <PortalButton type='button' disabled={action.busy} onClick={() => { if (!sessionConfirmed) { setErrors(previous => ({ ...previous, sessions: t('confirmBeforeSelect') })); return }; void action.run(signal => apiDelete('/api/v1/practice/security/sessions/' + row.id, undefined, signal), confirmResult, resource.retry) }}>{t('signOutSession')}</PortalButton>}</li>)}</ul>
      <div className='mt-5 flex flex-wrap gap-3'><PortalButton type='button' disabled={action.busy} onClick={() => { if (!sessionConfirmed) { setErrors(previous => ({ ...previous, sessions: t('confirmBeforeContinue') })); return }; void action.run(signal => apiPost('/api/v1/practice/security/sessions/revoke-others', {}, undefined, signal), confirmResult, resource.retry) }}>{t('signOutOthers')}</PortalButton><PortalButton type='button' disabled={resource.refreshing || action.busy} onClick={resource.retry}>{t('refreshSessions')}</PortalButton></div>
    </PortalCard><ActionFeedback action={action} />
  </>}</>
}

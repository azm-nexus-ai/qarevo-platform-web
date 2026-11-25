'use client'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { apiDelete, apiGet, apiPost, clearPortalSession, getApiErrorDetail } from '@/lib/api'
import { recoveryPortal } from '@/lib/auth-recovery'
import { readAccountScope } from '@/lib/account-storage'
import { usePortalAction } from '@/lib/portal-action'
import ActionLink from '@/components/ui/ActionLink'
import PasswordField from './PasswordField'
import styles from './AccountSecurity.module.css'

type Session = { id: string; current: boolean; device_name: string; browser_name: string | null; operating_system: string | null; last_seen_at: string; created_at: string; expires_at: string }
type Security = { password_change_available: boolean; mfa: { available: boolean; enabled: boolean; method: string | null; message: string }; sessions: Session[]; sessions_total: number }
type FieldKey = 'current' | 'password' | 'confirmation'
type Confirmation = { path: string; method: 'POST' | 'DELETE'; title: string; description: string; action: string }


function ConfirmAction({ confirmation, onCancel, onConfirm }: { confirmation: Confirmation; onCancel: () => void; onConfirm: () => void }) {
  const t = useTranslations('accountSecurity')
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  const description = useId()
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog ref={dialog} className={styles.dialog} role='alertdialog' aria-labelledby={title} aria-describedby={description} onCancel={onCancel}>
    <h3 className='portal-h3' id={title}>{confirmation.title}</h3>
    <p id={description}>{confirmation.description}</p>
    <div className={styles.actions}><button type='button' className='q-button q-button-secondary' onClick={onCancel} autoFocus>{t('cancel')}</button><button type='button' className='q-button q-button-danger' onClick={onConfirm}>{confirmation.action}</button></div>
  </dialog>
}

function lastActive(value: string, locale: string | undefined, unavailable: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString(locale) : unavailable
}

export default function AccountSecurity() {
  const t = useTranslations('accountSecurity'), locale = useLocale().startsWith('de') ? 'de-DE' : undefined
  const router = useRouter()
  const pathname = usePathname()
  const captureAction = usePortalAction()
  const [data, setData] = useState<Security | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [values, setValues] = useState({ current: '', password: '', confirmation: '' })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const busyRef = useRef(false)
  const errorTarget = useRef<HTMLParagraphElement>(null)
  const focusError = useRef<(() => boolean) | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const loadGeneration = useRef(0)
  const showError = useCallback((message: string, action: ReturnType<typeof captureAction>, focus = false) => {
    if (!action.isCurrent()) return
    focusError.current = focus ? action.isCurrent : null
    setError(message)
    // The paragraph can already exist on a repeated failed user action.
    if (focus) errorTarget.current?.focus()
  }, [])
  const load = useCallback(async (focusOnFailure = false) => {
    const action = captureAction()
    if (!action.isCurrent() || action.scope === null) return
    const generation = ++loadGeneration.current
    const current = () => action.isCurrent() && generation === loadGeneration.current
    setLoading(true); setError('')
    try {
      const result = await apiGet<Security>('/api/v1/security')
      if (current()) setData(result)
    } catch (failure) {
      if (current()) showError(getApiErrorDetail(failure) || t('loadFailed'), action, focusOnFailure)
    } finally { if (current()) setLoading(false) }
  }, [captureAction, showError, t])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const canFocus = focusError.current
    focusError.current = null
    if (error && canFocus?.()) errorTarget.current?.focus()
  }, [error])
  const finishRevocation = (action: ReturnType<typeof captureAction>) => {
    // Password/revoke-all already clear their captured session in the API.
    // A self-session DELETE still needs cleanup, scoped to its initiating identity.
    if (action.scope !== null && readAccountScope(action.portal) === action.scope) clearPortalSession(action.portal)
    if (action.isCurrent({ allowEndedSession: true })) {
      const login = recoveryPortal(action.portal === 'admin' ? '/auth/admin/login' : action.portal === 'doctor' ? '/auth/doctor/login' : '/auth/sign-in').signIn
      router.replace(login)
    }
  }
  const update = (key: FieldKey, value: string) => {
    setValues(previous => ({ ...previous, [key]: value }))
    setFieldErrors(previous => ({ ...previous, [key]: undefined }))
    setError(''); setNotice('')
  }
  async function mutate(action: Confirmation) {
    const context = captureAction()
    if (busyRef.current || !context.isCurrent() || context.scope === null) return
    busyRef.current = true; setBusy(true); setError(''); setNotice(''); setConfirmation(null)
    try {
      const result = action.method === 'POST'
        ? await apiPost<{ message: string; current_session_revoked: boolean }>(action.path, {})
        : await apiDelete<{ message: string; current_session_revoked: boolean }>(action.path)
      if (result.current_session_revoked) { finishRevocation(context); return }
      if (context.isCurrent()) { setNotice(result.message); await load(true) }
    } catch (failure) { showError(getApiErrorDetail(failure) || t('theSecurityActionFailedPlease'), context, true) }
    finally { busyRef.current = false; if (context.isCurrent()) setBusy(false) }
  }
  async function changePassword(event: React.FormEvent) {
    event.preventDefault()
    const context = captureAction()
    if (busyRef.current || !context.isCurrent() || context.scope === null) return
    setError(''); setNotice('')
    const next: Partial<Record<FieldKey, string>> = {}
    if (!values.current) next.current = t('currentRequired')
    if (values.password.length < 8 || values.password.length > 128 || !/[A-Z]/.test(values.password) || !/[a-z]/.test(values.password) || !/[0-9]/.test(values.password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(values.password)) next.password = t('passwordRule')
    if (!values.confirmation || values.password !== values.confirmation) next.confirmation = t('confirmationMismatch')
    setFieldErrors(next)
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0] as FieldKey
      const index = (['current', 'password', 'confirmation'] as FieldKey[]).indexOf(first)
      form.current?.querySelectorAll('input')[index]?.focus()
      return
    }
    busyRef.current = true; setBusy(true)
    try {
      await apiPost('/api/v1/security/password', { current_password: values.current, new_password: values.password })
      if (context.isCurrent()) setValues({ current: '', password: '', confirmation: '' })
      finishRevocation(context)
    } catch (failure) { showError(getApiErrorDetail(failure) || t('changeFailed'), context, true) }
    finally { busyRef.current = false; if (context.isCurrent()) setBusy(false) }
  }
  return <section aria-label={t('title')} className={styles.root} aria-busy={loading || busy}>
    <header><h2 className='portal-h2'>{t('title')}</h2><p className={styles.intro}>{t('intro')}</p></header>
    {error && <p ref={errorTarget} tabIndex={-1} role='alert' className={styles.error}>{error}</p>}
    {notice && <p role='status' className={styles.notice}>{notice}</p>}
    {busy && <p role='status' className={styles.progress}><span className={styles.spinner} aria-hidden='true'/>{t('updating')}</p>}
    {loading ? <p role='status' className={styles.progress}><span className={styles.spinner} aria-hidden='true'/>{t('loading')}</p> : !data ? <button type='button' onClick={() => void load(true)} className='q-button q-button-secondary'>{t('retry')}</button> : <>
      <form ref={form} onSubmit={changePassword} noValidate aria-label={t('changePassword')} className={`${styles.group} ${styles.form}`}>
        <div className={styles.groupHeader}><div><h3 className='portal-h3'>{t('changePassword')}</h3><p className={styles.intro}>{t('changeNote')}</p></div></div>
        <div className={styles.fields}>
          <PasswordField label={t('currentPassword')} value={values.current} onChange={value => update('current', value)} autoComplete='current-password' error={fieldErrors.current}/>
          <PasswordField label={t('newPassword')} value={values.password} onChange={value => update('password', value)} autoComplete='new-password' error={fieldErrors.password} hint={t('passwordHint')}/>
          <PasswordField label={t('confirmPassword')} value={values.confirmation} onChange={value => update('confirmation', value)} autoComplete='new-password' error={fieldErrors.confirmation}/>
        </div>
        {!data.password_change_available && <p className={styles.hint}>{t('passwordUnavailable')}</p>}
        <div className={styles.actions}><button className='q-button q-button-primary' disabled={busy || !data.password_change_available} type='submit'>{t('changeAndSignOut')}</button><button type='button' className='q-button q-button-secondary' disabled={busy} onClick={() => { setValues({ current: '', password: '', confirmation: '' }); setFieldErrors({}); setError(''); setNotice(t('editCancelled')) }}>{t('cancelEdit')}</button></div>
      </form>
      {!pathname.startsWith('/admin') && <div className={styles.group}><h3 className='portal-h3'>{t('connectedAccounts')}</h3><p className={styles.intro}>{t('connectedIntro')}</p><div className={styles.actions}><ActionLink href='/auth/social/connect' pendingLabel={t('openingProviders')}>{t('connectProvider')}</ActionLink></div></div>}
      <div className={styles.group}><div className={styles.groupHeader}><h3 className='portal-h3'>{t('twoFactor')}</h3><span className={styles.badge}>{data.mfa.enabled ? t('enabled') : t('notEnabled')}</span></div><p className={styles.intro}>{data.mfa.message}</p>{!data.mfa.available && <div><button className='q-button q-button-secondary' disabled type='button'>{t('twoFactorUnavailable')}</button></div>}</div>
      <div className={styles.group}>
        <div><h3 className='portal-h3'>{t('sessions')}</h3><p className={styles.intro}>{t('sessionsIntro')}</p></div>
        {data.sessions.length === 0 ? <p className={styles.empty}>{t('noSessions')}</p> : <ul className={styles.sessionList} aria-label={t('activeSessions')}>{data.sessions.map(session => <li key={session.id} className={styles.session}>
          <div><strong>{session.device_name || t('device')}{session.current ? ` · ${t('thisDevice')}` : ''}</strong><p>{[session.browser_name, session.operating_system].filter(Boolean).join(' · ')}<br/>{t('lastActive', { time: lastActive(session.last_seen_at, locale, t('notAvailable')) })}</p></div>
          <button type='button' className='q-button q-button-secondary' disabled={busy} onClick={() => setConfirmation({ path: `/api/v1/security/sessions/${encodeURIComponent(session.id)}`, method: 'DELETE', title: session.current ? t('signOutThisTitle') : t('revokeTitle'), description: session.current ? t('signOutThisBody') : t('revokeBody'), action: session.current ? t('signOutThis') : t('revoke') })}>{session.current ? t('signOutThis') : t('revoke')}</button>
        </li>)}</ul>}
        <div className={styles.actions}><button type='button' className='q-button q-button-secondary' disabled={busy} onClick={() => setConfirmation({ path: '/api/v1/security/sessions/revoke-others', method: 'POST', title: t('signOutOthersTitle'), description: t('signOutOthersBody'), action: t('signOutOthers') })}>{t('signOutOthers')}</button><button type='button' className='q-button q-button-danger' disabled={busy} onClick={() => setConfirmation({ path: '/api/v1/security/sessions/revoke-all', method: 'POST', title: t('signOutAllTitle'), description: t('signOutAllBody'), action: t('signOutAll') })}>{t('signOutAll')}</button></div>
      </div>
    </>}
    {confirmation && <ConfirmAction confirmation={confirmation} onCancel={() => setConfirmation(null)} onConfirm={() => void mutate(confirmation)}/>}
  </section>
}

'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import QRCode from 'qrcode'
import { apiGet, apiPost, apiPut, getAdminUsers, getApiErrorDetail, type AdminUser } from '@/lib/api'
import { apiErrorInfo } from '@/lib/auth-errors'
import styles from './TwoFactorSettings.module.css'

export type TwoFactorStatus = {
  enabled: boolean
  confirmed_at: string | null
  recovery_codes_remaining: number
  required: boolean
  required_by: 'environment' | 'policy' | null
  setup_required: boolean
}
type Setup = { secret: string; otpauth_uri: string; account: string; issuer: string; expires_in: number }
type Confirmed = { recovery_codes: string[]; status: TwoFactorStatus }
const BASE = '/api/v1/admin/security/two-factor'
const KNOWN = ['CODE_INVALID', 'CODE_ATTEMPTS_LOCKED', 'SETUP_EXPIRED', 'CURRENT_CODE_REQUIRED', 'TWO_FACTOR_REQUIRED',
  'SET_UP_YOUR_OWN_FIRST', 'SELF_RESET_NOT_ALLOWED', 'AUTHENTICATOR_UNREADABLE', 'TWO_FACTOR_NOT_ENABLED']

function useErrorText() {
  const t = useTranslations('adminSecurity.errors')
  return useCallback((failure: unknown) => {
    const info = apiErrorInfo(failure)
    if (info.code && KNOWN.includes(info.code)) return t(info.code.toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()))
    if (info.status === 403) return t('forbidden')
    return getApiErrorDetail(failure) || t('generic')
  }, [t])
}

/** Six digits only; paste-friendly. */
function CodeInput({ id, value, onChange, label, disabled }: { id: string; value: string; onChange: (value: string) => void; label: string; disabled?: boolean }) {
  return <label className={styles.field} htmlFor={id}>{label}
    <input id={id} className={styles.input} value={value} onChange={event => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
      inputMode='numeric' autoComplete='one-time-code' maxLength={6} disabled={disabled} />
  </label>
}

/** Asks for a current app code before a sensitive change. */
function CodePrompt({ id, title, hint, action, tone = 'primary', run, onCancel }: { id: string; title: string; hint: string; action: string; tone?: 'primary' | 'danger'; run: (code: string) => Promise<void>; onCancel: () => void }) {
  const t = useTranslations('adminSecurity'), errorText = useErrorText()
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (code.length !== 6) { setError(t('codeRequired')); return }
    setBusy(true); setError('')
    try { await run(code) } catch (failure) { setError(errorText(failure)); setCode('') } finally { setBusy(false) }
  }
  return <form noValidate onSubmit={submit} className={styles.stack} aria-labelledby={`${id}-title`}>
    <div><h3 id={`${id}-title`} className={styles.title}>{title}</h3><p className={styles.lead}>{hint}</p></div>
    <CodeInput id={`${id}-code`} value={code} onChange={value => { setCode(value); setError('') }} label={t('appCode')} disabled={busy} />
    {error && <p role='alert' className={styles.error}>{error}</p>}
    <div className={styles.actions}>
      <button type='submit' className={tone === 'danger' ? styles.danger : styles.primary} disabled={busy}>{busy ? t('checking') : action}</button>
      <button type='button' className={styles.secondary} onClick={onCancel} disabled={busy}>{t('cancel')}</button>
    </div>
  </form>
}

/** Shown once after set-up or regeneration: copy, download, and confirm they are stored. */
function RecoveryCodes({ codes, account, onDone }: { codes: string[]; account: string; onDone: () => void }) {
  const t = useTranslations('adminSecurity.codes'), locale = useLocale()
  const [saved, setSaved] = useState(false), [copied, setCopied] = useState(false)
  const text = [t('fileTitle'), ...(account ? [t('fileAccount', { account })] : []), t('fileCreated', { date: new Date().toLocaleString(locale.startsWith('de') ? 'de-DE' : 'en-GB') }), '', ...codes, '', t('fileHint')].join('\n')
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'qarevo-admin-recovery-codes.txt'; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const copy = async () => { try { await navigator.clipboard.writeText(codes.join('\n')); setCopied(true) } catch { setCopied(false) } }
  return <div className={styles.stack}>
    <div><h3 className={styles.title}>{t('title')}</h3><p className={styles.lead}>{t('intro')}</p></div>
    <ul className={styles.codes} aria-label={t('listLabel')}>{codes.map(code => <li key={code}>{code}</li>)}</ul>
    <div className={styles.actions}>
      <button type='button' className={styles.secondary} onClick={download}>{t('download')}</button>
      <button type='button' className={styles.secondary} onClick={() => void copy()}>{copied ? t('copied') : t('copy')}</button>
      <button type='button' className={styles.secondary} onClick={() => window.print()}>{t('print')}</button>
    </div>
    <label className={styles.check}><input type='checkbox' checked={saved} onChange={event => setSaved(event.target.checked)} />{t('stored')}</label>
    <div className={styles.actions}><button type='button' className={styles.primary} disabled={!saved} onClick={onDone}>{t('done')}</button></div>
  </div>
}

/** Scan → confirm with a code → recovery codes. Replacing an authenticator first asks for its current code. */
function SetupFlow({ replacing, onConfirmed, onCancel }: { replacing: boolean; onConfirmed: (result: Confirmed, account: string) => void; onCancel: () => void }) {
  const t = useTranslations('adminSecurity.setup'), tc = useTranslations('adminSecurity'), errorText = useErrorText()
  const [setup, setSetup] = useState<Setup | null>(null), [svg, setSvg] = useState('')
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const started = useRef(false)
  const start = useCallback(async (currentCode?: string) => {
    setBusy(true); setError('')
    try {
      const result = await apiPost<Setup>(`${BASE}/setup`, currentCode ? { current_code: currentCode } : {})
      setSetup(result)
      setSvg(await QRCode.toString(result.otpauth_uri, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#04354D', light: '#FFFFFF' } }))
    } catch (failure) { setError(errorText(failure)); throw failure } finally { setBusy(false) }
  }, [errorText])
  useEffect(() => {
    if (replacing || started.current) return
    started.current = true
    const timer = window.setTimeout(() => { void start().catch(() => undefined) }, 0)
    return () => window.clearTimeout(timer)
  }, [replacing, start])
  if (replacing && !setup) return <CodePrompt id='replace' title={t('replaceTitle')} hint={t('replaceHint')} action={t('replaceAction')} run={code => start(code)} onCancel={onCancel} />
  const confirm = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!setup) return
    if (code.length !== 6) { setError(tc('codeRequired')); return }
    setBusy(true); setError('')
    try { onConfirmed(await apiPost<Confirmed>(`${BASE}/confirm`, { code }), setup.account) } catch (failure) { setError(errorText(failure)); setCode('') } finally { setBusy(false) }
  }
  return <form noValidate onSubmit={confirm} className={styles.stack} aria-busy={busy}>
    <div><h3 className={styles.title}>{replacing ? t('replaceScanTitle') : t('title')}</h3><p className={styles.lead}>{t('intro')}</p></div>
    {!setup ? (error ? <p role='alert' className={styles.error}>{error}</p> : <p role='status' className={styles.lead}>{t('preparing')}</p>) : <>
      <div className={styles.steps}>
        <div role='img' aria-label={t('qrLabel')} className={styles.qr} dangerouslySetInnerHTML={{ __html: svg }} />
        <div className={styles.stack}>
          <ol className={styles.ol}><li>{t('step1')}</li><li>{t('step2')}</li><li>{t('step3')}</li></ol>
          <div><p className={styles.lead} style={{ marginTop: 0 }}>{t('manualKey')}</p><p className={styles.key} aria-label={t('manualKeyLabel')}>{(setup.secret.match(/.{1,4}/g) ?? []).map((group, index) => <span key={index}>{group}</span>)}</p></div>
        </div>
      </div>
      <CodeInput id='setup-code' value={code} onChange={value => { setCode(value); setError('') }} label={t('codeLabel')} disabled={busy} />
      {error && <p role='alert' className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button type='submit' className={styles.primary} disabled={busy}>{busy ? tc('checking') : t('confirm')}</button>
        <button type='button' className={styles.secondary} onClick={onCancel} disabled={busy}>{tc('cancel')}</button>
      </div>
    </>}
  </form>
}

function Team({ ownEnabled, status, onPolicy }: { ownEnabled: boolean; status: TwoFactorStatus; onPolicy: (status: TwoFactorStatus) => void }) {
  const t = useTranslations('adminSecurity.team'), tc = useTranslations('adminSecurity'), errorText = useErrorText()
  const [admins, setAdmins] = useState<AdminUser[] | null>(null), [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const [currentId, setCurrentId] = useState<string | null>(null), [allowed, setAllowed] = useState(false)
  const [target, setTarget] = useState<AdminUser | null>(null), [reason, setReason] = useState(''), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const load = useCallback(async () => {
    try {
      const roster = await apiGet<{ required: boolean; admins: Record<string, boolean> }>(`${BASE}/roster`)
      const list = await getAdminUsers(undefined, undefined, undefined, 100, 0)
      setEnabled(roster.admins); setAdmins(list.admin_users.filter(admin => admin.status === 'ACTIVE')); setCurrentId(list.current_admin_id ?? null); setAllowed(true)
    } catch { setAllowed(false) }
  }, [])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load])
  useEffect(() => { const node = dialog.current; if (!node) return; if (target && !node.open) node.showModal(); if (!target && node.open) node.close() }, [target])
  if (!allowed) return null
  const setPolicy = async (required: boolean) => {
    setBusy(true); setError(''); setNotice('')
    try { onPolicy(await apiPut<TwoFactorStatus>(`${BASE}/policy`, { required })); setNotice(required ? t('policyOn') : t('policyOff')) } catch (failure) { setError(errorText(failure)) } finally { setBusy(false) }
  }
  const reset = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!target) return
    if (reason.trim().length < 10) { setError(t('reasonShort')); return }
    setBusy(true); setError('')
    try {
      await apiPost(`${BASE}/admins/${target.id}/reset`, { reason: reason.trim() })
      setNotice(t('resetDone', { name: target.full_name })); setTarget(null); setReason(''); await load()
    } catch (failure) { setError(errorText(failure)) } finally { setBusy(false) }
  }
  const missing = admins?.filter(admin => !enabled[admin.id]).length ?? 0
  return <section className={styles.card} aria-labelledby='team-2fa-title'>
    <div className={styles.cardHeader}><div><h2 id='team-2fa-title' className={styles.title}>{t('title')}</h2><p className={styles.lead}>{t('intro')}</p></div>
      <span className={`${styles.badge} ${status.required ? styles.on : styles.off}`}><span className={styles.dot} aria-hidden />{status.required ? t('required') : t('optional')}</span></div>
    {status.required_by === 'environment'
      ? <p className={styles.notice}>{t('byEnvironment')}</p>
      : <div className={styles.actions}>
        {status.required
          ? <button type='button' className={styles.secondary} disabled={busy} onClick={() => void setPolicy(false)}>{t('stopRequiring')}</button>
          : <button type='button' className={styles.primary} disabled={busy || !ownEnabled} onClick={() => void setPolicy(true)}>{t('require')}</button>}
      </div>}
    {!status.required && !ownEnabled && <p className={styles.lead}>{t('ownFirst')}</p>}
    {!status.required && missing > 0 && ownEnabled && <p className={styles.lead}>{t('missingCount', { count: missing })}</p>}
    {notice && <p role='status' className={styles.notice}>{notice}</p>}
    {error && !target && <p role='alert' className={styles.error}>{error}</p>}
    <ul className={styles.roster}>{(admins ?? []).map(admin => <li key={admin.id} className={styles.rosterRow}>
      <div><p className={styles.rosterName}>{admin.full_name}{admin.id === currentId ? ` ${t('you')}` : ''}</p><p className={styles.rosterEmail}>{admin.email}</p></div>
      <span className={`${styles.badge} ${enabled[admin.id] ? styles.on : styles.off}`}><span className={styles.dot} aria-hidden />{enabled[admin.id] ? t('appOn') : t('appOff')}</span>
      {enabled[admin.id] && admin.id !== currentId && <button type='button' className={styles.danger} onClick={() => { setError(''); setReason(''); setTarget(admin) }}>{t('reset')}</button>}
    </li>)}</ul>
    <dialog ref={dialog} className={styles.dialog} aria-label={target ? t('resetTitle', { name: target.full_name }) : undefined} onCancel={event => { if (busy) event.preventDefault(); else setTarget(null) }}>
      <form noValidate onSubmit={reset} className={styles.stack}>
        <div><h2 id='reset-2fa-title' className={styles.title}>{t('resetTitle', { name: target?.full_name ?? '' })}</h2><p className={styles.lead}>{t('resetIntro')}</p></div>
        <div className={styles.field}><label htmlFor='reset-2fa-reason'>{t('reasonLabel')}</label>
          <textarea id='reset-2fa-reason' className={styles.textarea} value={reason} maxLength={500} aria-invalid={Boolean(error)} onChange={event => { setReason(event.target.value); setError('') }} /></div>
        {error && <p role='alert' className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type='submit' className={styles.danger} disabled={busy}>{busy ? tc('checking') : t('resetConfirm')}</button>
          <button type='button' className={styles.secondary} disabled={busy} onClick={() => setTarget(null)}>{tc('cancel')}</button>
        </div>
      </form>
    </dialog>
  </section>
}

export default function TwoFactorSettings({ setupRequested = false }: { setupRequested?: boolean }) {
  const t = useTranslations('adminSecurity'), errorText = useErrorText(), locale = useLocale()
  const [status, setStatus] = useState<TwoFactorStatus | null>(null), [loadError, setLoadError] = useState('')
  type Flow = { kind: 'setup'; replacing: boolean } | { kind: 'codes'; codes: string[]; account: string } | { kind: 'regenerate' } | { kind: 'disable' } | null
  const [flow, setFlow] = useState<Flow>(null), [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    try { setStatus(await apiGet<TwoFactorStatus>(BASE)); setLoadError('') } catch (failure) { setLoadError(errorText(failure)) }
  }, [errorText])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load])
  if (!status) return <section className={styles.card}>{loadError
    ? <><p role='alert' className={styles.error}>{loadError}</p><div className={styles.actions}><button type='button' className={styles.secondary} onClick={() => void load()}>{t('retry')}</button></div></>
    : <p role='status' className={styles.lead}>{t('loading')}</p>}</section>
  const since = status.confirmed_at ? new Date(status.confirmed_at).toLocaleDateString(locale.startsWith('de') ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const finished = (result: Confirmed, account: string) => { setStatus(result.status); setFlow({ kind: 'codes', codes: result.recovery_codes, account }) }
  return <div className={styles.stack}>
    {(status.setup_required || setupRequested) && !status.enabled && <p role='status' className={styles.warning}>{t('requiredBanner')}</p>}
    <section className={styles.card} aria-labelledby='own-2fa-title'>
      <div className={styles.cardHeader}>
        <div><h2 id='own-2fa-title' className={styles.title}>{t('title')}</h2><p className={styles.lead}>{t('intro')}</p></div>
        <span className={`${styles.badge} ${status.enabled ? styles.on : styles.off}`}><span className={styles.dot} aria-hidden />{status.enabled ? t('on') : t('off')}</span>
      </div>
      {notice && <p role='status' className={styles.notice}>{notice}</p>}
      {flow?.kind === 'setup' ? <SetupFlow replacing={flow.replacing} onConfirmed={finished} onCancel={() => setFlow(null)} />
        : flow?.kind === 'codes' ? <RecoveryCodes codes={flow.codes} account={flow.account} onDone={() => { setFlow(null); setNotice(t('allSet')) }} />
        : flow?.kind === 'regenerate' ? <CodePrompt id='regenerate' title={t('regenerateTitle')} hint={t('regenerateHint')} action={t('regenerateAction')}
            run={async code => { const result = await apiPost<Confirmed>(`${BASE}/recovery-codes`, { code }); setStatus(result.status); setFlow({ kind: 'codes', codes: result.recovery_codes, account: '' }) }} onCancel={() => setFlow(null)} />
        : flow?.kind === 'disable' ? <CodePrompt id='disable' tone='danger' title={t('disableTitle')} hint={t('disableHint')} action={t('disableAction')}
            run={async code => { setStatus(await apiPost<TwoFactorStatus>(`${BASE}/disable`, { code })); setFlow(null); setNotice(t('disabled')) }} onCancel={() => setFlow(null)} />
        : !status.enabled ? <>
            <ul className={styles.ol}><li>{t('why1')}</li><li>{t('why2')}</li><li>{t('why3')}</li></ul>
            <div className={styles.actions}><button type='button' className={styles.primary} onClick={() => { setNotice(''); setFlow({ kind: 'setup', replacing: false }) }}>{t('start')}</button></div>
          </>
        : <>
            <dl className={styles.meta}><div><dt className='sr-only'>{t('sinceLabel')}</dt><dd style={{ margin: 0 }}>{t('since', { date: since })}</dd></div>
              <div><dt className='sr-only'>{t('codesLabel')}</dt><dd style={{ margin: 0 }}><strong>{t('codesLeft', { count: status.recovery_codes_remaining })}</strong></dd></div></dl>
            {status.recovery_codes_remaining <= 3 && <p className={styles.warning}>{t('codesLow')}</p>}
            <div className={styles.actions}>
              <button type='button' className={styles.secondary} onClick={() => { setNotice(''); setFlow({ kind: 'regenerate' }) }}>{t('regenerate')}</button>
              <button type='button' className={styles.secondary} onClick={() => { setNotice(''); setFlow({ kind: 'setup', replacing: true }) }}>{t('replace')}</button>
              {!status.required && <button type='button' className={styles.danger} onClick={() => { setNotice(''); setFlow({ kind: 'disable' }) }}>{t('disable')}</button>}
            </div>
            {status.required && <p className={styles.lead}>{t('cannotDisable')}</p>}
          </>}
    </section>
    <Team ownEnabled={status.enabled} status={status} onPolicy={setStatus} />
  </div>
}

'use client'

import { Suspense, useCallback, useEffect, useId, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getApiErrorDetail } from '@/lib/api'
import AccountErasure from '@/components/admin/AccountErasure'
import {
  ACTION_LABELS, STATUS_LABELS, cancelAccountDeletion, eventLabel, formatBerlin, getAccount, listAccounts, reactivateAccount,
  reasonProblem, requestAccountDeletion, suspendAccount,
  type AccountDetail, type AccountList, type AccountRole, type AccountStatus,
} from '@/lib/admin-accounts'

type Action = 'suspend' | 'reactivate' | 'delete' | 'cancel-delete'
const PAGE = 25
const ACTION_COPY: Record<Action, { title: string; body: string; button: string; danger?: boolean }> = {
  suspend: { title: 'Suspend account', body: 'Sign-in is blocked and every active session is ended now. The account can be reactivated later.', button: 'Suspend account', danger: true },
  reactivate: { title: 'Reactivate account', body: 'The person can sign in again. Sessions ended earlier stay ended.', button: 'Reactivate account' },
  delete: { title: 'Request account deletion', body: 'Sign-in is blocked and sessions end now. Contact data becomes eligible for erasure after the cooling-off period. Records that must be kept by law are retained until their retention period ends.', button: 'Request deletion', danger: true },
  'cancel-delete': { title: 'Cancel deletion request', body: 'The deletion request is withdrawn. The account stays suspended until someone reactivates it deliberately.', button: 'Cancel deletion request' },
}

function StatusBadge({ status }: { status: AccountStatus }) {
  return <span className={`acc-badge ${status.toLowerCase()}`}>{STATUS_LABELS[status] ?? status}</span>
}

function ActionDialog({ action, account, onClose, onDone }: { action: Action; account: AccountDetail; onClose: () => void; onDone: (detail: AccountDetail, message: string) => void }) {
  const copy = ACTION_COPY[action]
  const [reason, setReason] = useState('')
  const [email, setEmail] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const titleId = useId()
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { reasonRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])
  const reasonError = reasonProblem(reason)
  const emailError = action === 'delete' && email.trim().toLowerCase() !== (account.email ?? '').toLowerCase() ? 'Type the account’s email address exactly.' : null

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setAttempted(true)
    if (reasonError || emailError || busy) return
    setBusy(true); setError('')
    try {
      const text = reason.trim()
      const detail = action === 'suspend' ? await suspendAccount(account.user_id, text)
        : action === 'reactivate' ? await reactivateAccount(account.user_id, text)
          : action === 'delete' ? await requestAccountDeletion(account.user_id, text, email.trim())
            : await cancelAccountDeletion(account.user_id, text)
      onDone(detail, { suspend: 'Account suspended and sessions ended.', reactivate: 'Account reactivated.', delete: 'Deletion requested. Sign-in is blocked.', 'cancel-delete': 'Deletion request cancelled. The account stays suspended.' }[action])
    } catch (cause) {
      setError(getApiErrorDetail(cause) || 'The change could not be saved. Nothing was changed.')
    } finally { setBusy(false) }
  }

  return <div className='acc-overlay' onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <form role='dialog' aria-modal='true' aria-labelledby={titleId} className='acc-dialog' onSubmit={submit} noValidate>
      <h2 id={titleId}>{copy.title}</h2>
      <p><strong>{account.name || account.email || 'Unnamed account'}</strong>{account.email ? ` · ${account.email}` : ''}</p>
      <p>{copy.body}</p>
      {action === 'delete' && <div className='acc-retention'>
        <h3>What happens to the data</h3>
        <ul>{account.retention_plan.map(item => <li key={item.category}><strong>{item.category}</strong>: {item.handling}{item.retention ? ` (${item.retention})` : ''}</li>)}</ul>
        {!account.retention_confirmed && <p className='acc-warn'>Retention periods are awaiting legal confirmation. Erasure runs only after an administrator reviews the dry-run plan.</p>}
      </div>}
      <label htmlFor={`${titleId}-reason`}>Reason (Required)</label>
      <textarea id={`${titleId}-reason`} ref={reasonRef} value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={600}
        aria-invalid={attempted && !!reasonError} aria-describedby={`${titleId}-reason-help`} />
      <p id={`${titleId}-reason-help`} className={attempted && reasonError ? 'acc-error' : 'acc-help'}>{attempted && reasonError ? reasonError : 'Stored in the audit trail with your name and the time.'}</p>
      {action === 'delete' && <>
        <label htmlFor={`${titleId}-email`}>Type the account’s email address to confirm (Required)</label>
        <input id={`${titleId}-email`} value={email} onChange={event => setEmail(event.target.value)} autoComplete='off' spellCheck={false}
          aria-invalid={attempted && !!emailError} aria-describedby={attempted && emailError ? `${titleId}-email-error` : undefined} />
        {attempted && emailError && <p id={`${titleId}-email-error`} className='acc-error'>{emailError}</p>}
      </>}
      {error && <p role='alert' className='acc-error'>{error}</p>}
      <div className='acc-actions'>
        <button type='button' className='acc-button' onClick={onClose} disabled={busy}>Keep as is</button>
        <button type='submit' className={`acc-button ${copy.danger ? 'danger' : 'primary'}`} disabled={busy}>{busy ? 'Saving…' : copy.button}</button>
      </div>
    </form>
  </div>
}

function AccountPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<AccountDetail | null>(null)
  const [error, setError] = useState('')
  const [action, setAction] = useState<Action | null>(null)
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    let live = true
    // The panel is keyed by account id, so a new account always starts empty; retry resets in its handler.
    getAccount(id).then(value => { if (live) { setDetail(value); requestAnimationFrame(() => heading.current?.focus()) } })
      .catch(cause => { if (live) setError(getApiErrorDetail(cause) || 'This account could not be loaded.') })
    return () => { live = false }
  }, [id, attempt])

  if (error) return <section className='acc-panel' aria-label='Account details'><p role='alert' className='acc-error'>{error}</p><button className='acc-button' onClick={() => { setError(''); setDetail(null); setAttempt(n => n + 1) }}>Try again</button></section>
  if (!detail) return <section className='acc-panel' aria-label='Account details'><p role='status'>Loading account…</p></section>
  const can = detail.can
  const any = can.suspend || can.reactivate || can.request_deletion || can.cancel_deletion
  return <section className='acc-panel' aria-labelledby='acc-detail-title'>
    <header className='acc-panel-head'>
      <div>
        <h2 id='acc-detail-title' ref={heading} tabIndex={-1}>{detail.name || 'Unnamed account'}</h2>
        <p>{detail.email ?? 'Contact data erased'}</p>
      </div>
      <StatusBadge status={detail.status} />
    </header>
    {notice && <p role='status' className='acc-notice'>{notice}</p>}
    {detail.contact_data_erased_at && <div className='acc-banner' role='note'><strong>Contact data erased</strong> on {formatBerlin(detail.contact_data_erased_at)}. The identity kept with the medical documentation remains.</div>}
    {detail.deletion && <div className='acc-banner' role='note'>
      <strong>Deletion requested</strong> on {formatBerlin(detail.deletion.requested_at)} by {detail.deletion.requested_by}. Contact data becomes eligible for erasure from {formatBerlin(detail.deletion.erase_contact_data_after, false)}. {detail.deletion.erasure_job === 'enabled' ? 'A super or compliance administrator erases it from the erasure plan below the account list.' : 'Erasure is a dry run only on this deployment.'}
    </div>}
    <dl className='acc-facts'>
      <div><dt>Account type</dt><dd>{detail.role === 'doctor' ? 'Doctor' : 'Patient'}</dd></div>
      <div><dt>Registered</dt><dd>{formatBerlin(detail.registered_at)}</dd></div>
      <div><dt>Last sign-in</dt><dd>{formatBerlin(detail.last_login_at)}</dd></div>
      <div><dt>{detail.role === 'doctor' ? 'Licence verification' : 'Email verification'}</dt><dd>{detail.verification === 'verified' ? 'Verified' : detail.verification === 'pending' ? 'Pending review' : 'Not verified'}</dd></div>
      <div><dt>Phone</dt><dd>{detail.phone || '—'}{detail.phone ? (detail.phone_verified ? ' · verified' : ' · not verified') : ''}</dd></div>
      <div><dt>Active sessions</dt><dd>{detail.sessions.length}</dd></div>
    </dl>
    {any ? <div className='acc-actions start'>
      {can.suspend && <button className='acc-button danger' onClick={() => setAction('suspend')}>Suspend</button>}
      {can.reactivate && <button className='acc-button primary' onClick={() => setAction('reactivate')}>Reactivate</button>}
      {can.cancel_deletion && <button className='acc-button' onClick={() => setAction('cancel-delete')}>Cancel deletion request</button>}
      {can.request_deletion && <button className='acc-button danger subtle' onClick={() => setAction('delete')}>Request deletion</button>}
    </div> : <p className='acc-help'>Your administrator role can view this account but not change it.</p>}
    <div className='acc-columns'>
      <section aria-labelledby='acc-sessions'><h3 id='acc-sessions'>Sessions</h3>
        {detail.sessions.length ? <ul className='acc-list'>{detail.sessions.map(s => <li key={s.id}><strong>{[s.device, s.browser, s.os].filter(Boolean).join(' · ') || 'Unknown device'}</strong><span>Network {s.network || 'unknown'} · started {formatBerlin(s.started_at)} · last seen {formatBerlin(s.last_seen_at)}</span></li>)}</ul> : <p className='acc-help'>No active sessions.</p>}
      </section>
      <section aria-labelledby='acc-activity'><h3 id='acc-activity'>Recent activity</h3>
        {detail.activity.length ? <ul className='acc-list'>{detail.activity.map((a, i) => <li key={`${a.event}-${a.at}-${i}`}><strong>{eventLabel(a.event)}{a.success ? '' : ' (failed)'}</strong><span>{formatBerlin(a.at)}</span></li>)}</ul> : <p className='acc-help'>No recorded activity.</p>}
      </section>
    </div>
    <section aria-labelledby='acc-history'><h3 id='acc-history'>Administrative history</h3>
      {detail.admin_history.length ? <ol className='acc-list'>{detail.admin_history.map((h, i) => <li key={`${h.action}-${h.at}-${i}`}><strong>{ACTION_LABELS[h.action] || eventLabel(h.action)} by {h.by}</strong><span>{formatBerlin(h.at)}{h.reason ? ` · “${h.reason}”` : ''}</span></li>)}</ol> : <p className='acc-help'>No administrative changes yet.</p>}
    </section>
    {action && <ActionDialog action={action} account={detail} onClose={() => setAction(null)}
      onDone={(value, message) => { setAction(null); setDetail(value); setNotice(message); onChanged(); requestAnimationFrame(() => heading.current?.focus()) }} />}
  </section>
}

function AccountsContent() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const role: AccountRole = params.get('role') === 'doctor' ? 'doctor' : 'patient'
  const selected = params.get('account')
  const [search, setSearch] = useState(params.get('q') || '')
  const [status, setStatus] = useState('')
  const [verification, setVerification] = useState('')
  const [offset, setOffset] = useState(0)
  const [list, setList] = useState<AccountList | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  const navigate = useCallback((next: Record<string, string | null>) => {
    const query = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) { if (value) query.set(key, value); else query.delete(key) }
    router.replace(`${pathname}?${query.toString()}`, { scroll: false })
  }, [params, pathname, router])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setError('')
      listAccounts({ role, search, status, verification, limit: PAGE, offset }, controller.signal)
        .then(setList)
        .catch(cause => { if (!controller.signal.aborted) setError(getApiErrorDetail(cause) || 'Accounts could not be loaded.') })
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [role, search, status, verification, offset, revision])

  const verificationOptions = role === 'doctor' ? [['verified', 'Licence verified'], ['pending', 'Licence pending']] : [['verified', 'Email verified'], ['unverified', 'Email not verified']]
  const total = list?.total ?? 0
  return <section className='accounts'>
    <header>
      <h1>Accounts</h1>
      <p>Find patient and doctor accounts, check their status and sessions, and suspend, reactivate or request deletion. Clinical records are never shown here.</p>
    </header>
    <div role='tablist' aria-label='Account type' className='acc-tabs'>
      {(['patient', 'doctor'] as const).map(value => <button key={value} role='tab' aria-selected={role === value} className={role === value ? 'active' : ''}
        onClick={() => { setOffset(0); setVerification(''); navigate({ role: value, account: null }) }}>{value === 'patient' ? 'Patients' : 'Doctors'}</button>)}
    </div>
    <form className='acc-filters' role='search' onSubmit={event => event.preventDefault()}>
      <label>Search by name or email<input type='search' value={search} maxLength={120} onChange={event => { setOffset(0); setSearch(event.target.value) }} /></label>
      <label>Status<select value={status} onChange={event => { setOffset(0); setStatus(event.target.value) }}>
        <option value=''>Any status</option>{(Object.keys(STATUS_LABELS) as AccountStatus[]).map(value => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
      </select></label>
      <label>Verification<select value={verification} onChange={event => { setOffset(0); setVerification(event.target.value) }}>
        <option value=''>Any</option>{verificationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </form>
    <div className={`acc-layout${selected ? ' with-panel' : ''}`}>
      <div className='acc-results'>
        <p role='status' className='acc-help'>{list ? `${total} ${role === 'doctor' ? 'doctor' : 'patient'} account${total === 1 ? '' : 's'}` : 'Loading accounts…'}</p>
        {error && <p role='alert' className='acc-error'>{error} <button className='acc-button' onClick={() => setRevision(n => n + 1)}>Try again</button></p>}
        {list && <ul className='acc-rows'>{list.accounts.map(account => <li key={account.user_id} className={selected === account.user_id ? 'current' : ''}>
          <button className='acc-row' aria-current={selected === account.user_id || undefined} aria-label={`Open account ${account.name || account.email || account.user_id}`} onClick={() => navigate({ account: account.user_id })}>
            <span className='acc-row-main'><strong>{account.name || 'Unnamed account'}</strong><span>{account.email ?? 'Contact data erased'}</span></span>
            <span className='acc-row-meta'><StatusBadge status={account.status} />{account.deletion_pending && <span className='acc-badge deactivated'>Deletion pending</span>}
              <span>Registered {formatBerlin(account.registered_at, false)} · last sign-in {formatBerlin(account.last_login_at, false)}</span></span>
          </button>
        </li>)}</ul>}
        {list && total > PAGE && <nav aria-label='Pages' className='acc-actions start'>
          <button className='acc-button' disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</button>
          <span className='acc-help'>{offset + 1}–{Math.min(offset + PAGE, total)} of {total}</span>
          <button className='acc-button' disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>Next</button>
        </nav>}
      </div>
      {selected && <AccountPanel key={selected} id={selected} onChanged={() => setRevision(n => n + 1)} />}
    </div>
    <AccountErasure onErased={() => setRevision(n => n + 1)} />
    <style jsx global>{`
      .accounts {display:grid;gap:20px;color:var(--text);min-width:0}
      .accounts h1 {font-size:28px;line-height:1.2;letter-spacing:-.03em;margin:0 0 6px}
      .accounts h2 {font-size:20px;line-height:1.3;margin:0}
      .accounts h3 {font-size:15px;margin:0 0 8px}
      .accounts p {font-size:14px;line-height:1.6;margin:0;color:var(--text-secondary);overflow-wrap:anywhere}
      .acc-tabs {display:inline-flex;gap:4px;padding:4px;border-radius:12px;background:var(--surface-subtle);border:1px solid var(--border);justify-self:start}
      .acc-tabs button {min-height:40px;padding:0 18px;border-radius:9px;border:0;background:transparent;color:var(--text-secondary);font:inherit;font-weight:700;cursor:pointer}
      .acc-tabs button.active {background:var(--surface);color:var(--text);box-shadow:0 1px 3px rgba(4,53,77,.12)}
      .acc-filters {display:grid;grid-template-columns:minmax(0,2fr) repeat(2,minmax(0,1fr));gap:12px}
      .acc-filters label, .acc-dialog label {display:grid;gap:6px;font-size:13px;font-weight:700;color:var(--text)}
      .acc-filters input, .acc-filters select, .acc-dialog input, .acc-dialog textarea {min-height:44px;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;font-size:14px;width:100%}
      .acc-layout {display:grid;gap:16px;min-width:0}
      .acc-layout.with-panel {grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);align-items:start}
      .acc-results {display:grid;gap:10px;min-width:0}
      .acc-rows {list-style:none;margin:0;padding:0;display:grid;gap:8px}
      .acc-row {width:100%;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;text-align:left;padding:14px 16px;border-radius:14px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;cursor:pointer}
      .acc-rows li.current .acc-row {border-color:var(--action-primary);box-shadow:0 0 0 1px var(--action-primary)}
      .acc-row-main, .acc-row-meta {display:grid;gap:4px;min-width:0}
      .acc-row-main span, .acc-row-meta > span:last-child {font-size:13px;color:var(--text-secondary);overflow-wrap:anywhere}
      .acc-row-meta {justify-items:end}
      .acc-badge {display:inline-flex;align-items:center;min-height:24px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:700;background:var(--surface-subtle);color:var(--text);border:1px solid var(--border)}
      .acc-badge.active {border-color:var(--success,#0f9e77);color:var(--success,#0f9e77)}
      .acc-badge.suspended, .acc-badge.deactivated {border-color:var(--danger);color:var(--danger)}
      .acc-panel {display:grid;gap:16px;padding:20px;border-radius:18px;border:1px solid var(--border);background:var(--surface);min-width:0}
      .acc-panel-head {display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
      .acc-facts {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0}
      .acc-facts div {padding:12px;border-radius:12px;background:var(--surface-subtle);border:1px solid var(--border)}
      .acc-facts dt {font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em}
      .acc-facts dd {margin:4px 0 0;font-size:14px;font-weight:600;overflow-wrap:anywhere}
      .acc-columns {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
      .acc-list {list-style:none;margin:0;padding:0;display:grid;gap:8px}
      .acc-list li {display:grid;gap:2px;padding:10px 12px;border-radius:10px;border:1px solid var(--border-subtle,var(--border));font-size:14px}
      .acc-list li span {font-size:13px;color:var(--text-secondary);overflow-wrap:anywhere}
      .acc-actions {display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;align-items:center}
      .acc-actions.start {justify-content:flex-start}
      .acc-button {min-height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;font-size:14px;font-weight:700;cursor:pointer}
      .acc-button.primary {background:var(--action-primary);color:var(--surface);border-color:transparent}
      .acc-button.danger {background:var(--danger);color:#fff;border-color:transparent}
      .acc-button.danger.subtle {background:var(--surface);color:var(--danger);border-color:var(--danger)}
      .acc-button:disabled {opacity:.55;cursor:not-allowed}
      .acc-help {font-size:13px;color:var(--text-muted)}
      .acc-error {color:var(--danger)!important;font-size:13px}
      .acc-notice {padding:10px 12px;border-radius:10px;background:var(--surface-subtle);border:1px solid var(--border);color:var(--text)!important}
      .acc-banner {padding:12px 14px;border-radius:12px;border:1px solid var(--danger);background:var(--danger-soft);font-size:14px;line-height:1.6}
      .acc-overlay {position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:rgba(4,20,32,.55)}
      .acc-dialog {width:min(560px,100%);max-height:calc(100dvh - 32px);overflow:auto;display:grid;gap:12px;padding:24px;border-radius:18px;background:var(--surface);border:1px solid var(--border);box-shadow:0 24px 60px rgba(4,20,32,.3)}
      .acc-retention {padding:12px 14px;border-radius:12px;background:var(--surface-subtle);border:1px solid var(--border)}
      .acc-retention ul {margin:0;padding-left:18px;display:grid;gap:6px;font-size:13px;line-height:1.5}
      .acc-warn {margin-top:8px!important;font-size:13px;color:var(--text)!important;font-weight:600}
      .accounts :focus-visible {outline:3px solid var(--action-primary);outline-offset:2px}
      @media (max-width:1100px) {.acc-layout.with-panel {grid-template-columns:minmax(0,1fr)}}
      @media (max-width:720px) {.acc-filters, .acc-facts, .acc-columns {grid-template-columns:minmax(0,1fr)} .acc-row-meta {justify-items:start} .acc-tabs {justify-self:stretch} .acc-tabs button {flex:1}}
    `}</style>
  </section>
}

export default function AccountsPage() {
  return <Suspense fallback={<p role='status'>Loading accounts…</p>}><AccountsContent /></Suspense>
}

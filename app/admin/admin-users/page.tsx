'use client'

import { useEffect, useRef, useState } from 'react'
import { FieldFeedback, ValidationSummary } from '@/components/ui/ValidationFeedback'
import { getAdminUsers, createAdminUser, updateAdminUser, updateAdminUserStatus, resendAdminInvitation,
  getApiErrorDetail, type AdminUser, type AdminRole, type AdminStatus } from '@/lib/api'

const ROLES: Record<AdminRole, string> = {
  super_admin: 'Super administrator', operations_admin: 'Operations administrator',
  compliance_admin: 'Compliance administrator', support_admin: 'Support administrator',
}
const STATUSES: AdminStatus[] = ['INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED']
type Action = { kind: 'invite' | 'edit' | 'status' | 'resend'; user?: AdminUser; status?: Exclude<AdminStatus, 'INVITED'> }

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [canManage, setCanManage] = useState(false)
  const [currentId, setCurrentId] = useState('')
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [action, setAction] = useState<Action | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', role: 'support_admin' as AdminRole, reason: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true); setError('')
      try {
        const data = await getAdminUsers(role, status, search, 50, offset)
        if (!cancelled) {
          setUsers(data.admin_users); setTotal(data.total); setCanManage(data.can_manage); setCurrentId(data.current_admin_id)
        }
      } catch (err) { if (!cancelled) { setError(getApiErrorDetail(err) || 'Unable to load administrators. Please retry.'); setCanManage(false) } }
      finally { if (!cancelled) setLoading(false) }
    }, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [search, role, status, offset, revision])

  function open(next: Action) {
    trigger.current = document.activeElement as HTMLElement
    setAction(next); setErrors({}); setNotice('')
    setForm({ full_name: next.user?.full_name || '', email: next.user?.email || '', role: next.user?.role || 'support_admin', reason: '' })
    dialog.current?.showModal()
  }
  function close() { if (!saving) dialog.current?.close() }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!action || saving) return
    const issues: Record<string, string> = {}
    if (action.kind === 'invite' || action.kind === 'edit') {
      if (!form.full_name.trim()) issues.full_name = 'Full name is required.'
      else if (form.full_name.trim().split(/\s+/).length < 2) issues.full_name = 'Enter your first and last name.'
      if (!(form.role in ROLES)) issues.role = 'Select an administrator role.'
    }
    if (action.kind === 'invite' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) issues.email = 'Enter a valid email address.'
    if (action.kind === 'status' && form.reason.trim().length < 10) issues.reason = 'Explain this access change in at least 10 characters.'
    setErrors(issues)
    if (Object.keys(issues).length) return
    setSaving(true)
    try {
      if (action.kind === 'invite') {
        await createAdminUser({ email: form.email.trim(), full_name: form.full_name.trim(), role: form.role })
        setNotice('Invitation accepted for email delivery. Access stays pending until the recipient sets their password.')
      } else if (action.kind === 'edit' && action.user) {
        await updateAdminUser(action.user.id, { full_name: form.full_name.trim(), role: form.role })
        setNotice('Administrator updated. A role change requires a fresh sign-in.')
      } else if (action.kind === 'status' && action.user && action.status) {
        await updateAdminUserStatus(action.user.id, { status: action.status, reason: form.reason.trim() })
        setNotice('Access updated. Existing sessions have been revoked; restoring access requires a fresh sign-in.')
      } else if (action.kind === 'resend' && action.user) {
        await resendAdminInvitation(action.user.id)
        setNotice('New invitation accepted for email delivery. The previous link is invalid.')
      }
      dialog.current?.close(); setRevision(n => n + 1)
    } catch (err) { setErrors({ server: getApiErrorDetail(err) || 'This change could not be completed. Please retry.' }) }
    finally { setSaving(false) }
  }
  const title = action?.kind === 'invite' ? 'Invite administrator' : action?.kind === 'edit' ? 'Edit administrator' : action?.kind === 'resend' ? 'Send a new invitation' : 'Change administrator access'
  return <section className='admin-management'>
    <header className='management-heading'>
      <div><h1>Admin Users</h1><p>Invite trusted colleagues, assign roles and control administrative access.</p></div>
      {canManage && <button className='primary' onClick={() => open({ kind: 'invite' })}>Invite administrator</button>}
    </header>
    <div className='management-guide'>
      <h2>Owner & administrator setup</h2>
      <p>A super administrator can manage other administrators. Invitations expire after 24 hours and require mailbox verification and a personal password. Keep at least one active super administrator.</p>
      <p>Suspend or revoke access to stop existing sessions. Restore access when appropriate. These controls preserve account and audit records; they do not permanently delete people or clinical data.</p>
      {!canManage && !loading && !error && <p>You can view this directory. Only a super administrator can change access.</p>}
    </div>
    <div className='management-filters'>
      <label>Search administrators<input type='search' value={search} onChange={e => { setSearch(e.target.value); setOffset(0) }} maxLength={200} /></label>
      <label>Role<select value={role} onChange={e => { setRole(e.target.value); setOffset(0) }}><option value=''>All roles</option>{Object.entries(ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Status<select value={status} onChange={e => { setStatus(e.target.value); setOffset(0) }}><option value=''>All statuses</option>{STATUSES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    </div>
    {notice && <p role='status' className='management-guide'>{notice}</p>}
    {error ? <div role='alert'><p>{error}</p><button onClick={() => setRevision(n => n + 1)}>Retry</button></div> : loading ? <p role='status'>Loading administrators…</p> : <>
      {!users.length && <p>No administrators match these filters.</p>}
      {users.map(user => <article className='management-card' key={user.id}>
        <div><h2>{user.full_name}{user.id === currentId ? ' (you)' : ''}</h2><p>{user.email}</p><p>{ROLES[user.role]} · <strong>{user.status}</strong></p></div>
        {canManage && <div className='management-actions'>
          <button onClick={() => open({kind:'edit',user})}>Edit</button>
          {user.status === 'INVITED' && <button onClick={() => open({kind:'resend',user})}>Resend invitation</button>}
          {user.status === 'ACTIVE' && <button onClick={() => open({kind:'status',user,status:'SUSPENDED'})}>Suspend access</button>}
          {(user.status === 'SUSPENDED' || user.status === 'DISABLED') && <button onClick={() => open({kind:'status',user,status:'ACTIVE'})}>Restore access</button>}
          {user.status === 'DISABLED' && <button onClick={() => open({kind:'resend',user})}>Reinvite unactivated account</button>}
          {user.status !== 'DISABLED' && <button className='danger' onClick={() => open({kind:'status',user,status:'DISABLED'})}>{user.status === 'INVITED' ? 'Revoke invitation' : 'Revoke access'}</button>}
        </div>}
      </article>)}
      <nav aria-label='Administrator directory pages' className='management-actions'>
        <button disabled={offset === 0} onClick={() => setOffset(n => Math.max(0,n-50))}>Previous</button>
        <span>{total ? `${offset+1}–${Math.min(offset+50,total)} of ${total}` : '0 administrators'}</span>
        <button disabled={offset+50 >= total} onClick={() => setOffset(n => n+50)}>Next</button>
      </nav>
    </>}
    <dialog ref={dialog} className='preferences-dialog' aria-labelledby='admin-action-title' onCancel={event => { if (saving) event.preventDefault() }} onClose={() => { setAction(null); trigger.current?.focus() }}>
      <h2 id='admin-action-title'>{title}</h2>
      <form noValidate onSubmit={submit}>
        <ValidationSummary errors={errors} />
        {(action?.kind === 'invite' || action?.kind === 'edit') && <>
          <label htmlFor='admin-full_name'>Full Name (Required)</label>
          <input id='admin-full_name' autoComplete='name' required maxLength={200} value={form.full_name} onChange={e => setForm({...form,full_name:e.target.value})} aria-invalid={!!errors.full_name} aria-describedby={errors.full_name ? 'admin-full_name-error' : undefined} />
          <FieldFeedback name='admin-full_name' error={errors.full_name} />
          {action.kind === 'invite' && <><label htmlFor='admin-email'>Email (Required)</label>
            <input id='admin-email' type='email' autoComplete='email' required value={form.email} onChange={e => setForm({...form,email:e.target.value})} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'admin-email-error' : 'admin-email-hint'} />
            <small id='admin-email-hint'>Use a dedicated mailbox the recipient controls, separate from patient or clinician accounts.</small><FieldFeedback name='admin-email' error={errors.email} /></>}
          <label htmlFor='admin-role'>Role (Required)</label>
          <select id='admin-role' required value={form.role} onChange={e => setForm({...form,role:e.target.value as AdminRole})} aria-invalid={!!errors.role} aria-describedby={errors.role?'admin-role-hint admin-role-error':'admin-role-hint'}>
            {Object.entries(ROLES).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select><small id='admin-role-hint'>Super administrators can grant and revoke administrative access. Operations administrators can review clinicians.</small>
          <FieldFeedback name='admin-role' error={errors.role} />
        </>}
        {action?.kind === 'status' && <><p>Set {action.user?.email} to <strong>{action.status}</strong>. Current sessions will be revoked. Records will be preserved.</p>
          <label htmlFor='admin-reason'>Reason (Required)</label><textarea id='admin-reason' required minLength={10} maxLength={500} value={form.reason} onChange={e => setForm({...form,reason:e.target.value})} aria-invalid={!!errors.reason} aria-describedby='admin-reason-error' /><FieldFeedback name='admin-reason' error={errors.reason} /></>}
        {action?.kind === 'resend' && <p>Send a replacement invitation to {action.user?.email}. The previous link will stop working. This applies only to an invitation that has not been accepted.</p>}
        <div className='management-actions'><button type='button' disabled={saving} onClick={close}>Cancel</button><button className='primary' type='submit' disabled={saving}>{saving ? 'Saving…' : action?.kind === 'invite' ? 'Send invitation' : action?.kind === 'resend' ? 'Resend invitation' : 'Save changes'}</button></div>
      </form>
    </dialog>
    <style jsx>{`
      .admin-management {display:grid;gap:24px;color:var(--text);min-width:0}
      h1 {font-size:28px;line-height:1.2;letter-spacing:-.035em;margin:0 0 8px} h2 {font-size:18px;line-height:1.4;margin:0 0 8px}
      p {font-size:14px;line-height:1.7;margin:6px 0;color:var(--text-secondary);overflow-wrap:anywhere}
      .management-heading,.management-card {display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:center}
      .management-guide,.management-card {padding:22px;border:1px solid var(--border);border-radius:16px;background:var(--surface)}
      .management-filters {display:grid;grid-template-columns:2fr 1fr 1fr;gap:16px}
      label {display:block;font-size:13px;font-weight:600;margin:12px 0 6px}
      input,select,textarea {width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font:inherit;font-size:16px}
      small {display:block;font-size:13px;line-height:1.6;color:var(--text-secondary);margin:6px 0 12px}
      .management-actions {display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:14px}
      button {min-height:44px;padding:10px 16px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font:inherit;font-size:14px;cursor:pointer}
      button:disabled {opacity:.5;cursor:not-allowed} button.primary {background:var(--link);color:var(--surface);font-weight:700} button.danger {color:var(--danger);background:var(--danger-soft)}
      @media(max-width:700px) {.management-filters{grid-template-columns:1fr}.management-card{align-items:stretch}.management-actions{width:100%}}
    `}</style>
  </section>
}

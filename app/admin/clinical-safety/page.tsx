'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAdminUsers, getApiErrorDetail, type AdminUser } from '@/lib/api'
import {
  approveSafetyVersion, cleanSafetyContent, createSafetyDraft, emptySafetyContent, getMySafetyPermissions,
  getSafetyVersion, grantSafetyPermission, listSafetyGrants, listSafetyVersions, publishSafetyVersion,
  questionId, retireSafetyVersion, revokeSafetyPermission, safetyContentErrors, updateSafetyDraft,
  ROUTE_LABELS, SAFETY_ROUTES,
  type Grant, type MyPermissions, type SafetyContent, type SafetyQuestion, type SafetyRoute, type VersionDetail, type VersionSummary,
} from '@/lib/safety-screen'

type Mode = { kind: 'list' } | { kind: 'view'; id: string } | { kind: 'edit'; id?: string; basedOn?: string }
type Draft = { title: string; locale: string; change_note: string; content: SafetyContent; lock_version?: number }

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Draft', APPROVED: 'Approved, not live', ACTIVE: 'Live', RETIRED: 'Retired' }
const ACTION_LABEL: Record<string, string> = {
  CREATE_SAFETY_SCREEN_DRAFT: 'Draft created', UPDATE_SAFETY_SCREEN_DRAFT: 'Draft edited', APPROVE_SAFETY_SCREEN: 'Clinically approved',
  PUBLISH_SAFETY_SCREEN: 'Published to patients', RETIRE_SAFETY_SCREEN: 'Retired',
}
const when = (value: string | null) => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value)) : '—'

function copyContent(content: SafetyContent): SafetyContent {
  return JSON.parse(JSON.stringify({ ...emptySafetyContent(), ...content, outcomes: content.outcomes ?? {} }))
}

export default function ClinicalSafetyPage() {
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [perms, setPerms] = useState<MyPermissions | null>(null)
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [detail, setDetail] = useState<VersionDetail | null>(null)
  const [grants, setGrants] = useState<Grant[]>([])
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [me, list, grantList] = await Promise.all([getMySafetyPermissions(), listSafetyVersions(), listSafetyGrants()])
      setPerms(me); setVersions(list.versions); setGrants(grantList.grants)
      if (me.can_manage_permissions) {
        const directory = await getAdminUsers(undefined, 'ACTIVE', undefined, 100, 0)
        setAdmins(directory.admin_users)
      }
    } catch (err) {
      setError(getApiErrorDetail(err) || 'Clinical safety governance could not be loaded.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load, revision])

  useEffect(() => {
    if (mode.kind !== 'view') { setDetail(null); return }
    let cancelled = false
    getSafetyVersion(mode.id).then(value => { if (!cancelled) setDetail(value) })
      .catch(err => { if (!cancelled) setError(getApiErrorDetail(err) || 'This version could not be loaded.') })
    return () => { cancelled = true }
  }, [mode, revision])

  const can = new Set(perms?.permissions ?? [])
  const live = versions.filter(version => version.status === 'ACTIVE')
  const refresh = (next?: Mode, message?: string) => { if (next) setMode(next); setNotice(message ?? ''); setRevision(n => n + 1) }

  return <section className='clinical-safety'>
    <header className='heading'>
      <div>
        <h1>Clinical Safety Screen</h1>
        <p>Red-flag questions every patient answers before choosing an appointment. Authorised administrators draft the content, a second authorised administrator approves it, and only approved content can go live. Every step is recorded.</p>
      </div>
      {mode.kind === 'list' && can.has('AUTHOR') && <button className='primary' onClick={() => setMode({ kind: 'edit' })}>New draft</button>}
      {mode.kind !== 'list' && <button onClick={() => { setMode({ kind: 'list' }); setNotice('') }}>Back to all versions</button>}
    </header>

    {notice && <p role='status' className='panel success'>{notice}</p>}
    {error && <div role='alert' className='panel danger'><p>{error}</p><button onClick={() => setRevision(n => n + 1)}>Retry</button></div>}
    {loading && !perms ? <p role='status'>Loading clinical safety governance…</p> : perms && <>
      {mode.kind === 'list' && <>
        <div className='summary'>
          <div className='panel'>
            <h2>Live for patients</h2>
            {live.length ? live.map(version => <p key={version.id}><strong>v{version.version_number}</strong> · {version.locale} · {version.title}<br /><small>Published {when(version.published_at)} by {version.published_by ?? 'unknown'}</small></p>)
              : <p className='warn'>No screen is live. {perms.booking_requires_screen ? 'Online booking is paused until one is published.' : 'Bookings continue in this environment, but a live environment will refuse them.'}</p>}
          </div>
          <div className='panel'>
            <h2>Your permissions</h2>
            <p>{can.size ? [...can].map(p => p === 'AUTHOR' ? 'Author drafts' : 'Approve and publish').join(' · ') : 'View only. A super administrator can grant clinical content permissions.'}</p>
            <small>Booking requires a passed screen here: <strong>{perms.booking_requires_screen ? 'yes' : 'no (development)'}</strong></small>
          </div>
        </div>
        <VersionList versions={versions} onOpen={id => setMode({ kind: 'view', id })} />
        <GrantsPanel perms={perms} grants={grants} admins={admins} onChanged={message => refresh(undefined, message)} />
      </>}
      {mode.kind === 'view' && (detail ? <VersionView detail={detail} canAuthor={can.has('AUTHOR')}
        onEdit={() => setMode({ kind: 'edit', id: detail.id })}
        onBranch={() => setMode({ kind: 'edit', basedOn: detail.id })}
        onChanged={(message, next) => refresh(next ?? { kind: 'view', id: detail.id }, message)} /> : <p role='status'>Loading version…</p>)}
      {mode.kind === 'edit' && <Editor mode={mode} onSaved={(saved, message) => refresh({ kind: 'view', id: saved.id }, message)} onCancel={() => setMode(mode.id ? { kind: 'view', id: mode.id } : { kind: 'list' })} />}
    </>}

    <style jsx global>{`
      .clinical-safety {display:grid;gap:24px;color:var(--text);min-width:0}
      .clinical-safety h1 {font-size:28px;line-height:1.2;letter-spacing:-.03em;margin:0 0 8px}
      .clinical-safety h2 {font-size:18px;line-height:1.4;margin:0 0 10px}
      .clinical-safety h3 {font-size:15px;margin:0 0 6px}
      .clinical-safety p {font-size:14px;line-height:1.7;margin:4px 0;color:var(--text-secondary);overflow-wrap:anywhere}
      .clinical-safety small {font-size:13px;color:var(--text-muted)}
      .clinical-safety .heading {display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:flex-start}
      .clinical-safety .heading p {max-width:760px}
      .clinical-safety .summary {display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
      .clinical-safety .panel {padding:20px;border:1px solid var(--border);border-radius:16px;background:var(--surface);min-width:0}
      .clinical-safety .panel.success {border-color:var(--success,var(--border));background:var(--success-soft,var(--surface))}
      .clinical-safety .panel.danger {border-color:var(--danger);background:var(--danger-soft)}
      .clinical-safety .warn {color:var(--danger)}
      .clinical-safety table {width:100%;border-collapse:collapse;font-size:14px}
      .clinical-safety th,.clinical-safety td {text-align:left;padding:10px 8px;border-bottom:1px solid var(--border-subtle,var(--border));vertical-align:top}
      .clinical-safety th {font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted)}
      .clinical-safety .chip {display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;border:1px solid var(--border)}
      .clinical-safety .chip.ACTIVE {background:var(--success-soft,var(--surface-subtle));border-color:var(--success,var(--border))}
      .clinical-safety .chip.APPROVED {background:var(--surface-subtle)}
      .clinical-safety .chip.RETIRED {opacity:.7}
      .clinical-safety label {display:block;font-size:13px;font-weight:600;margin:12px 0 6px;color:var(--text)}
      .clinical-safety input,.clinical-safety select,.clinical-safety textarea {width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font:inherit;font-size:15px}
      .clinical-safety textarea {min-height:88px;resize:vertical}
      .clinical-safety input[type=checkbox] {width:20px;min-height:20px;height:20px}
      .clinical-safety .check {display:flex;gap:10px;align-items:flex-start;font-weight:500}
      .clinical-safety button {min-height:44px;padding:10px 16px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);font:inherit;font-size:14px;cursor:pointer}
      .clinical-safety button:disabled {opacity:.5;cursor:not-allowed}
      .clinical-safety button.primary {background:var(--link,var(--action-primary));color:var(--surface);border-color:transparent;font-weight:700}
      .clinical-safety button.danger {color:var(--danger);background:var(--danger-soft)}
      .clinical-safety .actions {display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:14px}
      .clinical-safety .grid2 {display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
      .clinical-safety fieldset {border:1px solid var(--border);border-radius:14px;padding:16px;margin:0 0 12px;min-width:0}
      .clinical-safety legend {font-weight:700;padding:0 6px}
      .clinical-safety ol.preview {padding-left:20px;margin:8px 0}
      .clinical-safety ol.preview li {margin:8px 0;font-size:14px}
      .clinical-safety .route {font-size:12px;color:var(--text-muted)}
      .clinical-safety .audit li {font-size:14px;margin:6px 0;color:var(--text-secondary)}
      .clinical-safety code {font-size:12px;overflow-wrap:anywhere}
      .clinical-safety .problems {margin:0 0 12px;padding-left:18px;color:var(--danger);font-size:14px}
      @media (max-width:700px) {.clinical-safety .table-wrap{overflow-x:auto}}
    `}</style>
  </section>
}

function VersionList({ versions, onOpen }: { versions: VersionSummary[]; onOpen: (id: string) => void }) {
  return <div className='panel'>
    <h2>Versions</h2>
    {!versions.length ? <p>No versions yet. An administrator with the author permission can start the first draft.</p> :
      <div className='table-wrap'><table>
        <thead><tr><th scope='col'>Version</th><th scope='col'>Title</th><th scope='col'>Status</th><th scope='col'>Questions</th><th scope='col'>Last change</th><th scope='col'><span className='sr-only'>Open</span></th></tr></thead>
        <tbody>{versions.map(version => <tr key={version.id}>
          <td>v{version.version_number}<br /><small>{version.locale}</small></td>
          <td>{version.title}</td>
          <td><span className={`chip ${version.status}`}>{STATUS_LABEL[version.status]}</span></td>
          <td>{version.question_count}</td>
          <td>{when(version.retired_at ?? version.published_at ?? version.approved_at ?? version.updated_at)}<br /><small>{version.retired_by ?? version.published_by ?? version.approved_by ?? version.updated_by ?? ''}</small></td>
          <td><button onClick={() => onOpen(version.id)} aria-label={`Open version ${version.version_number}`}>Open</button></td>
        </tr>)}</tbody>
      </table></div>}
  </div>
}

function VersionView({ detail, canAuthor, onEdit, onBranch, onChanged }: {
  detail: VersionDetail; canAuthor: boolean; onEdit: () => void; onBranch: () => void
  onChanged: (message: string, next?: Mode) => void
}) {
  const [reviewed, setReviewed] = useState(false)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  async function act(run: () => Promise<unknown>, message: string) {
    setBusy(true); setProblem('')
    try { await run(); onChanged(message) } catch (err) { setProblem(getApiErrorDetail(err) || 'This action could not be completed.') }
    finally { setBusy(false) }
  }

  const content = detail.content
  return <div className='grid-view' style={{ display: 'grid', gap: 16 }}>
    <div className='panel'>
      <h2>v{detail.version_number} · {detail.title} <span className={`chip ${detail.status}`}>{STATUS_LABEL[detail.status]}</span></h2>
      <p>Locale {detail.locale} · drafted by {detail.created_by ?? 'unknown'} on {when(detail.created_at)}{detail.approved_by ? ` · approved by ${detail.approved_by} on ${when(detail.approved_at)}` : ''}{detail.published_by ? ` · published by ${detail.published_by} on ${when(detail.published_at)}` : ''}</p>
      {detail.change_note && <p><strong>Change note:</strong> {detail.change_note}</p>}
      <p><small>Content fingerprint (SHA-256): <code title={detail.content_sha256}>{detail.content_sha256.slice(0, 16)}…</code></small></p>
      {problem && <p role='alert' className='warn'>{problem}</p>}
      <div className='actions'>
        {detail.can.edit && <button onClick={onEdit}>Edit draft</button>}
        {canAuthor && detail.status !== 'DRAFT' && <button onClick={onBranch}>Start a new draft from this version</button>}
      </div>
    </div>

    <div className='panel'>
      <h2>What patients see</h2>
      {content.intro && <p>{content.intro}</p>}
      <ol className='preview'>{content.questions.map(q => <li key={q.id}>{q.prompt}{q.help && <><br /><small>{q.help}</small></>}<br /><span className='route'>Yes → {ROUTE_LABELS[q.route_if_yes]} · id {q.id}</span></li>)}</ol>
      {SAFETY_ROUTES.filter(route => content.outcomes[route]).map(route => {
        const guidance = content.outcomes[route]!
        return <div key={route} className='panel' style={{ marginTop: 10 }}>
          <h3>{ROUTE_LABELS[route]}: {guidance.title}</h3><p>{guidance.body}</p>
          {guidance.action_href && <p><small>Button: “{guidance.action_label}” → {guidance.action_href}</small></p>}
        </div>
      })}
      {content.continue_message && <p><strong>When no answer is yes:</strong> {content.continue_message}</p>}
    </div>

    {(detail.can.approve || detail.can.publish || detail.can.retire) && <div className='panel'>
      <h2>Decision</h2>
      {detail.can.approve && <form onSubmit={e => { e.preventDefault(); if (reviewed) void act(() => approveSafetyVersion(detail.id, { lock_version: detail.lock_version, content_sha256: detail.content_sha256, note: note.trim() || undefined }), 'Approved. It goes live only when published.') }}>
        <label className='check'><input type='checkbox' checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I have reviewed every question, route and patient message above as clinical content, and approve exactly this version.</label>
        <label htmlFor='approval-note'>Approval note (optional)</label>
        <textarea id='approval-note' maxLength={500} value={note} onChange={e => setNote(e.target.value)} />
        <div className='actions'><button className='primary' type='submit' disabled={!reviewed || busy}>Approve this version</button></div>
      </form>}
      {detail.can.publish && <div className='actions'>
        <p>Publishing replaces the live {detail.locale} screen immediately. Patients who passed the previous version must answer again.</p>
        <button className='primary' disabled={busy} onClick={() => { if (window.confirm(`Publish v${detail.version_number} to patients now?`)) void act(() => publishSafetyVersion(detail.id, detail.lock_version), 'Published. Patients now see this version.') }}>Publish to patients</button>
      </div>}
      {detail.can.retire && <div>
        <label htmlFor='retire-reason'>Reason for retiring</label>
        <input id='retire-reason' maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />
        {detail.status === 'ACTIVE' && <p className='warn'>Retiring the live version leaves no screen for {detail.locale}; where booking requires a screen, online booking pauses.</p>}
        <div className='actions'><button className='danger' disabled={busy || reason.trim().length < 5} onClick={() => void act(() => retireSafetyVersion(detail.id, detail.lock_version, reason.trim()), 'Version retired.')}>Retire version</button></div>
      </div>}
      {detail.status === 'DRAFT' && !detail.can.approve && detail.can.publish === false && <p><small>Approval needs a different administrator with the approve permission than the one who wrote or last edited this draft.</small></p>}
    </div>}

    <div className='panel'>
      <h2>Audit trail</h2>
      <ul className='audit'>{detail.audit.map((event, index) => <li key={index}><strong>{ACTION_LABEL[event.action] ?? event.action}</strong> · {event.by ?? 'unknown'} · {when(event.at)}{event.reason ? ` · “${event.reason}”` : ''}</li>)}</ul>
    </div>
  </div>
}

function Editor({ mode, onSaved, onCancel }: { mode: Extract<Mode, { kind: 'edit' }>; onSaved: (saved: VersionDetail, message: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [touchedIds, setTouchedIds] = useState<Record<number, boolean>>({})
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    const source = mode.id ?? mode.basedOn
    if (!source) { setDraft({ title: '', locale: 'de-DE', change_note: '', content: emptySafetyContent() }); return }
    getSafetyVersion(source).then(version => setDraft({
      title: mode.id ? version.title : `${version.title}`, locale: version.locale, change_note: mode.id ? version.change_note ?? '' : '',
      content: copyContent(version.content), lock_version: mode.id ? version.lock_version : undefined,
    })).catch(err => setServerError(getApiErrorDetail(err) || 'The source version could not be loaded.'))
  }, [mode.id, mode.basedOn])

  const cleaned = useMemo(() => draft ? cleanSafetyContent(draft.content) : null, [draft])
  const problems = draft && cleaned ? safetyContentErrors(draft.title, cleaned) : []

  if (!draft) return <p role='status'>{serverError || 'Loading editor…'}</p>
  const setContent = (content: SafetyContent) => setDraft({ ...draft, content })
  const setQuestion = (index: number, patch: Partial<SafetyQuestion>) => {
    const questions = draft.content.questions.map((q, i) => {
      if (i !== index) return q
      const next = { ...q, ...patch }
      if (patch.prompt !== undefined && !touchedIds[index]) next.id = questionId(patch.prompt, draft.content.questions.filter((_, j) => j !== i).map(o => o.id))
      return next
    })
    setContent({ ...draft.content, questions })
  }
  const move = (index: number, delta: number) => {
    const questions = [...draft.content.questions]
    const [item] = questions.splice(index, 1)
    questions.splice(index + delta, 0, item)
    setContent({ ...draft.content, questions })
  }
  const setOutcome = (route: SafetyRoute, field: 'title' | 'body' | 'action_label' | 'action_href', value: string) => {
    const current = draft.content.outcomes[route] ?? { title: '', body: '', action_label: '', action_href: '' }
    setContent({ ...draft.content, outcomes: { ...draft.content.outcomes, [route]: { ...current, [field]: value } } })
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setAttempted(true); setServerError('')
    if (!draft || !cleaned || problems.length) return
    setSaving(true)
    try {
      const saved = mode.id && draft.lock_version
        ? await updateSafetyDraft(mode.id, { lock_version: draft.lock_version, title: draft.title.trim(), content: cleaned, change_note: draft.change_note.trim() || undefined })
        : await createSafetyDraft({ locale: draft.locale, title: draft.title.trim(), content: cleaned, change_note: draft.change_note.trim() || undefined, based_on_version_id: mode.basedOn })
      onSaved(saved, 'Draft saved. Ask a second authorised administrator to review and approve it.')
    } catch (err) { setServerError(getApiErrorDetail(err) || 'The draft could not be saved.') }
    finally { setSaving(false) }
  }

  return <form className='panel' noValidate onSubmit={save} aria-busy={saving}>
    <h2>{mode.id ? 'Edit draft' : mode.basedOn ? 'New draft from an earlier version' : 'New draft'}</h2>
    <p>Write the questions and patient messages exactly as your clinical lead has approved them. Nothing here reaches patients until another authorised administrator approves and publishes it.</p>
    {attempted && problems.length > 0 && <div role='alert'><ul className='problems'>{problems.map(problem => <li key={problem}>{problem}</li>)}</ul></div>}
    {serverError && <p role='alert' className='warn'>{serverError}</p>}
    <div className='grid2'>
      <div><label htmlFor='safety-title'>Title (Required)</label><input id='safety-title' maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
      <div><label htmlFor='safety-locale'>Language</label>
        <select id='safety-locale' value={draft.locale} disabled={Boolean(mode.id)} onChange={e => setDraft({ ...draft, locale: e.target.value })}>
          <option value='de-DE'>German (de-DE)</option><option value='en'>English (en)</option>
        </select></div>
    </div>
    <label htmlFor='safety-intro'>Introduction shown above the questions</label>
    <textarea id='safety-intro' maxLength={1000} value={draft.content.intro ?? ''} onChange={e => setContent({ ...draft.content, intro: e.target.value })} />

    <h3 style={{ marginTop: 18 }}>Questions</h3>
    {draft.content.questions.map((question, index) => <fieldset key={index}>
      <legend>Question {index + 1}</legend>
      <label htmlFor={`q-${index}-prompt`}>Question for the patient (Required)</label>
      <textarea id={`q-${index}-prompt`} maxLength={300} value={question.prompt} onChange={e => setQuestion(index, { prompt: e.target.value })} />
      <label htmlFor={`q-${index}-help`}>Help text (optional)</label>
      <input id={`q-${index}-help`} maxLength={500} value={question.help ?? ''} onChange={e => setQuestion(index, { help: e.target.value })} />
      <div className='grid2'>
        <div><label htmlFor={`q-${index}-route`}>If the patient answers yes</label>
          <select id={`q-${index}-route`} value={question.route_if_yes} onChange={e => setQuestion(index, { route_if_yes: e.target.value as SafetyRoute })}>
            {SAFETY_ROUTES.map(route => <option key={route} value={route}>{ROUTE_LABELS[route]}</option>)}
          </select></div>
        <div><label htmlFor={`q-${index}-id`}>Stable id</label>
          <input id={`q-${index}-id`} maxLength={48} value={question.id} onChange={e => { setTouchedIds({ ...touchedIds, [index]: true }); setQuestion(index, { id: e.target.value.toLowerCase() }) }} /></div>
      </div>
      <div className='actions'>
        <button type='button' disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move question ${index + 1} up`}>Move up</button>
        <button type='button' disabled={index === draft.content.questions.length - 1} onClick={() => move(index, 1)} aria-label={`Move question ${index + 1} down`}>Move down</button>
        <button type='button' className='danger' disabled={draft.content.questions.length === 1} onClick={() => setContent({ ...draft.content, questions: draft.content.questions.filter((_, i) => i !== index) })}>Remove</button>
      </div>
    </fieldset>)}
    <button type='button' disabled={draft.content.questions.length >= 30} onClick={() => setContent({ ...draft.content, questions: [...draft.content.questions, { id: '', prompt: '', help: '', route_if_yes: 'EMERGENCY' }] })}>Add question</button>

    <h3 style={{ marginTop: 18 }}>Patient guidance for each outcome</h3>
    {SAFETY_ROUTES.map(route => {
      const guidance = draft.content.outcomes[route]
      return <fieldset key={route}>
        <legend>{ROUTE_LABELS[route]}</legend>
        <label htmlFor={`o-${route}-title`}>Heading</label>
        <input id={`o-${route}-title`} maxLength={120} value={guidance?.title ?? ''} onChange={e => setOutcome(route, 'title', e.target.value)} />
        <label htmlFor={`o-${route}-body`}>What the patient should do</label>
        <textarea id={`o-${route}-body`} maxLength={1200} value={guidance?.body ?? ''} onChange={e => setOutcome(route, 'body', e.target.value)} />
        <div className='grid2'>
          <div><label htmlFor={`o-${route}-label`}>Button label (optional)</label><input id={`o-${route}-label`} maxLength={60} value={guidance?.action_label ?? ''} onChange={e => setOutcome(route, 'action_label', e.target.value)} /></div>
          <div><label htmlFor={`o-${route}-href`}>Button link: tel:… or https://…</label><input id={`o-${route}-href`} maxLength={300} value={guidance?.action_href ?? ''} onChange={e => setOutcome(route, 'action_href', e.target.value)} /></div>
        </div>
      </fieldset>
    })}
    <label htmlFor='safety-continue'>Message when no answer is yes (optional)</label>
    <input id='safety-continue' maxLength={500} value={draft.content.continue_message ?? ''} onChange={e => setContent({ ...draft.content, continue_message: e.target.value })} />
    <label htmlFor='safety-note'>Change note for reviewers</label>
    <textarea id='safety-note' maxLength={2000} value={draft.change_note} onChange={e => setDraft({ ...draft, change_note: e.target.value })} />
    <div className='actions'>
      <button type='button' onClick={onCancel} disabled={saving}>Cancel</button>
      <button className='primary' type='submit' disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button>
    </div>
  </form>
}

function GrantsPanel({ perms, grants, admins, onChanged }: { perms: MyPermissions; grants: Grant[]; admins: AdminUser[]; onChanged: (message: string) => void }) {
  const [adminId, setAdminId] = useState('')
  const [permission, setPermission] = useState<'AUTHOR' | 'APPROVE'>('AUTHOR')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  async function run(task: () => Promise<unknown>, message: string) {
    setBusy(true); setProblem('')
    try { await task(); onChanged(message) } catch (err) { setProblem(getApiErrorDetail(err) || 'The permission could not be changed.') }
    finally { setBusy(false) }
  }
  return <div className='panel'>
    <h2>Clinical content permissions</h2>
    <p>Permissions are separate from administrator roles. Grant authoring and approval to different people so every version is checked by someone other than its author.</p>
    {problem && <p role='alert' className='warn'>{problem}</p>}
    {!grants.length ? <p>No one holds a clinical content permission yet.</p> : <div className='table-wrap'><table>
      <thead><tr><th scope='col'>Administrator</th><th scope='col'>Permission</th><th scope='col'>Granted</th>{perms.can_manage_permissions && <th scope='col'><span className='sr-only'>Revoke</span></th>}</tr></thead>
      <tbody>{grants.map(grant => <tr key={grant.id}>
        <td>{grant.admin_name}<br /><small>{grant.admin_role.replace('_', ' ')} · {grant.admin_status}</small></td>
        <td>{grant.permission === 'AUTHOR' ? 'Author drafts' : 'Approve and publish'}</td>
        <td>{when(grant.granted_at)}<br /><small>by {grant.granted_by ?? 'unknown'}</small></td>
        {perms.can_manage_permissions && <td><button className='danger' disabled={busy} onClick={() => void run(() => revokeSafetyPermission(grant.id), 'Permission revoked.')}>Revoke</button></td>}
      </tr>)}</tbody>
    </table></div>}
    {perms.can_manage_permissions && <form className='grid2' onSubmit={e => { e.preventDefault(); if (adminId) void run(() => grantSafetyPermission(adminId, permission), 'Permission granted.') }}>
      <div><label htmlFor='grant-admin'>Administrator</label>
        <select id='grant-admin' value={adminId} onChange={e => setAdminId(e.target.value)}>
          <option value=''>Choose an active administrator</option>
          {admins.map(admin => <option key={admin.id} value={admin.id}>{admin.full_name} · {admin.email}</option>)}
        </select></div>
      <div><label htmlFor='grant-permission'>Permission</label>
        <select id='grant-permission' value={permission} onChange={e => setPermission(e.target.value as 'AUTHOR' | 'APPROVE')}>
          <option value='AUTHOR'>Author drafts</option><option value='APPROVE'>Approve and publish</option>
        </select></div>
      <div className='actions' style={{ alignSelf: 'end' }}><button className='primary' type='submit' disabled={!adminId || busy}>Grant permission</button></div>
    </form>}
  </div>
}

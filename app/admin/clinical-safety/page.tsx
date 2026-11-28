'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { getAdminUsers, getApiErrorDetail, type AdminUser } from '@/lib/api'
import {
  approveSafetyVersion, cleanSafetyContent, createSafetyDraft, emptySafetyContent, getMySafetyPermissions,
  getSafetyVersion, grantSafetyPermission, listSafetyGrants, listSafetyVersions, publishSafetyVersion,
  questionId, retireSafetyVersion, revokeSafetyPermission, safetyContentErrors, updateSafetyDraft,
  SAFETY_ROUTES, type SafetyText,
  type Grant, type MyPermissions, type SafetyContent, type SafetyQuestion, type SafetyRoute, type VersionDetail, type VersionSummary,
} from '@/lib/safety-screen'

type Mode = { kind: 'list' } | { kind: 'view'; id: string } | { kind: 'edit'; id?: string; basedOn?: string }
type Draft = { title: string; locale: string; change_note: string; content: SafetyContent; lock_version?: number }

/** Status, audit action and route codes map to adminSafety message keys. */
const STATUS_KEY: Record<string, string> = { DRAFT: 'draft', APPROVED: 'approved', ACTIVE: 'active', RETIRED: 'retired' }
const ACTION_KEY: Record<string, string> = {
  CREATE_SAFETY_SCREEN_DRAFT: 'draftCreated', UPDATE_SAFETY_SCREEN_DRAFT: 'draftEdited', APPROVE_SAFETY_SCREEN: 'approved',
  PUBLISH_SAFETY_SCREEN: 'published', RETIRE_SAFETY_SCREEN: 'retired',
}
const ROUTE_KEY: Record<SafetyRoute, string> = { EMERGENCY: 'emergency', URGENT: 'urgent', IN_PERSON: 'inPerson' }

/** Translator, Berlin dates in the reader's language, and labels for codes. */
function useSafetyText() {
  const t = useTranslations('adminSafety'), locale = useLocale().startsWith('de') ? 'de-DE' : 'en-GB'
  const when = (value: string | null) => value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value)) : '—'
  const status = (code: string) => STATUS_KEY[code] ? t(`status.${STATUS_KEY[code]}`) : code
  const action = (code: string) => ACTION_KEY[code] ? t(`audit.${ACTION_KEY[code]}`) : code
  const route = (code: SafetyRoute) => t(`route.${ROUTE_KEY[code]}`)
  const permission = (code: string) => code === 'AUTHOR' ? t('permAuthor') : t('permApprove')
  return { t, when, status, action, route, permission }
}

function copyContent(content: SafetyContent): SafetyContent {
  return JSON.parse(JSON.stringify({ ...emptySafetyContent(), ...content, outcomes: content.outcomes ?? {} }))
}

export default function ClinicalSafetyPage() {
  const { t, when, permission } = useSafetyText()
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
      setError(getApiErrorDetail(err) || t('loadFailed'))
    } finally { setLoading(false) }
  }, [t])

  useEffect(() => { void load() }, [load, revision])

  useEffect(() => {
    if (mode.kind !== 'view') { setDetail(null); return }
    let cancelled = false
    getSafetyVersion(mode.id).then(value => { if (!cancelled) setDetail(value) })
      .catch(err => { if (!cancelled) setError(getApiErrorDetail(err) || t('versionFailed')) })
    return () => { cancelled = true }
  }, [mode, revision, t])

  const can = new Set(perms?.permissions ?? [])
  const live = versions.filter(version => version.status === 'ACTIVE')
  const refresh = (next?: Mode, message?: string) => { if (next) setMode(next); setNotice(message ?? ''); setRevision(n => n + 1) }

  return <section className='clinical-safety'>
    <header className='heading'>
      <div>
        <h1>{t('title')}</h1>
        <p>{t('intro')}</p>
      </div>
      {mode.kind === 'list' && can.has('AUTHOR') && <button className='primary' onClick={() => setMode({ kind: 'edit' })}>{t('newDraft')}</button>}
      {mode.kind !== 'list' && <button onClick={() => { setMode({ kind: 'list' }); setNotice('') }}>{t('backToVersions')}</button>}
    </header>

    {notice && <p role='status' className='panel success'>{notice}</p>}
    {error && <div role='alert' className='panel danger'><p>{error}</p><button onClick={() => setRevision(n => n + 1)}>{t('retry')}</button></div>}
    {loading && !perms ? <p role='status'>{t('loading')}</p> : perms && <>
      {mode.kind === 'list' && <>
        <div className='summary'>
          <div className='panel'>
            <h2>{t('liveForPatients')}</h2>
            {live.length ? live.map(version => <p key={version.id}><strong>v{version.version_number}</strong> · {version.locale} · {version.title}<br /><small>{t('publishedBy', { date: when(version.published_at), by: version.published_by ?? t('unknown') })}</small></p>)
              : <p className='warn'>{t('noneLive')} {perms.booking_requires_screen ? t('bookingPaused') : t('bookingContinues')}</p>}
          </div>
          <div className='panel'>
            <h2>{t('yourPermissions')}</h2>
            <p>{can.size ? [...can].map(permission).join(' · ') : t('viewOnly')}</p>
            <small>{t('bookingRequires')} <strong>{perms.booking_requires_screen ? t('yes') : t('noDevelopment')}</strong></small>
          </div>
        </div>
        <VersionList versions={versions} onOpen={id => setMode({ kind: 'view', id })} />
        <GrantsPanel perms={perms} grants={grants} admins={admins} onChanged={message => refresh(undefined, message)} />
      </>}
      {mode.kind === 'view' && (detail ? <VersionView detail={detail} canAuthor={can.has('AUTHOR')}
        onEdit={() => setMode({ kind: 'edit', id: detail.id })}
        onBranch={() => setMode({ kind: 'edit', basedOn: detail.id })}
        onChanged={(message, next) => refresh(next ?? { kind: 'view', id: detail.id }, message)} /> : <p role='status'>{t('loadingVersion')}</p>)}
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
  const { t, when, status } = useSafetyText()
  return <div className='panel'>
    <h2>{t('versions')}</h2>
    {!versions.length ? <p>{t('noVersions')}</p> :
      <div className='table-wrap'><table>
        <thead><tr><th scope='col'>{t('colVersion')}</th><th scope='col'>{t('colTitle')}</th><th scope='col'>{t('colStatus')}</th><th scope='col'>{t('colQuestions')}</th><th scope='col'>{t('colLastChange')}</th><th scope='col'><span className='sr-only'>{t('open')}</span></th></tr></thead>
        <tbody>{versions.map(version => <tr key={version.id}>
          <td>v{version.version_number}<br /><small>{version.locale}</small></td>
          <td>{version.title}</td>
          <td><span className={`chip ${version.status}`}>{status(version.status)}</span></td>
          <td>{version.question_count}</td>
          <td>{when(version.retired_at ?? version.published_at ?? version.approved_at ?? version.updated_at)}<br /><small>{version.retired_by ?? version.published_by ?? version.approved_by ?? version.updated_by ?? ''}</small></td>
          <td><button onClick={() => onOpen(version.id)} aria-label={t('openVersion', { number: version.version_number })}>{t('open')}</button></td>
        </tr>)}</tbody>
      </table></div>}
  </div>
}

function VersionView({ detail, canAuthor, onEdit, onBranch, onChanged }: {
  detail: VersionDetail; canAuthor: boolean; onEdit: () => void; onBranch: () => void
  onChanged: (message: string, next?: Mode) => void
}) {
  const { t, when, status, action, route } = useSafetyText()
  const [reviewed, setReviewed] = useState(false)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  async function act(run: () => Promise<unknown>, message: string) {
    setBusy(true); setProblem('')
    try { await run(); onChanged(message) } catch (err) { setProblem(getApiErrorDetail(err) || t('actionFailed')) }
    finally { setBusy(false) }
  }

  const content = detail.content
  return <div className='grid-view' style={{ display: 'grid', gap: 16 }}>
    <div className='panel'>
      <h2>v{detail.version_number} · {detail.title} <span className={`chip ${detail.status}`}>{status(detail.status)}</span></h2>
      <p>{t('drafted', { locale: detail.locale, by: detail.created_by ?? t('unknown'), date: when(detail.created_at) })}{detail.approved_by ? ` · ${t('approvedBy', { by: detail.approved_by, date: when(detail.approved_at) })}` : ''}{detail.published_by ? ` · ${t('publishedByLine', { by: detail.published_by, date: when(detail.published_at) })}` : ''}</p>
      {detail.change_note && <p><strong>{t('changeNote')}</strong> {detail.change_note}</p>}
      <p><small>{t('fingerprint')} <code title={detail.content_sha256}>{detail.content_sha256.slice(0, 16)}…</code></small></p>
      {problem && <p role='alert' className='warn'>{problem}</p>}
      <div className='actions'>
        {detail.can.edit && <button onClick={onEdit}>{t('editDraft')}</button>}
        {canAuthor && detail.status !== 'DRAFT' && <button onClick={onBranch}>{t('branch')}</button>}
      </div>
    </div>

    <div className='panel'>
      <h2>{t('patientsSee')}</h2>
      {content.intro && <p>{content.intro}</p>}
      <ol className='preview'>{content.questions.map(q => <li key={q.id}>{q.prompt}{q.help && <><br /><small>{q.help}</small></>}<br /><span className='route'>{t('yesRoute', { route: route(q.route_if_yes), id: q.id })}</span></li>)}</ol>
      {SAFETY_ROUTES.filter(code => content.outcomes[code]).map(code => {
        const guidance = content.outcomes[code]!
        return <div key={code} className='panel' style={{ marginTop: 10 }}>
          <h3>{route(code)}: {guidance.title}</h3><p>{guidance.body}</p>
          {guidance.action_href && <p><small>{t('buttonPreview', { label: guidance.action_label ?? '', href: guidance.action_href })}</small></p>}
        </div>
      })}
      {content.continue_message && <p><strong>{t('whenNoYes')}</strong> {content.continue_message}</p>}
    </div>

    {(detail.can.approve || detail.can.publish || detail.can.retire) && <div className='panel'>
      <h2>{t('decision')}</h2>
      {detail.can.approve && <form onSubmit={e => { e.preventDefault(); if (reviewed) void act(() => approveSafetyVersion(detail.id, { lock_version: detail.lock_version, content_sha256: detail.content_sha256, note: note.trim() || undefined }), t('approvedNotice')) }}>
        <label className='check'><input type='checkbox' checked={reviewed} onChange={e => setReviewed(e.target.checked)} />{t('reviewedCheck')}</label>
        <label htmlFor='approval-note'>{t('approvalNote')}</label>
        <textarea id='approval-note' maxLength={500} value={note} onChange={e => setNote(e.target.value)} />
        <div className='actions'><button className='primary' type='submit' disabled={!reviewed || busy}>{t('approve')}</button></div>
      </form>}
      {detail.can.publish && <div className='actions'>
        <p>{t('publishWarning', { locale: detail.locale })}</p>
        <button className='primary' disabled={busy} onClick={() => { if (window.confirm(t('publishConfirm', { number: detail.version_number }))) void act(() => publishSafetyVersion(detail.id, detail.lock_version), t('publishedNotice')) }}>{t('publish')}</button>
      </div>}
      {detail.can.retire && <div>
        <label htmlFor='retire-reason'>{t('retireReason')}</label>
        <input id='retire-reason' maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />
        {detail.status === 'ACTIVE' && <p className='warn'>{t('retireWarning', { locale: detail.locale })}</p>}
        <div className='actions'><button className='danger' disabled={busy || reason.trim().length < 5} onClick={() => void act(() => retireSafetyVersion(detail.id, detail.lock_version, reason.trim()), t('retiredNotice'))}>{t('retire')}</button></div>
      </div>}
      {detail.status === 'DRAFT' && !detail.can.approve && detail.can.publish === false && <p><small>{t('fourEyes')}</small></p>}
    </div>}

    <div className='panel'>
      <h2>{t('auditTrail')}</h2>
      <ul className='audit'>{detail.audit.map((event, index) => <li key={index}><strong>{action(event.action)}</strong> · {event.by ?? t('unknown')} · {when(event.at)}{event.reason ? ` · “${event.reason}”` : ''}</li>)}</ul>
    </div>
  </div>
}

function Editor({ mode, onSaved, onCancel }: { mode: Extract<Mode, { kind: 'edit' }>; onSaved: (saved: VersionDetail, message: string) => void; onCancel: () => void }) {
  const { t, route } = useSafetyText()
  const text: SafetyText = useMemo(() => ({
    route, title: t('err.title'), intro: t('err.intro'), questionCount: t('err.questionCount'),
    question: (number: number) => t('err.question', { number }),
    questionId: (label: string) => t('err.questionId', { label }), questionRepeat: (label: string, id: string) => t('err.questionRepeat', { label, id }),
    questionPrompt: (label: string) => t('err.questionPrompt', { label }), questionHelp: (label: string) => t('err.questionHelp', { label }),
    questionRoute: (label: string) => t('err.questionRoute', { label }), guidanceMissing: (name: string) => t('err.guidanceMissing', { route: name }),
    guidanceTitle: (name: string) => t('err.guidanceTitle', { route: name }), guidanceBody: (name: string) => t('err.guidanceBody', { route: name }),
    guidancePair: (name: string) => t('err.guidancePair', { route: name }), guidanceHref: (name: string) => t('err.guidanceHref', { route: name }),
    continueMessage: t('err.continueMessage'),
  // route is derived from t; t identifies the language.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [t])
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
    })).catch(err => setServerError(getApiErrorDetail(err) || t('sourceFailed')))
  }, [mode.id, mode.basedOn, t])

  const cleaned = useMemo(() => draft ? cleanSafetyContent(draft.content) : null, [draft])
  const problems = draft && cleaned ? safetyContentErrors(draft.title, cleaned, text) : []

  if (!draft) return <p role='status'>{serverError || t('loadingEditor')}</p>
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
      onSaved(saved, t('draftSaved'))
    } catch (err) { setServerError(getApiErrorDetail(err) || t('draftFailed')) }
    finally { setSaving(false) }
  }

  return <form className='panel' noValidate onSubmit={save} aria-busy={saving}>
    <h2>{mode.id ? t('editDraft') : mode.basedOn ? t('newDraftFrom') : t('newDraft')}</h2>
    <p>{t('editorIntro')}</p>
    {attempted && problems.length > 0 && <div role='alert'><ul className='problems'>{problems.map(problem => <li key={problem}>{problem}</li>)}</ul></div>}
    {serverError && <p role='alert' className='warn'>{serverError}</p>}
    <div className='grid2'>
      <div><label htmlFor='safety-title'>{t('titleRequired')}</label><input id='safety-title' maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
      <div><label htmlFor='safety-locale'>{t('language')}</label>
        <select id='safety-locale' value={draft.locale} disabled={Boolean(mode.id)} onChange={e => setDraft({ ...draft, locale: e.target.value })}>
          <option value='de-DE'>{t('localeDe')}</option><option value='en'>{t('localeEn')}</option>
        </select></div>
    </div>
    <label htmlFor='safety-intro'>{t('introLabel')}</label>
    <textarea id='safety-intro' maxLength={1000} value={draft.content.intro ?? ''} onChange={e => setContent({ ...draft.content, intro: e.target.value })} />

    <h3 style={{ marginTop: 18 }}>{t('questions')}</h3>
    {draft.content.questions.map((question, index) => <fieldset key={index}>
      <legend>{t('questionNumber', { number: index + 1 })}</legend>
      <label htmlFor={`q-${index}-prompt`}>{t('promptLabel')}</label>
      <textarea id={`q-${index}-prompt`} maxLength={300} value={question.prompt} onChange={e => setQuestion(index, { prompt: e.target.value })} />
      <label htmlFor={`q-${index}-help`}>{t('helpLabel')}</label>
      <input id={`q-${index}-help`} maxLength={500} value={question.help ?? ''} onChange={e => setQuestion(index, { help: e.target.value })} />
      <div className='grid2'>
        <div><label htmlFor={`q-${index}-route`}>{t('routeLabel')}</label>
          <select id={`q-${index}-route`} value={question.route_if_yes} onChange={e => setQuestion(index, { route_if_yes: e.target.value as SafetyRoute })}>
            {SAFETY_ROUTES.map(code => <option key={code} value={code}>{route(code)}</option>)}
          </select></div>
        <div><label htmlFor={`q-${index}-id`}>{t('stableId')}</label>
          <input id={`q-${index}-id`} maxLength={48} value={question.id} onChange={e => { setTouchedIds({ ...touchedIds, [index]: true }); setQuestion(index, { id: e.target.value.toLowerCase() }) }} /></div>
      </div>
      <div className='actions'>
        <button type='button' disabled={index === 0} onClick={() => move(index, -1)} aria-label={t('moveUpLabel', { number: index + 1 })}>{t('moveUp')}</button>
        <button type='button' disabled={index === draft.content.questions.length - 1} onClick={() => move(index, 1)} aria-label={t('moveDownLabel', { number: index + 1 })}>{t('moveDown')}</button>
        <button type='button' className='danger' disabled={draft.content.questions.length === 1} onClick={() => setContent({ ...draft.content, questions: draft.content.questions.filter((_, i) => i !== index) })}>{t('remove')}</button>
      </div>
    </fieldset>)}
    <button type='button' disabled={draft.content.questions.length >= 30} onClick={() => setContent({ ...draft.content, questions: [...draft.content.questions, { id: '', prompt: '', help: '', route_if_yes: 'EMERGENCY' }] })}>{t('addQuestion')}</button>

    <h3 style={{ marginTop: 18 }}>{t('guidanceHeading')}</h3>
    {SAFETY_ROUTES.map(code => {
      const guidance = draft.content.outcomes[code], route = code
      return <fieldset key={route}>
        <legend>{text.route(route)}</legend>
        <label htmlFor={`o-${route}-title`}>{t('heading')}</label>
        <input id={`o-${route}-title`} maxLength={120} value={guidance?.title ?? ''} onChange={e => setOutcome(route, 'title', e.target.value)} />
        <label htmlFor={`o-${route}-body`}>{t('bodyLabel')}</label>
        <textarea id={`o-${route}-body`} maxLength={1200} value={guidance?.body ?? ''} onChange={e => setOutcome(route, 'body', e.target.value)} />
        <div className='grid2'>
          <div><label htmlFor={`o-${route}-label`}>{t('buttonLabel')}</label><input id={`o-${route}-label`} maxLength={60} value={guidance?.action_label ?? ''} onChange={e => setOutcome(route, 'action_label', e.target.value)} /></div>
          <div><label htmlFor={`o-${route}-href`}>{t('buttonLink')}</label><input id={`o-${route}-href`} maxLength={300} value={guidance?.action_href ?? ''} onChange={e => setOutcome(route, 'action_href', e.target.value)} /></div>
        </div>
      </fieldset>
    })}
    <label htmlFor='safety-continue'>{t('continueLabel')}</label>
    <input id='safety-continue' maxLength={500} value={draft.content.continue_message ?? ''} onChange={e => setContent({ ...draft.content, continue_message: e.target.value })} />
    <label htmlFor='safety-note'>{t('noteLabel')}</label>
    <textarea id='safety-note' maxLength={2000} value={draft.change_note} onChange={e => setDraft({ ...draft, change_note: e.target.value })} />
    <div className='actions'>
      <button type='button' onClick={onCancel} disabled={saving}>{t('cancel')}</button>
      <button className='primary' type='submit' disabled={saving}>{saving ? t('saving') : t('saveDraft')}</button>
    </div>
  </form>
}

function GrantsPanel({ perms, grants, admins, onChanged }: { perms: MyPermissions; grants: Grant[]; admins: AdminUser[]; onChanged: (message: string) => void }) {
  const { t, when, permission: permissionLabel } = useSafetyText()
  const [adminId, setAdminId] = useState('')
  const [permission, setPermission] = useState<'AUTHOR' | 'APPROVE'>('AUTHOR')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  async function run(task: () => Promise<unknown>, message: string) {
    setBusy(true); setProblem('')
    try { await task(); onChanged(message) } catch (err) { setProblem(getApiErrorDetail(err) || t('permissionFailed')) }
    finally { setBusy(false) }
  }
  return <div className='panel'>
    <h2>{t('grantsTitle')}</h2>
    <p>{t('grantsIntro')}</p>
    {problem && <p role='alert' className='warn'>{problem}</p>}
    {!grants.length ? <p>{t('noGrants')}</p> : <div className='table-wrap'><table>
      <thead><tr><th scope='col'>{t('colAdministrator')}</th><th scope='col'>{t('colPermission')}</th><th scope='col'>{t('colGranted')}</th>{perms.can_manage_permissions && <th scope='col'><span className='sr-only'>{t('revoke')}</span></th>}</tr></thead>
      <tbody>{grants.map(grant => <tr key={grant.id}>
        <td>{grant.admin_name}<br /><small>{grant.admin_role.replace('_', ' ')} · {grant.admin_status}</small></td>
        <td>{permissionLabel(grant.permission)}</td>
        <td>{when(grant.granted_at)}<br /><small>{t('by', { by: grant.granted_by ?? t('unknown') })}</small></td>
        {perms.can_manage_permissions && <td><button className='danger' disabled={busy} onClick={() => void run(() => revokeSafetyPermission(grant.id), t('revokedNotice'))}>{t('revoke')}</button></td>}
      </tr>)}</tbody>
    </table></div>}
    {perms.can_manage_permissions && <form className='grid2' onSubmit={e => { e.preventDefault(); if (adminId) void run(() => grantSafetyPermission(adminId, permission), t('grantedNotice')) }}>
      <div><label htmlFor='grant-admin'>{t('colAdministrator')}</label>
        <select id='grant-admin' value={adminId} onChange={e => setAdminId(e.target.value)}>
          <option value=''>{t('chooseAdmin')}</option>
          {admins.map(admin => <option key={admin.id} value={admin.id}>{admin.full_name} · {admin.email}</option>)}
        </select></div>
      <div><label htmlFor='grant-permission'>{t('colPermission')}</label>
        <select id='grant-permission' value={permission} onChange={e => setPermission(e.target.value as 'AUTHOR' | 'APPROVE')}>
          <option value='AUTHOR'>{t('permAuthor')}</option><option value='APPROVE'>{t('permApprove')}</option>
        </select></div>
      <div className='actions' style={{ alignSelf: 'end' }}><button className='primary' type='submit' disabled={!adminId || busy}>{t('grant')}</button></div>
    </form>}
  </div>
}

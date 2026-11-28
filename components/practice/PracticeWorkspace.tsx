'use client'
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useDates } from '@/i18n/format'
import { apiPatch, apiPost } from '@/lib/api'
import { usePortalResource } from '@/lib/use-portal-resource'
import { usePracticeAction } from '@/lib/use-practice-action'
import { practice, practiceMember, practiceInvitation, practiceWorkspace, practicePage, practiceFields, validatePracticeFields, practiceVersion, deliveryMessage, object, practiceControl, type Practice, type PracticeInvitation } from '@/lib/practice'
import { PortalBadge, PortalButton, PortalCard, PortalEmptyState } from '@/components/patient/PatientPortalPrimitives'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import { PracticeScope, PracticeGate, PracticeBoundaryNote, PracticeReadState, PracticePages, ActionFeedback, usePracticeText } from './PracticeShared'
import { entityProfile, type EntityProfile } from '@/lib/treating-entity'

/** A registry row; with treating-entity verification on it also carries the entity and its bookability. */
type RegistryRow = Practice & { entity: EntityProfile | null; bookable: boolean | null; entityAware: boolean }
function registryRow(value: unknown): RegistryRow | null {
  const base = practice(value)
  if (!base || !object(value)) return null
  const aware = 'entity' in value, entity = value.entity == null ? null : entityProfile(value.entity)
  if ((value.entity != null && !entity) || (aware && typeof value.bookable !== 'boolean')) return null
  return { ...base, entity, bookable: aware ? value.bookable as boolean : null, entityAware: aware }
}

const profileLabels = { name: 'name', contact_email: 'contactEmail', phone: 'phone', address_line1: 'addressLine1', address_line2: 'addressLine2', city: 'city', postcode: 'postcode', country: 'country' } as const
const profileHints: Partial<Record<keyof typeof profileLabels, 'phoneHint' | 'postcodeHint' | 'countryHint' | 'nameHint'>> = { phone: 'phoneHint', postcode: 'postcodeHint', country: 'countryHint', name: 'nameHint' }

/** Status words in the active language; unknown values from a newer API fall back to their raw text. */
function useStatusText() {
  const t = useTranslations('practiceWs.status')
  const pick = (keys: Record<string, Parameters<typeof t>[0]>, value: string) => keys[value] ? t(keys[value]) : value.toLowerCase()
  return {
    practice: (value: string) => pick({ DRAFT: 'practiceDraft', SUBMITTED: 'practiceSubmitted', REVIEWED: 'practiceReviewed', SUSPENDED: 'practiceSuspended' }, value),
    badge: (value: string) => value === 'REVIEWED' ? t('reviewed') : ({ DRAFT: t('badgeDraft'), SUBMITTED: t('badgeSubmitted'), SUSPENDED: t('badgeSuspended') } as Record<string, string>)[value] ?? value,
    role: (value: string) => pick({ OWNER: 'roleOwner', CLINICIAN: 'roleClinician' }, value),
    member: (value: string) => pick({ ACTIVE: 'memberActive', REVOKED: 'memberRevoked', PENDING: 'memberPending', SUSPENDED: 'memberSuspended' }, value),
    invitation: (value: string) => ({ PENDING: t('invitationPending'), ACCEPTED: t('invitationAccepted'), REVOKED: t('invitationRevoked'), EXPIRED: t('invitationExpired') } as Record<string, string>)[value] ?? value,
  }
}
const profileLimits = { name: 160, contact_email: 255, phone: 20, address_line1: 255, address_line2: 255, city: 100, postcode: 20, country: 2 }
function ProfileForm({ saved: initial, complete }: { saved?: Practice; complete: () => void }) {
  const t = useTranslations('practiceWs.workspace'), f = useTranslations('practiceWs.fields'), text = usePracticeText()
  const [saved] = useState(initial)
  const [fields, setFields] = useState(() => practiceFields(saved)), [creationId] = useState(() => crypto.randomUUID()), [errors, setErrors] = useState<Record<string, string>>({})
  const action = usePracticeAction(saved ? saved.id + ':' + saved.version : creationId)
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const next = validatePracticeFields(fields, text.fields); setErrors(next); if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    const body = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim() || null])); body.country = fields.country.toUpperCase()
    await action.run(signal => saved ? apiPatch(`/api/v1/practice/practices/${saved.id}`, body, practiceVersion(saved.version), signal) : apiPost('/api/v1/admin/practices', { ...body, creation_id: creationId }, undefined, signal), result => {
      const row = object(result) ? practice(result.practice) : null; if (!row || (saved && row.id !== saved.id)) throw new Error(t('savedUnconfirmed')); complete(); return t('savedForReview')
    })
  }
  return <form noValidate onSubmit={submit} aria-busy={action.busy} className='grid gap-4'><ValidationSummary errors={errors} /><div className='grid min-w-0 gap-4 sm:grid-cols-2'>
    {(Object.keys(profileLabels) as (keyof typeof profileLabels)[]).map(key => <div key={key} className='min-w-0'><label htmlFor={'practice-' + key} className='mb-2 block text-sm font-semibold text-ink'>{f(key === 'name' || key === 'country' ? 'required' : 'optional', { label: f(profileLabels[key]) })}</label>
      <input id={'practice-' + key} type={key === 'contact_email' ? 'email' : key === 'phone' ? 'tel' : 'text'} maxLength={profileLimits[key]} value={fields[key]} onChange={event => setFields(previous => ({ ...previous, [key]: event.target.value }))} className={practiceControl} aria-invalid={!!errors[key]} aria-describedby={'practice-' + key + '-hint practice-' + key + '-error'} />
      <FieldFeedback name={'practice-' + key} error={errors[key]} hint={profileHints[key] ? f(profileHints[key]) : undefined} /></div>)}
  </div><p className='text-sm leading-7 text-secondary'>{t('profileNote')}</p><ActionFeedback action={action} /><div className='flex flex-wrap gap-3'><PortalButton type='submit' tone='primary' disabled={action.busy}>{action.busy ? t('saving') : saved ? t('saveProfile') : t('createDraft')}</PortalButton><PortalButton type='button' disabled={action.busy} onClick={complete}>{t('cancel')}</PortalButton></div></form>
}
type PracticeDecisionProps = { label: string; confirmLabel: string; endpoint: string; version: number; confirm: (value: unknown) => boolean; refresh: () => void }
function Decision(props: PracticeDecisionProps) {
  // A prior confirmation cannot authorize a newer record or another operation.
  return <DecisionForm key={props.endpoint + ':' + props.version} {...props} />
}
function DecisionForm({ label, confirmLabel, endpoint, version, confirm, refresh }: PracticeDecisionProps) {
  const t = useTranslations('practiceWs.decision')
  const [open, setOpen] = useState(false), [reason, setReason] = useState(''), [acknowledged, setAcknowledged] = useState(false), [errors, setErrors] = useState<Record<string, string>>({}), action = usePracticeAction(endpoint + ':' + version)
  if (!open) return <PortalButton type='button' onClick={() => setOpen(true)}>{label}</PortalButton>
  return <form noValidate className='my-4 grid gap-3 rounded-xl border border-theme bg-surface-subtle p-4' onSubmit={event => { event.preventDefault(); const next: Record<string, string> = {}; if (reason.trim().length < 4 || reason.trim().length > 500) next.reason = t('reasonError'); if (!acknowledged) next.confirmed = t('confirmError'); setErrors(next); if (Object.keys(next).length) { focusValidation(event.currentTarget); return }; void action.run(signal => apiPost(endpoint, { reason: reason.trim() }, practiceVersion(version), signal), result => { if (!confirm(result)) throw new Error(t('unconfirmed')); setOpen(false); return t('recorded') }, refresh) }}>
    <h3 className='font-semibold text-ink'>{label}</h3><ValidationSummary errors={errors} /><label className='grid gap-2 text-sm font-semibold text-ink'>{t('reason')}<textarea rows={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className={practiceControl} /></label><p className='text-sm text-secondary'>{t('reasonHint')}</p><label className='flex items-start gap-3 text-sm leading-7 text-ink'><input type='checkbox' className='mt-1 h-5 w-5 shrink-0' checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />{t('confirmChange')}</label><ActionFeedback action={action} /><div className='flex flex-wrap gap-3'><PortalButton type='submit' disabled={action.busy}>{action.busy ? t('recording') : confirmLabel}</PortalButton><PortalButton type='button' disabled={action.busy} onClick={() => setOpen(false)}>{t('cancel')}</PortalButton></div>
  </form>
}
function InvitationRow({ row, endpoint, canManage, refresh }: { row: PracticeInvitation; endpoint: string; canManage: boolean; refresh: () => void }) {
  const t = useTranslations('practiceWs.workspace'), d = useTranslations('practiceWs.delivery'), decision = useTranslations('practiceWs.decision'), status = useStatusText(), dates = useDates(), text = usePracticeText()
  const delivery = ({ accepted: d('statusAccepted'), unconfirmed: d('statusUnconfirmed'), not_configured: d('statusNotConfigured') } as Record<string, string>)[row.delivery_status] ?? row.delivery_status.replaceAll('_', ' ')
  const action = usePracticeAction(row.id + ':' + row.version), canResend = canManage && ['PENDING', 'EXPIRED'].includes(row.status)
  return <li className='min-w-0 rounded-xl border border-theme bg-surface p-4'><div className='flex flex-wrap items-start justify-between gap-3'><div className='min-w-0'><h3 className='break-all font-semibold text-ink'>{row.email}</h3><p className='mt-1 text-sm text-secondary'>{t('invitationMeta', { role: status.role(row.role), time: dates.dateTime(row.expires_at) })}</p></div><PortalBadge tone={row.status === 'ACCEPTED' ? 'success' : row.status === 'REVOKED' ? 'danger' : 'warning'}>{status.invitation(row.status)}</PortalBadge></div>
    <p className='my-3 text-sm leading-7 text-secondary'>{d('line', { status: delivery })}</p><ActionFeedback action={action} />
    {canResend && <div className='flex flex-wrap items-start gap-3'><PortalButton type='button' disabled={action.busy} onClick={() => void action.run(signal => apiPost(endpoint + '/' + row.id + '/resend', {}, practiceVersion(row.version), signal), result => { const saved = object(result) ? practiceInvitation(result.invitation, row.practice_id) : null; if (!saved || saved.id === row.id) throw new Error(t('replacementUnconfirmed')); return deliveryMessage(result, text.delivery) }, refresh)}>{action.busy ? t('requesting') : t('resend')}</PortalButton>
      <Decision label={decision('revokeInvitation')} confirmLabel={decision('confirmRevokeInvitation')} endpoint={endpoint + '/' + row.id + '/revoke'} version={row.version} refresh={refresh} confirm={result => object(result) && practiceInvitation(result.invitation, row.practice_id)?.id === row.id && object(result.invitation) && result.invitation.status === 'REVOKED'} /></div>}
  </li>
}
export function PracticeInvitations({ saved, admin, canManage }: { saved: Practice; admin: boolean; canManage: boolean }) {
  const t = useTranslations('practiceWs.workspace'), text = usePracticeText()
  const base = `/api/v1/${admin ? 'admin' : 'practice'}/practices/${saved.id}/invitations`, [offset, setOffset] = useState(0), [email, setEmail] = useState(''), [error, setError] = useState('')
  const resource = usePortalResource<unknown>(canManage ? `${base}?limit=25&offset=${offset}` : null, false, { abortOnCleanup: true, refreshOnFocus: true })
  const data = useMemo(() => practicePage(resource.data, 'invitations', value => practiceInvitation(value, saved.id)), [resource.data, saved.id]), action = usePracticeAction(base + ':' + saved.version + ':' + canManage + ':' + data?.canManage)
  if (data && data.offset !== offset) setOffset(data.offset)
  return <PortalCard><h2 className='text-xl font-semibold text-ink'>{admin ? t('ownerInvitations') : t('clinicianInvitations')}</h2><p className='my-3 text-sm leading-7 text-secondary'>{admin ? t('ownerInvitationsText') : t('clinicianInvitationsText')}</p>
    {!canManage ? <p role='status' className='text-sm text-secondary'>{t('permissionRequired')}</p> : <><form noValidate className='my-5 grid gap-3' onSubmit={event => { event.preventDefault(); if (!canManage || data?.canManage !== true || resource.refreshing || action.busy) return; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 255) { setError(t('invitationEmailError')); focusValidation(event.currentTarget); return }; setError(''); void action.run(signal => apiPost(base, { email: email.trim() }, undefined, signal), result => { const invitation = object(result) ? practiceInvitation(result.invitation, saved.id) : null; if (!invitation || invitation.role !== (admin ? 'OWNER' : 'CLINICIAN')) throw new Error(t('invitationUnconfirmed')); setEmail(''); return deliveryMessage(result, text.delivery) }, resource.retry) }}>
      <label className='grid gap-2 text-sm font-semibold text-ink'>{t('invitationEmail')}<input type='email' autoComplete='email' value={email} maxLength={255} onChange={event => setEmail(event.target.value)} className={practiceControl} aria-invalid={!!error} /></label><FieldFeedback name='practice-invitation-email' error={error} />{data?.canManage !== true && <p role='status' className='text-sm text-secondary'>{resource.refreshing ? t('checkingPermission') : t('permissionUnconfirmed')}</p>}<PortalButton type='submit' tone='primary' disabled={action.busy || resource.refreshing || data?.canManage !== true}>{action.busy ? t('savingInvitation') : admin ? t('inviteOwner') : t('inviteClinician')}</PortalButton></form><ActionFeedback action={action} /><PracticeReadState resource={resource} invalid={resource.data !== null && !data} />
    <PracticePages data={data} offset={offset} busy={resource.refreshing || action.busy} onChange={setOffset} label={t('invitationsLabel')} />
      {data && !resource.loading && <>{data.rows.length ? <ul className='grid gap-3'>{data.rows.map(row => <InvitationRow key={row.id + ':' + row.version} row={row} endpoint={base} canManage={canManage && data.canManage} refresh={resource.retry} />)}</ul> : <PortalEmptyState title={t('noInvitationsTitle')} description={t('noInvitationsText')} />}</>}
    </>}
  </PortalCard>
}
export function PracticeMembers({ saved, canManage }: { saved: Practice; canManage: boolean }) {
  const t = useTranslations('practiceWs.workspace'), decision = useTranslations('practiceWs.decision'), status = useStatusText()
  const [offset, setOffset] = useState(0), base = `/api/v1/practice/practices/${saved.id}/members`
  const resource = usePortalResource<unknown>(`${base}?limit=25&offset=${offset}`, false, { abortOnCleanup: true, refreshOnFocus: true })
  const data = useMemo(() => practicePage(resource.data, 'members', value => practiceMember(value, saved.id)), [resource.data, saved.id])
  if (data && data.offset !== offset) setOffset(data.offset)
  return <PortalCard><h2 className='text-xl font-semibold text-ink'>{t('teamTitle')}</h2><p className='my-3 text-sm leading-7 text-secondary'>{t('teamText')}</p><PracticeReadState resource={resource} invalid={resource.data !== null && !data} /><PracticePages data={data} offset={offset} busy={resource.refreshing} onChange={setOffset} label={t('membersLabel')} />
    {data && <ul className='grid gap-3'>{data.rows.map(row => <li key={row.id + ':' + row.version} className='min-w-0 rounded-xl border border-theme p-4'><h3 className='break-words font-semibold text-ink'>{row.full_name || row.email || t('memberFallback')}</h3>{row.email && <p className='mt-1 break-all text-sm text-secondary'>{row.email}</p>}<p className='my-3 text-sm text-secondary'>{status.role(row.role)} · {status.member(row.status)}</p>
      {canManage && data.canManage && row.can_revoke && <Decision label={decision('revokeMembership')} confirmLabel={decision('confirmRevokeMembership')} endpoint={base + '/' + row.id + '/revoke'} version={row.version} refresh={resource.retry} confirm={result => object(result) && practiceMember(result.membership, saved.id)?.id === row.id && object(result.membership) && result.membership.status === 'REVOKED'} />}
    </li>)}</ul>}
  </PortalCard>
}
function PracticeDetail({ id, admin, refreshRegistry }: { id: string; admin: boolean; refreshRegistry: () => void }) {
  const t = useTranslations('practiceWs.workspace'), f = useTranslations('practiceWs.fields'), decision = useTranslations('practiceWs.decision'), status = useStatusText()
  const base = `/api/v1/${admin ? 'admin' : 'practice'}/practices/${id}`, resource = usePortalResource<unknown>(base, false, { abortOnCleanup: true, refreshOnFocus: true })
  const saved = object(resource.data) ? practice(resource.data.practice) : null, correct = saved?.id === id, canManage = correct && object(resource.data) && resource.data.can_manage === true
  const [editing, setEditing] = useState(false), action = usePracticeAction(id + ':' + saved?.version + ':' + canManage)
  const refresh = () => { resource.retry(); refreshRegistry() }
  return <div className='grid min-w-0 gap-5'><PracticeReadState resource={resource} invalid={resource.data !== null && !correct} />{correct && saved && <>
    <PortalCard><div className='flex flex-wrap items-center justify-between gap-3'><h2 className='break-words text-xl font-semibold text-ink'>{saved.name}</h2><PortalBadge tone={saved.status === 'REVIEWED' ? 'success' : saved.status === 'SUSPENDED' ? 'danger' : 'warning'}>{status.badge(saved.status)}</PortalBadge></div>
      <dl className='my-5 grid min-w-0 gap-4 text-sm sm:grid-cols-2'>{[[f('contactEmail'), saved.contact_email], [f('phone'), saved.phone], [f('address'), [saved.address_line1, saved.address_line2].filter(Boolean).join(', ')], [f('location'), [saved.postcode, saved.city, saved.country].filter(Boolean).join(' ')]].map(([label, value]) => <div key={label}><dt className='text-secondary'>{label}</dt><dd className='mt-1 break-words text-ink'>{value || f('notProvided')}</dd></div>)}</dl>
      {saved.status === 'SUSPENDED' && <p role='status' className='my-4 text-sm leading-7 text-secondary'>{t('suspendedNote')}</p>}
      {!admin && canManage && !editing && <div className='flex flex-wrap gap-3'><PortalButton type='button' onClick={() => setEditing(true)}>{t('editProfile')}</PortalButton>{saved.status === 'DRAFT' && <PortalButton type='button' disabled={action.busy} onClick={() => void action.run(signal => apiPost(base + '/submit', {}, practiceVersion(saved.version), signal), result => { const row = object(result) ? practice(result.practice) : null; if (row?.id !== id || row.status !== 'SUBMITTED') throw new Error(t('submitUnconfirmed')); return t('submitted') }, refresh)}>{t('submitForReview')}</PortalButton>}</div>}
      {!admin && editing && canManage && <ProfileForm key={saved.id} saved={saved} complete={() => { setEditing(false); refresh() }} />}
      {admin && canManage && <div className='grid gap-3'>{saved.status === 'SUBMITTED' && <Decision label={decision('recordReview')} confirmLabel={decision('confirmRecordReview')} endpoint={base + '/review'} version={saved.version} refresh={refresh} confirm={result => object(result) && practice(result.practice)?.id === id && object(result.practice) && result.practice.status === 'REVIEWED'} />}{saved.status !== 'SUSPENDED' ? <Decision label={decision('suspend')} confirmLabel={decision('confirmSuspend')} endpoint={base + '/suspend'} version={saved.version} refresh={refresh} confirm={result => object(result) && practice(result.practice)?.id === id && object(result.practice) && result.practice.status === 'SUSPENDED'} /> : <Decision label={decision('reopen')} confirmLabel={decision('confirmReopen')} endpoint={base + '/reopen'} version={saved.version} refresh={refresh} confirm={result => object(result) && practice(result.practice)?.id === id && object(result.practice) && result.practice.status === 'DRAFT'} />}</div>}
      <ActionFeedback action={action} />
    </PortalCard>
    {!admin && <PracticeMembers key={'members:' + id} saved={saved} canManage={canManage} />}
    <PracticeInvitations key={'invitations:' + id + ':' + canManage} saved={saved} admin={admin} canManage={canManage} />
  </>}</div>
}
export default function PracticeWorkspace({ admin = false, clinician = false }: { admin?: boolean; clinician?: boolean }) { const t = useTranslations('practiceWs.workspace'); return <PracticeScope><div className='grid min-w-0 gap-5'><header><p className='mb-2 text-xs font-semibold uppercase tracking-widest text-secondary'>{t('eyebrow')}</p><h1 className='text-3xl font-extrabold tracking-tight text-ink'>{admin ? t('registryTitle') : clinician ? t('clinicianTitle') : t('workspaceTitle')}</h1><p className='mt-3 text-sm leading-7 text-secondary'>{admin ? t('registryIntro') : clinician ? t('clinicianIntro') : t('workspaceIntro')}</p></header><PracticeBoundaryNote /><PracticeGate>{admin ? <Registry /> : <Affiliations clinician={clinician} />}</PracticeGate></div></PracticeScope> }
function Registry() {
  const t = useTranslations('practiceWs.workspace'), status = useStatusText()
  const [offset, setOffset] = useState(0), [selected, setSelected] = useState<string | null>(null), [creating, setCreating] = useState(false)
  const [entityType, setEntityType] = useState(''), [verification, setVerification] = useState(''), [entityAware, setEntityAware] = useState(false)
  const filters = (entityType ? `&entity_type=${entityType}` : '') + (verification ? `&verification_status=${verification}` : '')
  const resource = usePortalResource<unknown>(`/api/v1/admin/practices?limit=25&offset=${offset}${filters}`, false, { abortOnCleanup: true, refreshOnFocus: true })
  const data = useMemo(() => practicePage(resource.data, 'practices', registryRow), [resource.data])
  if (data && data.offset !== offset) setOffset(data.offset)
  if (data && !entityAware && data.rows.some(row => row.entityAware)) setEntityAware(true)
  const filter = (set: (value: string) => void) => (value: string) => { setSelected(null); setOffset(0); set(value) }
  return <><PortalCard><div className='flex flex-wrap items-center justify-between gap-3'><h2 className='text-xl font-semibold text-ink'>{t('registeredTitle')}</h2><PortalButton type='button' onClick={resource.retry} disabled={resource.refreshing}>{t('refreshRegistry')}</PortalButton></div><PracticeReadState resource={resource} invalid={resource.data !== null && !data} />
    {entityAware && <div className='mt-4 grid min-w-0 gap-3 sm:grid-cols-2'>
      <div className='min-w-0'><label htmlFor='registry-entity-type' className='mb-2 block text-sm font-semibold text-ink'>{t('entityType')}</label>
        <select id='registry-entity-type' value={entityType} onChange={event => filter(setEntityType)(event.target.value)} className={practiceControl}><option value=''>{t('allEntities')}</option><option value='PRACTICE'>{t('practices')}</option><option value='INDEPENDENT'>{t('independents')}</option></select></div>
      <div className='min-w-0'><label htmlFor='registry-verification' className='mb-2 block text-sm font-semibold text-ink'>{t('verification')}</label>
        <select id='registry-verification' value={verification} onChange={event => filter(setVerification)(event.target.value)} className={practiceControl}><option value=''>{t('any')}</option><option value='VERIFIED'>{t('verified')}</option><option value='UNVERIFIED'>{t('notVerified')}</option></select></div>
    </div>}
    <PracticePages data={data} offset={offset} busy={resource.refreshing} onChange={value => { setSelected(null); setOffset(value) }} label={t('practicesLabel')} />
    {data?.canManage && <PortalButton type='button' tone='primary' onClick={() => setCreating(value => !value)}>{creating ? t('closeDraft') : t('addPractice')}</PortalButton>}{creating && data?.canManage && <div className='mt-5'><ProfileForm complete={() => { setCreating(false); resource.retry() }} /></div>}
    {data && !data.rows.length && <PortalEmptyState title={t('noPracticesTitle')} description={t('noPracticesText')} />}
    {data && <ul className='mt-5 grid gap-3'>{data.rows.map(row => <li key={row.id} className='flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-theme p-4'><div className='min-w-0'><h3 className='break-words font-semibold text-ink'>{row.name}</h3><p className='mt-1 text-sm text-secondary'>{status.practice(row.status)} · {row.city || t('cityMissing')}</p>
      {row.entityAware && <p className='mt-2 flex flex-wrap gap-2'><PortalBadge tone='info'>{row.entity?.entity_type === 'INDEPENDENT' ? t('independent') : t('practice')}</PortalBadge><PortalBadge tone={row.entity?.verification_status === 'VERIFIED' ? 'success' : 'warning'}>{row.entity?.verification_status === 'VERIFIED' ? t('verified') : t('notVerified')}</PortalBadge><PortalBadge tone={row.bookable ? 'success' : 'neutral'}>{row.bookable ? t('bookable') : t('notBookable')}</PortalBadge></p>}</div><PortalButton type='button' disabled={resource.refreshing} onClick={() => setSelected(row.id)} aria-label={t('openPracticeNamed', { name: row.name })}>{t('openPractice')}</PortalButton></li>)}</ul>}
  </PortalCard>{selected && data?.rows.some(row => row.id === selected) && <PracticeDetail key={selected} id={selected} admin refreshRegistry={resource.retry} />}</>
}
function Affiliations({ clinician }: { clinician: boolean }) {
  const t = useTranslations('practiceWs.workspace'), status = useStatusText()
  const resource = usePortalResource<unknown>(clinician ? '/api/v1/doctor/practices' : '/api/v1/practice/workspace', false, { abortOnCleanup: true, refreshOnFocus: true }), [selected, setSelected] = useState<string | null>(null)
  const rows = useMemo(() => practiceWorkspace(resource.data), [resource.data]), active = selected || (rows?.length === 1 ? rows[0].practice.id : null)
  return <><PortalCard><div className='flex flex-wrap items-center justify-between gap-3'><h2 className='text-xl font-semibold text-ink'>{t('affiliationsTitle')}</h2><PortalButton type='button' onClick={resource.retry} disabled={resource.refreshing}>{t('refreshAffiliations')}</PortalButton></div><PracticeReadState resource={resource} invalid={resource.data !== null && !rows} />
    {rows?.length === 0 && <PortalEmptyState title={t('noMembershipsTitle')} description={t('noMembershipsText')} />}
    {rows && <ul className='mt-5 grid gap-3'>{rows.map(row => <li key={row.practice.id} className='flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-theme p-4'><div className='min-w-0'><h3 className='break-words font-semibold text-ink'>{row.practice.name}</h3><p className='my-1 text-sm text-secondary'>{t('affiliationMeta', { role: status.role(row.membership.role), status: status.member(row.membership.status), practiceStatus: status.practice(row.practice.status) })}</p></div>{!clinician && <PortalButton type='button' disabled={resource.refreshing || row.membership.status !== 'ACTIVE'} onClick={() => setSelected(row.practice.id)} aria-pressed={active === row.practice.id}>{t('manage')}</PortalButton>}</li>)}</ul>}
    {clinician && <p className='mt-4 text-sm leading-7 text-secondary'>{t('clinicianNote')}</p>}
  </PortalCard>{!clinician && active && rows?.some(row => row.practice.id === active && row.membership.status === 'ACTIVE') && <PracticeDetail key={active} id={active} admin={false} refreshRegistry={resource.retry} />}</>
}

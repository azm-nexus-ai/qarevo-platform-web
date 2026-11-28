'use client'

import { useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { usePortalResource } from '@/lib/use-portal-resource'
import { practiceWorkspace, type Practice } from '@/lib/practice'
import { useMoney } from '@/i18n/format'
import { TIME_ZONE } from '@/i18n/locale'
import { PortalBadge, PortalButton, PortalCard, PortalEmptyState, PortalLinkButton } from '@/components/patient/PatientPortalPrimitives'
import { PracticeReadState, PracticeScope } from './PracticeShared'
import { PracticeInvitations, PracticeMembers } from './PracticeWorkspace'
import { PRACTICE_ROUTES } from '@/constants/portal-navigation'

type Overview = {
  verification_status: string | null; clinicians: number; pending_invitations: number; appointments_today: number
  appointments_next_7_days: number; cancelled_next_7_days: number; coverage_next_7_days: Record<string, number>
  latest_statement: { period: string; status: string; gross_minor: number; currency: string } | null
}
type Slot = { start: string; end: string; status: string; coverage_type: string }
type Clinician = { membership_id: string; name: string; specialty: string | null; weekly_hours: { day_of_week: number; start: string; end: string; slot_minutes: number }[]; time_off: { start: string; end: string }[]; appointments: Slot[] }
type Schedule = { start: string; days: number; clinicians: Clinician[]; other_appointments: Slot[] }

const int = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
const str = (value: unknown) => typeof value === 'string' ? value : ''

function parseOverview(value: unknown): Overview | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const coverage: Record<string, number> = {}
  if (row.coverage_next_7_days && typeof row.coverage_next_7_days === 'object') {
    for (const [key, count] of Object.entries(row.coverage_next_7_days as Record<string, unknown>)) if (['GKV', 'PKV', 'SELF_PAY'].includes(key)) coverage[key] = int(count)
  }
  const statement = row.latest_statement && typeof row.latest_statement === 'object' ? row.latest_statement as Record<string, unknown> : null
  return {
    verification_status: typeof row.verification_status === 'string' ? row.verification_status : null,
    clinicians: int(row.clinicians), pending_invitations: int(row.pending_invitations), appointments_today: int(row.appointments_today),
    appointments_next_7_days: int(row.appointments_next_7_days), cancelled_next_7_days: int(row.cancelled_next_7_days), coverage_next_7_days: coverage,
    latest_statement: statement && /^\d{4}-\d{2}$/.test(str(statement.period)) ? { period: str(statement.period), status: str(statement.status), gross_minor: int(statement.gross_minor), currency: str(statement.currency) || 'EUR' } : null,
  }
}

function parseSlots(value: unknown): Slot[] {
  return Array.isArray(value) ? value.flatMap(item => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return str(row.start) && str(row.end) ? [{ start: str(row.start), end: str(row.end), status: str(row.status), coverage_type: str(row.coverage_type) }] : []
  }) : []
}

function parseSchedule(value: unknown): Schedule | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (!Array.isArray(row.clinicians) || !/^\d{4}-\d{2}-\d{2}$/.test(str(row.start))) return null
  return {
    start: str(row.start), days: int(row.days) || 7, other_appointments: parseSlots(row.other_appointments),
    clinicians: row.clinicians.flatMap(item => {
      const c = item && typeof item === 'object' ? item as Record<string, unknown> : null
      if (!c || !str(c.membership_id) || !str(c.name)) return []
      const hours = Array.isArray(c.weekly_hours) ? c.weekly_hours.flatMap(h => {
        const x = h && typeof h === 'object' ? h as Record<string, unknown> : {}
        return /^\d\d:\d\d$/.test(str(x.start)) && /^\d\d:\d\d$/.test(str(x.end)) ? [{ day_of_week: int(x.day_of_week), start: str(x.start), end: str(x.end), slot_minutes: int(x.slot_minutes) }] : []
      }) : []
      const away = Array.isArray(c.time_off) ? c.time_off.flatMap(t => { const x = t && typeof t === 'object' ? t as Record<string, unknown> : {}; return str(x.start) && str(x.end) ? [{ start: str(x.start), end: str(x.end) }] : [] }) : []
      return [{ membership_id: str(c.membership_id), name: str(c.name), specialty: typeof c.specialty === 'string' ? c.specialty : null, weekly_hours: hours, time_off: away, appointments: parseSlots(c.appointments) }]
    }),
  }
}

/** The practices this account owns (active owner membership only). */
function useOwnedPractices() {
  const resource = usePortalResource<unknown>('/api/v1/practice/workspace', false, { abortOnCleanup: true })
  const owned = useMemo(() => practiceWorkspace(resource.data)?.filter(row => row.membership.role === 'OWNER' && row.membership.status === 'ACTIVE').map(row => row.practice) ?? null, [resource.data])
  return { resource, owned }
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className='min-w-0 rounded-2xl border border-theme bg-surface p-4'>
    <p className='text-xs font-bold uppercase tracking-wide text-secondary'>{label}</p>
    <p className='mt-2 text-2xl font-extrabold text-ink'>{value}</p>
    {hint && <p className='mt-1 text-xs leading-5 text-secondary'>{hint}</p>}
  </div>
}

function OverviewCard({ practice }: { practice: Practice }) {
  const t = useTranslations('practiceOps'), money = useMoney()
  const resource = usePortalResource<unknown>(`/api/v1/practice/practices/${practice.id}/overview`, false, { abortOnCleanup: true, refreshOnFocus: true })
  const data = useMemo(() => parseOverview(resource.data), [resource.data])
  if (!data) return <PortalCard><PracticeReadState resource={resource} invalid={!!resource.data && !data} /></PortalCard>
  const coverage = Object.entries(data.coverage_next_7_days).map(([key, count]) => `${t(`coverage.${key === 'SELF_PAY' ? 'selfPay' : key.toLowerCase()}`)} ${count}`).join(' · ')
  const verified = data.verification_status === 'VERIFIED'
  return <PortalCard>
    <div className='flex flex-wrap items-start justify-between gap-3'>
      <div className='min-w-0'><h2 className='break-words text-xl font-semibold text-ink'>{t('overviewTitle', { name: practice.name })}</h2>
        <p className='mt-1 text-sm leading-6 text-secondary'>{t('overviewIntro')}</p></div>
      <PortalBadge tone={verified ? 'success' : 'warning'}>{verified ? t('verified') : t('notVerified')}</PortalBadge>
    </div>
    <div className='mt-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3'>
      <Stat label={t('today')} value={data.appointments_today} />
      <Stat label={t('next7')} value={data.appointments_next_7_days} hint={coverage || undefined} />
      <Stat label={t('cancelled7')} value={data.cancelled_next_7_days} />
      <Stat label={t('clinicians')} value={data.clinicians} hint={data.pending_invitations ? t('pendingInvitations', { count: data.pending_invitations }) : undefined} />
      <Stat label={t('latestStatement')} value={data.latest_statement ? money.minor(data.latest_statement.gross_minor, data.latest_statement.currency) : '—'}
        hint={data.latest_statement ? `${data.latest_statement.period} · ${data.latest_statement.status === 'ISSUED' ? t('issued') : t('draft')}` : t('noStatement')} />
    </div>
    <div className='mt-5 flex flex-wrap gap-3'>
      <PortalLinkButton href={PRACTICE_ROUTES.team} tone='primary'>{t('inviteClinician')}</PortalLinkButton>
      <PortalLinkButton href={PRACTICE_ROUTES.schedule}>{t('openSchedule')}</PortalLinkButton>
      {!verified && <PortalLinkButton href={PRACTICE_ROUTES.verification}>{t('completeVerification')}</PortalLinkButton>}
      <PortalLinkButton href={PRACTICE_ROUTES.statements}>{t('openInvoices')}</PortalLinkButton>
    </div>
    <p className='mt-4 text-xs leading-6 text-secondary'>{t('privacyNote')}</p>
  </PortalCard>
}

/** Dashboard header block: one overview per owned practice. */
export function PracticeOverview() {
  const { resource, owned } = useOwnedPractices()
  if (!owned) return resource.data || resource.error ? <PortalCard><PracticeReadState resource={resource} invalid={!!resource.data && !owned} /></PortalCard> : null
  return <div className='grid grid-cols-[minmax(0,1fr)] gap-5'>{owned.map(row => <OverviewCard key={row.id} practice={row} />)}</div>
}

export function PracticeTeamPage() {
  const t = useTranslations('practiceOps'), { resource, owned } = useOwnedPractices()
  return <PracticeScope>
    <header className='mb-6'><h1 className='text-3xl font-extrabold tracking-tight text-ink'>{t('teamTitle')}</h1>
      <p className='mt-2 max-w-3xl text-sm leading-7 text-secondary'>{t('teamIntro')}</p></header>
    {!owned ? <PortalCard><PracticeReadState resource={resource} invalid={!!resource.data && !owned} /></PortalCard>
      : !owned.length ? <PortalEmptyState title={t('noPracticeTitle')} description={t('noPracticeText')} />
        : owned.map(row => <section key={row.id} aria-label={row.name} className='mb-8 grid grid-cols-[minmax(0,1fr)] gap-5'>
          {owned.length > 1 && <h2 className='text-2xl font-bold text-ink'>{row.name}</h2>}
          <PracticeMembers saved={row} canManage={row.status !== 'SUSPENDED'} />
          <PracticeInvitations saved={row} admin={false} canManage={row.status !== 'SUSPENDED'} />
        </section>)}
  </PracticeScope>
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10)
}

function ScheduleView({ practice }: { practice: Practice }) {
  const t = useTranslations('practiceOps'), format = useFormatter()
  const [start, setStart] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date()))
  const resource = usePortalResource<unknown>(`/api/v1/practice/practices/${practice.id}/schedule?start=${start}&days=7`, false, { abortOnCleanup: true, refreshOnFocus: true })
  const data = useMemo(() => parseSchedule(resource.data), [resource.data])
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const dayLabel = (iso: string) => format.dateTime(new Date(`${iso}T12:00:00Z`), { timeZone: TIME_ZONE, weekday: 'short', day: '2-digit', month: '2-digit' })
  const time = (iso: string) => format.dateTime(new Date(iso), { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' })
  const localDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(iso))
  const weekday = (iso: string) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7  // Monday = 0, as stored
  return <PortalCard>
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <h2 className='break-words text-xl font-semibold text-ink'>{practice.name}</h2>
      <div className='flex flex-wrap items-center gap-2' role='group' aria-label={t('weekNavigation')}>
        <PortalButton type='button' onClick={() => setStart(addDays(start, -7))}>{t('previousWeek')}</PortalButton>
        <PortalButton type='button' onClick={() => setStart(new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date()))}>{t('thisWeek')}</PortalButton>
        <PortalButton type='button' onClick={() => setStart(addDays(start, 7))}>{t('nextWeek')}</PortalButton>
      </div>
    </div>
    <p className='mt-2 text-sm leading-6 text-secondary' role='status'>{t('weekOf', { from: dayLabel(days[0]), to: dayLabel(days[6]) })}</p>
    {!data ? <PracticeReadState resource={resource} invalid={!!resource.data && !data} />
      : !data.clinicians.length ? <p className='mt-4 rounded-xl border border-dashed border-theme p-4 text-sm text-secondary'>{t('noClinicians')}</p>
        : <div className='mt-4 overflow-x-auto' role='region' aria-label={t('scheduleTable')} tabIndex={0}>
          <table className='w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm'>
            <thead><tr>
              <th scope='col' className='sticky left-0 border-b border-theme bg-surface py-2 pr-3 font-semibold text-secondary'>{t('clinician')}</th>
              {days.map(day => <th key={day} scope='col' className='border-b border-theme px-2 py-2 font-semibold text-secondary'>{dayLabel(day)}</th>)}
            </tr></thead>
            <tbody>{data.clinicians.map(clinician => <tr key={clinician.membership_id}>
              <th scope='row' className='sticky left-0 border-b border-theme bg-surface py-3 pr-3 align-top font-semibold text-ink'>
                {clinician.name}{clinician.specialty && <span className='block text-xs font-normal text-secondary'>{clinician.specialty}</span>}
              </th>
              {days.map(day => {
                const hours = clinician.weekly_hours.filter(h => h.day_of_week === weekday(day))
                const booked = clinician.appointments.filter(slot => localDay(slot.start) === day)
                const active = booked.filter(slot => slot.status.toUpperCase() !== 'CANCELLED')
                const away = clinician.time_off.some(off => localDay(off.start) <= day && localDay(off.end) >= day)
                return <td key={day} className='border-b border-theme px-2 py-3 align-top'>
                  {away ? <PortalBadge tone='warning'>{t('away')}</PortalBadge>
                    : hours.length ? <span className='block text-xs text-secondary'>{hours.map(h => `${h.start}–${h.end}`).join(', ')}</span>
                      : <span className='block text-xs text-secondary'>{t('noHours')}</span>}
                  {active.length > 0 && <span className='mt-1 block font-semibold text-ink'>{t('booked', { count: active.length })}</span>}
                  {active.length > 0 && <span className='block text-xs text-secondary'>{active.slice(0, 4).map(slot => time(slot.start)).join(' · ')}{active.length > 4 ? ' …' : ''}</span>}
                </td>
              })}
            </tr>)}</tbody>
          </table>
        </div>}
    <p className='mt-4 text-xs leading-6 text-secondary'>{t('privacyNote')}</p>
  </PortalCard>
}

export function PracticeSchedulePage() {
  const t = useTranslations('practiceOps'), { resource, owned } = useOwnedPractices()
  return <PracticeScope>
    <header className='mb-6'><h1 className='text-3xl font-extrabold tracking-tight text-ink'>{t('scheduleTitle')}</h1>
      <p className='mt-2 max-w-3xl text-sm leading-7 text-secondary'>{t('scheduleIntro')}</p></header>
    {!owned ? <PortalCard><PracticeReadState resource={resource} invalid={!!resource.data && !owned} /></PortalCard>
      : !owned.length ? <PortalEmptyState title={t('noPracticeTitle')} description={t('noPracticeText')} />
        : <div className='grid grid-cols-[minmax(0,1fr)] gap-6'>{owned.map(row => <ScheduleView key={row.id} practice={row} />)}</div>}
  </PracticeScope>
}

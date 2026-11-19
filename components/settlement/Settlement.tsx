'use client'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet, apiPost } from '@/lib/api'
import { usePortalResource } from '@/lib/use-portal-resource'
import { usePracticeAction } from '@/lib/use-practice-action'
import { practicePage, practice, practiceControl, practiceVersion, practiceWorkspace } from '@/lib/practice'
import { previousMonth, statement as parseStatement, statements as parseStatements, type Statement } from '@/lib/settlement'
import { PortalButton, PortalCard, PortalEmptyState } from '@/components/patient/PatientPortalPrimitives'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import { ActionFeedback, PracticeReadState, PracticeScope } from '@/components/practice/PracticeShared'
import StatementView from './StatementView'

const ADMIN = '/api/v1/admin/settlement'

/** Settlement oversight: monthly statements per treating entity, drafts, invoices. */
export function AdminSettlement() {
  const t = useTranslations('settlement.admin'), [period, setPeriod] = useState(previousMonth), [notice, setNotice] = useState('')
  const resource = usePortalResource<unknown>(`${ADMIN}/statements?period=${period}`, false, { abortOnCleanup: true, refreshOnFocus: true })
  const rows = useMemo(() => parseStatements(resource.data), [resource.data])
  return <PracticeScope>
    <header className='mb-6'>
      <h1 className='text-3xl font-extrabold tracking-tight text-ink'>{t('title')}</h1>
      <p className='mt-2 max-w-3xl text-sm leading-7 text-secondary'>{t('intro')}</p>
    </header>
    {notice && <p role='status' className='mb-6 rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-7 text-ink'>{notice}</p>}
    <div className='grid grid-cols-[minmax(0,1fr)] gap-6'>
      <PortalCard>
        <div className='flex flex-wrap items-end gap-4'>
          <div><label htmlFor='settlement-period' className='mb-2 block text-sm font-semibold text-ink'>{t('month')}</label>
            <input id='settlement-period' type='month' value={period} onChange={event => { if (event.target.value) { setPeriod(event.target.value); setNotice('') } }} className={practiceControl} /></div>
        </div>
        <Generate period={period} done={resource.retry} />
      </PortalCard>
      {!rows ? <PortalCard><PracticeReadState resource={resource} invalid={!!resource.data && !rows} /></PortalCard>
        : rows.length === 0 ? <PortalEmptyState title={t('emptyTitle')} description={t('emptyText')} />
        : rows.map(row => <AdminStatement key={row.id} summary={row} refresh={resource.retry} announce={setNotice} />)}
    </div>
  </PracticeScope>
}

function Generate({ period, done }: { period: string; done: () => void }) {
  const t = useTranslations('settlement.admin'), entities = usePortalResource<unknown>('/api/v1/admin/practices?limit=100&offset=0', false, { abortOnCleanup: true })
  const options = useMemo(() => practicePage(entities.data, 'practices', practice)?.rows ?? [], [entities.data])
  const [practiceId, setPracticeId] = useState(''), [errors, setErrors] = useState<Record<string, string>>({})
  const action = usePracticeAction('settlement-generate:' + period)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next: Record<string, string> = practiceId ? {} : { 'settlement-entity': t('chooseEntityError') }
    setErrors(next); if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    void action.run(signal => apiPost(`${ADMIN}/statements`, { practice_id: practiceId, period }, undefined, signal), result => {
      const saved = parseStatement(result); if (!saved) throw new Error(t('notConfirmed'))
      done(); return saved.status === 'ISSUED' ? t('alreadyIssued') : t('draftUpdated', { count: saved.line_count })
    })
  }
  return <form noValidate onSubmit={submit} aria-busy={action.busy} className='mt-4 grid gap-3'>
    <ValidationSummary errors={errors} />
    <div className='min-w-0'><label htmlFor='settlement-entity' className='mb-2 block text-sm font-semibold text-ink'>{t('entity')}</label>
      <select id='settlement-entity' value={practiceId} onChange={event => setPracticeId(event.target.value)} className={practiceControl} aria-invalid={!!errors['settlement-entity']} aria-describedby='settlement-entity-error'>
        <option value=''>{t('choose')}</option>{options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select><FieldFeedback name='settlement-entity' error={errors['settlement-entity']} /></div>
    <ActionFeedback action={action} />
    <div><PortalButton type='submit' tone='primary' disabled={action.busy}>{action.busy ? t('calculating') : t('generate')}</PortalButton></div>
  </form>
}

function AdminStatement({ summary, refresh, announce }: { summary: Statement; refresh: () => void; announce: (message: string) => void }) {
  const t = useTranslations('settlement.admin'), [detail, setDetail] = useState<Statement | null>(null), [loadError, setLoadError] = useState('')
  const current = detail && detail.version === summary.version ? detail : null, shown = current ?? summary
  const load = async () => {
    setLoadError('')
    try { const value = parseStatement(await apiGet<unknown>(`${ADMIN}/statements/${summary.id}`)); if (!value) throw new Error(); setDetail(value) }
    catch { setLoadError(t('linesFailed')) }
  }
  return <StatementView statement={shown} invoicePath={`${ADMIN}/statements/${summary.id}/invoice`}>
    {!current && <PortalButton type='button' onClick={() => void load()}>{t('showLines')}</PortalButton>}
    {shown.status === 'DRAFT' && shown.line_count > 0 && <Issue statement={shown} refresh={refresh} announce={announce} />}
    {loadError && <p role='alert' className='text-sm text-ink'>{loadError}</p>}
  </StatementView>
}

function Issue({ statement, refresh, announce }: { statement: Statement; refresh: () => void; announce: (message: string) => void }) {
  const t = useTranslations('settlement.admin'), [open, setOpen] = useState(false), [confirmed, setConfirmed] = useState(false), [error, setError] = useState('')
  const action = usePracticeAction(`settlement-issue:${statement.id}:${statement.version}`)
  if (!open) return <PortalButton type='button' tone='primary' onClick={() => setOpen(true)}>{t('issue')}</PortalButton>
  return <div className='grid w-full gap-3 rounded-xl border border-theme bg-surface-subtle p-4'>
    <label className='flex items-start gap-3 text-sm text-ink'><input type='checkbox' className='mt-1 h-5 w-5 shrink-0' checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
      <span>{t('issueConfirm')}</span></label>
    {error && <p role='alert' className='text-sm text-ink'>{error}</p>}
    <ActionFeedback action={action} />
    <div className='flex flex-wrap gap-3'>
      <PortalButton type='button' tone='primary' disabled={action.busy} onClick={() => {
        if (!confirmed) { setError(t('issueConfirmError')); return }
        setError('')
        void action.run(signal => apiPost(`${ADMIN}/statements/${statement.id}/issue`, {}, practiceVersion(statement.version), signal), result => {
          const saved = parseStatement(result); if (!saved || saved.status !== 'ISSUED') throw new Error(t('issueNotConfirmed'))
          const message = t('issued', { number: saved.invoice_number ?? '', period: saved.period })
          announce(message); refresh(); return message
        })
      }}>{action.busy ? t('issuing') : t('confirmIssue')}</PortalButton>
      <PortalButton type='button' onClick={() => setOpen(false)}>{t('cancel')}</PortalButton>
    </div>
  </div>
}

/** A treating entity's own invoiced statements (practice portal or doctor portal). */
export function EntityStatements({ base }: { base: string }) {
  const t = useTranslations('settlement.entity'), resource = usePortalResource<unknown>(base, false, { abortOnCleanup: true })
  const rows = useMemo(() => parseStatements(resource.data), [resource.data])
  if (!rows) return <PortalCard><PracticeReadState resource={resource} invalid={!!resource.data && !rows} /></PortalCard>
  if (!rows.length) return <PortalEmptyState title={t('emptyTitle')} description={t('emptyText')} />
  return <div className='grid grid-cols-[minmax(0,1fr)] gap-6'>{rows.map(row => <EntityStatement key={row.id} base={base} summary={row} />)}</div>
}

function EntityStatement({ base, summary }: { base: string; summary: Statement }) {
  const t = useTranslations('settlement.entity'), [detail, setDetail] = useState<Statement | null>(null)
  return <StatementView statement={detail ?? summary} invoicePath={`${base}/${summary.id}/invoice`}>
    {!detail && <PortalButton type='button' onClick={async () => { const value = parseStatement(await apiGet<unknown>(`${base}/${summary.id}`).catch(() => null)); if (value) setDetail(value) }}>{t('showLines')}</PortalButton>}
  </StatementView>
}

export function PracticeStatementsPage() {
  const t = useTranslations('settlement.entity'), resource = usePortalResource<unknown>('/api/v1/practice/workspace', false, { abortOnCleanup: true })
  const owned = useMemo(() => practiceWorkspace(resource.data)?.filter(row => row.membership.role === 'OWNER' && row.membership.status === 'ACTIVE').map(row => row.practice) ?? null, [resource.data])
  return <PracticeScope>
    <header className='mb-6'><h1 className='text-3xl font-extrabold tracking-tight text-ink'>{t('title')}</h1>
      <p className='mt-2 max-w-3xl text-sm leading-7 text-secondary'>{t('intro')}</p></header>
    {!owned ? <PortalCard><PracticeReadState resource={resource} invalid={!!resource.data && !owned} /></PortalCard>
      : owned.map(item => <section key={item.id} aria-label={item.name} className='mb-8'>{owned.length > 1 && <h2 className='mb-3 text-2xl font-bold text-ink'>{item.name}</h2>}
        <EntityStatements base={`/api/v1/practice/practices/${item.id}/statements`} /></section>)}
  </PracticeScope>
}

/** Headings for the invoices section on the doctor's independent practice page. */
export function InvoicesHeading() { return <>{useTranslations('settlement.entity')('title')}</> }
export function InvoicesIntro() { return <>{useTranslations('settlement.entity')('independentIntro')}</> }

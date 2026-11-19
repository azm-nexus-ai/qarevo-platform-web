'use client'
import { useMemo, useState, type FormEvent } from 'react'
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
  const [period, setPeriod] = useState(previousMonth), [notice, setNotice] = useState('')
  const resource = usePortalResource<unknown>(`${ADMIN}/statements?period=${period}`, false, { abortOnCleanup: true, refreshOnFocus: true })
  const rows = useMemo(() => parseStatements(resource.data), [resource.data])
  return <PracticeScope>
    <header className='mb-6'>
      <h1 className='text-3xl font-extrabold tracking-tight text-ink'>Settlement</h1>
      <p className='mt-2 max-w-3xl text-sm leading-7 text-secondary'>Monthly platform-fee statements per practice and independent practitioner. Lines come only from consultations whose attendance the video provider has reported as final. The fee schedule is price list v2 until another is confirmed.</p>
    </header>
    {notice && <p role='status' className='mb-6 rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-7 text-ink'>{notice}</p>}
    <div className='grid grid-cols-[minmax(0,1fr)] gap-6'>
      <PortalCard>
        <div className='flex flex-wrap items-end gap-4'>
          <div><label htmlFor='settlement-period' className='mb-2 block text-sm font-semibold text-ink'>Month</label>
            <input id='settlement-period' type='month' value={period} onChange={event => { if (event.target.value) { setPeriod(event.target.value); setNotice('') } }} className={practiceControl} /></div>
        </div>
        <Generate period={period} done={resource.retry} />
      </PortalCard>
      {!rows ? <PortalCard><PracticeReadState resource={resource} invalid={!!resource.data && !rows} /></PortalCard>
        : rows.length === 0 ? <PortalEmptyState title='No statements for this month' description='Create a draft for a practice or independent practitioner above.' />
        : rows.map(row => <AdminStatement key={row.id} summary={row} refresh={resource.retry} announce={setNotice} />)}
    </div>
  </PracticeScope>
}

function Generate({ period, done }: { period: string; done: () => void }) {
  const entities = usePortalResource<unknown>('/api/v1/admin/practices?limit=100&offset=0', false, { abortOnCleanup: true })
  const options = useMemo(() => practicePage(entities.data, 'practices', practice)?.rows ?? [], [entities.data])
  const [practiceId, setPracticeId] = useState(''), [errors, setErrors] = useState<Record<string, string>>({})
  const action = usePracticeAction('settlement-generate:' + period)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next: Record<string, string> = practiceId ? {} : { 'settlement-entity': 'Choose a practice or independent practitioner.' }
    setErrors(next); if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    void action.run(signal => apiPost(`${ADMIN}/statements`, { practice_id: practiceId, period }, undefined, signal), result => {
      const saved = parseStatement(result); if (!saved) throw new Error('The statement could not be confirmed. Refresh before trying again.')
      done(); return saved.status === 'ISSUED' ? 'This month is already invoiced; the issued statement is unchanged.' : `Draft updated: ${saved.line_count} billable consultations.`
    })
  }
  return <form noValidate onSubmit={submit} aria-busy={action.busy} className='mt-4 grid gap-3'>
    <ValidationSummary errors={errors} />
    <div className='min-w-0'><label htmlFor='settlement-entity' className='mb-2 block text-sm font-semibold text-ink'>Treating entity (Required)</label>
      <select id='settlement-entity' value={practiceId} onChange={event => setPracticeId(event.target.value)} className={practiceControl} aria-invalid={!!errors['settlement-entity']} aria-describedby='settlement-entity-error'>
        <option value=''>Choose…</option>{options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select><FieldFeedback name='settlement-entity' error={errors['settlement-entity']} /></div>
    <ActionFeedback action={action} />
    <div><PortalButton type='submit' tone='primary' disabled={action.busy}>{action.busy ? 'Calculating…' : 'Create or refresh draft'}</PortalButton></div>
  </form>
}

function AdminStatement({ summary, refresh, announce }: { summary: Statement; refresh: () => void; announce: (message: string) => void }) {
  const [detail, setDetail] = useState<Statement | null>(null), [loadError, setLoadError] = useState('')
  const current = detail && detail.version === summary.version ? detail : null, shown = current ?? summary
  const load = async () => {
    setLoadError('')
    try { const value = parseStatement(await apiGet<unknown>(`${ADMIN}/statements/${summary.id}`)); if (!value) throw new Error(); setDetail(value) }
    catch { setLoadError('The statement lines could not be loaded.') }
  }
  return <StatementView statement={shown} invoicePath={`${ADMIN}/statements/${summary.id}/invoice`}>
    {!current && <PortalButton type='button' onClick={() => void load()}>Show lines</PortalButton>}
    {shown.status === 'DRAFT' && shown.line_count > 0 && <Issue statement={shown} refresh={refresh} announce={announce} />}
    {loadError && <p role='alert' className='text-sm text-ink'>{loadError}</p>}
  </StatementView>
}

function Issue({ statement, refresh, announce }: { statement: Statement; refresh: () => void; announce: (message: string) => void }) {
  const [open, setOpen] = useState(false), [confirmed, setConfirmed] = useState(false), [error, setError] = useState('')
  const action = usePracticeAction(`settlement-issue:${statement.id}:${statement.version}`)
  if (!open) return <PortalButton type='button' tone='primary' onClick={() => setOpen(true)}>Issue invoice</PortalButton>
  return <div className='grid w-full gap-3 rounded-xl border border-theme bg-surface-subtle p-4'>
    <label className='flex items-start gap-3 text-sm text-ink'><input type='checkbox' className='mt-1 h-5 w-5 shrink-0' checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
      <span>I checked this statement. Issuing freezes it, assigns the next invoice number and stores the PDF.</span></label>
    {error && <p role='alert' className='text-sm text-ink'>{error}</p>}
    <ActionFeedback action={action} />
    <div className='flex flex-wrap gap-3'>
      <PortalButton type='button' tone='primary' disabled={action.busy} onClick={() => {
        if (!confirmed) { setError('Confirm that you checked the statement.'); return }
        setError('')
        void action.run(signal => apiPost(`${ADMIN}/statements/${statement.id}/issue`, {}, practiceVersion(statement.version), signal), result => {
          const saved = parseStatement(result); if (!saved || saved.status !== 'ISSUED') throw new Error('The invoice could not be confirmed. Refresh before trying again.')
          const message = `Invoice ${saved.invoice_number} issued for ${saved.period}.`
          announce(message); refresh(); return message
        })
      }}>{action.busy ? 'Issuing…' : 'Confirm and issue'}</PortalButton>
      <PortalButton type='button' onClick={() => setOpen(false)}>Cancel</PortalButton>
    </div>
  </div>
}

/** A treating entity's own invoiced statements (practice portal or doctor portal). */
export function EntityStatements({ base }: { base: string }) {
  const resource = usePortalResource<unknown>(base, false, { abortOnCleanup: true })
  const rows = useMemo(() => parseStatements(resource.data), [resource.data])
  if (!rows) return <PortalCard><PracticeReadState resource={resource} invalid={!!resource.data && !rows} /></PortalCard>
  if (!rows.length) return <PortalEmptyState title='No invoices yet' description='Qarevo invoices the platform fee monthly for consultations completed through the platform. Issued invoices appear here.' />
  return <div className='grid grid-cols-[minmax(0,1fr)] gap-6'>{rows.map(row => <EntityStatement key={row.id} base={base} summary={row} />)}</div>
}

function EntityStatement({ base, summary }: { base: string; summary: Statement }) {
  const [detail, setDetail] = useState<Statement | null>(null)
  return <StatementView statement={detail ?? summary} invoicePath={`${base}/${summary.id}/invoice`}>
    {!detail && <PortalButton type='button' onClick={async () => { const value = parseStatement(await apiGet<unknown>(`${base}/${summary.id}`).catch(() => null)); if (value) setDetail(value) }}>Show consultations</PortalButton>}
  </StatementView>
}

export function PracticeStatementsPage() {
  const resource = usePortalResource<unknown>('/api/v1/practice/workspace', false, { abortOnCleanup: true })
  const owned = useMemo(() => practiceWorkspace(resource.data)?.filter(row => row.membership.role === 'OWNER' && row.membership.status === 'ACTIVE').map(row => row.practice) ?? null, [resource.data])
  return <PracticeScope>
    <header className='mb-6'><h1 className='text-3xl font-extrabold tracking-tight text-ink'>Invoices</h1>
      <p className='mt-2 max-w-3xl text-sm leading-7 text-secondary'>Monthly invoices for Qarevo’s platform fee. You bill your patients yourself: GKV through your KV, PKV and self-pay under the GOÄ.</p></header>
    {!owned ? <PortalCard><PracticeReadState resource={resource} invalid={!!resource.data && !owned} /></PortalCard>
      : owned.map(item => <section key={item.id} aria-label={item.name} className='mb-8'>{owned.length > 1 && <h2 className='mb-3 text-2xl font-bold text-ink'>{item.name}</h2>}
        <EntityStatements base={`/api/v1/practice/practices/${item.id}/statements`} /></section>)}
  </PracticeScope>
}

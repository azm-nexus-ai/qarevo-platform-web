'use client'
import { useState } from 'react'
import { openSignedDocument } from '@/lib/open-signed-document'
import { SEGMENT_LABELS, money, preciseMoney, type Statement } from '@/lib/settlement'
import { PortalBadge, PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'

/** One statement: totals (rounded once), lines (unrounded fees) and the invoice when issued. */
export default function StatementView({ statement, invoicePath, children }: { statement: Statement; invoicePath: string | null; children?: React.ReactNode }) {
  const [error, setError] = useState('')
  const open = async () => {
    if (!invoicePath) return
    setError('')
    if (!await openSignedDocument(invoicePath)) setError('The invoice could not be opened. Retry, or contact support.')
  }
  return <PortalCard>
    <div className='flex flex-wrap items-start justify-between gap-3'>
      <div className='min-w-0'>
        <h2 className='break-words text-xl font-semibold text-ink'>{statement.practice_name ? `${statement.practice_name} · ` : ''}{statement.period}</h2>
        <p className='mt-1 text-sm text-secondary'>{statement.line_count} billable consultation{statement.line_count === 1 ? '' : 's'}{statement.invoice_number ? ` · Invoice ${statement.invoice_number}` : ''}</p>
      </div>
      <PortalBadge tone={statement.status === 'ISSUED' ? 'success' : 'info'}>{statement.status === 'ISSUED' ? 'Invoiced' : 'Draft'}</PortalBadge>
    </div>
    <dl className='mt-4 grid gap-3 text-sm sm:grid-cols-4'>
      <div><dt className='text-secondary'>Net (exact)</dt><dd className='font-semibold text-ink'>{preciseMoney(statement.net_e4, statement.currency)}</dd></div>
      <div><dt className='text-secondary'>Net (rounded)</dt><dd className='font-semibold text-ink'>{money(statement.net_minor, statement.currency)}</dd></div>
      <div><dt className='text-secondary'>VAT {statement.vat_rate_percent} %</dt><dd className='font-semibold text-ink'>{money(statement.vat_minor, statement.currency)}</dd></div>
      <div><dt className='text-secondary'>Total</dt><dd className='text-lg font-extrabold text-ink'>{money(statement.gross_minor, statement.currency)}</dd></div>
    </dl>
    <p className='mt-2 text-xs text-secondary'>Fees are summed exactly and rounded once, on the total. VAT treatment is pending tax review.</p>
    {statement.lines && statement.lines.length > 0 && <div className='mt-4 overflow-x-auto' role='region' aria-label='Statement lines' tabIndex={0}>
      <table className='w-full min-w-[560px] text-left text-sm'>
        <thead><tr className='text-secondary'><th className='py-2 pr-3 font-semibold'>Completed</th><th className='py-2 pr-3 font-semibold'>Segment</th><th className='py-2 pr-3 font-semibold'>Band</th><th className='py-2 pr-3 font-semibold'>Joint time</th><th className='py-2 font-semibold'>Fee</th></tr></thead>
        <tbody>{statement.lines.map(row => <tr key={row.consultation_id} className='border-t border-theme text-ink'>
          <td className='py-2 pr-3'>{new Date(row.completed_at).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}</td>
          <td className='py-2 pr-3'>{SEGMENT_LABELS[row.segment] ?? row.segment}</td>
          <td className='py-2 pr-3'>{row.band}</td>
          <td className='py-2 pr-3'>{Math.floor(row.joint_seconds / 60)} min {row.joint_seconds % 60} s</td>
          <td className='py-2'>{preciseMoney(row.fee_e4, statement.currency)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    <div className='mt-4 flex flex-wrap gap-3'>
      {statement.status === 'ISSUED' && invoicePath && <PortalButton type='button' onClick={() => void open()}>Open invoice PDF</PortalButton>}
      {children}
    </div>
    {error && <p role='alert' className='mt-3 text-sm text-ink'>{error}</p>}
  </PortalCard>
}

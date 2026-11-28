'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { openSignedDocument } from '@/lib/open-signed-document'
import { type Statement } from '@/lib/settlement'
import { useDates, useMoney } from '@/i18n/format'
import { PortalBadge, PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'

const SEGMENT_KEYS: Record<string, string> = { GKV_KNOWN: 'gkvKnown', GKV_UNKNOWN: 'gkvUnknown', PRIVATE: 'private' }

/** One statement: totals (rounded once), lines (unrounded fees) and the invoice when issued. */
export default function StatementView({ statement, invoicePath, children }: { statement: Statement; invoicePath: string | null; children?: React.ReactNode }) {
  const t = useTranslations('settlement.statement'), money = useMoney(), dates = useDates()
  const [error, setError] = useState('')
  const open = async () => {
    if (!invoicePath) return
    setError('')
    if (!await openSignedDocument(invoicePath)) setError(t('openFailed'))
  }
  const issued = statement.status === 'ISSUED'
  return <PortalCard>
    <div className='flex flex-wrap items-start justify-between gap-3'>
      <div className='min-w-0'>
        <h2 className='break-words text-xl font-semibold text-ink'>{statement.practice_name ? `${statement.practice_name} · ` : ''}{statement.period}</h2>
        <p className='mt-1 text-sm text-secondary'>{t('billable', { count: statement.line_count })}{statement.invoice_number ? ` · ${t('invoiceNumber', { number: statement.invoice_number })}` : ''}</p>
      </div>
      <PortalBadge tone={issued ? 'success' : 'info'}>{issued ? t('issued') : t('draft')}</PortalBadge>
    </div>
    <dl className='mt-4 grid gap-3 text-sm sm:grid-cols-4'>
      <div><dt className='text-secondary'>{t('netExact')}</dt><dd className='font-semibold text-ink'>{money.e4(statement.net_e4, statement.currency)}</dd></div>
      <div><dt className='text-secondary'>{t('netRounded')}</dt><dd className='font-semibold text-ink'>{money.minor(statement.net_minor, statement.currency)}</dd></div>
      <div><dt className='text-secondary'>{t('vat', { rate: statement.vat_rate_percent })}</dt><dd className='font-semibold text-ink'>{money.minor(statement.vat_minor, statement.currency)}</dd></div>
      <div><dt className='text-secondary'>{t('total')}</dt><dd className='text-lg font-extrabold text-ink'>{money.minor(statement.gross_minor, statement.currency)}</dd></div>
    </dl>
    <p className='mt-2 text-xs text-secondary'>{t('roundingNote')}</p>
    {statement.lines && statement.lines.length > 0 && <div className='mt-4 overflow-x-auto' role='region' aria-label={t('linesLabel')} tabIndex={0}>
      <table className='w-full min-w-[560px] text-left text-sm'>
        <thead><tr className='text-secondary'><th className='py-2 pr-3 font-semibold'>{t('completed')}</th><th className='py-2 pr-3 font-semibold'>{t('segment')}</th><th className='py-2 pr-3 font-semibold'>{t('band')}</th><th className='py-2 pr-3 font-semibold'>{t('jointTime')}</th><th className='py-2 font-semibold'>{t('fee')}</th></tr></thead>
        <tbody>{statement.lines.map(row => <tr key={row.consultation_id} className='border-t border-theme text-ink'>
          <td className='py-2 pr-3'>{dates.date(row.completed_at)}</td>
          <td className='py-2 pr-3'>{SEGMENT_KEYS[row.segment] ? t(`segments.${SEGMENT_KEYS[row.segment]}`) : row.segment}</td>
          <td className='py-2 pr-3'>{row.band}</td>
          <td className='py-2 pr-3'>{t('duration', { minutes: Math.floor(row.joint_seconds / 60), seconds: row.joint_seconds % 60 })}</td>
          <td className='py-2'>{money.e4(row.fee_e4, statement.currency)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    <div className='mt-4 flex flex-wrap gap-3'>
      {issued && invoicePath && <PortalButton type='button' onClick={() => void open()}>{t('openInvoice')}</PortalButton>}
      {children}
    </div>
    {error && <p role='alert' className='mt-3 text-sm text-ink'>{error}</p>}
  </PortalCard>
}

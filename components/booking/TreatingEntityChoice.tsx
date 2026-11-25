'use client'
import { useEffect, useId, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePortalResource } from '@/lib/use-portal-resource'
import { bookingOptions, formatMoney, type BookingEntity } from '@/lib/booking-entity'
import { PortalBadge, PortalCard } from '@/components/patient/PatientPortalPrimitives'

export type EntitySelection = { ready: boolean; treatingEntityId: string | null; confirmedFeeMinor: number | null; reason: string }
const COVERAGE_KEYS: Record<string, string> = { GKV: 'gkv', PKV: 'pkv', SELF_PAY: 'selfPay' }

/** Who treats the patient, and for self-pay at which confirmed price. Reports readiness to the booking step. */
export default function TreatingEntityChoice({ providerId, onChange }: { providerId: string; onChange: (value: EntitySelection) => void }) {
  const t = useTranslations('treatingEntityChoice'), german = useLocale().startsWith('de')
  const coverage = (code: string) => COVERAGE_KEYS[code] ? t(`coverage.${COVERAGE_KEYS[code]}`) : code
  const resource = usePortalResource<unknown>(providerId ? `/api/v1/patient/booking/options?provider_id=${encodeURIComponent(providerId)}` : null, false, { abortOnCleanup: true })
  const data = useMemo(() => bookingOptions(resource.data), [resource.data])
  const [chosen, setChosen] = useState<string | null>(null), [confirmed, setConfirmed] = useState(false)
  const group = useId()
  const entity: BookingEntity | null = data ? (data.entities.length === 1 ? data.entities[0] : data.entities.find(item => item.id === chosen) ?? null) : null
  const selfPay = data?.coverage_type === 'SELF_PAY'
  useEffect(() => {
    // The server re-checks every booking, so an unavailable options service must not block it.
    if (!data) { onChange({ ready: Boolean(resource.error), treatingEntityId: null, confirmedFeeMinor: null, reason: resource.error ? '' : t('checking') }); return }
    if (!data.verification_required) { onChange({ ready: true, treatingEntityId: null, confirmedFeeMinor: null, reason: '' }); return }
    if (!data.entities.length) { onChange({ ready: false, treatingEntityId: null, confirmedFeeMinor: null, reason: t('notForCoverage') }); return }
    if (!entity) { onChange({ ready: false, treatingEntityId: null, confirmedFeeMinor: null, reason: t('chooseEntity') }); return }
    if (selfPay && !confirmed) { onChange({ ready: false, treatingEntityId: entity.id, confirmedFeeMinor: null, reason: t('confirmPrice') }); return }
    onChange({ ready: true, treatingEntityId: entity.id, confirmedFeeMinor: selfPay ? entity.self_pay_fee_minor ?? null : null, reason: '' })
  }, [data, entity, selfPay, confirmed, resource.error, onChange, t])

  if (!data) return null
  if (!data.verification_required) return null
  return <PortalCard>
    <div className='grid gap-3' aria-live='polite'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h2 className='text-lg font-bold text-ink'>{t('title')}</h2>
        <PortalBadge tone='info'>{coverage(data.coverage_type)}</PortalBadge>
      </div>
      {!data.entities.length ? <p role='alert' className='text-sm leading-7 text-ink'>
        {t('cannotTreat', { coverage: COVERAGE_KEYS[data.coverage_type] ? (german ? coverage(data.coverage_type) : coverage(data.coverage_type).toLowerCase()) : t('coverageFallback') })}
      </p> : data.entities.length > 1 ? <fieldset className='grid gap-2'>
        <legend className='mb-1 text-sm font-semibold text-ink'>{t('chooseOne')}</legend>
        {data.entities.map(item => <label key={item.id} className='flex min-w-0 items-start gap-3 rounded-xl border border-theme bg-surface p-3 text-sm text-ink'>
          <input type='radio' name={group} value={item.id} checked={chosen === item.id} onChange={() => { setChosen(item.id); setConfirmed(false) }} className='mt-1 h-5 w-5 shrink-0' />
          <span className='min-w-0 break-words'><strong>{item.name}</strong>{item.city ? ` · ${item.city}` : ''}{selfPay && item.self_pay_fee_minor ? ` · ${formatMoney(item.self_pay_fee_minor, item.currency)}` : ''}</span>
        </label>)}
      </fieldset> : <p className='text-sm leading-7 text-ink'>
        <strong>{data.entities[0].name}</strong>{data.entities[0].city ? `, ${data.entities[0].city}` : ''} — {t('singleKind', { kind: t(data.entities[0].entity_type === 'INDEPENDENT' ? 'kindIndependent' : 'kindPractice') })}
      </p>}
      {entity && selfPay && entity.self_pay_fee_minor != null && <div className='grid gap-2 rounded-xl border border-theme bg-surface-subtle p-4'>
        <p className='text-sm text-secondary'>{t('selfPayPrice')}</p>
        <p className='text-2xl font-extrabold text-ink'>{formatMoney(entity.self_pay_fee_minor, entity.currency)}</p>
        <p className='text-xs leading-6 text-secondary'>{entity.self_pay_fee_is_reference ? t('referencePrice') : t('practicePrice')}{entity.self_pay_fee_basis ? `: ${entity.self_pay_fee_basis}` : ''}. {t('invoiceNote')}</p>
        <label className='mt-1 flex items-start gap-3 text-sm text-ink'>
          <input type='checkbox' checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className='mt-1 h-5 w-5 shrink-0' />
          <span>{t('confirmPay', { amount: formatMoney(entity.self_pay_fee_minor, entity.currency) })}</span>
        </label>
      </div>}
    </div>
  </PortalCard>
}

'use client'
import { useTranslations } from 'next-intl'
import ClinicalStatusBadge from '@/components/ui/ClinicalStatusBadge'
import { PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import { qualityKeys, type MedicationInstruction, type CareInstruction, type ClinicalQuality } from '@/lib/clinical-instructions'

function Quality({ quality }: { quality: ClinicalQuality }) {
  const t = useTranslations('instructionRecords')
  const describe = (warning: { field: string; code: string }) => { const keys = qualityKeys(warning); return t('quality.line', { field: t(`quality.field.${keys.field}`), problem: t(`quality.problem.${keys.problem}`) }) }
  return quality.reviewNeeded ? <aside aria-label={t('recordQuality')} className='mt-4 rounded-xl border border-theme bg-surface-subtle p-4'><p className='font-semibold text-ink'>{t('reviewNeeded')}</p>{quality.warnings.length ? <ul className='mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-secondary'>{quality.warnings.map((warning, index) => <li key={`${warning.field}:${warning.code}:${index}`}>{describe(warning)}</li>)}</ul> : <p className='mt-2 text-sm text-secondary'>{t('unconfirmedFields')}</p>}</aside> : null
}
function Value({ label, value }: { label: string; value: string | null }) { const t = useTranslations('instructionRecords'); return <div><dt className='text-sm font-semibold text-secondary'>{label}</dt><dd className='mt-1 whitespace-pre-wrap break-words text-ink' style={{ overflowWrap: 'anywhere' }}>{value?.trim() ? value : t('notRecorded')}</dd></div> }
export function MedicationRecordCard({ medication, onDelete, busy = false, actionsAvailable = true }: { medication: MedicationInstruction; onDelete?: () => void; busy?: boolean; actionsAvailable?: boolean }) {
  const t = useTranslations('instructionRecords')
  return <PortalCard role='article' aria-label={t('medicationInstructions')}><div className='flex flex-wrap items-start justify-between gap-3'><div><h3 className='portal-h3'>{medication.name?.trim() || t('nameMissing')}</h3><ClinicalStatusBadge status={medication.status} domain='medication' /></div>{onDelete && <PortalButton tone='danger' disabled={busy || !medication.id || !actionsAvailable} onClick={onDelete}>{t('delete')}</PortalButton>}</div>
    <dl className='mt-5 grid gap-4 sm:grid-cols-2'>{[[t('brand'), medication.brand], [t('strength'), medication.strength], [t('dosage'), medication.dosage], [t('frequency'), medication.frequency], [t('duration'), medication.duration], [t('clinicianInstructions'), medication.instructions], [t('food'), medication.food], [t('refill'), medication.refill]].map(([label, value]) => <Value key={label!} label={label!} value={value} />)}<Value label={t('schedule')} value={medication.quality.scheduleState === 'unavailable' ? t('scheduleUnavailable') : medication.times.length ? medication.times.map(time => ['Morning', 'Afternoon', 'Evening', 'Night'].includes(time) ? t(`daypart.${time}`) : time).join(', ') : null} /></dl>
    {medication.takenToday && <p className='mt-4 text-sm leading-7 text-secondary'>{t('takenToday', { detail: medication.recordedOn && medication.timeZone ? t('reportedFor', { date: medication.recordedOn, zone: medication.timeZone }) : medication.reportedAt ? t('reportedAt', { time: new Date(medication.reportedAt).toISOString() }) : '' })}</p>}
    <Quality quality={medication.quality} />{onDelete && !medication.id && <p className='mt-3 text-sm text-secondary'>{t('deleteUnavailable')}</p>}
  </PortalCard>
}
export function CarePlanRecordCard({ plan, onDelete, busy = false, actionsAvailable = true }: { plan: CareInstruction; onDelete?: () => void; busy?: boolean; actionsAvailable?: boolean }) {
  const t = useTranslations('instructionRecords')
  return <PortalCard role='article' aria-label={t('carePlan')}><div className='flex flex-wrap items-start justify-between gap-3'><div><h3 className='portal-h3'>{plan.title?.trim() || t('carePlanTitleMissing')}</h3><ClinicalStatusBadge status={plan.status} domain='care-plan' /></div>{onDelete && <PortalButton tone='danger' disabled={busy || !plan.id || !actionsAvailable} onClick={onDelete}>{t('delete')}</PortalButton>}</div><dl className='mt-5 grid gap-4'><Value label={t('planDetails')} value={plan.description} /><Value label={t('recordedProgress')} value={plan.progress === null ? null : `${plan.progress}%`} /></dl>{plan.progress !== null && <progress aria-label={t('recordedProgress')} value={plan.progress} max={100} className='mt-4 w-full' />}<Quality quality={plan.quality} /></PortalCard>
}

import { useLocale, useTranslations } from 'next-intl'
import { labResultHasNoCurrentFile, labResultReview } from '@/lib/lab-result-review'
export default function LabResultReviewStatus({ review, fileId }: { review: unknown; fileId: unknown }) {
  const t = useTranslations('labReviewStatus'), dateLocale = useLocale().startsWith('de') ? 'de-DE' : undefined
  const result = labResultReview(review, fileId)
  if (labResultHasNoCurrentFile(review, fileId)) return <section aria-label={t('label')} className='rounded-xl border border-theme bg-surface-subtle p-3 text-sm leading-7'><p className='font-semibold text-ink'>{t('noFile')}</p><p className='text-secondary'>{t('noFileText')}</p></section>
  return <section aria-label={t('label')} className='rounded-xl border border-theme bg-surface-subtle p-3 text-sm leading-7'><p className='font-semibold text-ink'>{result.state === 'acknowledged' ? t('recorded') : result.state === 'pending' ? t('notRecorded') : t('unavailable')}</p>{result.state === 'acknowledged' ? <p className='text-secondary'>{result.reviewerName || t('clinicianMissing')} · <time dateTime={result.reviewedAt!}>{new Date(result.reviewedAt!).toLocaleString(dateLocale)}</time>. {t('recordsReviewOnly')}</p> : <p className='text-secondary'>{result.state === 'pending' ? t('note') : t('unconfirmed')}</p>}</section>
}

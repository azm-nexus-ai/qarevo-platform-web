'use client'

import { useTranslations } from 'next-intl'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import FeatureAvailability from '@/components/ui/FeatureAvailability'

/**
 * Consultation feedback cannot be saved yet: the API answers 501. The page says so
 * plainly instead of showing a pre-filled form that only appeared to submit.
 */
export default function FeedbackPage() {
  const t = useTranslations('patientFeedback')
  return (
    <PatientPortalShell eyebrow={t('eyebrow')} title={t('title')} description={t('description')}>
      <FeatureAvailability
        title={t('unavailableTitle')}
        description={t('unavailableText')}
        actions={[{ href: '/patient/appointments', label: t('toAppointments') }, { href: '/patient/messages', label: t('toMessages') }]}
      />
    </PatientPortalShell>
  )
}

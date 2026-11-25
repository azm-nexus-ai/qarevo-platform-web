'use client'

import { useTranslations } from 'next-intl'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalCard } from '@/components/patient/PatientPortalPrimitives'
import PatientNotifications from '@/components/notifications/PatientNotifications'

export default function PatientNotificationsPage() {
  const t = useTranslations('patientPages')
  return <PatientPortalShell title={t('notificationsTitle')} description={t('notificationsDescription')}><PortalCard><PatientNotifications /></PortalCard></PatientPortalShell>
}

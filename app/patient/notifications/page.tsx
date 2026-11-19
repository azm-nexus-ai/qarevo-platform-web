'use client'

import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalCard } from '@/components/patient/PatientPortalPrimitives'
import PatientNotifications from '@/components/notifications/PatientNotifications'

export default function PatientNotificationsPage() {
  return <PatientPortalShell title='Notifications' description='Read account and care updates, open the related record, and manage your read receipts.'><PortalCard><PatientNotifications /></PortalCard></PatientPortalShell>
}

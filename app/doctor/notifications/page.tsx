'use client'

import DoctorLabNotifications from '@/components/notifications/DoctorLabNotifications'

export default function DoctorNotificationsPage() {
  return <div className='space-y-6'><header><h1 className='text-2xl font-bold text-ink'>Notifications</h1><p className='mt-2 text-sm leading-7 text-secondary'>Track result uploads for the lab requests you ordered.</p></header><DoctorLabNotifications /></div>
}

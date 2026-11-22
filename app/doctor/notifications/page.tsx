'use client'

import { useTranslations } from 'next-intl'
import DoctorLabNotifications from '@/components/notifications/DoctorLabNotifications'
import NotificationsPage from '@/components/notifications/NotificationsPage'

export default function DoctorNotificationsPage() {
  const t = useTranslations('notifications')
  return <NotificationsPage>
    <section aria-labelledby='doctor-lab-uploads' className='space-y-3'>
      <h2 id='doctor-lab-uploads' className='text-lg font-bold text-ink'>{t('labUploadsTitle')}</h2>
      <p className='text-sm leading-7 text-secondary'>{t('labUploadsIntro')}</p>
      <DoctorLabNotifications />
    </section>
  </NotificationsPage>
}

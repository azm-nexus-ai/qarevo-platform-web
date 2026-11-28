'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { NotificationInbox } from './NotificationCenter'

/** Full notification page used by the doctor, admin and practice portals. */
export default function NotificationsPage({ children }: { children?: ReactNode }) {
  const t = useTranslations('notifications')
  return <div className='space-y-6'>
    <header>
      <h1 className='text-2xl font-bold text-ink'>{t('title')}</h1>
      <p className='mt-2 max-w-3xl text-sm leading-7 text-secondary'>{t('pageIntro')}</p>
    </header>
    <NotificationInbox />
    {children}
  </div>
}

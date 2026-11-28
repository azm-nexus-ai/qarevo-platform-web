'use client'

import Link from 'next/link'
import RoleHomeLink from '@/components/branding/RoleHomeLink'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowUpRight } from 'lucide-react'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import { useTheme } from '@/components/ui/ThemeProvider'
import { themeKey } from '@/lib/theme'
import { currentPortal } from '@/lib/portal-scope'
import { usePortalRole } from '@/lib/portal-navigation'
import { SIDEBAR_PREFERENCE_CHANGED } from '@/components/layout/SidebarToggle'

const LINKS = [
  ['linkImpressum', '/impressum'], ['linkPrivacy', '/privacy'], ['linkTerms', '/terms'],
  ['linkCookies', '/cookies'], ['linkSupport', '/support'],
] as const

// Company-owned profiles confirmed by the product owner on 3 November 2026.
const SOCIAL_LINKS = [
  ['Instagram', 'https://www.instagram.com/qarevo_health/'],
  ['X', 'https://x.com/qarevohealth'],
  ['LinkedIn', 'https://www.linkedin.com/company/qarevo-health-gmbh/posts/'],
  ['TikTok', 'https://www.tiktok.com/@qarevohealth'],
] as const

export default function Footer() {
  const t = useTranslations('footer')
  const path = usePathname()
  const role = usePortalRole()
  const portal = ['patient', 'doctor', 'admin', 'practice'].includes(path.split('/')[1]) ? path.split('/')[1] : role
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const { setTheme } = useTheme()
  const [message, setMessage] = useState('')
  function resetAppearance() {
    let persisted = true
    const activePortal = currentPortal()
    setTheme('light')
    try { localStorage.removeItem(themeKey(activePortal)) } catch { persisted = false }
    for (const role of activePortal === 'patient' ? ['patient', 'patient-right'] : [activePortal]) {
      document.documentElement.setAttribute(`data-${role}-sidebar`, 'expanded')
      try { localStorage.removeItem(`qarevo.sidebar.${role}`) } catch { persisted = false }
    }
    window.dispatchEvent(new Event(SIDEBAR_PREFERENCE_CHANGED))
    setMessage(persisted ? t('thisPortalSAppearancePreferences') : t('appearanceResetForThisPage'))
  }
  return <footer className='corporate-footer' data-portal-footer={portal}>
    <div className='corporate-footer-content'>
      <div className='corporate-footer-brand'>
        <RoleHomeLink aria-label={t('qarevoHealthHome')}><AuthenticatedLogo width={142} /></RoleHomeLink>
        <p>{t('connectingPatientsAndIndependentPractices')}</p>
        <span className='corporate-footer-preview'>{t('developmentPreviewSyntheticTestData')}</span>
        <nav aria-label={t('qarevoHealthSocialProfiles')}>
          {SOCIAL_LINKS.map(([label, href]) => <a key={href} href={href} target='_blank' rel='noopener noreferrer' aria-label={t('opensNewTab', { label })} className='gap-1.5'>
            {label}<ArrowUpRight size={14} aria-hidden='true' />
          </a>)}
        </nav>
      </div>
      <nav aria-label={t('legalAndSupport')}>
        {LINKS.map(([label, href]) => <Link href={href} key={href}>{t(label)}</Link>)}
        <button ref={trigger} type='button' onClick={() => { setMessage(''); dialog.current?.showModal() }}>{t('cookiePreferences')}</button>
      </nav>
      <p className='corporate-footer-copyright'>{t('copyright', { year: new Date().getFullYear() })}</p>
    </div>
    <dialog ref={dialog} aria-labelledby='cookie-preferences-title' className='preferences-dialog' onClose={() => trigger.current?.focus()}>
      <h2 id='cookie-preferences-title'>{t('cookieStoragePreferences')}</h2>
      <p>{t('theseControlsManageThisPortal')}</p>
      <p>{t('signInSecurityAndAccount')}</p>
      <p>{t('noticeUnderReview')} <Link href='/cookies' onClick={() => dialog.current?.close()}>{t('readTheCurrentStatus')}</Link>.</p>
      {message && <p role='status'>{message}</p>}
      <div className='preferences-dialog-actions'>
        <button type='button' className='theme-toggle' onClick={resetAppearance}>{t('clearAppearancePreferences')}</button>
        <form method='dialog'><button className='theme-toggle' autoFocus>{t('closePreferences')}</button></form>
      </div>
    </dialog>
  </footer>
}

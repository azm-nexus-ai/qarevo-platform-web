'use client'

import Link from 'next/link'
import RoleHomeLink from '@/components/branding/RoleHomeLink'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import { useTheme } from '@/components/ui/ThemeProvider'
import { themeKey } from '@/lib/theme'
import { currentPortal } from '@/lib/portal-scope'
import { usePortalRole } from '@/lib/portal-navigation'
import { SIDEBAR_PREFERENCE_CHANGED } from '@/components/layout/SidebarToggle'

const LINKS = [
  ['Impressum', '/impressum'], ['Privacy', '/privacy'], ['Patient terms', '/terms'],
  ['Cookie information', '/cookies'], ['Support', '/support'],
] as const

// Company-owned profiles confirmed by the product owner on 3 November 2026.
const SOCIAL_LINKS = [
  ['Instagram', 'https://www.instagram.com/qarevo_health/'],
  ['X', 'https://x.com/qarevohealth'],
  ['LinkedIn', 'https://www.linkedin.com/company/qarevo-health-gmbh/posts/'],
  ['TikTok', 'https://www.tiktok.com/@qarevohealth'],
] as const

export default function Footer() {
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
    setMessage(persisted ? 'This portal’s appearance preferences were cleared. Your other portals, account and sign-in are unchanged.' : 'Appearance reset for this page. Browser storage could not be updated.')
  }
  return <footer className='corporate-footer' data-portal-footer={portal}>
    <div className='corporate-footer-content'>
      <div className='corporate-footer-brand'>
        <RoleHomeLink aria-label='Qarevo Health home'><AuthenticatedLogo width={142} /></RoleHomeLink>
        <p>Connecting patients and independent practices through clinician-led digital care.</p>
        <span className='corporate-footer-preview'>Development preview · Synthetic test data only</span>
        <nav aria-label='Qarevo Health social profiles'>
          {SOCIAL_LINKS.map(([label, href]) => <a key={href} href={href} target='_blank' rel='noopener noreferrer' aria-label={`${label} (opens in a new tab)`} className='gap-1.5'>
            {label}<ArrowUpRight size={14} aria-hidden='true' />
          </a>)}
        </nav>
      </div>
      <nav aria-label='Legal and support'>
        {LINKS.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
        <button ref={trigger} type='button' onClick={() => { setMessage(''); dialog.current?.showModal() }}>Cookie preferences</button>
      </nav>
      <p className='corporate-footer-copyright'>© {new Date().getFullYear()} Qarevo Health. All rights reserved.</p>
    </div>
    <dialog ref={dialog} aria-labelledby='cookie-preferences-title' className='preferences-dialog' onClose={() => trigger.current?.focus()}>
      <h2 id='cookie-preferences-title'>Cookie & storage preferences</h2>
      <p>These controls manage this portal’s theme and sidebar layout in this browser. Other portals keep their own appearance preferences.</p>
      <p>Sign-in, security and account-specific working data are managed separately. Clearing appearance preferences does not sign you out or delete your profile.</p>
      <p>The complete cookie and storage notice remains under review. <Link href='/cookies' onClick={() => dialog.current?.close()}>Read the current status</Link>.</p>
      {message && <p role='status'>{message}</p>}
      <div className='preferences-dialog-actions'>
        <button type='button' className='theme-toggle' onClick={resetAppearance}>Clear appearance preferences</button>
        <form method='dialog'><button className='theme-toggle' autoFocus>Close preferences</button></form>
      </div>
    </dialog>
  </footer>
}

'use client'

import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/ThemeProvider'
import { usePathname } from 'next/navigation'
import { ADMIN_ROUTES, ADMIN_SIDEBAR_ITEMS, isAdminNavActive } from '@/constants/admin-navigation'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'

export default function AdminMobileNavigation({ onSignOut }: { onSignOut: () => void }) {
  const pathname = usePathname()
  return <div className="admin-mobile-navigation">
    <Link href={ADMIN_ROUTES.dashboard} aria-label="Admin dashboard"><AuthenticatedLogo width={100} /></Link>
    <ThemeToggle />
    <details key={pathname} onKeyDown={event => {
      if (event.key === 'Escape') {
        event.currentTarget.open = false
        event.currentTarget.querySelector('summary')?.focus()
      }
    }}>
      <summary>Admin menu</summary>
      <nav aria-label="Admin mobile navigation">
        {ADMIN_SIDEBAR_ITEMS.filter(item => item.href !== ADMIN_ROUTES.logout).map(item =>
          <Link key={item.href} href={item.href} aria-current={isAdminNavActive(pathname, item.href) ? 'page' : undefined}>{item.label}</Link>)}
        <button type="button" onClick={onSignOut}>Sign out</button>
      </nav>
    </details>
  </div>
}

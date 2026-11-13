'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { logoutCurrentUser } from '@/lib/api'
import RoleHomeLink from '@/components/branding/RoleHomeLink'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import ProfileAvatar from '@/components/branding/ProfileAvatar'
import PortalAccountMenu from '@/components/layout/PortalAccountMenu'
import SidebarToggle from '@/components/layout/SidebarToggle'
import { ThemeToggle } from '@/components/ui/ThemeProvider'
import { PortalButton } from '@/components/patient/PatientPortalPrimitives'

const items = [['Practice workspace', '/practice/dashboard'], ['Settings and security', '/practice/settings'], ['Help and support', '/support']] as const
export default function PracticeLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname(), router = useRouter(), [ending, setEnding] = useState(false), [error, setError] = useState('')
  const links = items.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} className={'rounded-xl px-3 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ' + (pathname === href ? 'bg-surface-subtle text-ink' : 'text-secondary hover:bg-surface-subtle')}>{label}</Link>)
  return <div className='practice-shell min-h-dvh bg-page text-ink'>
    <style>{`.practice-header{position:sticky;top:0;z-index:20;background:var(--surface-glass);backdrop-filter:blur(22px);border-bottom:1px solid var(--border)}.practice-body{display:flex;gap:24px;max-width:1600px;margin:auto}.practice-sidebar{width:240px;flex-shrink:0;align-self:flex-start;position:sticky;top:104px;padding:24px 12px;max-height:calc(100dvh - 104px);overflow-y:auto}.practice-main{flex:1;min-width:0;padding:28px 24px 48px}.practice-mobile-nav{display:none}html[data-practice-sidebar=collapsed] .practice-sidebar{display:none}@media(max-width:920px){.practice-sidebar,.practice-shell .sidebar-toggle{display:none}.practice-mobile-nav{display:flex}.practice-main{padding:24px 16px 40px}.practice-header .practice-account{display:none}}`}</style>
    <header className='practice-header' aria-label='Practice main navigation'><div className='mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-4 sm:px-6'>
      <RoleHomeLink aria-label='Qarevo Health practice dashboard' className='shrink-0'><AuthenticatedLogo width={156} /></RoleHomeLink><SidebarToggle role='practice' />
      <span className='mr-auto text-sm font-semibold text-secondary'>Practice administration</span><ThemeToggle />
      <div className='practice-account'><PortalAccountMenu portal='practice' name='Practice account' description='Administrative access' avatar={<ProfileAvatar name='Practice account' kind='practice' size={36} />} profileHref='/practice/dashboard' settingsHref='/practice/settings' /></div>
      <PortalButton type='button' disabled={ending} onClick={async () => { if (ending) return; setEnding(true); setError(''); try { await logoutCurrentUser(); router.replace('/auth/practice/login') } catch { setError('Server sign-out could not be confirmed. This browser’s practice access is closed; sign in again if needed.'); router.replace('/auth/practice/login') } }}>{ending ? 'Signing out…' : 'Sign out'}</PortalButton>
    </div><nav aria-label='Practice mobile navigation' className='practice-mobile-nav flex-wrap gap-1 border-t border-theme px-2 py-2'>{links}</nav></header>
    <div className='practice-body'><aside id='practice-primary-sidebar' className='practice-sidebar'><nav aria-label='Practice navigation' className='grid gap-2'>{links}</nav><p className='mt-6 px-3 text-xs leading-6 text-secondary'>Practice administration remains separate from patient care and platform oversight.</p></aside>
      <main className='practice-main'>{error && <p role='alert' className='mb-5 rounded-xl border border-theme p-4 text-sm'>{error}</p>}{children}</main></div>
  </div>
}

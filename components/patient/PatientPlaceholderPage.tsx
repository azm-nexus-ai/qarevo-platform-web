'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NavigationBar from '@/components/layout/NavigationBar'
import Ico from '@/components/ui/Ico'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import { T, Sh, PAGE_BG } from '@/lib/tokens'
import { PATIENT_SIDEBAR_ITEMS, PATIENT_ROUTES, isPatientNavActive } from '@/constants/patient-navigation'

type Props = {
  title: string
  description: string
}

export default function PatientPlaceholderPage({ title, description }: Props) {
  const pathname = usePathname()

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, position: 'relative' }}>
      <NavigationBar />
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '18px', display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: '18px' }}>
        <aside>
          <div style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: Sh.float, padding: '16px' }}>
            <div style={{ marginBottom: '18px' }}>
              <Link href='/' aria-label='Qarevo Health home' style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                <AuthenticatedLogo priority />
              </Link>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {PATIENT_SIDEBAR_ITEMS.map((item) => {
                const isActive = isPatientNavActive(pathname, item.href)
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    style={{
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 10px',
                      borderRadius: '11px',
                      background: isActive ? 'rgba(32,181,223,0.14)' : 'transparent',
                      color: isActive ? T.blue : T.slate,
                      fontSize: '13px',
                      fontWeight: isActive ? 700 : 500,
                    }}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Ico p={item.icon} size={15} sw={1.7} color={isActive ? T.blue : T.slate2} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${T.borderFaint}` }}>
              <Link href={PATIENT_ROUTES.logout} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '11px', textDecoration: 'none', color: '#348CEA', fontSize: '13px', fontWeight: 600 }}>
                Logout
              </Link>
            </div>
          </div>
        </aside>

        <section style={{ background: 'rgba(255,255,255,0.88)', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: Sh.float, padding: '24px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#348CEA' }}>Patient Platform</p>
          <h1 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>{title}</h1>
          <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.7, maxWidth: '720px' }}>{description}</p>
        </section>
      </div>
    </main>
  )
}

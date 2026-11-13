'use client'
import type { ReactNode } from 'react'
import Link from 'next/link'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { usePortalHome, usePortalRole } from '@/lib/portal-navigation'
export default function SupportContentShell({ title, children }: { title: string; children: ReactNode }) {
  const role = usePortalRole()
  const home = usePortalHome()
  const back = <Link href={home} className='theme-toggle' style={{textDecoration:'none',width:'fit-content'}}>{role ? `Return to ${role === 'doctor' ? 'doctor' : role} dashboard` : 'Return to home'}</Link>
  if (role === 'patient') return <PatientPortalShell title={title} description='Find guidance and return to your care workspace.' headerActions={back}>{children}</PatientPortalShell>
  return <main style={{maxWidth:1100,margin:'0 auto',padding:'clamp(16px,4vw,32px)',color:'var(--text)'}}><header style={{display:'flex',flexWrap:'wrap',gap:16,alignItems:'center',justifyContent:'space-between',marginBottom:24}}><h1 style={{fontSize:'clamp(24px,4vw,32px)',fontWeight:700}}>{title}</h1>{back}</header>{children}</main>
}

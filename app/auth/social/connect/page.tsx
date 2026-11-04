'use client'
import { useState } from 'react'
import Link from 'next/link'
import SocialSignInButtons from '@/components/auth/SocialSignInButtons'
import { usePortalRole } from '@/lib/portal-navigation'

export default function ConnectProvider(){
  const current = usePortalRole()
  const role = current === 'patient' ? 'PATIENT' : current === 'doctor' ? 'PROVIDER' : null
  const [password,setPassword]=useState('')
  return <main style={{maxWidth:560,margin:'60px auto',padding:24,color:'var(--text)'}}><h1>Connect a sign-in provider</h1><p>Sign in to your existing Qarevo account, then confirm your current password before connecting Google or Apple. Matching email addresses are never linked automatically.</p>
    {role?<><label htmlFor='link-password'>Current password (Required)</label><input id='link-password' type='password' autoComplete='current-password' required maxLength={128} value={password} onChange={event=>setPassword(event.target.value)} style={{width:'100%',minHeight:44,padding:12,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)',borderRadius:10}}/><SocialSignInButtons portal={role} currentPassword={password}/><Link href={role==='PROVIDER'?'/doctor/settings':'/patient/settings'}>Return to account settings</Link></>:<nav><Link href='/auth/sign-in'>Patient sign-in</Link> · <Link href='/auth/doctor/login'>Clinician sign-in</Link></nav>}
  </main>
}

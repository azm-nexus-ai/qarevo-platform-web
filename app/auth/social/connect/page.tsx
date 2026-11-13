'use client'
import { useState } from 'react'
import SocialSignInButtons from '@/components/auth/SocialSignInButtons'
import PasswordField from '@/components/security/PasswordField'
import ActionLink from '@/components/ui/ActionLink'
import { usePortalRole } from '@/lib/portal-navigation'
import styles from './ConnectProvider.module.css'

export default function ConnectProvider() {
  const current = usePortalRole()
  const role = current === 'patient' ? 'PATIENT' : current === 'doctor' ? 'PROVIDER' : null
  const [password, setPassword] = useState('')
  return <main className={styles.page}>
    <section className={styles.card} aria-labelledby='connect-provider-title'>
      <header><p className={styles.eyebrow}>Account connections</p><h1 id='connect-provider-title' className={styles.title}>Connect a sign-in provider</h1><p className={styles.description}>Use Google or Apple to sign in to your existing Qarevo Health account. Confirm your current password before connecting a provider.</p></header>
      {role ? <>
        <PasswordField label='Current password' value={password} onChange={setPassword} autoComplete='current-password' hint='Your password confirms ownership of this Qarevo account. It is never shared with Google or Apple.'/>
        <SocialSignInButtons portal={role} currentPassword={password}/>
        <p className={styles.note}>Matching email addresses never connect accounts automatically. Your portal role and required verification continue to apply.</p>
        <div className={styles.actions}><ActionLink href={role === 'PROVIDER' ? '/doctor/settings' : '/patient/settings'}>Return to account settings</ActionLink></div>
      </> : <>
        <p className={styles.note}>Sign in to your patient or physician account first to manage its connected providers.</p>
        <nav aria-label='Sign in before connecting a provider' className={styles.actions}><ActionLink href='/auth/sign-in'>Patient sign-in</ActionLink><ActionLink href='/auth/doctor/login'>Physician sign-in</ActionLink></nav>
      </>}
    </section>
  </main>
}

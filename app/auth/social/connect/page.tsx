'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import SocialSignInButtons from '@/components/auth/SocialSignInButtons'
import PasswordField from '@/components/security/PasswordField'
import ActionLink from '@/components/ui/ActionLink'
import { usePortalRole } from '@/lib/portal-navigation'
import styles from './ConnectProvider.module.css'

export default function ConnectProvider() {
  const t = useTranslations('auth')
  const current = usePortalRole()
  const role = current === 'patient' ? 'PATIENT' : current === 'doctor' ? 'PROVIDER' : null
  const [password, setPassword] = useState('')
  return <main className={styles.page}>
    <section className={styles.card} aria-labelledby='connect-provider-title'>
      <header><p className={styles.eyebrow}>{t('socialConnect.accountConnections')}</p><h1 id='connect-provider-title' className={styles.title}>{t('socialConnect.connectASignInProvider')}</h1><p className={styles.description}>{t('socialConnect.useGoogleOrAppleTo')}</p></header>
      {role ? <>
        <PasswordField label={t('socialConnect.currentPassword')} value={password} onChange={setPassword} autoComplete='current-password' hint={t('socialConnect.yourPasswordConfirmsOwnershipOf')}/>
        <SocialSignInButtons portal={role} currentPassword={password}/>
        <p className={styles.note}>{t('socialConnect.matchingEmailAddressesNeverConnect')}</p>
        <div className={styles.actions}><ActionLink href={role === 'PROVIDER' ? '/doctor/settings' : '/patient/settings'}>{t('socialConnect.returnToAccountSettings')}</ActionLink></div>
      </> : <>
        <p className={styles.note}>{t('socialConnect.signInToYourPatient')}</p>
        <nav aria-label={t('socialConnect.signInBeforeConnectingA')} className={styles.actions}><ActionLink href='/auth/sign-in'>{t('socialConnect.patientSignIn')}</ActionLink><ActionLink href='/auth/doctor/login'>{t('socialConnect.physicianSignIn')}</ActionLink></nav>
      </>}
    </section>
  </main>
}

'use client'
import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { portalSignInHref, type PatientDoctorPortal, type PortalHandoff } from '@/lib/portal-handoff'
import styles from './SignInAccess.module.css'

export function WrongPortalNotice({ handoff }: { handoff: PortalHandoff }) {
  const t = useTranslations('portalSignIn')
  return <div className={styles.handoff} role='alert'>
    <p>{t(handoff.portal === 'PROVIDER' ? 'wrongPortalProvider' : 'wrongPortalPatient')} {t('useDedicated')}</p>
    <Link href={handoff.href} className='q-button q-button-secondary'>{t(handoff.portal === 'PROVIDER' ? 'continueProvider' : 'continuePatient')}</Link>
  </div>
}

const subscribe = (update: () => void) => { window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update) }
const search = () => window.location.search

export default function PortalSignInReference({ portal }: { portal: PatientDoctorPortal }) {
  const t = useTranslations('portalSignIn')
  const destination = portal === 'PATIENT' ? 'PROVIDER' : 'PATIENT'
  // A supplied cross-role destination may be useful on this secondary sign-in link.
  const query = useSyncExternalStore(subscribe, search, () => '')
  const next = new URLSearchParams(query).get('next')
  return <nav className={styles.reference} aria-label={t('otherSignInPortal')}>
    <span>{destination === 'PROVIDER' ? t('areYouAPhysician') : t('lookingForPatientCare')}</span>
    <Link href={portalSignInHref(destination, next)}>{destination === 'PROVIDER' ? t('physicianSignIn') : t('patientSignIn')}<span aria-hidden='true'> ↗</span></Link>
  </nav>
}

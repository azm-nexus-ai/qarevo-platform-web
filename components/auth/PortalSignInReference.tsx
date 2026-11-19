'use client'
import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { portalSignInHref, type PatientDoctorPortal, type PortalHandoff } from '@/lib/portal-handoff'
import styles from './SignInAccess.module.css'

export function WrongPortalNotice({ handoff }: { handoff: PortalHandoff }) {
  return <div className={styles.handoff} role='alert'>
    <p>{handoff.message} Use its dedicated sign-in page to continue securely.</p>
    <Link href={handoff.href} className='q-button q-button-secondary'>{handoff.label}</Link>
  </div>
}

const subscribe = (update: () => void) => { window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update) }
const search = () => window.location.search

export default function PortalSignInReference({ portal }: { portal: PatientDoctorPortal }) {
  const destination = portal === 'PATIENT' ? 'PROVIDER' : 'PATIENT'
  // A supplied cross-role destination may be useful on this secondary sign-in link.
  const query = useSyncExternalStore(subscribe, search, () => '')
  const next = new URLSearchParams(query).get('next')
  return <nav className={styles.reference} aria-label='Other sign-in portal'>
    <span>{destination === 'PROVIDER' ? 'Are you a physician?' : 'Looking for patient care?'}</span>
    <Link href={portalSignInHref(destination, next)}>{destination === 'PROVIDER' ? 'Physician sign-in' : 'Patient sign-in'}<span aria-hidden='true'> ↗</span></Link>
  </nav>
}

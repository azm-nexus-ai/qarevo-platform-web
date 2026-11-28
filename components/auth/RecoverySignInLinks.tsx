import { useTranslations } from 'next-intl'
import Link from 'next/link'

/** Recovery does not infer or disclose the account's role. */
export default function RecoverySignInLinks() {
  const t = useTranslations('portalSignIn')
  return <nav aria-label={t('chooseYourSignInPortal')} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 16px', marginTop: 24 }}>
    {[
      [t('patientSignIn'), '/auth/sign-in'],
      [t('clinicianSignIn'), '/auth/doctor/login'],
      [t('administratorSignIn'), '/auth/admin/login'],
    ].map(([label, href]) => <Link key={href} href={href} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: 'var(--link)', fontSize: 14, fontWeight: 600 }}>{label}</Link>)}
  </nav>
}

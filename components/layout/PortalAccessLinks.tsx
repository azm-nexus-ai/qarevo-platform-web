import { useTranslations } from 'next-intl'
import Link from 'next/link'
export default function PortalAccessLinks() {
  const t = useTranslations('portalAccess')
  return <details className='portal-access-links'><summary>{t('otherPortals')}</summary><nav aria-label={t('otherPortalSignIn')}><p>{t('eachPortalVerifiesItsOwn')}</p><Link href='/auth/sign-in'>{t('patientPortalSignIn')}</Link><Link href='/auth/doctor/login'>{t('doctorPortalSignIn')}</Link><Link href='/auth/practice/login'>{t('practicePortalSignIn')}</Link></nav></details>
}

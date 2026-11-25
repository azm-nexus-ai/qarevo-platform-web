import { useTranslations } from 'next-intl'
import styles from './SignInAccess.module.css'

/** Keep sign-in guidance accurate when the API's session durations change. */
export default function SessionPolicyHint() {
  const t = useTranslations('sessionPolicy')
  return <p className={styles.policy}>
    {t('forYourSecuritySessionsExpire')}
  </p>
}

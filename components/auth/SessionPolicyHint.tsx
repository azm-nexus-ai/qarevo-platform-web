import styles from './SignInAccess.module.css'

/** Keep sign-in guidance accurate when the API's session durations change. */
export default function SessionPolicyHint() {
  return <p className={styles.policy}>
    For your security, sessions expire after inactivity or the maximum session duration. Save your work when an expiry warning appears.
  </p>
}

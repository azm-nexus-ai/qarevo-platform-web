import Link from 'next/link'

/** Recovery does not infer or disclose the account's role. */
export default function RecoverySignInLinks() {
  return <nav aria-label='Choose your sign-in portal' style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 16px', marginTop: 24 }}>
    {[
      ['Patient sign-in', '/auth/sign-in'],
      ['Clinician sign-in', '/auth/doctor/login'],
      ['Administrator sign-in', '/auth/admin/login'],
    ].map(([label, href]) => <Link key={href} href={href} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: 'var(--link)', fontSize: 14, fontWeight: 600 }}>{label}</Link>)}
  </nav>
}

import Link from 'next/link'
export default function PortalAccessLinks() {
  return <details className='portal-access-links'><summary>Other portals</summary><nav aria-label='Other portal sign-in'><p>Each portal verifies its own permissions and session. Opening another portal does not switch your current access.</p><Link href='/auth/sign-in'>Patient portal sign-in</Link><Link href='/auth/doctor/login'>Doctor portal sign-in</Link><Link href='/auth/practice/login'>Practice portal sign-in</Link></nav></details>
}

import Link from 'next/link'
export default function PortalAccessLinks() {
  return <details className='portal-access-links'><summary>Other portals</summary><nav aria-label='Other portal sign-in'><p>Use a separate verified account for each role. This does not switch your current permissions.</p><Link href='/auth/sign-in'>Patient portal sign-in</Link><Link href='/auth/doctor/login'>Doctor portal sign-in</Link></nav></details>
}

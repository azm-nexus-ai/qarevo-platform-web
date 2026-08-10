import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", background: '#EDF2FA' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '72px', fontWeight: 800, color: '#20B5DF', lineHeight: 1, marginBottom: '8px', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.04em' }}>404</div>
        <div style={{ fontSize: '18px', fontWeight: 600, color: '#04354D', marginBottom: '8px', letterSpacing: '-0.02em' }}>Page not found</div>
        <div style={{ fontSize: '14px', color: '#4B6480', marginBottom: '28px' }}>The page you are looking for does not exist.</div>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '11px', background: '#20B5DF', color: '#fff', textDecoration: 'none', fontSize: '14px', fontWeight: 600, letterSpacing: '-0.015em' }}>
          Return home
        </Link>
      </div>
    </div>
  )
}

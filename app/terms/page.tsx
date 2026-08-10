import Link from 'next/link'
import { T, PAGE_BG } from '@/lib/tokens'

export default function TermsPage() {
  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <section style={{ width: '100%', maxWidth: '640px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: 'inset 0 1px 0 #fff, 0 20px 60px rgba(4,53,77,0.1)', padding: '32px' }}>
        <h1 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Terms of Service</h1>
        <p style={{ margin: '0 0 16px', fontSize: '14px', color: T.slate, lineHeight: 1.65 }}>Terms content placeholder for prototype continuity.</p>
        <Link href='/' style={{ color: T.blue, fontWeight: 700, textDecoration: 'none', fontSize: '14px' }}>Return to Home</Link>
      </section>
    </main>
  )
}

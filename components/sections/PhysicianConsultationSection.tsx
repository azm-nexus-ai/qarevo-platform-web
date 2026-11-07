import Link from 'next/link'
import { T, Sh } from '@/lib/tokens'

export default function PhysicianConsultationSection() {
  return <section aria-labelledby="care-journey-title" style={{ maxWidth: 1080, margin: '0 auto', padding: '52px 24px 24px' }}>
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: Sh.float, padding: 'clamp(20px, 4vw, 36px)' }}>
      <p style={{ color: T.link, fontWeight: 650, fontSize: 13 }}>YOUR CARE JOURNEY</p>
      <h2 id="care-journey-title" style={{ color: T.navy, fontSize: 'clamp(24px, 4vw, 34px)', letterSpacing: '-0.03em', margin: '12px 0 24px' }}>One place to prepare for your care</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 24 }}>
        {[['01', 'Create your account', 'Verify your email and save your profile with clearly labelled required fields.'], ['02', 'Explore the clinician directory', 'See the approved clinician profiles available in your account. Availability is shown in the booking flow.'], ['03', 'Prepare for your consultation', 'Share your concern and make an explicit choice about optional AI assistance.']].map(([step, title, body]) => <div key={step}>
          <span style={{ color: T.link, fontWeight: 700 }}>{step}</span><h3 style={{ color: T.navy, fontSize: 18, margin: '10px 0' }}>{title}</h3><p style={{ color: T.slate, lineHeight: 1.7, margin: 0 }}>{body}</p>
        </div>)}
      </div>
      <Link href="/auth/sign-up" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 48, marginTop: 28, padding: '10px 24px', background: T.brandNavy, color: '#fff', borderRadius: 12, fontWeight: 650, textDecoration: 'none' }}>Patient registration</Link>
      <p style={{ color: T.slate2, fontSize: 13, marginTop: 16 }}>Development preview. Consultation delivery and payment are being validated before patient use.</p>
    </div>
  </section>
}

'use client'

import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'

export default function VideoConsultationPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy }}>Video Consultation</h1>
        <p style={{ margin: '4px 0 0', fontSize: '14px', color: T.slate2 }}>Manage video consultations with patients</p>
      </div>

      {/* Coming Soon Card */}
      <div style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(22px) saturate(175%)',
        WebkitBackdropFilter: 'blur(22px) saturate(175%)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.88)',
        boxShadow: Sh.card,
        padding: '60px 40px',
        textAlign: 'center',
      }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'rgba(32,181,223,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <Ico p={ICONS.video} size={36} sw={1.5} color={T.blue} />
        </div>
        <h2 style={{ margin: '0 0 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>Video Consultation</h2>
        <p style={{ margin: '0 0 24px', fontSize: '15px', color: T.slate2, lineHeight: 1.6, maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
          This feature is coming soon. You'll be able to conduct video consultations with your patients directly through the platform.
        </p>
        <div style={{ padding: '16px 24px', borderRadius: '12px', background: 'rgba(32,181,223,0.06)', border: '1px solid rgba(32,181,223,0.18)' }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: T.navy }}>
            For now, please use the Workspace to manage consultations
          </p>
        </div>
      </div>
    </div>
  )
}

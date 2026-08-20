'use client'

import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import { APPOINTMENT_SLOTS } from '@/constants/healthcare'
import Ico from '@/components/ui/Ico'
import DoctorCard from '@/components/cards/DoctorCard'
import AppointmentSelector from '@/components/cards/AppointmentSelector'
import HoverBtn from '@/components/buttons/HoverBtn'

function SecHead({ icon, label }: { icon: string | readonly string[]; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
      <Ico p={icon} size={14} sw={1.75} style={{ color: T.slate2 }} />
      <span
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: T.slate2,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  )
}

export default function PhysicianConsultationSection() {
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        background: 'rgba(245,249,255,0.72)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
      }}
    >
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '52px 32px 0' }}>
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(4,53,77,0.06)',
            borderRadius: '20px',
            boxShadow: Sh.float,
            marginBottom: '20px',
            overflow: 'hidden',
          }}
        >
          <div
            className="grid-responsive-2"
            style={{
              borderBottom: `1px solid ${T.borderFaint}`,
            }}
          >
            {/* Physician Network */}
            <div style={{ padding: '28px 28px 32px', borderRight: `1px solid ${T.borderFaint}` }}>
              <SecHead icon={ICONS.search} label="Verified Physician Network" />
              <DoctorCard
                name="Dr. Sarah Jenkins"
                specialty="General Practice"
                verification="A+"
                tags={['Internal Medicine', 'Diagnostics']}
                imageUrl="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop&auto=format&q=80"
              />
            </div>

            {/* Consultation Orchestration */}
            <div style={{ padding: '28px 28px 32px' }}>
              <SecHead icon={ICONS.calendar} label="Consultation Orchestration" />
              <AppointmentSelector slots={APPOINTMENT_SLOTS} />
            </div>
          </div>

          <div style={{ padding: '20px 28px' }}>
            <HoverBtn
              base={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: '11px',
                background: T.navy,
                border: 'none',
                cursor: 'pointer',
                fontSize: '14.5px',
                fontWeight: 600,
                color: '#fff',
                letterSpacing: '-0.015em',
                boxShadow: '0 1px 3px rgba(4,53,77,0.22), 0 2px 10px rgba(4,53,77,0.12)',
              }}
              on={{
                transform: 'translateY(-1px)',
                boxShadow: '0 3px 10px rgba(4,53,77,0.28), 0 8px 28px rgba(4,53,77,0.15)',
              }}
            >
              Confirm & Authenticate
            </HoverBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

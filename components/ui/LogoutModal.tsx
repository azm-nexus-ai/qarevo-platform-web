'use client'

import { T } from '@/lib/tokens'
import HoverBtn from '@/components/buttons/HoverBtn'

interface LogoutModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function LogoutModal({ isOpen, onClose, onConfirm }: LogoutModalProps) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(4,53,77,0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.9)',
          boxShadow: '0 20px 60px rgba(4,53,77,0.2)',
          padding: '32px',
          maxWidth: '400px',
          width: '90%',
        }}
      >
        <h2
          style={{
            margin: '0 0 12px',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '20px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: T.navy,
          }}
        >
          Log Out
        </h2>
        <p
          style={{
            margin: '0 0 24px',
            fontSize: '14px',
            lineHeight: 1.6,
            color: T.slate,
          }}
        >
          Are you sure you want to log out?
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <HoverBtn
            onClick={onClose}
            base={{
              minHeight: '42px',
              padding: '0 20px',
              borderRadius: '11px',
              border: '1px solid rgba(4,53,77,0.12)',
              background: 'rgba(255,255,255,0.9)',
              color: T.slate,
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
            }}
            on={{
              background: 'rgba(255,255,255,0.98)',
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(4,53,77,0.1)',
            }}
          >
            No
          </HoverBtn>
          <HoverBtn
            onClick={onConfirm}
            base={{
              minHeight: '42px',
              padding: '0 20px',
              borderRadius: '11px',
              border: 'none',
              background: T.blue,
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(32,181,223,0.3)',
            }}
            on={{
              background: '#348CEA',
              transform: 'translateY(-1px)',
              boxShadow: '0 6px 16px rgba(52,140,234,0.4)',
            }}
          >
            Yes
          </HoverBtn>
        </div>
      </div>
    </div>
  )
}

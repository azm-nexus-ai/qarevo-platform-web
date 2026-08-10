'use client'

import { T, Sh, Glass } from '@/lib/tokens'
import Ico from '@/components/ui/Ico'
import type { AIItemProps } from '@/types'

export default function AIItem({ icon, title, titleColor, body, action, divider, glass }: AIItemProps) {
  return (
    <div style={{ borderBottom: divider && !glass ? `1px solid ${T.borderFaint}` : undefined }}>
      <div
        style={{
          padding: '17px 20px',
          margin: glass ? '10px 20px 16px' : '16px 8px',
          borderRadius: glass ? '12px' : undefined,
          ...(glass
            ? {
                ...Glass.aiCard,
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.72), 0 4px 20px rgba(32,181,223,0.07), 0 8px 24px rgba(32,181,223,0.06)',
              }
            : {}),
          display: 'flex',
          gap: '14px',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...(glass
              ? Glass.chip
              : { background: T.blueLight, border: `1px solid ${T.blueMid}`, boxShadow: Sh.inner }),
          }}
        >
          <Ico p={icon} size={16} sw={1.5} style={{ color: T.blue }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '-0.015em',
              color: titleColor || T.navy,
              marginBottom: '5px',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: '13px',
              color: T.slate,
              lineHeight: 1.6,
              marginBottom: action ? '10px' : 0,
            }}
          >
            {body}
          </div>
          {action && (
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12.5px',
                fontWeight: 500,
                color: T.blue,
                letterSpacing: '-0.01em',
              }}
            >
              {action}
              <Ico p="M5 12h14M12 5l7 7-7 7" size={12} sw={2} style={{ color: T.blue }} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

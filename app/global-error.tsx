'use client'

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "'Inter', sans-serif", background: '#EDF2FA', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '72px', fontWeight: 800, color: '#20B5DF', lineHeight: 1, marginBottom: '8px', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.04em' }}>500</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#04354D', marginBottom: '8px', letterSpacing: '-0.02em' }}>Something went wrong</div>
          <div style={{ fontSize: '14px', color: '#4B6480', marginBottom: '28px' }}>An unexpected error occurred. Please try again.</div>
          <button onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '11px', background: '#20B5DF', color: '#fff', border: 'none', fontSize: '14px', fontWeight: 600, letterSpacing: '-0.015em', cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}

'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'

const MAX_W: CSSProperties = { maxWidth: '1080px', margin: '0 auto', padding: '0 32px' }

function SectionHr() {
  return <div style={{ height: '1px', background: T.borderFaint, margin: '0' }} />
}

function DocSection({ num, label, title, desc, id, children }: {
  num: string; label: string; title: string; desc?: string; id: string; children: React.ReactNode
}) {
  return (
    <>
      <section id={id} style={{ padding: '80px 0 72px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '11.5px', fontWeight: 700, color: T.blue, letterSpacing: '0.04em' }}>{num}</span>
          <div style={{ width: '1px', height: '12px', background: T.border }} />
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: T.slate2, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
        </div>
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '30px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 10px' }}>{title}</h2>
        {desc
          ? <p style={{ fontSize: '15px', color: T.slate, lineHeight: 1.65, maxWidth: '580px', margin: '0 0 40px', letterSpacing: '-0.01em' }}>{desc}</p>
          : <div style={{ height: '40px' }} />}
        {children}
      </section>
      <SectionHr />
    </>
  )
}

function Swatch({ color, name, hex, tall }: { color: string; name: string; hex: string; tall?: boolean }) {
  return (
    <div>
      <div style={{ height: tall ? '88px' : '60px', borderRadius: '12px', background: color, border: color.startsWith('#F') || color.startsWith('rgba(255') ? `1px solid ${T.border}` : 'none', boxShadow: Sh.inner, marginBottom: '9px' }} />
      <div style={{ fontSize: '12.5px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em', marginBottom: '2px' }}>{name}</div>
      <div style={{ fontSize: '11px', color: T.slate2, fontFamily: "'DM Mono', 'Fira Code', monospace" }}>{hex}</div>
    </div>
  )
}

function ColorGroup({ title, items, cols = 5 }: { title: string; items: { color: string; name: string; hex: string; tall?: boolean }[]; cols?: number }) {
  return (
    <div>
      <div style={{ fontSize: '10.5px', fontWeight: 700, color: T.slate2, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '14px' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '12px' }}>
        {items.map(i => <Swatch key={i.name} {...i} />)}
      </div>
    </div>
  )
}

function Btn({ variant, label, size = 'md', disabled }: { variant: 'primary' | 'secondary' | 'ghost' | 'outline'; label: string; size?: 'sm' | 'md'; disabled?: boolean }) {
  const [h, setH] = useState(false)
  const pad = size === 'sm' ? '8px 16px' : '11px 22px'
  const fs  = size === 'sm' ? '13px' : '14px'
  const base: Record<string, CSSProperties> = {
    primary:   { background: disabled ? '#8DC9DC' : h ? '#348CEA' : T.blue, color: '#fff', border: 'none', boxShadow: disabled ? 'none' : h ? '0 6px 18px rgba(52,140,234,0.3)' : '0 2px 8px rgba(32,181,223,0.28), 0 10px 24px rgba(32,181,223,0.2)' },
    secondary: { background: h ? '#04354D' : '#348CEA', color: '#fff', border: 'none', boxShadow: h ? '0 6px 20px rgba(4,53,77,0.26)' : '0 4px 14px rgba(52,140,234,0.24)' },
    ghost:     { background: h ? 'rgba(32,181,223,0.06)' : 'transparent', color: h ? T.blue : T.slate, border: 'none' },
    outline:   { ...(h ? { ...Glass.pill, background: 'rgba(255,255,255,0.97)' } : Glass.pill), color: T.navy2 },
  }
  return (
    <button disabled={disabled} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ padding: pad, borderRadius: '10px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: fs, fontWeight: 600, letterSpacing: '-0.015em', fontFamily: 'inherit', transition: 'all 0.15s ease', opacity: disabled ? 0.52 : 1, ...base[variant] }}>{label}</button>
  )
}

function Field({ label, placeholder, type = 'text', hint }: { label: string; placeholder: string; type?: string; hint?: string }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      <label style={{ fontSize: '12.5px', fontWeight: 600, color: T.navy, letterSpacing: '-0.01em' }}>{label}</label>
      <input type={type} placeholder={placeholder} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={{ padding: '11px 14px', borderRadius: '10px', fontSize: '14px', color: T.navy, fontFamily: 'inherit', background: focused ? '#FFFFFF' : 'rgba(4,53,77,0.025)', border: focused ? '1.5px solid rgba(32,181,223,0.5)' : `1px solid ${T.border}`, outline: 'none', boxShadow: focused ? '0 0 0 3px rgba(32,181,223,0.08)' : 'none', transition: 'all 0.15s ease' }} />
      {hint && <span style={{ fontSize: '11.5px', color: T.slate2 }}>{hint}</span>}
    </div>
  )
}

function RBox({ r, label, val }: { r: string; label: string; val: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <div style={{ width: '72px', height: '72px', borderRadius: r, background: `linear-gradient(135deg, ${T.blueLight}, ${T.blueMid})`, border: `1px solid ${T.blueMid}`, boxShadow: Sh.inner }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: T.navy, letterSpacing: '-0.01em' }}>{label}</div>
        <div style={{ fontSize: '11px', color: T.slate2, fontFamily: 'monospace', marginTop: '2px' }}>{val}</div>
      </div>
    </div>
  )
}

function ShadowTile({ name, shadow, usage }: { name: string; shadow: string; usage: string }) {
  return (
    <div>
      <div style={{ height: '72px', background: '#FFFFFF', borderRadius: '14px', boxShadow: shadow, marginBottom: '12px', border: '1px solid rgba(4,53,77,0.04)' }} />
      <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.015em', marginBottom: '3px' }}>{name}</div>
      <div style={{ fontSize: '11.5px', color: T.slate2, lineHeight: 1.55 }}>{usage}</div>
    </div>
  )
}

function GlassTile({ label, desc, style: s }: { label: string; desc: string; style: CSSProperties }) {
  return (
    <div style={{ padding: '20px 18px', borderRadius: '14px', ...s }}>
      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(32,181,223,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', color: T.blue }}>
        <Ico p={ICONS.shield} size={14} sw={1.75} />
      </div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy, letterSpacing: '-0.015em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '11.5px', color: T.slate2, lineHeight: 1.55 }}>{desc}</div>
    </div>
  )
}

function IconTile({ name, path }: { name: string; path: string | readonly string[] }) {
  return (
    <div style={{ padding: '20px 12px', borderRadius: '14px', textAlign: 'center', background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, boxShadow: Sh.inner, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <div style={{ color: T.slate }}><Ico p={path} size={22} sw={1.5} /></div>
      <span style={{ fontSize: '11px', color: T.slate2, letterSpacing: '-0.005em' }}>{name}</span>
    </div>
  )
}

function Chip({ label, color, bg, border: bd }: { label: string; color: string; bg: string; border?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '100px', background: bg, color, fontSize: '12px', fontWeight: 600, border: bd, letterSpacing: '-0.01em' }}>{label}</span>
  )
}

function Spec({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, borderRadius: '12px', boxShadow: Sh.inner }}>
      <span style={{ fontSize: '13px', color: T.slate }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy, fontFamily: 'monospace' }}>{value}</div>
        {note && <div style={{ fontSize: '11px', color: T.slate2, marginTop: '1px' }}>{note}</div>}
      </div>
    </div>
  )
}

export default function DesignFoundationPage() {
  const [hoverBack, setHoverBack] = useState(false)

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: PAGE_BG, overflowX: 'hidden' }}>

      {/* Fixed dot grid */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: 'radial-gradient(circle at center, rgba(32,181,223,0.10) 1px, transparent 1.2px)', backgroundSize: '22px 22px', maskImage: 'radial-gradient(ellipse 100% 60% at 50% 20%, black 30%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 100% 60% at 50% 20%, black 30%, transparent 100%)' }} />

      {/* Navigation */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, ...Glass.nav }}>
        <div style={{ ...MAX_W, height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link href='/' aria-label='Qarevo Health home' style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Image
                src='/brand/Untitled design - 2026-08-03T165004.531.png'
                alt='Qarevo Health'
                width={150}
                height={32}
                priority
                unoptimized
                style={{ width: '150px', height: 'auto' }}
              />
            </Link>
            <div style={{ width: '1px', height: '14px', background: T.border }} />
            <span style={{ fontSize: '12.5px', fontWeight: 500, color: T.slate2, letterSpacing: '-0.01em' }}>Design Foundation</span>
            <span style={{ padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, color: T.blue, letterSpacing: '0.04em', ...Glass.chip }}>v1.0</span>
          </div>
          <Link
            href="/"
            onMouseEnter={() => setHoverBack(true)}
            onMouseLeave={() => setHoverBack(false)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px',
              fontSize: '13px', fontWeight: 500, color: T.slate, letterSpacing: '-0.01em',
              border: `1px solid ${T.border}`,
              background: hoverBack ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer', transition: 'all 0.12s', textDecoration: 'none',
            }}
          >← Back to Product</Link>
        </div>
      </nav>

      {/* Page content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={MAX_W}>

          {/* Page hero */}
          <div style={{ padding: '80px 0 72px', borderBottom: `1px solid ${T.borderFaint}` }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 14px', borderRadius: '100px', marginBottom: '28px', color: T.blue, ...Glass.chip }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: T.blue }} />
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em' }}>QAREVO HEALTH · DESIGN FOUNDATION · VERSION 1.0 · 2026</span>
            </div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(40px, 5vw, 62px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.036em', color: T.navy, maxWidth: '700px', margin: '0 0 20px' }}>
              The complete visual<br />
              <span style={{ color: T.slate2 }}>language of Qarevo Health.</span>
            </h1>
            <p style={{ fontSize: '17px', lineHeight: 1.72, color: T.slate, maxWidth: '520px', margin: '0 0 36px', letterSpacing: '-0.01em' }}>
              Every token, component, and pattern extracted directly from the approved landing page — standardized for production use across the entire Qarevo Health ecosystem.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['15 Sections', '100% Landing-Derived', 'WCAG 2.1 AA', 'Production Ready', 'Enterprise Grade'].map(t => (
                <span key={t} style={{ padding: '5px 13px', borderRadius: '100px', background: 'rgba(255,255,255,0.72)', border: `1px solid ${T.border}`, fontSize: '12px', fontWeight: 500, color: T.slate, letterSpacing: '-0.01em', boxShadow: Sh.inner }}>{t}</span>
              ))}
            </div>
          </div>

          {/* 01 — Brand Principles */}
          <DocSection num="01" label="Brand & Design Principles" id="brand" title="Design philosophy" desc="Eight principles that govern every decision across the Qarevo Health platform. Expressed through the visual choices on the landing page.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { e: '⚕️', t: 'Patient-First',          d: "Every interaction is designed around the patient's trust and comfort above all else." },
                { e: '✦',  t: 'Simplicity',             d: 'Remove friction at every step. Surface only what is needed, precisely when needed.' },
                { e: '🔒', t: 'Trust Through Clarity',  d: 'Governance and compliance are visible and prominent. Trust is earned visually.' },
                { e: '🧘', t: 'Calm & Reassuring',      d: 'Soft tones, generous spacing, and smooth motion create a calming clinical environment.' },
                { e: '🏛️', t: 'Enterprise Grade',       d: 'Every component meets the standards expected by leading hospitals, insurers, and regulators.' },
                { e: '♿', t: 'Accessibility-First',    d: 'WCAG 2.1 AA minimum. Contrast, focus, and keyboard navigation are non-negotiable.' },
                { e: '⬡',  t: 'Ecosystem Consistency', d: 'One visual language across Registration, Booking, AI Intelligence, and Follow-up Care.' },
                { e: '◈',  t: 'Premium Visual Quality', d: 'Every shadow, radius, and typographic decision reflects a world-class healthcare product.' },
              ].map(p => (
                <div key={p.t} style={{ padding: '24px 20px', borderRadius: '16px', background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, boxShadow: Sh.inner }}>
                  <div style={{ fontSize: '24px', marginBottom: '14px', lineHeight: 1 }}>{p.e}</div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: T.navy, letterSpacing: '-0.02em', marginBottom: '7px' }}>{p.t}</div>
                  <div style={{ fontSize: '12.5px', color: T.slate, lineHeight: 1.62 }}>{p.d}</div>
                </div>
              ))}
            </div>
          </DocSection>

          {/* 02 — Color System */}
          <DocSection num="02" label="Color System" id="colors" title="Complete color palette" desc="Every color extracted from the landing page. Organized into semantic groups for consistent application across all Qarevo Health products.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
              <ColorGroup title="Primary Palette" cols={5} items={[
                { color: T.blue,      name: 'Brand Blue',    hex: '#20B5DF', tall: true },
                { color: T.blueLight, name: 'Blue Light',    hex: '#EAF1FF', tall: true },
                { color: T.blueMid,   name: 'Blue Mid',      hex: '#C5D8FF', tall: true },
                { color: T.navy,      name: 'Navy',          hex: '#04354D', tall: true },
                { color: T.navy2,     name: 'Navy 2',        hex: '#0E151A', tall: true },
              ]} />
              <ColorGroup title="Surface Colors" cols={5} items={[
                { color: T.surface,              name: 'Background',   hex: '#F7FAFC' },
                { color: '#EDF2FB',              name: 'Surface Mid',  hex: '#EDF2FB' },
                { color: '#F5F9FF',              name: 'Surface Light',hex: '#F5F9FF' },
                { color: '#FFFFFF',              name: 'Card White',   hex: '#FFFFFF' },
                { color: 'rgba(255,255,255,0.72)',name: 'Glass White',  hex: 'rgba(255,255,255,0.72)' },
              ]} />
              <ColorGroup title="Text & Border" cols={5} items={[
                { color: T.navy,                 name: 'Primary Text',   hex: '#04354D' },
                { color: T.slate,                name: 'Secondary Text', hex: '#4B6480' },
                { color: T.slate2,               name: 'Tertiary Text',  hex: '#8298AF' },
                { color: 'rgba(4,53,77,0.07)',   name: 'Border',         hex: 'rgba(4,53,77,0.07)' },
                { color: 'rgba(4,53,77,0.04)',   name: 'Border Faint',   hex: 'rgba(4,53,77,0.04)' },
              ]} />
              <ColorGroup title="Semantic & Framework Colors" cols={6} items={[
                { color: T.green,      name: 'Success',    hex: '#09AD70' },
                { color: T.greenLight, name: 'Suc. Light', hex: '#E3F8F0' },
                { color: T.amber,      name: 'Warning',    hex: '#D97706' },
                { color: T.red,        name: 'Error',      hex: '#DC2626' },
                { color: T.purple,     name: 'HIPAA',      hex: '#7C3AED' },
                { color: T.cyan,       name: 'SOC 2',      hex: '#0891B2' },
              ]} />
            </div>
          </DocSection>

          {/* 03 — Typography */}
          <DocSection num="03" label="Typography" id="type" title="Type scale & hierarchy" desc="Plus Jakarta Sans for display headings. Inter for body, labels, and UI text. Both loaded via next/font/google.">
            <div style={{ background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, borderRadius: '20px', boxShadow: Sh.float, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr 136px 64px 60px 60px', gap: '16px', padding: '12px 28px', background: 'rgba(4,53,77,0.02)', borderBottom: `1px solid ${T.borderFaint}` }}>
                {['Role', 'Specimen', 'Family', 'Weight', 'Size', 'L.H.'].map(h => (
                  <span key={h} style={{ fontSize: '10.5px', fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>
              {[
                { role: 'Display',    fam: 'Plus Jakarta Sans', w: '800', sz: '68px',   lh: '1.04', ls: '-0.038em', sample: 'European Healthcare' },
                { role: 'H1',         fam: 'Plus Jakarta Sans', w: '800', sz: '48px',   lh: '1.1',  ls: '-0.03em',  sample: 'Verified Physicians' },
                { role: 'H2',         fam: 'Plus Jakarta Sans', w: '700', sz: '32px',   lh: '1.2',  ls: '-0.025em', sample: 'Clinical Intelligence' },
                { role: 'H3',         fam: 'Plus Jakarta Sans', w: '700', sz: '24px',   lh: '1.3',  ls: '-0.02em',  sample: 'Consultation Booking' },
                { role: 'H4',         fam: 'Plus Jakarta Sans', w: '600', sz: '18px',   lh: '1.4',  ls: '-0.015em', sample: 'Patient Dashboard' },
                { role: 'Body Large', fam: 'Inter',             w: '400', sz: '17.5px', lh: '1.72', ls: '-0.01em',  sample: 'Discover verified physicians and orchestrate continuous care across Europe.' },
                { role: 'Body',       fam: 'Inter',             w: '400', sz: '14px',   lh: '1.6',  ls: '-0.01em',  sample: 'Processing patient self-report and historical lab panels. 3 critical markers identified.' },
                { role: 'Small',      fam: 'Inter',             w: '500', sz: '12.5px', lh: '1.5',  ls: '-0.01em',  sample: 'General Practice · Clinical Ver: A+' },
                { role: 'Caption',    fam: 'Inter',             w: '700', sz: '10.5px', lh: '1.4',  ls: '+0.1em',   sample: 'CLINICAL FOCUS · UPPERCASE LABEL' },
                { role: 'Button',     fam: 'Plus Jakarta Sans', w: '600', sz: '14.5px', lh: '1.0',  ls: '-0.015em', sample: 'Confirm & Authenticate' },
              ].map((row, i) => {
                const isJakarta = row.fam === 'Plus Jakarta Sans'
                const displaySize = Math.min(parseFloat(row.sz), 30) + 'px'
                return (
                  <div key={row.role} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 136px 64px 60px 60px', alignItems: 'center', gap: '16px', padding: '16px 28px', borderBottom: i < 9 ? `1px solid ${T.borderFaint}` : undefined, background: i % 2 ? 'rgba(4,53,77,0.01)' : 'transparent' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.05em' }}>{row.role}</span>
                    <span style={{ fontFamily: isJakarta ? "'Plus Jakarta Sans', sans-serif" : 'Inter, sans-serif', fontWeight: Number(row.w), fontSize: displaySize, color: T.navy, letterSpacing: row.ls, lineHeight: row.lh, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: row.ls === '+0.1em' ? 'uppercase' : 'none' }}>{row.sample}</span>
                    <code style={{ fontSize: '11px', color: T.slate2, fontFamily: 'monospace' }}>{isJakarta ? 'Plus Jakarta Sans' : 'Inter'}</code>
                    <code style={{ fontSize: '11px', color: T.blue, fontFamily: 'monospace', fontWeight: 600 }}>{row.w}</code>
                    <code style={{ fontSize: '11px', color: T.slate2, fontFamily: 'monospace' }}>{row.sz}</code>
                    <code style={{ fontSize: '11px', color: T.slate2, fontFamily: 'monospace' }}>{row.lh}</code>
                  </div>
                )
              })}
            </div>
          </DocSection>

          {/* 04 — Grid & Layout */}
          <DocSection num="04" label="Grid & Layout" id="grid" title="Layout system" desc="The landing page uses a 1080px centered content column with 32px horizontal padding and CSS Grid for all multi-column layouts.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
              {[
                { l: 'Max Content Width', v: '1080px',   n: 'Centered in viewport' },
                { l: 'H. Padding',        v: '32px',     n: 'Both sides of content column' },
                { l: 'Nav Height',        v: '60px',     n: 'Sticky top navigation' },
                { l: 'Card Gap',          v: '16px',     n: 'Between sibling cards' },
                { l: 'Hero Top',          v: '96px',     n: 'Above hero headline' },
                { l: 'Hero Bottom',       v: '88px',     n: 'Below hero CTAs' },
                { l: 'Section Spacing',   v: '48–80px',  n: 'Vertical between sections' },
                { l: 'Card Padding',      v: '24–32px',  n: 'Internal card horizontal' },
              ].map(r => <Spec key={r.l} label={r.l} value={r.v} note={r.n} />)}
            </div>
            <div style={{ background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, borderRadius: '16px', boxShadow: Sh.inner, padding: '24px', overflow: 'hidden' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px' }}>Column Patterns Used</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: '1 column (hero, compliance)', cols: [1] },
                  { label: '2 equal columns (physician + consultation)', cols: [1, 1] },
                  { label: '2 asymmetric columns (dashboard 1fr + 300px)', cols: [2.2, 1] },
                  { label: '4 columns (brand principles grid)', cols: [1, 1, 1, 1] },
                  { label: '5 columns (color swatches, trust cards)', cols: [1, 1, 1, 1, 1] },
                ].map(p => (
                  <div key={p.label} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '3px', flex: 1, maxWidth: '420px' }}>
                      {p.cols.map((w, i) => (
                        <div key={i} style={{ flex: w, height: '28px', borderRadius: '6px', background: `linear-gradient(90deg, ${T.blueLight}, ${T.blueMid})`, border: `1px solid ${T.blueMid}` }} />
                      ))}
                    </div>
                    <span style={{ fontSize: '12px', color: T.slate2 }}>{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </DocSection>

          {/* 05 — Spacing */}
          <DocSection num="05" label="Spacing System" id="spacing" title="8px base spacing scale" desc="All spacing derives from an 8px base. Used consistently for padding, gap, and margin across every component on the landing page.">
            <div style={{ background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, borderRadius: '16px', boxShadow: Sh.inner, overflow: 'hidden' }}>
              {[
                { t: 'space-1',  px: 4,  u: 'Icon gaps, badge padding fine-tune' },
                { t: 'space-2',  px: 8,  u: 'Compliance chip internal gap, button icon spacing' },
                { t: 'space-3',  px: 12, u: 'Section header icon-to-label gap, tag row gap' },
                { t: 'space-4',  px: 16, u: 'Card header bottom margin, form field row gap' },
                { t: 'space-5',  px: 20, u: 'Card confirm area padding, slot card bottom' },
                { t: 'space-6',  px: 24, u: 'Card inner padding (small), compliance row height' },
                { t: 'space-8',  px: 32, u: 'Content horizontal padding, nav logo margin' },
                { t: 'space-10', px: 40, u: 'Hero status badge bottom margin, section desc bottom' },
                { t: 'space-12', px: 48, u: 'Dashboard section top padding, compliance gap' },
                { t: 'space-16', px: 64, u: 'Large section bottom padding, page footer' },
              ].map((s, i) => (
                <div key={s.t} style={{ display: 'grid', gridTemplateColumns: '96px 180px 1fr 160px', alignItems: 'center', gap: '20px', padding: '12px 24px', borderBottom: i < 9 ? `1px solid ${T.borderFaint}` : undefined, background: i % 2 ? 'rgba(4,53,77,0.01)' : 'transparent' }}>
                  <code style={{ fontSize: '12px', color: T.blue, fontFamily: 'monospace', fontWeight: 600 }}>{s.t}</code>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ height: '16px', width: `${Math.max(s.px * 1.8, 8)}px`, minWidth: '8px', maxWidth: '180px', background: `linear-gradient(90deg, ${T.blue}, ${T.blueMid})`, borderRadius: '3px', opacity: 0.7 }} />
                    <code style={{ fontSize: '12px', fontWeight: 700, color: T.navy, fontFamily: 'monospace', flexShrink: 0 }}>{s.px}px</code>
                  </div>
                  <span style={{ fontSize: '12px', color: T.slate2 }}>{s.u}</span>
                  <code style={{ fontSize: '11px', color: T.slate2, fontFamily: 'monospace' }}>{s.px / 8}rem ({s.px / 4}×base)</code>
                </div>
              ))}
            </div>
          </DocSection>

          {/* 06 — Border Radius */}
          <DocSection num="06" label="Border Radius" id="radius" title="Corner radius scale" desc="Radii used directly on the landing page. Larger values signal premium floating surfaces; smaller values serve tight interactive components.">
            <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-end', flexWrap: 'wrap', padding: '32px', background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, borderRadius: '20px', boxShadow: Sh.inner }}>
              {[
                { l: 'XS',     v: '8px',   r: '8px' },
                { l: 'SM',     v: '10px',  r: '10px' },
                { l: 'MD',     v: '12px',  r: '12px' },
                { l: 'LG',     v: '14px',  r: '14px' },
                { l: 'XL',     v: '16px',  r: '16px' },
                { l: '2XL',    v: '20px',  r: '20px' },
                { l: 'Pill',   v: '100px', r: '100px' },
                { l: 'Circle', v: '50%',   r: '50%' },
              ].map(r => <RBox key={r.l} label={r.l} val={r.v} r={r.r} />)}
            </div>
            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {[
                { comp: 'Nav buttons',                v: '8px' },
                { comp: 'Sign In, nav CTA buttons',   v: '9px' },
                { comp: 'Form inputs, Review Case',   v: '10px' },
                { comp: 'CTA buttons, Confirm',       v: '11px' },
                { comp: 'Slot cards',                 v: '12px' },
                { comp: 'Physician tile, Trust card', v: '13–14px' },
                { comp: 'Standard cards',             v: '16px' },
                { comp: 'Primary floating cards',     v: '20px' },
              ].map(r => (
                <div key={r.comp} style={{ padding: '12px 16px', background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, borderRadius: '10px', boxShadow: Sh.inner }}>
                  <code style={{ fontSize: '12px', fontWeight: 700, color: T.blue, fontFamily: 'monospace', display: 'block', marginBottom: '4px' }}>{r.v}</code>
                  <div style={{ fontSize: '11.5px', color: T.slate2 }}>{r.comp}</div>
                </div>
              ))}
            </div>
          </DocSection>

          {/* 07 — Shadows & Elevation */}
          <DocSection num="07" label="Shadows & Elevation" id="shadows" title="Elevation system" desc="Multi-layer shadow tokens build genuine depth. Inner highlights simulate material thickness; outer layers create three-dimensional floating.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
              <ShadowTile name="Inner / Subtle"   shadow={Sh.inner} usage="Sub-cards within cards, physician tile, icon tiles" />
              <ShadowTile name="Card"             shadow={Sh.card}  usage="Standard information cards and activity items" />
              <ShadowTile name="Floating Card"    shadow={Sh.float} usage="Primary content containers — physician + consultation" />
              <ShadowTile name="Blue Glow"        shadow={Sh.glow}  usage="AI recommendation surfaces, active slot indicators" />
              <ShadowTile name="Navigation"       shadow={Sh.nav}   usage="Sticky glass navigation bar, inner highlight + underline" />
              <ShadowTile name="Glass Pill"       shadow={Sh.glass} usage="Status badges, ghost CTA button, info pill" />
            </div>
          </DocSection>

          {/* 08 — Glassmorphism */}
          <DocSection num="08" label="Glassmorphism" id="glass" title="Glass surface system" desc="Seven glass presets used on the landing page. Each defined by background opacity, blur strength, border, and inner highlight.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
              {[
                { l: 'Navigation Bar', d: 'Sticky frosted nav',     s: { ...Glass.nav,        borderRadius: '14px', border: '1px solid rgba(255,255,255,0.62)' } },
                { l: 'Status Pill',    d: 'Systems Nominal badge',  s: { ...Glass.pill,       borderRadius: '14px' } },
                { l: 'Active Slot',    d: 'Selected appointment',   s: { ...Glass.slotActive, borderRadius: '12px', outline: '1.5px solid rgba(32,181,223,0.45)', outlineOffset: '-1px' } },
                { l: 'AI Card',        d: 'Copilot recommendation', s: { ...Glass.aiCard,     borderRadius: '12px' } },
                { l: 'Info Chip',      d: 'Clinical tags, compliance', s: { ...Glass.chip,    borderRadius: '12px' } },
                { l: 'Verify Badge',   d: 'Physician credential',   s: { ...Glass.verifyBadge, borderRadius: '12px', color: '#fff' } },
                { l: 'Float Button',   d: 'Help / action floats',   s: { ...Glass.helpBtn,    borderRadius: '12px' } },
                { l: 'Ghost CTA',      d: 'Secondary hero button',  s: { ...Glass.pill,       borderRadius: '11px', background: 'rgba(255,255,255,0.82)' } },
              ].map(t => <GlassTile key={t.l} label={t.l} desc={t.d} style={t.s as CSSProperties} />)}
            </div>
            <div style={{ background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, borderRadius: '16px', boxShadow: Sh.inner, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '108px 152px 80px 110px 1fr', gap: '12px', padding: '12px 20px', background: 'rgba(4,53,77,0.02)', borderBottom: `1px solid ${T.borderFaint}` }}>
                {['Surface', 'Background', 'Blur', 'Saturate', 'Usage'].map(h => (
                  <span key={h} style={{ fontSize: '10.5px', fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>
              {[
                { n: 'Navigation',   bg: 'rgba(232,240,252,0.76)', bl: '28px', sat: '200%', u: 'Sticky top nav' },
                { n: 'Status Pill',  bg: 'rgba(255,255,255,0.82)', bl: '18px', sat: '180%', u: 'Badge, ghost CTA' },
                { n: 'Active Slot',  bg: 'rgba(218,232,255,0.52)', bl: '14px', sat: '160%', u: 'Selected appointment' },
                { n: 'AI Card',      bg: 'rgba(228,238,255,0.46)', bl: '12px', sat: '150%', u: 'Copilot card surface' },
                { n: 'Info Chip',    bg: 'rgba(234,241,255,0.72)', bl: '8px',  sat: '—',   u: 'Tags, compliance chips' },
                { n: 'Verify Badge', bg: 'rgba(18,88,218,0.88)',   bl: '6px',  sat: '—',   u: 'Avatar credential mark' },
                { n: 'Float Btn',    bg: 'rgba(255,255,255,0.84)', bl: '20px', sat: '180%', u: 'Floating actions' },
              ].map((row, i) => (
                <div key={row.n} style={{ display: 'grid', gridTemplateColumns: '108px 152px 80px 110px 1fr', alignItems: 'center', gap: '12px', padding: '13px 20px', borderBottom: i < 6 ? `1px solid ${T.borderFaint}` : undefined, background: i % 2 ? 'rgba(4,53,77,0.01)' : 'transparent', fontSize: '12px' }}>
                  <span style={{ fontWeight: 600, color: T.navy }}>{row.n}</span>
                  <code style={{ fontFamily: 'monospace', fontSize: '10.5px', color: T.blue }}>{row.bg}</code>
                  <code style={{ fontFamily: 'monospace', fontSize: '11px' }}>{row.bl}</code>
                  <code style={{ fontFamily: 'monospace', fontSize: '11px' }}>{row.sat}</code>
                  <span style={{ color: T.slate2 }}>{row.u}</span>
                </div>
              ))}
            </div>
          </DocSection>

          {/* 09 — Iconography */}
          <DocSection num="09" label="Iconography" id="icons" title="Icon system" desc="Outline icons with 1.5px stroke weight, rounded caps and joins, consistent 24×24 viewBox. Healthcare-appropriate with a clean, modern aesthetic.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '24px' }}>
              {([
                ['stethoscope', ICONS.steth],  ['heart pulse', ICONS.heart],
                ['shield',      ICONS.shield], ['lock',        ICONS.lock],
                ['user',        ICONS.user],   ['calendar',    ICONS.calendar],
                ['video',       ICONS.video],  ['brain/AI',    ICONS.brain],
                ['activity',    ICONS.activity],['zap/copilot', ICONS.zap],
                ['search',      ICONS.search], ['info',        ICONS.info],
              ] as [string, string | readonly string[]][]).map(([name, path]) => (
                <IconTile key={name} name={name} path={path} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-end', padding: '24px', background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, borderRadius: '14px', boxShadow: Sh.inner }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>Standard Sizes</div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end' }}>
                  {[14, 16, 18, 20, 22, 24, 28, 32].map(s => (
                    <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div style={{ color: T.slate }}><Ico p={ICONS.shield} size={s} sw={1.5} /></div>
                      <code style={{ fontSize: '10.5px', color: T.slate2, fontFamily: 'monospace' }}>{s}</code>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderLeft: `1px solid ${T.borderFaint}`, paddingLeft: '32px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>Stroke Weights</div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                  {[1, 1.25, 1.5, 1.75, 2, 2.5].map(sw => (
                    <div key={sw} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <div style={{ color: T.slate }}><Ico p={ICONS.shield} size={20} sw={sw} /></div>
                      <code style={{ fontSize: '10.5px', color: T.slate2, fontFamily: 'monospace' }}>{sw}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DocSection>

          {/* 10 — Buttons */}
          <DocSection num="10" label="Buttons" id="buttons" title="Button system" desc="Four button variants used on the landing page, each with defined hover, active, and disabled states.">
            <div style={{ background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, borderRadius: '20px', boxShadow: Sh.float, overflow: 'hidden' }}>
              {[
                { v: 'primary'   as const, l: 'Primary',    d: 'Main CTA — Book a Consultation, Access Platform', ex: 'bg: #20B5DF · hover: #348CEA · radius: 11px' },
                { v: 'secondary' as const, l: 'Secondary',  d: 'Dark confirmation — Confirm & Authenticate',      ex: 'bg: #04354D · hover: #0E151A · radius: 11px' },
                { v: 'outline'   as const, l: 'Ghost/Glass',d: 'Frosted secondary — Read the Whitepaper',         ex: 'bg: rgba(255,255,255,0.82) · blur: 18px' },
                { v: 'ghost'     as const, l: 'Ghost',      d: 'Minimal text — Sign In, nav links',               ex: 'bg: transparent · hover: rgba(32,181,223,0.06)' },
              ].map((b, i) => (
                <div key={b.v} style={{ display: 'grid', gridTemplateColumns: '220px 1fr auto', alignItems: 'center', gap: '32px', padding: '24px 28px', borderBottom: i < 3 ? `1px solid ${T.borderFaint}` : undefined }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Btn variant={b.v} label={b.l} />
                    <Btn variant={b.v} label={b.l} size="sm" />
                    <Btn variant={b.v} label={b.l} disabled />
                  </div>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: T.navy, letterSpacing: '-0.015em', marginBottom: '3px' }}>{b.l}</div>
                    <div style={{ fontSize: '12px', color: T.slate2 }}>{b.d}</div>
                  </div>
                  <code style={{ fontSize: '10.5px', color: T.blue, fontFamily: 'monospace', background: T.blueLight, padding: '5px 10px', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>{b.ex}</code>
                </div>
              ))}
            </div>
          </DocSection>

          {/* 11 — Form Controls */}
          <DocSection num="11" label="Form Controls" id="forms" title="Input component system" desc="Form controls use a soft background at rest, white on focus, with a blue border and glow ring. All follow the landing page depth treatment.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', maxWidth: '840px', marginBottom: '24px' }}>
              <Field label="Full Name"     placeholder="Dr. Sarah Jenkins"  hint="Min 2 characters" />
              <Field label="Email"         placeholder="sarah@clinic.eu"    type="email" />
              <Field label="Password"      placeholder="••••••••••••"       type="password" hint="Min 12 characters" />
              <Field label="Search"        placeholder="Search physicians…" />
              <Field label="Date of Birth" placeholder="DD / MM / YYYY" />
              <Field label="Specialty"     placeholder="General Practice" />
            </div>
            <div style={{ padding: '20px 24px', background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, borderRadius: '14px', boxShadow: Sh.inner }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>Focus State Tokens</div>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '12.5px', color: T.slate }}>
                {[
                  ['Border',        '1.5px solid rgba(32,181,223,0.5)'],
                  ['Ring',          '0 0 0 3px rgba(32,181,223,0.08)'],
                  ['Background',    '#FFFFFF'],
                  ['Transition',    'all 0.15s ease'],
                  ['Border Radius', '10px'],
                  ['Padding',       '11px 14px'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: T.slate2 }}>{k}:</span>
                    <code style={{ fontSize: '11.5px', color: T.blue, fontFamily: 'monospace', background: T.blueLight, padding: '2px 7px', borderRadius: '4px' }}>{v}</code>
                  </div>
                ))}
              </div>
            </div>
          </DocSection>

          {/* 12 — Cards */}
          <DocSection num="12" label="Cards" id="cards" title="Card component system" desc="Six card patterns extracted from the landing page. All share the floating elevation treatment with consistent internal spacing and border treatment.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, borderRadius: '20px', boxShadow: Sh.float, padding: '24px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: T.slate2, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Information Card</div>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '15px', fontWeight: 700, color: T.navy, letterSpacing: '-0.02em', marginBottom: '6px' }}>Clinical Intelligence Dashboard</div>
                <div style={{ fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>Processing patient self-report data. Identified 3 critical markers for review.</div>
              </div>
              <div style={{ background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, borderRadius: '20px', boxShadow: Sh.float, padding: '24px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: T.slate2, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>Physician Card</div>
                <div style={{ background: 'linear-gradient(145deg, #F6F9FF, #EEF4FF)', borderRadius: '13px', border: '1px solid rgba(32,181,223,0.09)', padding: '16px', display: 'flex', gap: '12px', boxShadow: Sh.inner }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: `linear-gradient(135deg, ${T.blueLight}, ${T.blueMid})`, boxShadow: `0 0 0 3px white, 0 0 0 4.5px ${T.blueMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Ico p={ICONS.user} size={20} sw={1.5} color={T.blue} />
                    </div>
                    <span style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '18px', height: '18px', borderRadius: '50%', ...Glass.verifyBadge, border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Ico p={ICONS.check} size={8} sw={2.5} color="#fff" />
                    </span>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: T.navy, letterSpacing: '-0.02em' }}>Dr. Sarah Jenkins</div>
                    <div style={{ fontSize: '12px', color: T.slate2, marginBottom: '10px' }}>General Practice · Clinical Ver: A+</div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {['Internal Medicine', 'Diagnostics'].map(t => (
                        <span key={t} style={{ padding: '3px 9px', borderRadius: '100px', ...Glass.chip, color: T.blue, fontSize: '11px', fontWeight: 500 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, borderRadius: '20px', boxShadow: Sh.float, padding: '24px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: T.slate2, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>Appointment Card</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { t: 'Oct 12, 14:00 CET', l: 'Secure Video Session', sel: false },
                    { t: 'Oct 12, 14:30 CET', l: 'Priority Slot',        sel: true  },
                  ].map(s => (
                    <div key={s.t} style={{ padding: '12px 14px', borderRadius: '10px', ...(s.sel ? { ...Glass.slotActive, outline: '1.5px solid rgba(32,181,223,0.45)', outlineOffset: '-1px' } : { background: 'rgba(4,53,77,0.02)', border: `1px solid ${T.border}` }) }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: s.sel ? T.blue : T.navy }}>{s.t}</div>
                      <div style={{ fontSize: '11.5px', color: s.sel ? '#6B96E8' : T.slate2 }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, borderRadius: '20px', boxShadow: Sh.float, padding: '24px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: T.slate2, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>AI Recommendation Card</div>
                <div style={{ ...Glass.aiCard, borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '9px', ...Glass.chip, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Ico p={ICONS.zap} size={16} sw={1.5} color={T.blue} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: T.blue, marginBottom: '4px', letterSpacing: '-0.015em' }}>Copilot Recommendation generated</div>
                    <div style={{ fontSize: '12px', color: T.slate, lineHeight: 1.55 }}>Confidence score: 92% — early intervention protocol.</div>
                  </div>
                </div>
              </div>
            </div>
          </DocSection>

          {/* 13 — Badges & Chips */}
          <DocSection num="13" label="Badges & Chips" id="badges" title="Badge & chip components" desc="Reusable status indicators, specialty labels, AI markers, and trust elements used across the landing page.">
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', padding: '24px', background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, borderRadius: '16px', boxShadow: Sh.inner }}>
              <Chip label="✓ Verified Physician"    color={T.blue}   bg={T.blueLight}  border={`1px solid ${T.blueMid}`} />
              <Chip label="⚡ AI-Powered"           color="#7C3AED"  bg="#F3EEFF"      border="1px solid #D8C4FF" />
              <Chip label="● Systems Nominal"        color={T.green}  bg={T.greenLight} border="1px solid #A8EDD4" />
              <Chip label="⏳ Awaiting Sign-off"     color={T.amber}  bg="#FFF8E6"      border="1px solid #FDE4A0" />
              <Chip label="✗ Error"                 color={T.red}    bg="#FEF2F2"      border="1px solid #FECACA" />
              <Chip label="ISO 27001"                color={T.cyan}   bg="#E0F6FD"      border="1px solid #BAE9F8" />
              <Chip label="GDPR"                     color={T.teal}   bg={T.greenLight} border="1px solid #A8EDD4" />
              <Chip label="HIPAA"                    color={T.purple} bg="#F3EEFF"      border="1px solid #D8C4FF" />
              <Chip label="SOC 2"                    color={T.cyan}   bg="#E0F6FD"      border="1px solid #BAE9F8" />
              <Chip label="EMA Standards"            color={T.amber}  bg="#FFF8E6"      border="1px solid #FDE4A0" />
              <Chip label="Internal Medicine"        color={T.blue}   bg="rgba(234,241,255,0.72)" border={`1px solid ${T.blueMid}`} />
              <Chip label="Priority Slot"            color={T.blue}   bg={T.blueLight}  border={`1px solid ${T.blueMid}`} />
              <Chip label="Clinical Ver: A+"         color={T.green}  bg={T.greenLight} border="1px solid #A8EDD4" />
              <Chip label="Confidence: 92%"          color={T.blue}   bg={T.blueLight}  border={`1px solid ${T.blueMid}`} />
            </div>
          </DocSection>

          {/* 14 — Navigation */}
          <DocSection num="14" label="Navigation" id="nav" title="Navigation patterns" desc="Top navigation uses frosted glass with blur(28px) saturate(200%), height 60px, sticky at z-index 50.">
            <div style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: Sh.float, border: `1px solid ${T.borderFaint}`, marginBottom: '16px' }}>
              <div style={{ ...Glass.nav, padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: '15px', color: T.navy, letterSpacing: '-0.03em', marginRight: '20px' }}>Qarevo Health</span>
                <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
                  {['Platform Overview', 'Clinical Intelligence', 'Security & Governance', 'Patients'].map((l, i) => (
                    <button key={l} style={{ background: i === 0 ? 'rgba(4,53,77,0.05)' : 'none', border: 'none', padding: '5px 11px', borderRadius: '7px', fontSize: '13px', fontWeight: i === 0 ? 600 : 400, color: i === 0 ? T.navy : T.slate, cursor: 'pointer' }}>{l}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '7px' }}>
                  <button style={{ background: 'none', border: 'none', fontSize: '13px', color: T.slate, cursor: 'pointer', padding: '6px 14px' }}>Sign In</button>
                  <button style={{ background: T.navy, border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: '#fff', cursor: 'pointer', padding: '7px 16px', boxShadow: Sh.inner }}>Access Platform</button>
                </div>
              </div>
              <div style={{ padding: '16px 24px', background: 'rgba(4,53,77,0.015)', borderTop: `1px solid ${T.borderFaint}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', fontSize: '12px' }}>
                  {[
                    { k: 'Height',     v: '60px' },
                    { k: 'Blur',       v: 'blur(28px)' },
                    { k: 'Saturate',   v: 'saturate(200%)' },
                    { k: 'Background', v: 'rgba(232,240,252,0.76)' },
                    { k: 'Position',   v: 'sticky top:0 z:50' },
                  ].map(r => (
                    <div key={r.k}>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '3px' }}>{r.k}</div>
                      <code style={{ fontSize: '11.5px', color: T.navy, fontFamily: 'monospace' }}>{r.v}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DocSection>

          {/* 15 — Accessibility */}
          <DocSection num="15" label="Accessibility" id="a11y" title="Accessibility standards" desc="Qarevo Health targets WCAG 2.1 Level AA across all products. These requirements apply to every module in the ecosystem.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
              {[
                { e: '◐', t: 'Color Contrast',  r: '4.5:1 minimum',    d: 'Body text on all surfaces. Large text (18px+bold or 24px) requires 3:1.' },
                { e: '⌨', t: 'Keyboard Access', r: 'Full tab support',  d: 'All buttons, inputs, and links reachable via Tab. Visible focus ring required.' },
                { e: '👆', t: 'Touch Targets',   r: '44×44px minimum',  d: 'All tappable areas on mobile. Add padding to meet size without changing visuals.' },
                { e: '🔡', t: 'Text Scaling',    r: 'Up to 200% zoom',  d: 'No horizontal scroll. No clipped content. Relative units throughout.' },
                { e: '🏷', t: 'ARIA Labels',     r: 'All icon buttons', d: 'Icon-only controls require aria-label. Dynamic regions use aria-live.' },
                { e: '📖', t: 'Line Height',     r: '1.5× minimum',     d: 'Body uses 1.6–1.72 line-height. Paragraph spacing at least 2× font-size.' },
              ].map(r => (
                <div key={r.t} style={{ padding: '20px', borderRadius: '14px', background: '#FFFFFF', border: `1px solid ${T.borderFaint}`, boxShadow: Sh.inner }}>
                  <div style={{ fontSize: '22px', marginBottom: '10px', lineHeight: 1 }}>{r.e}</div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: T.navy, letterSpacing: '-0.02em', marginBottom: '4px' }}>{r.t}</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: T.blue, marginBottom: '7px' }}>{r.r}</div>
                  <div style={{ fontSize: '12px', color: T.slate, lineHeight: 1.62 }}>{r.d}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '20px 24px', borderRadius: '13px', background: T.blueLight, border: `1px solid ${T.blueMid}`, display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{ color: T.blue, marginTop: '1px' }}><Ico p={ICONS.shield} size={18} sw={1.75} color={T.blue} /></div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: T.navy, letterSpacing: '-0.015em', marginBottom: '5px' }}>Healthcare accessibility is a regulatory requirement</div>
                <div style={{ fontSize: '12.5px', color: T.slate, lineHeight: 1.65 }}>
                  Under EN 301 549 (EU) and Section 508 (US), healthcare platforms serving patients are legally required to meet WCAG 2.1 AA. All Qarevo Health products must pass automated and manual accessibility audits — including screen reader testing — before production release.
                </div>
              </div>
            </div>
          </DocSection>

          {/* Footer */}
          <div style={{ paddingTop: '48px', paddingBottom: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '15px', fontWeight: 700, color: T.navy, letterSpacing: '-0.025em', marginBottom: '5px' }}>Qarevo Health Design Foundation</div>
              <div style={{ fontSize: '12.5px', color: T.slate2 }}>Version 1.0 · 2026 · Derived entirely from the approved Qarevo Health landing page · 15 sections</div>
            </div>
            <Link
              href="/"
              style={{ padding: '10px 22px', borderRadius: '10px', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600, color: T.navy, letterSpacing: '-0.015em', border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.7)', boxShadow: Sh.inner, flexShrink: 0, textDecoration: 'none', display: 'inline-block' }}
            >
              ← Back to Product
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}

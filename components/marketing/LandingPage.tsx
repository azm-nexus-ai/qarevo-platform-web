'use client'

import { useState } from 'react'
import type { PointerEvent } from 'react'
import { PAGE_BG } from '@/lib/tokens'
import Glow from '@/components/shared/Glow'
import FloatingHelp from '@/components/shared/FloatingHelp'
import NavigationBar from '@/components/layout/NavigationBar'
import Footer from '@/components/layout/Footer'
import HeroSection from '@/components/sections/HeroSection'
import ComplianceSection from '@/components/sections/ComplianceSection'
import PhysicianConsultationSection from '@/components/sections/PhysicianConsultationSection'
import DashboardSection from '@/components/sections/DashboardSection'

export default function LandingPage() {
  const [hovering, setHovering] = useState(false)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const mask = `radial-gradient(circle at ${cursor.x}px ${cursor.y}px, #000 72px, transparent 124px)`

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        overflowX: 'hidden',
        background: PAGE_BG,
      }}
      onPointerEnter={() => setHovering(true)}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHovering(false)}
    >
      {/* Static dot grid */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          backgroundImage: 'radial-gradient(circle at center, rgba(32,181,223,0.12) 1px, transparent 1.2px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 90% 80% at 50% 40%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 50% 40%, black 40%, transparent 100%)',
        }}
      />
      {/* Cursor-bloom dot layer */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          backgroundImage: 'radial-gradient(circle at center, rgba(32,181,223,0.26) 1.9px, transparent 2.1px)',
          backgroundSize: '22px 22px',
          opacity: hovering ? 1 : 0,
          maskImage: mask,
          WebkitMaskImage: mask,
          transition: 'opacity 0.18s ease',
        }}
      />

      {/* Ambient glow orbs */}
      <Glow color="rgba(32,181,223,0.13)"  w={700} h={480} top={340}  left="50%"  opacity={0.9} />
      <Glow color="rgba(52,140,234,0.08)" w={600} h={300} top={660}  left="60%"  opacity={0.8} />
      <Glow color="rgba(32,181,223,0.07)"  w={800} h={400} top={980}  left="45%"  opacity={0.7} />
      <Glow color="rgba(52,140,234,0.08)" w={700} h={350} top={1460} left="55%"  opacity={0.7} />

      <NavigationBar />
      <main id="main-content">
        <HeroSection />
        <ComplianceSection />
        <PhysicianConsultationSection />
        <DashboardSection />
      </main>
      <Footer />
      <FloatingHelp />
    </div>
  )
}

'use client'
import { useEffect, useRef } from 'react'
import styles from './BrandScene3D.module.css'

/** Outline of the Qarevo "Q" mark (brand kit LOGO3, without the TM). viewBox 0 0 533 580. */
const Q = 'M159.782 0C145.075 0 133.152 11.5411 133.152 25.7778V109.556C133.152 120.233 124.21 128.889 113.179 128.889H26.6304C11.9228 128.889 0 140.43 0 154.667V375.989C0 382.826 2.80542 389.383 7.79993 394.216L125.352 508.006C130.347 512.839 137.12 515.556 144.183 515.556H255.274C262.336 515.556 269.11 518.272 274.104 523.105L325.08 572.45C330.075 577.284 336.848 580 343.911 580H388.426C395.488 580 402.262 577.284 407.256 572.45L509.877 473.114C518.266 464.994 512.325 451.111 500.462 451.111H410.487C403.424 451.111 396.651 448.395 391.656 443.562L340.68 394.216C335.686 389.383 328.912 386.667 321.85 386.667H159.782C145.075 386.667 133.152 375.126 133.152 360.889V154.667C133.152 140.43 145.075 128.889 159.782 128.889H372.826C387.534 128.889 399.456 140.43 399.456 154.667V360.889C399.456 375.126 411.379 386.667 426.087 386.667H505.978C520.686 386.667 532.608 375.126 532.608 360.889V139.566C532.608 132.729 529.803 126.173 524.808 121.339L407.256 7.54957C402.262 2.71623 395.488 0 388.426 0H159.782Z'
const LAYERS = 14

/** Depth colour: the face is brand cyan, the extrusion darkens towards brand navy. */
function sideColour(index: number) {
  const t = index / (LAYERS - 1), mix = (a: number, b: number) => Math.round(a + (b - a) * t)
  return `rgb(${mix(26, 4)}, ${mix(150, 53)}, ${mix(190, 77)})`
}

/**
 * The Qarevo mark as a solid 3D object built from stacked vector layers (CSS 3D, no WebGL),
 * with brand tiles floating at different depths. Decorative only: hidden from assistive technology,
 * still when the user prefers reduced motion, and paused while off-screen.
 */
export default function BrandScene3D({ size = 280, tone = 'light', className }: { size?: number; tone?: 'light' | 'dark'; className?: string }) {
  const scene = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = scene.current
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0, visible = true, target = { x: 0, y: 0 }, current = { x: 0, y: 0 }
    const tick = () => {
      current = { x: current.x + (target.x - current.x) * 0.08, y: current.y + (target.y - current.y) * 0.08 }
      node.style.setProperty('--tilt-x', `${(-current.y * 10).toFixed(2)}deg`)
      node.style.setProperty('--tilt-y', `${(current.x * 16).toFixed(2)}deg`)
      frame = Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > 0.001 && visible ? requestAnimationFrame(tick) : 0
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const box = node.getBoundingClientRect()
      target = { x: Math.max(-1, Math.min(1, (event.clientX - box.left - box.width / 2) / (box.width * 1.5))), y: Math.max(-1, Math.min(1, (event.clientY - box.top - box.height / 2) / (box.height * 1.5))) }
      if (!frame && visible) frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; node.dataset.paused = visible ? 'false' : 'true' })
    observer.observe(node)
    window.addEventListener('pointermove', move, { passive: true })
    return () => { window.removeEventListener('pointermove', move); observer.disconnect(); if (frame) cancelAnimationFrame(frame) }
  }, [])
  return <div ref={scene} aria-hidden='true' className={`${styles.scene} ${className ?? ''}`} data-tone={tone} style={{ '--size': `${size}px` } as React.CSSProperties}>
    <div className={styles.stage}>
      <div className={styles.float}>
        {/* eslint-disable @next/next/no-img-element -- decorative static vectors */}
        <img className={`${styles.tile} ${styles.ring}`} src='/brand/elements/circle-aqua-01.svg' alt='' />
        <img className={`${styles.tile} ${styles.plus}`} src='/brand/elements/shape-aqua-11.svg' alt='' />
        <div className={styles.mark}>
          {Array.from({ length: LAYERS }, (_, index) => LAYERS - 1 - index).map(index => (
            <svg key={index} className={styles.layer} viewBox='0 0 533 580' style={{ transform: `translateZ(${-index * 2.2}px)` }}>
              <path d={Q} fill={index === 0 ? 'url(#qarevo-face)' : sideColour(index)} />
              {index === 0 && <defs><linearGradient id='qarevo-face' x1='0' y1='0' x2='1' y2='1'>
                <stop offset='0' stopColor='#5fd0ee' /><stop offset='0.45' stopColor='#20B5DF' /><stop offset='1' stopColor='#178fb4' />
              </linearGradient></defs>}
            </svg>
          ))}
        </div>
        <img className={`${styles.tile} ${styles.stairs}`} src='/brand/elements/shape-blue-01.svg' alt='' />
        <img className={`${styles.tile} ${styles.spark}`} src='/brand/elements/shape-blue-11.svg' alt='' />
        {/* eslint-enable @next/next/no-img-element */}
      </div>
      <img className={styles.pulse} src='/brand/elements/shape-aqua-07.svg' alt='' />
      <div className={styles.shadow} />
    </div>
  </div>
}

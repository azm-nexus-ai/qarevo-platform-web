import type { CSSProperties } from 'react'

/**
 * The official Qarevo Health logo set (brand kit `qarevo-brand`, LOGO1–4 × A/B/C).
 * - horizontal: mark + wordmark in one line (headers)
 * - stacked: mark above the wordmark (splash, empty states)
 * - mark: the Q symbol alone (favicons, compact sidebars)
 * - wordmark: the name alone
 * Tone `auto` shows the colour logo in light mode and the white logo in dark mode;
 * `white` is for permanently dark surfaces, `black` for single-colour use.
 */
export type LogoVariant = 'horizontal' | 'stacked' | 'mark' | 'wordmark'
export type LogoTone = 'auto' | 'colour' | 'white' | 'black'

const RATIO: Record<LogoVariant, number> = { horizontal: 580 / 3933, stacked: 1143 / 3216, mark: 580 / 648, wordmark: 428 / 3216 }

export default function BrandLogo({ variant = 'horizontal', tone = 'auto', width = 156, label = 'Qarevo Health', decorative = false, style }: {
  variant?: LogoVariant; tone?: LogoTone; width?: number; label?: string; decorative?: boolean; style?: CSSProperties
}) {
  const height = Math.round(width * RATIO[variant])
  const src = (t: Exclude<LogoTone, 'auto'>) => `/brand/logo/qarevo-${variant}-${t}.svg`
  const image = (t: Exclude<LogoTone, 'auto'>, className?: string) => (
    // eslint-disable-next-line @next/next/no-img-element -- static vector asset; next/image adds nothing for SVG
    <img className={className} src={src(t)} width={width} height={height} alt={decorative ? '' : label} draggable={false}
      style={{ width, maxWidth: '100%', height: 'auto', ...(className ? {} : { display: 'block' }) }} />
  )
  return <span style={{ display: 'inline-block', width, maxWidth: '100%', lineHeight: 0, ...style }}>
    {tone === 'auto' ? <>{image('colour', 'logo-on-light')}{image('white', 'logo-on-dark')}</> : image(tone)}
  </span>
}

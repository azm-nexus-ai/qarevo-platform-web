import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import Footer from '@/components/layout/Footer'
import { THEME_BOOTSTRAP } from '@/lib/theme'
import { ThemeProvider } from '@/components/ui/ThemeProvider'
import { BookingProvider } from '@/contexts/BookingContext'
import { SessionGuard } from '@/components/ui/SessionGuard'
import { NavigationGuards } from '@/components/ui/NavigationGuards'

const publicSans = localFont({
  src: '../public/fonts/PublicSans-Variable.ttf',
  variable: '--font-public-sans',
  weight: '100 900',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Qarevo Health',
    template: '%s | Qarevo Health',
  },
  description: 'Qarevo Health connects patients and independent practices through a clinician-led digital care journey. Development preview.',
  keywords: ['healthcare', 'telemedicine', 'physician', 'clinical intelligence'],
  icons: {
    icon: '/brand/qarevo-mark.png',
    shortcut: '/brand/qarevo-mark.png',
    apple: '/brand/qarevo-mark.png',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en" className={publicSans.variable}>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} /></head>
      <body>
        <NavigationGuards><ThemeProvider><BookingProvider><SessionGuard>{children}<Footer /></SessionGuard></BookingProvider></ThemeProvider></NavigationGuards>
      </body>
    </html>
  )
}

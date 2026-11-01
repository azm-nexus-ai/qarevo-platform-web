import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { THEME_BOOTSTRAP } from '@/lib/theme'
import { ThemeProvider } from '@/components/ui/ThemeProvider'
import { BookingProvider } from '@/contexts/BookingContext'

const inter = localFont({
  src: '../public/fonts/InterVariable.woff2',
  variable: '--font-inter',
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
    <html suppressHydrationWarning lang="en" className={inter.variable}>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} /></head>
      <body>
        <ThemeProvider><BookingProvider>{children}</BookingProvider></ThemeProvider>
      </body>
    </html>
  )
}

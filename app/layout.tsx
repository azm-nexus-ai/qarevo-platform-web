import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { BookingProvider } from '@/contexts/BookingContext'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Qarevo Health',
    template: '%s | Qarevo Health',
  },
  description: 'Discover verified physicians, orchestrate continuous care, and experience the highest standard of clinical intelligence and data governance.',
  keywords: ['healthcare', 'telemedicine', 'physician', 'GDPR', 'HIPAA', 'clinical intelligence'],
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
    <html lang="en" className={inter.variable}>
      <body>
        <BookingProvider>{children}</BookingProvider>
      </body>
    </html>
  )
}

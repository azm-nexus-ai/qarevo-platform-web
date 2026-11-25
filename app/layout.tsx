import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import Footer from '@/components/layout/Footer'
import { THEME_BOOTSTRAP } from '@/lib/theme'
import { ThemeProvider } from '@/components/ui/ThemeProvider'
import { PortalSessionBoundary } from '@/components/ui/PortalSessionBoundary'
import { NavigationGuards } from '@/components/ui/NavigationGuards'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'

const publicSans = localFont({
  src: '../public/fonts/PublicSans-Variable.ttf',
  variable: '--font-public-sans',
  weight: '100 900',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pageTitles')
  return {
    title: {
      default: 'Qarevo Health',
      template: '%s | Qarevo Health',
    },
    description: t('description'),
    keywords: ['healthcare', 'telemedicine', 'physician', 'clinical intelligence'],
    icons: {
      icon: '/brand/qarevo-mark.png',
      shortcut: '/brand/qarevo-mark.png',
      apple: '/brand/qarevo-mark.png',
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return (
    <html suppressHydrationWarning lang={locale} className={publicSans.variable}>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} /></head>
      <body>
        <NextIntlClientProvider><NavigationGuards><ThemeProvider><PortalSessionBoundary>{children}<Footer /></PortalSessionBoundary></ThemeProvider></NavigationGuards></NextIntlClientProvider>
      </body>
    </html>
  )
}

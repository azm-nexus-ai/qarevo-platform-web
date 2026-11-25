'use client'

import { NextIntlClientProvider } from 'next-intl'
import SupportReference from '@/components/ui/SupportReference'
import { getApiErrorRequestId } from '@/lib/api'
import { DEFAULT_LOCALE, FORMAT_LOCALE, LOCALE_COOKIE, TIME_ZONE, isLocale, type Locale } from '@/i18n/locale'

/**
 * This page replaces the root layout, so the app's message provider is not available.
 * It carries the few texts it needs in both languages; the language follows the switcher's cookie.
 */
const TEXT: Record<Locale, { title: string; body: string; retry: string; supportReference: Record<string, string> }> = {
  de: {
    title: 'Etwas ist schiefgelaufen', body: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.', retry: 'Erneut versuchen',
    supportReference: {
      clipboardUnavailable: 'Zwischenablage nicht verfügbar', supportReferenceCopied: 'Support-Referenz kopiert.',
      selectTheReferenceAndCopy: 'Markieren Sie die Referenz und kopieren Sie sie mit der Tastatur oder dem Gerätemenü.', supportReference: 'Support-Referenz',
      shareThisReferenceWithSupport: 'Nennen Sie diese Referenz dem Support, falls das Problem weiter besteht.', copySupportReference: 'Support-Referenz kopieren', copyReference: 'Referenz kopieren',
    },
  },
  en: {
    title: 'Something went wrong', body: 'An unexpected error occurred. Please try again.', retry: 'Try again',
    supportReference: {
      clipboardUnavailable: 'Clipboard unavailable', supportReferenceCopied: 'Support reference copied.',
      selectTheReferenceAndCopy: 'Select the reference and copy it using your keyboard or device menu.', supportReference: 'Support reference',
      shareThisReferenceWithSupport: 'Share this reference with support if the problem continues.', copySupportReference: 'Copy support reference', copyReference: 'Copy reference',
    },
  },
}

function currentLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE
  const value = document.cookie.split('; ').find(part => part.startsWith(`${LOCALE_COOKIE}=`))?.split('=')[1]
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  const locale = currentLocale(), text = TEXT[locale]
  return (
    <html lang={locale}>
      <body style={{ margin: 0, fontFamily: "'Inter', sans-serif", background: "var(--canvas)", minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <NextIntlClientProvider locale={FORMAT_LOCALE[locale]} timeZone={TIME_ZONE} messages={{ supportReference: text.supportReference }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '72px', fontWeight: 800, color: "var(--link)", lineHeight: 1, marginBottom: '8px', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", letterSpacing: '-0.04em' }}>500</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: "var(--text)", marginBottom: '8px', letterSpacing: '-0.02em' }}>{text.title}</div>
            <div style={{ fontSize: '14px', color: '#4B6480', marginBottom: '28px' }}>{text.body}</div>
            <SupportReference requestId={getApiErrorRequestId(error)} />
            <button onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '11px', background: '#20B5DF', color: '#fff', border: 'none', fontSize: '14px', fontWeight: 600, letterSpacing: '-0.015em', cursor: 'pointer' }}>
              {text.retry}
            </button>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

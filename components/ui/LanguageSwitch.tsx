'use client'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LOCALES, LOCALE_COOKIE, type Locale } from '@/i18n/locale'

const NATIVE: Record<Locale, string> = { de: 'Deutsch', en: 'English' }

/** Language choice for every portal header. Stored in a cookie for a year; the server renders from it (ADR-0002). */
export function LanguageSwitch() {
  const locale = useLocale().slice(0, 2), t = useTranslations('common.language'), router = useRouter(), [pending, startTransition] = useTransition()
  const choose = (next: Locale) => {
    if (next === locale || pending) return
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
    startTransition(() => router.refresh())
  }
  return <div role='group' aria-label={t('label')} className='language-switch' aria-busy={pending}>
    {LOCALES.map(option => <button key={option} type='button' lang={option} aria-pressed={option === locale} disabled={pending}
      aria-label={NATIVE[option]} title={NATIVE[option]} onClick={() => choose(option)}>{option.toUpperCase()}</button>)}
  </div>
}

import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { DEFAULT_LOCALE, LOCALE_COOKIE, TIME_ZONE, isLocale } from './locale'

/** The locale comes from the language switcher's cookie, otherwise German. Accept-Language is not used (ADR-0002). */
export default getRequestConfig(async () => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = isLocale(chosen) ? chosen : DEFAULT_LOCALE
  return {
    locale,
    timeZone: TIME_ZONE,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})

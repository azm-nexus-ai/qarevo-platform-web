/** Locales and the cookie that carries the chosen one (ADR-0002). Shared by server and client code. */
export const LOCALES = ['de', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'de'
export const LOCALE_COOKIE = 'qarevo_locale'
/** Region-specific formats for each language; time zone and currency stay explicit and separate. */
export const FORMAT_LOCALE: Record<Locale, string> = { de: 'de-DE', en: 'en-GB' }
export const TIME_ZONE = 'Europe/Berlin'
export const isLocale = (value: unknown): value is Locale => typeof value === 'string' && (LOCALES as readonly string[]).includes(value)

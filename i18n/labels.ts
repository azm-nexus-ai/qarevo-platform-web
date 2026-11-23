'use client'
import { useTranslations } from 'next-intl'

/** Stable lookup key for a specialty or language name as the API returns it
 *  ("General Practice", "FAMILY_MEDICINE", "english"). */
export function labelKey(value: string): string {
  const words = value.trim().toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  return words.map((word, index) => index ? word[0].toUpperCase() + word.slice(1) : word).join('')
}

/** Localised specialty and language names, falling back to the stored text. */
export function useLabels() {
  const specialties = useTranslations('specialties')
  const languages = useTranslations('languages')
  const lookup = (t: typeof specialties, value: string) => {
    const key = labelKey(value)
    return key && t.has(key) ? t(key) : value
  }
  return {
    specialty: (value: string) => lookup(specialties, value),
    language: (value: string) => lookup(languages, value),
  }
}

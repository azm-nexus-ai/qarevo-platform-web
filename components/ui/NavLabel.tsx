'use client'
import { useTranslations } from 'next-intl'

/** "Find a Doctor" -> "findADoctor", "Help & Support" -> "helpSupport". */
export const navKey = (label: string) => label.split(/[^A-Za-z0-9]+/).filter(Boolean)
  .map((word, index) => index === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase()).join('')

/** A navigation item's label in the active language; unknown items keep their English label. */
export function NavLabel({ portal, label }: { portal: 'patient' | 'doctor' | 'admin' | 'practice'; label: string }) {
  const t = useTranslations('nav.' + portal), key = navKey(label)
  return <>{t.has(key) ? t(key) : label}</>
}

export function SigningOut() {
  return <>{useTranslations('common')('signingOut')}</>
}

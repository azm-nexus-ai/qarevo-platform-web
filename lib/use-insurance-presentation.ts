'use client'
import { useTranslations } from 'next-intl'
import { insurancePresentation } from './insurance-presentation'

/** insurancePresentation with its labels and notice in the active language. */
export function useInsurancePresentation() {
  const t = useTranslations('insurance')
  return (value: Parameters<typeof insurancePresentation>[0]) => {
    const presentation = insurancePresentation(value)
    const { keys } = presentation
    return { ...presentation, label: t(keys.label), verificationLabel: t(keys.verification), fundingLabel: t(keys.funding), membershipLabel: t(keys.membership), notice: t(keys.notice) }
  }
}

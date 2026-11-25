'use client'
import { useLocale, useTranslations } from 'next-intl'
import { LEGAL_KIND_LABELS, STATUS_LABELS, type SubmissionStatus, type VerificationText } from '@/lib/treating-entity'

/**
 * Verification labels and validation text in the active language. Requirement rules and
 * document types come from the API in English; known keys are translated, others are shown as sent.
 */
/** API codes (PLATFORM_AGREEMENT, legal_name) become message keys (platformAgreement, legalName). */
const camel = (code: string) => code.toLowerCase().replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase())

export function useVerificationText() {
  const t = useTranslations('verification'), german = useLocale().startsWith('de')
  const known = (group: string, code: string, fallback: string) => {
    const key = `${group}.${camel(code)}`
    return t.has(key) ? t(key) : fallback
  }
  const text: VerificationText = {
    label: rule => known('rule', rule.key, rule.label),
    hint: rule => known('ruleHint', rule.key, rule.hint),
    required: label => t('err.required', { label }),
    tooLong: max => t('err.tooLong', { max }),
    format: (label, hint) => t('err.format', { label, hint: hint || t('err.checkFormat') }),
    choose: label => t('err.choose', { label }),
    group: label => t('err.group', { label }),
    fileType: t('err.fileType'), fileEmpty: t('err.fileEmpty'), fileSize: t('err.fileSize'),
  }
  return {
    t, text,
    legal: (kind: string) => known('legal', kind, LEGAL_KIND_LABELS[kind] ?? kind),
    /** A label inside a sentence: English lower-cases it ("Read platform agreement"); German keeps its nouns. */
    inline: (label: string) => (german ? label : label.toLowerCase()),
    /** German dates for German; English keeps the browser's own format. */
    dateLocale: german ? 'de-DE' : undefined,
    status: (status: SubmissionStatus) => known('status', status, STATUS_LABELS[status]),
    document: (key: string, fallback: string) => known('document', key, fallback),
  }
}

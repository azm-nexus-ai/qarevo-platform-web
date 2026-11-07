// These APIs contain patient-reported details, not insurer eligibility decisions.
// Do not promote object presence, dates, a membership category, or legacy
// "active"/"verified" strings into a coverage or reimbursement confirmation.
export const INSURANCE_VERIFICATION_NOTICE = 'Coverage has not been verified. Saved details and uploaded cards do not confirm eligibility, reimbursement or an agreed consultation billing route.'
export const SELF_PAY_NOTICE = 'A self-pay preference does not confirm a consultation price or a payment agreement.'

type Details = {insurance_type?: unknown; insurance_provider_name?: unknown; insurance_number?: unknown; insured_status?: unknown}
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const fundingLabels: Record<string,string> = {GKV:'Statutory insurance (GKV)',PKV:'Private insurance (PKV)',SELF_PAY:'Self-pay'}
const membershipLabels: Record<string,string> = {SELF_INSURED:'Self-insured',FAMILY_MEMBER:'Family member',STUDENT:'Student',PENSIONER:'Pensioner',OTHER:'Other'}

export function insurancePresentation(value: Details | null | undefined) {
  const type = text(value?.insurance_type).toUpperCase()
  const provider = text(value?.insurance_provider_name), member = text(value?.insurance_number)
  const hasDetails = Boolean(type || provider || member)
  const selfPay = type === 'SELF_PAY'
  const complete = (type === 'GKV' || type === 'PKV') && Boolean(provider && member)
  const label = !hasDetails ? 'No insurance details recorded' : selfPay ? 'Self-pay preference recorded' : complete ? 'Insurance details recorded' : 'Insurance details incomplete'
  return {
    label, hasDetails,
    tone: hasDetails && !selfPay && !complete ? 'warning' as const : hasDetails ? 'info' as const : 'neutral' as const,
    verificationLabel: hasDetails && !selfPay ? 'Not verified' : selfPay ? 'Not applicable to a self-pay preference' : 'Not added',
    fundingLabel: fundingLabels[type] ?? 'Funding type not recorded',
    membershipLabel: membershipLabels[text(value?.insured_status).toUpperCase()] ?? 'Not recorded',
    notice: selfPay ? SELF_PAY_NOTICE : INSURANCE_VERIFICATION_NOTICE,
  }
}

/** Doctor-supplied options are not a patient's verified coverage or selected case route. */
export function declaredDoctorFundingOptions(value: unknown): string {
  if (!Array.isArray(value)) return 'Not provided'
  const options = [...new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))]
  return options.length ? options.join(', ') : 'Not provided'
}

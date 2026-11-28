// These APIs contain patient-reported details, not insurer eligibility decisions.
// Do not promote object presence, dates, a membership category, or legacy
// "active"/"verified" strings into a coverage or reimbursement confirmation.
export const INSURANCE_VERIFICATION_NOTICE = 'Coverage has not been verified. Saved details and uploaded cards do not confirm eligibility, reimbursement or an agreed consultation billing route.'
export const SELF_PAY_NOTICE = 'A self-pay preference does not confirm a consultation price or a payment agreement.'

type Details = {insurance_type?: unknown; insurance_provider_name?: unknown; insurance_number?: unknown; insured_status?: unknown}
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
/** English text for each key of the `insurance` message namespace; portals translate the keys. */
export const INSURANCE_TEXT = {
  noDetails: 'No insurance details recorded', selfPayRecorded: 'Self-pay preference recorded',
  detailsRecorded: 'Insurance details recorded', detailsIncomplete: 'Insurance details incomplete',
  notVerified: 'Not verified', notApplicableSelfPay: 'Not applicable to a self-pay preference', notAdded: 'Not added',
  fundingGkv: 'Statutory insurance (GKV)', fundingPkv: 'Private insurance (PKV)', fundingSelfPay: 'Self-pay', fundingNotRecorded: 'Funding type not recorded',
  memberSelfInsured: 'Self-insured', memberFamily: 'Family member', memberStudent: 'Student', memberPensioner: 'Pensioner', memberOther: 'Other', memberNotRecorded: 'Not recorded',
  verificationNotice: INSURANCE_VERIFICATION_NOTICE, selfPayNotice: SELF_PAY_NOTICE,
} as const
export type InsuranceTextKey = keyof typeof INSURANCE_TEXT
const fundingKeys: Record<string, InsuranceTextKey> = {GKV:'fundingGkv',PKV:'fundingPkv',SELF_PAY:'fundingSelfPay'}
const membershipKeys: Record<string, InsuranceTextKey> = {SELF_INSURED:'memberSelfInsured',FAMILY_MEMBER:'memberFamily',STUDENT:'memberStudent',PENSIONER:'memberPensioner',OTHER:'memberOther'}

export function insurancePresentation(value: Details | null | undefined) {
  const type = text(value?.insurance_type).toUpperCase()
  const provider = text(value?.insurance_provider_name), member = text(value?.insurance_number)
  const hasDetails = Boolean(type || provider || member)
  const selfPay = type === 'SELF_PAY'
  const complete = (type === 'GKV' || type === 'PKV') && Boolean(provider && member)
  const keys = {
    label: (!hasDetails ? 'noDetails' : selfPay ? 'selfPayRecorded' : complete ? 'detailsRecorded' : 'detailsIncomplete') as InsuranceTextKey,
    verification: (hasDetails && !selfPay ? 'notVerified' : selfPay ? 'notApplicableSelfPay' : 'notAdded') as InsuranceTextKey,
    funding: fundingKeys[type] ?? 'fundingNotRecorded',
    membership: membershipKeys[text(value?.insured_status).toUpperCase()] ?? 'memberNotRecorded',
    notice: (selfPay ? 'selfPayNotice' : 'verificationNotice') as InsuranceTextKey,
  }
  return {
    keys, hasDetails,
    label: INSURANCE_TEXT[keys.label],
    tone: hasDetails && !selfPay && !complete ? 'warning' as const : hasDetails ? 'info' as const : 'neutral' as const,
    verificationLabel: INSURANCE_TEXT[keys.verification],
    fundingLabel: INSURANCE_TEXT[keys.funding],
    membershipLabel: INSURANCE_TEXT[keys.membership],
    notice: INSURANCE_TEXT[keys.notice],
  }
}

/** Doctor-supplied options are not a patient's verified coverage or selected case route. */
export function declaredDoctorFundingOptions(value: unknown, none = 'Not provided'): string {
  if (!Array.isArray(value)) return none
  const options = [...new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))]
  return options.length ? options.join(', ') : none
}

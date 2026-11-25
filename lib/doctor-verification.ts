/** Display clinical verification only when the API explicitly supplies it.
 * Missing legacy metadata and account activity are not verification evidence.
 */
export type DoctorVerificationKey = 'verified' | 'pending' | 'unavailable'
/** `key` names the doctorVerification message; `label` is the English text for non-React callers. */
export function doctorVerification(value: unknown): { verified: boolean; key: DoctorVerificationKey; label: string } {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (status === 'verified' || status === 'approved') return { verified: true, key: 'verified', label: 'Verified physician' }
  if (status === 'pending') return { verified: false, key: 'pending', label: 'Pending verification' }
  return { verified: false, key: 'unavailable', label: 'Verification unavailable' }
}

/** Display clinical verification only when the API explicitly supplies it.
 * Missing legacy metadata and account activity are not verification evidence.
 */
export function doctorVerification(value: unknown): { verified: boolean; label: string } {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (status === 'verified' || status === 'approved') return { verified: true, label: 'Verified physician' }
  if (status === 'pending') return { verified: false, label: 'Pending verification' }
  return { verified: false, label: 'Verification unavailable' }
}

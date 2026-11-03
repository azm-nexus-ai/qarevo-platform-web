/** Presentation context only. Backend identity and token checks determine access. */
export function recoveryPortal(pathname: string) {
  const kind = pathname.startsWith('/auth/admin/') ? 'admin' : pathname.startsWith('/auth/doctor/') ? 'doctor' : 'patient'
  return {
    kind,
    signIn: kind === 'patient' ? '/auth/sign-in' : `/auth/${kind}/login`,
    forgot: kind === 'patient' ? '/auth/forgot-password' : `/auth/${kind}/forgot-password`,
    title: kind === 'admin' ? 'Recover administrator access' : kind === 'doctor' ? 'Recover clinician access' : 'Forgot your password?',
    resetTitle: kind === 'admin' ? 'Reset administrator password' : kind === 'doctor' ? 'Reset clinician password' : 'Reset Your Password',
  }
}

export const AUTH_FLOW_STORAGE_KEY = 'qarevo.auth.flow.v1'

export type OnboardingStage =
  | 'email-verification'
  | 'otp-verification'
  | 'account-created'
  | 'welcome'
  | 'personal-information'
  | 'contact-information'
  | 'health-profile'
  | 'insurance-consent'
  | 'profile-completed'
  | 'dashboard'

export interface AuthFlowState {
  isAuthenticated: boolean
  onboardingCompleted: boolean
  currentStage: OnboardingStage
  updatedAt: string
}

const DEFAULT_AUTH_FLOW_STATE: AuthFlowState = {
  isAuthenticated: false,
  onboardingCompleted: false,
  currentStage: 'email-verification',
  updatedAt: '',
}

export function readAuthFlowState(): AuthFlowState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(AUTH_FLOW_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<AuthFlowState>

    return {
      ...DEFAULT_AUTH_FLOW_STATE,
      ...parsed,
      updatedAt: parsed.updatedAt || '',
    }
  } catch {
    return null
  }
}

function writeAuthFlowState(next: AuthFlowState) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(AUTH_FLOW_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore storage failures in prototype mode.
  }
}

function updateAuthFlowState(patch: Partial<AuthFlowState>) {
  const current = readAuthFlowState() || DEFAULT_AUTH_FLOW_STATE
  writeAuthFlowState({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}

export function setAuthenticatedOnboardingStage(stage: OnboardingStage) {
  updateAuthFlowState({
    isAuthenticated: true,
    onboardingCompleted: false,
    currentStage: stage,
  })
}

export function setOnboardingStage(stage: OnboardingStage) {
  const current = readAuthFlowState()
  updateAuthFlowState({
    isAuthenticated: current?.isAuthenticated ?? true,
    onboardingCompleted: false,
    currentStage: stage,
  })
}

export function markOnboardingCompleted() {
  updateAuthFlowState({
    isAuthenticated: true,
    onboardingCompleted: true,
    currentStage: 'dashboard',
  })
}

export function getOnboardingRedirectPath(state: AuthFlowState | null): string {
  if (!state || state.onboardingCompleted) return '/patient/dashboard'

  switch (state.currentStage) {
    case 'account-created':
      return '/auth/account-created'
    case 'welcome':
      return '/auth/profile-setup/personal-information'
    case 'contact-information':
      return '/auth/profile-setup/contact-information'
    case 'health-profile':
      return '/auth/profile-setup/medical-history-allergies'
    case 'insurance-consent':
      return '/auth/profile-setup/insurance-privacy-consent'
    case 'profile-completed':
      return '/auth/profile-setup/profile-completed'
    case 'personal-information':
      return '/auth/profile-setup/personal-information'
    default:
      return '/auth/profile-setup'
  }
}

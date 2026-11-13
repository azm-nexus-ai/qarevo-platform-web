import { apiGet, apiPut } from './api'

export const GERMAN_STATES = ['Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen']
export type ContactInformation = {
  primary_phone: string; alternative_phone?: string; country: 'Germany'; state: string; city: string; address: string; postal_code: string;
  preferred_contact_method: 'Phone Call' | 'SMS' | 'Email' | 'WhatsApp'; emergency_name: string;
  emergency_relationship: 'Parent' | 'Spouse' | 'Sibling' | 'Guardian' | 'Friend' | 'Other'; emergency_phone: string;
  emergency_alternative_phone?: string; emergency_email?: string | null;
}
export type HealthHistory = {
  medical_history: string[]; other_condition: string; surgeries_status: 'yes' | 'no';
  surgeries: { id: string; procedure_name: string; hospital: string; year: number }[];
  allergies: string[]; allergy_details: Record<string, string>; medications_status: 'taking' | 'none';
  medications: { id: string; medication_name: string; dosage: string; frequency: string; purpose: string }[]; family_history: string[];
}
export type CoverageInformation = {
  insurance_type: 'SELF_PAY' | 'GKV' | 'PKV'; provider: string; insurance_number: string;
  consents: { terms: boolean; privacy: boolean; health: boolean; telemedicine: boolean; marketing: boolean };
}
export type OnboardingStatus = {
  personal: Record<string, string | null>; contact?: ContactInformation; health?: HealthHistory; coverage?: CoverageInformation;
  completed_steps: string[]; next_step: 'personal' | 'contact' | 'health' | 'coverage' | null; complete: boolean;
  coverage_verified: boolean; legal_ready: boolean; consent_version: string;
}
export const getOnboarding = () => apiGet<OnboardingStatus>('/api/v1/patient/settings/onboarding')
export const saveContactInformation = (data: ContactInformation) => apiPut<OnboardingStatus>('/api/v1/patient/settings/onboarding/contact', data)
export const saveHealthHistory = (data: HealthHistory) => apiPut<OnboardingStatus>('/api/v1/patient/settings/onboarding/health', data)
export const saveCoverageInformation = (data: CoverageInformation) => apiPut<OnboardingStatus>('/api/v1/patient/settings/onboarding/coverage', { ...data, consent_version: 'dev-test-20261101' })
export const onboardingPath = (step: OnboardingStatus['next_step']) => ({
  personal: '/auth/profile-setup/personal-information', contact: '/auth/profile-setup/contact-information',
  health: '/auth/profile-setup/medical-history-allergies', coverage: '/auth/profile-setup/insurance-privacy-consent',
})[step || 'personal']

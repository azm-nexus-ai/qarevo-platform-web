'use client'
// The existing resource implementation is scoped to the active portal/account,
// despite its original patient-only name. Reuse its race and privacy guards.
export { usePatientResource as usePortalResource } from './use-patient-resource'

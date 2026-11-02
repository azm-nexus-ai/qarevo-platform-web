import { redirect } from 'next/navigation'

// Preserve older bookmarks and patient-facing links to the consolidated care page.
export default function PrescriptionsRedirect() {
  redirect('/patient/prescription-care-plan')
}

import { redirect } from 'next/navigation'

export default function PatientHomeRedirectPage() {
  redirect('/patient/dashboard')
}

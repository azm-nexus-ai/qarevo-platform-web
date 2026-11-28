import { redirect } from 'next/navigation'

/** The old prototype route; appointments live in the patient portal. */
export default function AppointmentRedirect() {
  redirect('/patient/appointments')
}

import { redirect } from 'next/navigation'

// Patient administration moved to the account-management page, which shows no clinical
// records and enforces least privilege per action. Old links land there.
export default function AdminPatientsRedirect() {
  redirect('/admin/accounts?role=patient')
}

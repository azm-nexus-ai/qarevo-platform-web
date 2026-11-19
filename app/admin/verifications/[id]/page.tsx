import { AdminVerificationDetail } from '@/components/verification/AdminVerifications'
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AdminVerificationDetail id={id} />
}

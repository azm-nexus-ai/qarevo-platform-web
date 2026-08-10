import SupportTicketDetailsClient from '@/components/support/SupportTicketDetailsClient'

type Props = {
  params: Promise<{
    ticketId: string
  }>
}

export default async function SupportTicketDetailsPage({ params }: Props) {
  const { ticketId } = await params
  return <SupportTicketDetailsClient ticketId={ticketId} />
}
import type { Metadata } from 'next'
import dynamic from 'next/dynamic'

const DesignFoundationPage = dynamic(() => import('@/components/marketing/DesignFoundationPage'))

export const metadata: Metadata = {
  title: 'Design Foundation',
  description: 'The complete visual language of Qarevo Health. Every token, component, and pattern documented.',
}

export default function Page() {
  return <DesignFoundationPage />
}

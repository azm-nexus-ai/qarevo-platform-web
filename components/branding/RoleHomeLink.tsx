'use client'
import Link from 'next/link'
import { usePortalHome } from '@/lib/portal-navigation'
import type { ComponentProps } from 'react'

export default function RoleHomeLink(props: Omit<ComponentProps<typeof Link>, 'href'>) {
  const href = usePortalHome()
  return <Link {...props} href={href} />
}

'use client'
import Link, { useLinkStatus } from 'next/link'
import type { ReactNode } from 'react'

function ActionLabel({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useLinkStatus()
  return <span aria-live='polite' aria-busy={pending}>{pending ? pendingLabel : children}</span>
}

/** Native link semantics with shared button treatment and navigation feedback. */
export default function ActionLink({ href, children, pendingLabel = 'Opening…', tone = 'secondary' }: {
  href: string; children: ReactNode; pendingLabel?: string; tone?: 'primary' | 'secondary'
}) {
  return <Link href={href} className={`q-button q-button-${tone}`}><ActionLabel pendingLabel={pendingLabel}>{children}</ActionLabel></Link>
}

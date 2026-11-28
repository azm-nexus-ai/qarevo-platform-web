'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiGet } from '@/lib/api'
import styles from './SignInAccess.module.css'

type Policy = { idle_minutes: Record<'patient' | 'provider' | 'admin', number>; absolute_hours: number }
const valid = (value: unknown): value is Policy => {
  const policy = value as Policy
  return Boolean(policy && policy.idle_minutes && ['patient', 'provider', 'admin'].every(key => Number.isInteger(policy.idle_minutes[key as keyof Policy['idle_minutes']]))
    && Number.isInteger(policy.absolute_hours))
}

/** States the sign-out limits in minutes, read from the API so the text follows its configuration. */
export default function SessionPolicyHint({ portal = 'patient' }: { portal?: 'patient' | 'provider' | 'admin' }) {
  const t = useTranslations('sessionPolicy')
  const [policy, setPolicy] = useState<Policy | null>(null)
  useEffect(() => {
    let live = true
    apiGet<unknown>('/api/v1/session/policy').then(value => { if (live && valid(value)) setPolicy(value) }).catch(() => { /* the general hint stays */ })
    return () => { live = false }
  }, [])
  return <p className={styles.policy}>
    {policy ? t('withMinutes', { minutes: policy.idle_minutes[portal], hours: policy.absolute_hours }) : t('forYourSecuritySessionsExpire')}
  </p>
}

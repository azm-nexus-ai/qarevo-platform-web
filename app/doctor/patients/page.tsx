'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import { useRouter } from 'next/navigation'
import {
  clearPortalSession,
  getDoctorPatients,
  isAuthError,
  readSessionMarker,
  type DoctorPatient,
  type DoctorPatientsResponse,
} from '@/lib/api'

export default function PatientsPage() {
  const t = useTranslations('doctorPatients')
  const router = useRouter()
  const [patientsData, setPatientsData] = useState<DoctorPatientsResponse | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageSize = 10

  useEffect(() => {
    if (!readSessionMarker()) {
      clearPortalSession()
      router.replace('/auth/doctor/login')
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      void fetchPatients()
    }, 250)

    const fetchPatients = async () => {
      setLoading(true)
      try {
        const data = await getDoctorPatients(undefined, { page, page_size: pageSize }, searchQuery)
        if (!cancelled) {
          setPatientsData(data)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearPortalSession()
          router.replace('/auth/sign-in')
          return
        }
        console.error(t('loadFailedTech'), err)
        if (!cancelled) setError(t('loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [router, searchQuery, page, t])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <p style={{ color: T.slate2 }}>{t('loading')}</p>
      </div>
    )
  }

  if (error) {
    return <div style={{ background: "var(--surface-glass)", border: '1px solid rgba(220,38,38,0.18)', borderRadius: '16px', padding: '24px', color: T.red }}>{error}</div>
  }

  if (!patientsData) return null

  const visiblePatients = patientsData.patients

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: T.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('title')}</h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: T.slate2 }}>{t('intro')}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          <div style={{
            padding: '10px 16px',
            borderRadius: '12px',
            background: "var(--surface-glass)",
            border: "1px solid var(--border)",
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Ico p={ICONS.search} size={16} sw={1.5} color={T.slate2} />
            <input
              type="text"
              placeholder={t('searchPatients')}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setPage(1)
              }}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                color: T.navy,
                width: '200px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{
          background: "var(--surface-glass)",
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: "1px solid var(--border)",
          boxShadow: Sh.card,
          padding: '20px',
        }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('total')}</p>
          <p style={{ margin: '8px 0 0', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>{patientsData.total_count}</p>
        </div>
        <div style={{
          background: "var(--surface-glass)",
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: "1px solid var(--border)",
          boxShadow: Sh.card,
          padding: '20px',
        }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('active')}</p>
          <p style={{ margin: '8px 0 0', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.green }}>{patientsData.patients.filter((p: DoctorPatient) => p.status === 'active').length}</p>
        </div>
        <div style={{
          background: "var(--surface-glass)",
          backdropFilter: 'blur(22px) saturate(175%)',
          WebkitBackdropFilter: 'blur(22px) saturate(175%)',
          borderRadius: '20px',
          border: "1px solid var(--border)",
          boxShadow: Sh.card,
          padding: '20px',
        }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('visible')}</p>
          <p style={{ margin: '8px 0 0', fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: T.link }}>{visiblePatients.length}</p>
        </div>
      </div>

      {/* Patients List */}
      <div style={{
        background: "var(--surface-glass)",
        backdropFilter: 'blur(22px) saturate(175%)',
        WebkitBackdropFilter: 'blur(22px) saturate(175%)',
        borderRadius: '20px',
        border: "1px solid var(--border)",
        boxShadow: Sh.card,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-inter), Inter, system-ui, sans-serif", fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>{t('directory')}</h3>
        </div>
        <div style={{ padding: '16px 24px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {visiblePatients.length === 0 ? (
              <p style={{ margin: 0, padding: '28px', textAlign: 'center', color: T.slate2, fontSize: '13px' }}>{t('none')}</p>
            ) : visiblePatients.map((patient: DoctorPatient) => (
              <div key={patient.patient_id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderRadius: '14px',
                background: "var(--surface-subtle)",
                border: "1px solid var(--border)",
                transition: 'all 0.15s ease',
                cursor: 'default',
                flexDirection: 'row',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(32,181,223,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.link, fontSize: '14px', fontWeight: 700 }}>
                    {patient.name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: T.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: "13px", color: T.slate2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient.email || t('noEmail')} · {patient.phone || t('noPhone')}</p>
                    <p style={{ margin: '2px 0 0', fontSize: "13px", color: T.slate }}>
                      {patient.gender || t('unknownGender')}, {patient.age ?? t('unknown')} years · Last visit: {patient.last_visit ? formatDate(patient.last_visit) : t('noVisits')}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: "13px", color: T.slate2 }}>{t('consultations')}</p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: T.navy }}>{patient.total_consultations}</p>
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: "13px",
                    fontWeight: 700,
                    background: patient.status === 'active' ? 'rgba(15,158,119,0.12)' : 'rgba(109,135,151,0.12)',
                    color: patient.status === 'active' ? T.green : T.slate2
                  }}>
                    {patient.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px', paddingTop: '20px', borderTop: "1px solid var(--border)", flexWrap: 'wrap', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: T.slate2 }}>Page {patientsData.page} · Showing {visiblePatients.length} of {patientsData.filtered_count} patients</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={!patientsData.has_previous || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                style={{ padding: '8px 12px', borderRadius: '8px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.slate2, fontSize: "13px", fontWeight: 600, cursor: patientsData.has_previous && !loading ? 'pointer' : 'not-allowed', opacity: patientsData.has_previous && !loading ? 1 : 0.5 }}
              >
                {t('previous')}
              </button>
              <button
                type="button"
                disabled={!patientsData.has_next || loading}
                onClick={() => setPage((current) => current + 1)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: "1px solid var(--border)", background: "var(--surface-glass)", color: T.slate2, fontSize: "13px", fontWeight: 600, cursor: patientsData.has_next && !loading ? 'pointer' : 'not-allowed', opacity: patientsData.has_next && !loading ? 1 : 0.5 }}
              >
                {t('next')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

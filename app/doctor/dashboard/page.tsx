'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import {
  clearAuthTokens,
  getDoctorDashboard,
  getDoctorEpisodes,
  isAuthError,
  readAccessToken,
  type DoctorDashboardResponse,
  type DoctorEpisodeListResponse,
  type DoctorEpisodeSummary,
  type DoctorRecentAppointment,
  type DoctorRecentConsultation,
} from '@/lib/api'

type ActivityItem = DoctorRecentAppointment | DoctorRecentConsultation

function isRecentAppointment(item: ActivityItem): item is DoctorRecentAppointment {
  return 'appointment_id' in item
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case 'booked':
      return { bg: 'rgba(15,158,119,0.12)', color: T.green }
    case 'completed':
      return { bg: 'rgba(15,158,119,0.1)', color: T.green }
    case 'cancelled':
      return { bg: 'rgba(220,38,38,0.1)', color: T.red }
    default:
      return { bg: 'rgba(32,181,223,0.12)', color: T.blue }
  }
}

function StatCard({ title, value, icon, color, href, onNavigate }: { title: string; value: number; icon: string | readonly string[]; color: string; href: string; onNavigate: (href: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(href)}
      style={{
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '20px',
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: Sh.card,
      padding: '24px',
      cursor: 'pointer',
      textAlign: 'left',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 600, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{title}</p>
          <p style={{ margin: '8px 0 0', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '32px', fontWeight: 800, letterSpacing: '-0.04em', color: T.navy }}>{value}</p>
        </div>
        <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
          <Ico p={icon} size={28} sw={1.8} color={color} />
        </div>
      </div>
    </button>
  )
}

function ActivityCard({ title, items, type, onNavigate }: { title: string; items: ActivityItem[]; type: 'appointments' | 'consultations'; onNavigate: (href: string) => void }) {
  const handleClick = (item: ActivityItem) => {
    if (isRecentAppointment(item)) {
      onNavigate(`/doctor/appointments/${item.appointment_id}`)
    } else {
      onNavigate(`/doctor/workspace/${item.consultation_id}`)
    }
  }
    
  return (
    <div style={{
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '20px',
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: Sh.card,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(4,53,77,0.06)' }}>
        <h3 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>{title}</h3>
      </div>
      <div style={{ padding: '16px 24px 24px' }}>
        {items.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: T.slate2, fontSize: '13px' }}>No recent {type}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map((item) => (
              <div
                key={isRecentAppointment(item) ? item.appointment_id : item.consultation_id}
                onClick={() => handleClick(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  background: 'rgba(247,250,252,0.6)',
                  border: '1px solid rgba(4,53,77,0.04)',
                  transition: 'all 0.15s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(32,181,223,0.08)'
                  e.currentTarget.style.borderColor = 'rgba(32,181,223,0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(247,250,252,0.6)'
                  e.currentTarget.style.borderColor = 'rgba(4,53,77,0.04)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(32,181,223,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.blue, fontSize: '13px', fontWeight: 700 }}>
                    {item.patient_name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: T.navy }}>{item.patient_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: T.slate2 }}>
                      {isRecentAppointment(item) ? `${formatDate(item.scheduled_time)} at ${formatTime(item.scheduled_time)}` : formatDate(item.completed_at)}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isRecentAppointment(item) && (
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: getStatusColor(item.status).bg,
                      color: getStatusColor(item.status).color
                    }}>
                      {item.status.replace('_', ' ').toUpperCase()}
                    </span>
                  )}
                  {!isRecentAppointment(item) && item.duration_minutes && (
                    <span style={{ fontSize: '12px', color: T.slate, fontWeight: 500 }}>{item.duration_minutes} min</span>
                  )}
                  <span style={{ color: T.slate2, fontSize: '14px' }}>→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ClinicalEpisodeCard({ episodes, onNavigate }: { episodes: DoctorEpisodeSummary[]; onNavigate: (href: string) => void }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '20px',
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: Sh.card,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(4,53,77,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: T.navy }}>Clinical Workflow Episodes</h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: T.slate2 }}>CWS intake and AI draft status for assigned patients</p>
        </div>
        <button type="button" onClick={() => onNavigate('/doctor/workspace')} style={{ border: 'none', background: 'transparent', color: T.blue, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
          Open Workspace →
        </button>
      </div>
      <div style={{ padding: '16px 24px 24px' }}>
        {episodes.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: T.slate2, fontSize: '13px' }}>No assigned clinical workflow episodes</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {episodes.map((episode) => (
              <button
                key={episode.episode_id}
                type="button"
                onClick={() => onNavigate(`/doctor/episodes/${episode.episode_id}`)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  background: 'rgba(247,250,252,0.6)',
                  border: '1px solid rgba(4,53,77,0.04)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{episode.patient.name}</p>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: T.slate2 }}>
                    {episode.chief_complaint || episode.status.replaceAll('_', ' ')}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: episode.ai_draft_ready ? 'rgba(15,158,119,0.12)' : 'rgba(32,181,223,0.12)', color: episode.ai_draft_ready ? T.green : T.blue }}>
                    {episode.ai_draft_ready ? 'AI READY' : episode.latest_ai_job_status?.toUpperCase() || 'NO AI DRAFT'}
                  </span>
                  <span style={{ color: T.slate2 }}>→</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DoctorDashboard() {
  const router = useRouter()
  const [dashboardData, setDashboardData] = useState<DoctorDashboardResponse | null>(null)
  const [episodeData, setEpisodeData] = useState<DoctorEpisodeListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/sign-in')
      return
    }

    let cancelled = false

    async function fetchDashboard() {
      try {
        const [data, episodes] = await Promise.all([
          getDoctorDashboard(),
          getDoctorEpisodes(undefined, { page: 1, page_size: 5 }),
        ])
        if (!cancelled) {
          setDashboardData(data)
          setEpisodeData(episodes)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to load doctor dashboard', err)
        if (!cancelled) setError('Unable to load dashboard data right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchDashboard()

    return () => {
      cancelled = true
    }
  }, [router])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px', color: T.slate2 }}>
        Loading doctor dashboard...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: '16px', padding: '24px', color: T.red }}>
        {error}
      </div>
    )
  }

  if (!dashboardData) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <StatCard title="Today's Appointments" value={dashboardData.stats.today_appointments} icon={ICONS.calendar} color={T.blue} href="/doctor/appointments" onNavigate={router.push} />
        <StatCard title="Pending Patients" value={dashboardData.stats.pending_patients} icon={ICONS.user} color={T.amber} href="/doctor/patients" onNavigate={router.push} />
        <StatCard title="Assigned Episodes" value={dashboardData.stats.assigned_episodes} icon={ICONS.cpu} color={T.cyan} href="/doctor/workspace" onNavigate={router.push} />
        <StatCard title="AI Drafts Ready" value={dashboardData.stats.episodes_with_ai_ready} icon={ICONS.zap} color={T.green} href="/doctor/workspace" onNavigate={router.push} />
      </div>

      {/* Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px' }}>
        <ActivityCard title="Recent Appointments" items={dashboardData.recent_appointments} type="appointments" onNavigate={router.push} />
        <ActivityCard title="Recent Consultations" items={dashboardData.recent_consultations} type="consultations" onNavigate={router.push} />
      </div>

      <ClinicalEpisodeCard episodes={episodeData?.episodes || []} onNavigate={router.push} />
    </div>
  )
}

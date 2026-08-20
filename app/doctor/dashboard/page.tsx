'use client'

import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'

interface DashboardStats {
  today_appointments: number
  pending_patients: number
  upcoming_consultations: number
  completed_consultations: number
}

interface RecentAppointment {
  appointment_id: string
  patient_name: string
  scheduled_time: string
  status: string
  consultation_type: string | null
}

interface RecentConsultation {
  consultation_id: string
  patient_name: string
  completed_at: string
  duration_minutes: number | null
}

interface DashboardData {
  stats: DashboardStats
  recent_appointments: RecentAppointment[]
  recent_consultations: RecentConsultation[]
  current_date: string
}

// Dummy data for development
const dummyDashboardData: DashboardData = {
  stats: {
    today_appointments: 8,
    pending_patients: 3,
    upcoming_consultations: 12,
    completed_consultations: 47
  },
  recent_appointments: [
    {
      appointment_id: 'apt-001',
      patient_name: 'Sarah Johnson',
      scheduled_time: '2026-08-20T14:30:00',
      status: 'booked',
      consultation_type: 'Video Consultation'
    },
    {
      appointment_id: 'apt-002',
      patient_name: 'Michael Chen',
      scheduled_time: '2026-08-20T15:00:00',
      status: 'booked',
      consultation_type: 'In-Person'
    },
    {
      appointment_id: 'apt-003',
      patient_name: 'Emily Davis',
      scheduled_time: '2026-08-20T16:30:00',
      status: 'booked',
      consultation_type: 'Video Consultation'
    },
    {
      appointment_id: 'apt-004',
      patient_name: 'James Wilson',
      scheduled_time: '2026-08-20T17:00:00',
      status: 'booked',
      consultation_type: 'Follow-Up'
    },
    {
      appointment_id: 'apt-005',
      patient_name: 'Lisa Anderson',
      scheduled_time: '2026-08-20T17:30:00',
      status: 'booked',
      consultation_type: 'Video Consultation'
    }
  ],
  recent_consultations: [
    {
      consultation_id: 'cons-001',
      patient_name: 'Robert Martinez',
      completed_at: '2026-08-19T16:45:00',
      duration_minutes: 28
    },
    {
      consultation_id: 'cons-002',
      patient_name: 'Jennifer Lee',
      completed_at: '2026-08-19T15:30:00',
      duration_minutes: 35
    },
    {
      consultation_id: 'cons-003',
      patient_name: 'David Brown',
      completed_at: '2026-08-19T14:15:00',
      duration_minutes: 42
    },
    {
      consultation_id: 'cons-004',
      patient_name: 'Maria Garcia',
      completed_at: '2026-08-19T11:00:00',
      duration_minutes: 30
    },
    {
      consultation_id: 'cons-005',
      patient_name: 'Thomas Taylor',
      completed_at: '2026-08-19T09:30:00',
      duration_minutes: 25
    }
  ],
  current_date: '2026-08-20'
}

export default function DoctorDashboard() {
  const dashboardData = dummyDashboardData

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
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

  const StatCard = ({ title, value, icon, color }: { title: string; value: number; icon: string | readonly string[]; color: string }) => (
    <div style={{
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      borderRadius: '20px',
      border: '1px solid rgba(255,255,255,0.88)',
      boxShadow: Sh.card,
      padding: '24px',
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
    </div>
  )

  const ActivityCard = ({ title, items, type }: { title: string; items: any[]; type: 'appointments' | 'consultations' }) => (
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
          <div style={{ padding: '32px', textAlign: 'center', color: T.slate2, fontSize: '13px' }}>No recent activity</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map((item) => (
              <div key={item.appointment_id || item.consultation_id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '14px',
                background: 'rgba(247,250,252,0.6)',
                border: '1px solid rgba(4,53,77,0.04)',
                transition: 'all 0.15s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(32,181,223,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.blue, fontSize: '13px', fontWeight: 700 }}>
                    {item.patient_name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: T.navy }}>{item.patient_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: T.slate2 }}>
                      {type === 'appointments' ? `${formatDate(item.scheduled_time)} at ${formatTime(item.scheduled_time)}` : formatDate(item.completed_at)}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {type === 'appointments' && (
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
                  {type === 'consultations' && item.duration_minutes && (
                    <span style={{ fontSize: '12px', color: T.slate, fontWeight: 500 }}>{item.duration_minutes} min</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <StatCard title="Today's Appointments" value={dashboardData.stats.today_appointments} icon={ICONS.calendar} color={T.blue} />
        <StatCard title="Pending Patients" value={dashboardData.stats.pending_patients} icon={ICONS.user} color={T.amber} />
        <StatCard title="Upcoming This Week" value={dashboardData.stats.upcoming_consultations} icon={ICONS.activity} color={T.green} />
        <StatCard title="Completed This Month" value={dashboardData.stats.completed_consultations} icon={ICONS.check} color={T.purple} />
      </div>

      {/* Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px' }}>
        <ActivityCard title="Recent Appointments" items={dashboardData.recent_appointments} type="appointments" />
        <ActivityCard title="Recent Consultations" items={dashboardData.recent_consultations} type="consultations" />
      </div>
    </div>
  )
}

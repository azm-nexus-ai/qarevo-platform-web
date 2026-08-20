'use client'

import { useEffect, useState } from 'react'

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
  date: string
}

export default function DoctorDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // TODO: Replace with actual provider ID from auth
    const providerId = 'mock-provider-id'
    
    fetch(`/api/v1/doctor/dashboard?provider_id=${providerId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch dashboard data')
        return res.json()
      })
      .then(data => {
        setDashboardData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error: {error}</div>
      </div>
    )
  }

  if (!dashboardData) return null

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

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{dashboardData.stats.today_appointments}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <span className="text-2xl">📅</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Patients</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{dashboardData.stats.pending_patients}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <span className="text-2xl">⏳</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Upcoming This Week</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{dashboardData.stats.upcoming_consultations}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed This Month</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{dashboardData.stats.completed_consultations}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <span className="text-2xl">✅</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Appointments */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Appointments</h3>
          </div>
          <div className="p-6">
            {dashboardData.recent_appointments.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent appointments</p>
            ) : (
              <div className="space-y-4">
                {dashboardData.recent_appointments.map((appointment) => (
                  <div key={appointment.appointment_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{appointment.patient_name}</p>
                      <p className="text-sm text-gray-500">{formatDate(appointment.scheduled_time)} at {formatTime(appointment.scheduled_time)}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {appointment.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Consultations */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Consultations</h3>
          </div>
          <div className="p-6">
            {dashboardData.recent_consultations.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent consultations</p>
            ) : (
              <div className="space-y-4">
                {dashboardData.recent_consultations.map((consultation) => (
                  <div key={consultation.consultation_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{consultation.patient_name}</p>
                      <p className="text-sm text-gray-500">{formatDate(consultation.completed_at)}</p>
                    </div>
                    <div className="text-right">
                      {consultation.duration_minutes && (
                        <span className="text-sm text-gray-600">{consultation.duration_minutes} min</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

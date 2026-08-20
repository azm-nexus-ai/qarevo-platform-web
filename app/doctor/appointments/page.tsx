'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface AppointmentSummary {
  appointment_id: string
  patient_id: string
  patient_name: string
  start_at: string
  end_at: string
  status: string
  consultation_id: string | null
  consultation_modality: string | null
}

interface AppointmentsData {
  appointments: AppointmentSummary[]
  total_count: number
  filtered_count: number
}

export default function DoctorAppointments() {
  const router = useRouter()
  const [appointmentsData, setAppointmentsData] = useState<AppointmentsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')

  useEffect(() => {
    // TODO: Replace with actual provider ID from auth
    const providerId = 'mock-provider-id'
    
    const url = statusFilter 
      ? `/api/v1/doctor/appointments?provider_id=${providerId}&status=${statusFilter}`
      : `/api/v1/doctor/appointments?provider_id=${providerId}`
    
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch appointments')
        return res.json()
      })
      .then(data => {
        setAppointmentsData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [statusFilter])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'booked':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'no_show':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleAppointmentClick = (appointmentId: string) => {
    router.push(`/doctor/appointments/${appointmentId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading appointments...</div>
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

  if (!appointmentsData) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-500 mt-1">Manage your scheduled appointments</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="booked">Booked</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Total Appointments</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{appointmentsData.total_count}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Filtered Results</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{appointmentsData.filtered_count}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Upcoming</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {appointmentsData.appointments.filter(a => a.status === 'booked').length}
          </p>
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Scheduled Appointments</h3>
        </div>
        <div className="p-6">
          {appointmentsData.appointments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No appointments found</p>
          ) : (
            <div className="space-y-4">
              {appointmentsData.appointments.map((appointment) => (
                <div
                  key={appointment.appointment_id}
                  onClick={() => handleAppointmentClick(appointment.appointment_id)}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">
                        {appointment.patient_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{appointment.patient_name}</p>
                      <p className="text-sm text-gray-500">{formatDate(appointment.start_at)}</p>
                      {appointment.consultation_modality && (
                        <p className="text-xs text-gray-400 mt-1">
                          {appointment.consultation_modality}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                      {appointment.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-gray-400">→</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  clearPortalSession,
  getDoctorAppointments,
  isAuthError,
  readSessionMarker,
  type DoctorAppointmentsResponse,
} from '@/lib/api'

export default function DoctorAppointments() {
  const router = useRouter()
  const [appointmentsData, setAppointmentsData] = useState<DoctorAppointmentsResponse | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
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

    async function fetchAppointments() {
      setLoading(true)
      try {
        const data = await getDoctorAppointments(statusFilter || undefined, { page, page_size: pageSize })
        if (!cancelled) {
          setAppointmentsData(data)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearPortalSession()
          router.replace('/auth/doctor/login')
          return
        }
        console.error('Failed to load doctor appointments', err)
        if (!cancelled) setError('Unable to load appointments right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAppointments()

    return () => {
      cancelled = true
    }
  }, [router, statusFilter, page])

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
        return 'bg-surface-subtle text-ink'
    }
  }

  const handleViewDetails = (appointmentId: string) => {
    router.push(`/doctor/appointments/${appointmentId}`)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted">Loading appointments...</div>
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
  }

  if (!appointmentsData) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink truncate">Appointments</h1>
          <p className="text-muted mt-1 text-sm truncate">Manage your scheduled appointments</p>
        </div>
        <div className="flex items-center space-x-4 flex-shrink-0">
          <select
            aria-label="Appointment status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 border border-theme rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-auto"
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
        <div className="bg-surface rounded-lg shadow-sm border border-theme p-6">
          <p className="text-sm font-medium text-secondary">Total Appointments</p>
          <p className="text-3xl font-bold text-ink mt-2">{appointmentsData.total_count}</p>
        </div>
        <div className="bg-surface rounded-lg shadow-sm border border-theme p-6">
          <p className="text-sm font-medium text-secondary">Filtered Results</p>
          <p className="text-3xl font-bold text-ink mt-2">{appointmentsData.filtered_count}</p>
        </div>
        <div className="bg-surface rounded-lg shadow-sm border border-theme p-6">
          <p className="text-sm font-medium text-secondary">Upcoming</p>
          <p className="text-3xl font-bold text-ink mt-2">
            {appointmentsData.appointments.filter(a => a.status === 'booked').length}
          </p>
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-surface rounded-lg shadow-sm border border-theme">
        <div className="p-6 border-b border-theme">
          <h3 className="text-lg font-semibold text-ink">Scheduled Appointments</h3>
        </div>
        <div className="p-6">
          {appointmentsData.appointments.length === 0 ? (
            <p className="text-muted text-center py-8">No appointments found</p>
          ) : (
            <div className="space-y-4">
              {appointmentsData.appointments.map((appointment) => (
                <button
                  type="button"
                  key={appointment.appointment_id}
                  onClick={() => handleViewDetails(appointment.appointment_id)}
                  className="flex w-full items-center justify-between p-4 bg-canvas rounded-lg hover:bg-surface-subtle cursor-pointer transition-colors flex-col sm:flex-row gap-4 text-left"
                >
                  <div className="flex items-center space-x-4 w-full sm:w-auto">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">
                        {appointment.patient_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-ink">{appointment.patient_name}</p>
                      <p className="text-sm text-muted">{formatDate(appointment.start_at)}</p>
                      {appointment.consultation_modality && (
                        <p className="text-xs text-muted mt-1">
                          {appointment.consultation_modality}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 flex-shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                      {appointment.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-muted">→</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="mt-6 flex items-center justify-between border-t border-theme pt-4 flex-col sm:flex-row gap-4">
            <p className="text-sm text-muted">
              Page {appointmentsData.page} · Showing {appointmentsData.appointments.length} of {appointmentsData.filtered_count}
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                disabled={!appointmentsData.has_previous || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-theme px-3 py-2 text-sm font-semibold text-secondary disabled:cursor-not-allowed disabled:opacity-45"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!appointmentsData.has_next || loading}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-theme px-3 py-2 text-sm font-semibold text-secondary disabled:cursor-not-allowed disabled:opacity-45"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

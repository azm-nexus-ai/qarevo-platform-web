'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  clearAuthTokens,
  getDoctorAppointment,
  isAuthError,
  readAccessToken,
  updateDoctorAppointmentStatus,
  type DoctorAppointmentDetail,
} from '@/lib/api'

export default function AppointmentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const appointmentId = params.appointmentId as string
  
  const [appointmentData, setAppointmentData] = useState<DoctorAppointmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/doctor/login')
      return
    }

    let cancelled = false

    async function fetchAppointment() {
      try {
        const data = await getDoctorAppointment(appointmentId)
        if (!cancelled) setAppointmentData(data)
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to fetch appointment details')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAppointment()

    return () => {
      cancelled = true
    }
  }, [appointmentId, router])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdatingStatus(true)
    try {
      const data = await updateDoctorAppointmentStatus(appointmentId, newStatus)
      setAppointmentData(data)
      setError(null)
    } catch (err) {
      if (isAuthError(err)) {
        clearAuthTokens()
        router.replace('/auth/sign-in')
        return
      }
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleBack = () => {
    router.push('/doctor/appointments')
  }

  const handleGoToConsultation = () => {
    if (appointmentData?.consultation_id) {
      router.push(`/doctor/workspace/${appointmentData.consultation_id}`)
    }
  }

  const handleGoToEpisode = () => {
    if (appointmentData?.episode_id) {
      router.push(`/doctor/episodes/${appointmentData.episode_id}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading appointment details...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error: {error}</div>
        <button
          onClick={handleBack}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Back to Appointments
        </button>
      </div>
    )
  }

  if (!appointmentData) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4 flex-1 min-w-0">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            ← Back
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">Appointment Details</h1>
            <p className="text-gray-500 mt-1 text-sm truncate">ID: {appointmentData.appointment_id}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 flex-shrink-0">
          {appointmentData.consultation_id && (
            <button
              onClick={handleGoToConsultation}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Go to Consultation
            </button>
          )}
          {appointmentData.episode_id && (
            <button
              onClick={handleGoToEpisode}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              View Intake & AI Draft
            </button>
          )}
        </div>
      </div>

      {/* Patient Information */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Patient Information</h3>
        </div>
        <div className="p-6">
          <div className="flex items-start space-x-4 flex-col sm:flex-row">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-bold text-xl">
                {appointmentData.patient_name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-semibold text-gray-900 truncate">{appointmentData.patient_name}</h4>
              <div className="mt-2 space-y-1">
                {appointmentData.patient_email && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Email:</span> {appointmentData.patient_email}
                  </p>
                )}
                {appointmentData.patient_phone && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Phone:</span> {appointmentData.patient_phone}
                  </p>
                )}
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Patient ID:</span> {appointmentData.patient_id}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Appointment Details</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              <p className="mt-1 text-gray-900">{appointmentData.status.replace('_', ' ').toUpperCase()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Consultation Modality</p>
              <p className="mt-1 text-gray-900">{appointmentData.consultation_modality || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Start Time</p>
              <p className="mt-1 text-gray-900">{formatDate(appointmentData.start_at)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">End Time</p>
              <p className="mt-1 text-gray-900">{formatDate(appointmentData.end_at)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Consultation ID</p>
              <p className="mt-1 text-gray-900">{appointmentData.consultation_id || 'None'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Consultation Status</p>
              <p className="mt-1 text-gray-900">{appointmentData.consultation_status || 'None'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Created At</p>
              <p className="mt-1 text-gray-900">{formatDate(appointmentData.created_at)}</p>
            </div>
            {appointmentData.cancelled_at && (
              <div>
                <p className="text-sm font-medium text-gray-600">Cancelled At</p>
                <p className="mt-1 text-gray-900">{formatDate(appointmentData.cancelled_at)}</p>
              </div>
            )}
          </div>
          {appointmentData.status.toLowerCase() === 'cancelled' && appointmentData.cancellation_reason && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-600">Cancellation Reason</p>
              <p className="mt-1 text-gray-900">{appointmentData.cancellation_reason}</p>
            </div>
          )}
        </div>
      </div>

      {/* Patient Intake Information */}
      {appointmentData.episode_id && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Patient Intake Information</h3>
              {appointmentData.ai_draft_ready && (
                <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                  AI Draft Ready
                </span>
              )}
            </div>
          </div>
          <div className="p-6">
            {appointmentData.chief_complaint ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Chief Complaint</p>
                  <p className="mt-1 text-gray-900">{appointmentData.chief_complaint}</p>
                </div>
                {appointmentData.intake_submitted_at && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Intake Submitted</p>
                    <p className="mt-1 text-gray-900">{formatDate(appointmentData.intake_submitted_at)}</p>
                  </div>
                )}
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={handleGoToEpisode}
                    className="text-purple-600 hover:text-purple-700 font-medium text-sm"
                  >
                    View Full Intake & AI Draft →
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">
                No intake information available. Click &ldquo;View Intake & AI Draft&rdquo; to see full episode details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Update */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Update Status</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center space-x-4 flex-col sm:flex-row w-full">
            <select
              value={appointmentData.status}
              onChange={(e) => handleStatusUpdate(e.target.value)}
              disabled={updatingStatus}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 w-full sm:w-auto"
            >
              <option value="booked">Booked</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
            {updatingStatus && (
              <span className="text-sm text-gray-500">Updating...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

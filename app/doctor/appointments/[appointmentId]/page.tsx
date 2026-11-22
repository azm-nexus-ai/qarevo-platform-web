'use client'

import { useTranslations } from 'next-intl'
import { getApiErrorDetail } from '@/lib/api'
import '@/components/doctor/doctor-clinical.css'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  clearPortalSession,
  getDoctorAppointment,
  isAuthError,
  readSessionMarker,
  updateDoctorAppointmentStatus,
  type DoctorAppointmentDetail,
} from '@/lib/api'

export default function AppointmentDetailPage() {
  const t = useTranslations('doctorAppointment');
  const router = useRouter()
  const params = useParams()
  const appointmentId = params.appointmentId as string

  const [appointmentData, setAppointmentData] = useState<DoctorAppointmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    if (!readSessionMarker()) {
      clearPortalSession()
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
          clearPortalSession()
          router.replace('/auth/doctor/login')
          return
        }
        setError(getApiErrorDetail(err) || 'Failed to fetch appointment details')
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
        clearPortalSession()
        router.replace('/auth/doctor/login')
        return
      }
      setError(getApiErrorDetail(err) || 'Failed to update status')
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
        <div className="text-muted">{t('loadingAppointmentDetails')}</div>
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
          {t('backToAppointments')}
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
            className="p-2 hover:bg-surface-subtle rounded-lg transition-colors flex-shrink-0"
          >
            {t('back')}
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink truncate">{t('appointmentDetails')}</h1>
            <p className="text-muted mt-1 text-sm truncate">ID: {appointmentData.appointment_id}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 flex-shrink-0">
          {appointmentData.consultation_id && (
            <button
              onClick={handleGoToConsultation}
              className="clinical-action clinical-action--primary"
            >
              {t('goToConsultation')}
            </button>
          )}
          {appointmentData.episode_id && (
            <button
              onClick={handleGoToEpisode}
              className="clinical-action clinical-action--ai"
            >
              {appointmentData.ai_draft_ready ? 'View AI Draft' : 'View Intake & AI Draft'}
            </button>
          )}
        </div>
      </div>

      {appointmentData.ai_available === false && <p className="clinical-info" role="status">AI draft status is temporarily unavailable. Your saved appointment and intake remain accessible; open intake to retry clinical review.</p>}
      {appointmentData.clinical_context_available === false && <p className="clinical-info" role="status">Clinical context could not be checked. The appointment is still saved; open intake to retry.</p>}
      {/* Patient Information */}
      <div className="bg-surface rounded-lg shadow-sm border border-theme">
        <div className="p-6 border-b border-theme">
          <h3 className="text-lg font-semibold text-ink">{t('patientInformation')}</h3>
        </div>
        <div className="p-6">
          <div className="flex items-start space-x-4 flex-col sm:flex-row">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-bold text-xl">
                {appointmentData.patient_name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-semibold text-ink truncate">{appointmentData.patient_name}</h4>
              <div className="mt-2 space-y-1">
                {appointmentData.patient_email && (
                  <p className="text-sm text-secondary">
                    <span className="font-medium">{t('email')}</span> {appointmentData.patient_email}
                  </p>
                )}
                {appointmentData.patient_phone && (
                  <p className="text-sm text-secondary">
                    <span className="font-medium">{t('phone')}</span> {appointmentData.patient_phone}
                  </p>
                )}
                <p className="text-sm text-secondary">
                  <span className="font-medium">{t('patientId')}</span> {appointmentData.patient_id}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Details */}
      <div className="bg-surface rounded-lg shadow-sm border border-theme">
        <div className="p-6 border-b border-theme">
          <h3 className="text-lg font-semibold text-ink">{t('appointmentDetails')}</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-secondary">{t('status')}</p>
              <p className="mt-1 text-ink">{appointmentData.status.replace('_', ' ').toUpperCase()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary">{t('consultationModality')}</p>
              <p className="mt-1 text-ink">{appointmentData.consultation_modality || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary">{t('startTime')}</p>
              <p className="mt-1 text-ink">{formatDate(appointmentData.start_at)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary">{t('endTime')}</p>
              <p className="mt-1 text-ink">{formatDate(appointmentData.end_at)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary">{t('consultationId')}</p>
              <p className="mt-1 text-ink">{appointmentData.consultation_id || 'None'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary">{t('consultationStatus')}</p>
              <p className="mt-1 text-ink">{appointmentData.consultation_status || 'None'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary">{t('createdAt')}</p>
              <p className="mt-1 text-ink">{formatDate(appointmentData.created_at)}</p>
            </div>
            {appointmentData.cancelled_at && (
              <div>
                <p className="text-sm font-medium text-secondary">{t('cancelledAt')}</p>
                <p className="mt-1 text-ink">{formatDate(appointmentData.cancelled_at)}</p>
              </div>
            )}
          </div>
          {appointmentData.status.toLowerCase() === 'cancelled' && appointmentData.cancellation_reason && (
            <div className="mt-6 pt-6 border-t border-theme">
              <p className="text-sm font-medium text-secondary">{t('cancellationReason')}</p>
              <p className="mt-1 text-ink">{appointmentData.cancellation_reason}</p>
            </div>
          )}
        </div>
      </div>

      {/* Patient Intake Information */}
      {appointmentData.episode_id && (
        <div className="bg-surface rounded-lg shadow-sm border border-theme">
          <div className="p-6 border-b border-theme">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink">{t('patientIntakeInformation')}</h3>
              {appointmentData.ai_draft_ready && (
                <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                  {t('aiDraftReady')}
                </span>
              )}
            </div>
          </div>
          <div className="p-6">
            {appointmentData.chief_complaint ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-secondary">{t('chiefComplaint')}</p>
                  <p className="mt-1 text-ink">{appointmentData.chief_complaint}</p>
                </div>
                {appointmentData.intake_submitted_at && (
                  <div>
                    <p className="text-sm font-medium text-secondary">{t('intakeSubmitted')}</p>
                    <p className="mt-1 text-ink">{formatDate(appointmentData.intake_submitted_at)}</p>
                  </div>
                )}
                <div className="pt-4 border-t border-theme">
                  <button
                    onClick={handleGoToEpisode}
                    className="clinical-action clinical-action--ai"
                  >
                    {t('viewFullIntakeAiDraft')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-muted text-sm">
                No intake information available. Click &ldquo;View Intake & AI Draft&rdquo; to see full episode details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Update */}
      <div className="bg-surface rounded-lg shadow-sm border border-theme">
        <div className="p-6 border-b border-theme">
          <h3 className="text-lg font-semibold text-ink">{t('updateStatus')}</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center space-x-4 flex-col sm:flex-row w-full">
            <select
              value={appointmentData.status}
              onChange={(e) => handleStatusUpdate(e.target.value)}
              disabled={updatingStatus}
              className="px-4 py-2 border border-theme rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 w-full sm:w-auto"
            >
              <option value="booked">{t('booked')}</option>
              <option value="completed">{t('completed')}</option>
              <option value="cancelled">{t('cancelled')}</option>
              <option value="no_show">{t('noShow')}</option>
            </select>
            {updatingStatus && (
              <span className="text-sm text-muted">{t('updating')}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import ClinicalRecordEditor from '@/components/doctor/ClinicalRecordEditor'
import {
  clearAuthTokens,
  getDoctorConsultation,
  isAuthError,
  readAccessToken,
  type DoctorConsultationDetailResponse,
} from '@/lib/api'

export default function ConsultationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const consultationId = params.consultationId as string

  const [consultationData, setConsultationData] = useState<DoctorConsultationDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/doctor/login')
      return
    }

    let cancelled = false

    async function fetchConsultation() {
      try {
        const data = await getDoctorConsultation(consultationId)
        if (!cancelled) setConsultationData(data)
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to fetch consultation details')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchConsultation()

    return () => {
      cancelled = true
    }
  }, [consultationId, router])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleJoinVideo = () => {
    router.push(`/doctor/video-consultation?consultationId=${encodeURIComponent(consultationId)}`)
  }

  const handleBack = () => {
    router.push('/doctor/workspace')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted">Loading consultation details...</div>
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
          Back to Workspace
        </button>
      </div>
    )
  }

  if (!consultationData) return null

  const { consultation, can_join_video } = consultationData

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-surface-subtle rounded-lg transition-colors"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-ink">Consultation Details</h1>
            <p className="text-muted mt-1">ID: {consultation.consultation_id}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {can_join_video && (
            <button
              onClick={handleJoinVideo}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Join Video
            </button>
          )}

        </div>
      </div>

      {/* Patient Information */}
      <div className="bg-surface rounded-lg shadow-sm border border-theme">
        <div className="p-6 border-b border-theme">
          <h3 className="text-lg font-semibold text-ink">Patient Information</h3>
        </div>
        <div className="p-6">
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-bold text-xl">
                {consultation.patient_name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-semibold text-ink">{consultation.patient_name}</h4>
              <div className="mt-2 space-y-1">
                {consultation.patient_email && (
                  <p className="text-sm text-secondary">
                    <span className="font-medium">Email:</span> {consultation.patient_email}
                  </p>
                )}
                {consultation.patient_phone && (
                  <p className="text-sm text-secondary">
                    <span className="font-medium">Phone:</span> {consultation.patient_phone}
                  </p>
                )}
                <p className="text-sm text-secondary">
                  <span className="font-medium">Patient ID:</span> {consultation.patient_id}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Consultation Details */}
      <div className="bg-surface rounded-lg shadow-sm border border-theme">
        <div className="p-6 border-b border-theme">
          <h3 className="text-lg font-semibold text-ink">Consultation Details</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-secondary">Status</p>
              <p className="mt-1 text-ink">{consultation.status.replace('_', ' ').toUpperCase()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary">Modality</p>
              <p className="mt-1 text-ink">{consultation.consultation_modality || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary">Scheduled Time</p>
              <p className="mt-1 text-ink">{formatDate(consultation.scheduled_time)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary">Started At</p>
              <p className="mt-1 text-ink">{formatDate(consultation.started_at)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary">Ended At</p>
              <p className="mt-1 text-ink">{formatDate(consultation.ended_at)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary">Appointment ID</p>
              <p className="mt-1 text-ink">{consultation.appointment_id || 'None'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-secondary">Video Session ID</p>
              <p className="mt-1 text-ink">{consultation.video_session_id || 'None'}</p>
            </div>
          </div>
        </div>
      </div>

      <ClinicalRecordEditor key={consultationId} consultationId={consultationId} consultationStatus={consultation.status}
        onPublished={async () => { setConsultationData(await getDoctorConsultation(consultationId)) }} />
    </div>
  )
}

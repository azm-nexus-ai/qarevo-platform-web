'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  clearAuthTokens,
  completeDoctorConsultation,
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
  const [completing, setCompleting] = useState(false)
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
    // TODO: Navigate to video consultation page
    router.push(`/doctor/video-consultation/${consultationId}`)
  }

  const handleComplete = async () => {
    setCompleting(true)
    setError(null)

    try {
      const data = await completeDoctorConsultation(consultationId)
      setConsultationData(data)
    } catch (err) {
      if (isAuthError(err)) {
        clearAuthTokens()
        router.replace('/auth/sign-in')
        return
      }
      setError(err instanceof Error ? err.message : 'Failed to complete consultation')
    } finally {
      setCompleting(false)
    }
  }

  const handleBack = () => {
    router.push('/doctor/workspace')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading consultation details...</div>
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

  const { consultation, can_join_video, can_complete } = consultationData

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consultation Details</h1>
            <p className="text-gray-500 mt-1">ID: {consultation.consultation_id}</p>
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
          {can_complete && (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              {completing ? 'Completing...' : 'Complete Consultation'}
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
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-bold text-xl">
                {consultation.patient_name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-semibold text-gray-900">{consultation.patient_name}</h4>
              <div className="mt-2 space-y-1">
                {consultation.patient_email && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Email:</span> {consultation.patient_email}
                  </p>
                )}
                {consultation.patient_phone && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Phone:</span> {consultation.patient_phone}
                  </p>
                )}
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Patient ID:</span> {consultation.patient_id}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Consultation Details */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Consultation Details</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              <p className="mt-1 text-gray-900">{consultation.status.replace('_', ' ').toUpperCase()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Modality</p>
              <p className="mt-1 text-gray-900">{consultation.consultation_modality || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Scheduled Time</p>
              <p className="mt-1 text-gray-900">{formatDate(consultation.scheduled_time)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Started At</p>
              <p className="mt-1 text-gray-900">{formatDate(consultation.started_at)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Ended At</p>
              <p className="mt-1 text-gray-900">{formatDate(consultation.ended_at)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Appointment ID</p>
              <p className="mt-1 text-gray-900">{consultation.appointment_id || 'None'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Video Session ID</p>
              <p className="mt-1 text-gray-900">{consultation.video_session_id || 'None'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Capabilities */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Available Actions</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg ${can_join_video ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
              <p className="font-medium text-gray-900">Join Video Session</p>
              <p className="text-sm text-gray-600 mt-1">
                {can_join_video ? 'Available' : 'Not available'}
              </p>
            </div>
            <div className={`p-4 rounded-lg ${can_complete ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
              <p className="font-medium text-gray-900">Complete Consultation</p>
              <p className="text-sm text-gray-600 mt-1">
                {can_complete ? 'Available' : 'Not available'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

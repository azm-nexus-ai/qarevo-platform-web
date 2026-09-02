'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  clearAuthTokens,
  getDoctorEpisodes,
  getDoctorWorkspace,
  isAuthError,
  readAccessToken,
  type DoctorEpisodeListResponse,
  type DoctorWorkspaceResponse,
} from '@/lib/api'

export default function PhysicianWorkspace() {
  const router = useRouter()
  const [workspaceData, setWorkspaceData] = useState<DoctorWorkspaceResponse | null>(null)
  const [episodeData, setEpisodeData] = useState<DoctorEpisodeListResponse | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [consultationPage, setConsultationPage] = useState(1)
  const [episodePage, setEpisodePage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageSize = 10

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/sign-in')
      return
    }

    let cancelled = false

    async function fetchWorkspace() {
      setLoading(true)
      try {
        const [data, episodes] = await Promise.all([
          getDoctorWorkspace(statusFilter || undefined, { page: consultationPage, page_size: pageSize }),
          getDoctorEpisodes(statusFilter || undefined, { page: episodePage, page_size: pageSize }),
        ])
        if (!cancelled) {
          setWorkspaceData(data)
          setEpisodeData(episodes)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to load doctor workspace', err)
        if (!cancelled) setError('Unable to load workspace right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchWorkspace()

    return () => {
      cancelled = true
    }
  }, [router, statusFilter, consultationPage, episodePage])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not scheduled'
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
      case 'scheduled':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const handleConsultationClick = (consultationId: string) => {
    router.push(`/doctor/workspace/${consultationId}`)
  }

  const handleEpisodeClick = (episodeId: string) => {
    router.push(`/doctor/episodes/${episodeId}`)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading workspace...</div>
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
  }

  if (!workspaceData) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Physician Workspace</h1>
          <p className="text-gray-500 mt-1">Manage your consultations and patient queue</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setConsultationPage(1)
              setEpisodePage(1)
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Total Consultations</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{workspaceData.total_count}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Filtered Results</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{workspaceData.filtered_count}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Active Patients</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {workspaceData.consultations.filter(c => c.status === 'in_progress').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Assigned Episodes</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{episodeData?.total_count || 0}</p>
        </div>
      </div>

      {/* Consultations List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Consultations Queue</h3>
        </div>
        <div className="p-6">
          {workspaceData.consultations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No consultations found</p>
          ) : (
            <div className="space-y-4">
              {workspaceData.consultations.map((consultation) => (
                <div
                  key={consultation.consultation_id}
                  onClick={() => handleConsultationClick(consultation.consultation_id)}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">
                        {consultation.patient_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{consultation.patient_name}</p>
                      <p className="text-sm text-gray-500">{formatDate(consultation.scheduled_time)}</p>
                      {consultation.waiting_duration_minutes !== null && (
                        <p className="text-xs text-orange-600 mt-1">
                          Waiting: {consultation.waiting_duration_minutes} min
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(consultation.status)}`}>
                      {consultation.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-gray-400">→</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-500">
              Page {workspaceData.page} · Showing {workspaceData.consultations.length} of {workspaceData.filtered_count}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!workspaceData.has_previous || loading}
                onClick={() => setConsultationPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!workspaceData.has_next || loading}
                onClick={() => setConsultationPage((current) => current + 1)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Workflow Episodes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Clinical Workflow Episodes</h3>
          <p className="text-sm text-gray-500 mt-1">Assigned CWS episodes with intake and AI draft readiness.</p>
        </div>
        <div className="p-6">
          {!episodeData || episodeData.episodes.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No assigned episodes found</p>
          ) : (
            <div className="space-y-4">
              {episodeData.episodes.map((episode) => (
                <button
                  key={episode.episode_id}
                  type="button"
                  onClick={() => handleEpisodeClick(episode.episode_id)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors text-left"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
                      <span className="text-cyan-700 font-semibold">
                        {episode.patient.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{episode.patient.name}</p>
                      <p className="text-sm text-gray-500">{episode.chief_complaint || episode.status.replaceAll('_', ' ')}</p>
                      {episode.intake_submitted_at && (
                        <p className="text-xs text-cyan-700 mt-1">Intake submitted: {formatDate(episode.intake_submitted_at)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${episode.ai_draft_ready ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {episode.ai_draft_ready ? 'AI READY' : episode.latest_ai_job_status?.toUpperCase() || 'NO AI DRAFT'}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(episode.status)}`}>
                      {episode.status.replaceAll('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-gray-400">→</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {episodeData && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
              <p className="text-sm text-gray-500">
                Page {episodeData.page} · Showing {episodeData.episodes.length} of {episodeData.filtered_count}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!episodeData.has_previous || loading}
                  onClick={() => setEpisodePage((current) => Math.max(1, current - 1))}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!episodeData.has_next || loading}
                  onClick={() => setEpisodePage((current) => current + 1)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  clearAuthTokens,
  getDoctorEpisodeClinicalContext,
  performAIDraftAction,
  getEpisodeTimeline,
  isAuthError,
  readAccessToken,
  type DoctorEpisodeClinicalContextResponse,
  type AIDraftActionRequest,
  type EpisodeTimelineResponse,
} from '@/lib/api'

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not provided'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}

export default function DoctorEpisodeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const episodeId = params.episodeId as string
  const [context, setContext] = useState<DoctorEpisodeClinicalContextResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [timeline, setTimeline] = useState<EpisodeTimelineResponse | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(true)

  const handleAcceptDraft = async (draftId: string) => {
    setActionLoading(draftId)
    setActionError(null)
    try {
      const actionData: AIDraftActionRequest = {
        action: 'accept',
        draft_id: draftId,
      }
      await performAIDraftAction(episodeId, actionData)
      const [data, timelineData] = await Promise.all([
        getDoctorEpisodeClinicalContext(episodeId),
        getEpisodeTimeline(episodeId),
      ])
      setContext(data)
      setTimeline(timelineData)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to accept AI draft')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectDraft = async (draftId: string) => {
    if (!rejectReason.trim()) {
      setActionError('Please provide a reason for rejection')
      return
    }
    setActionLoading(draftId)
    setActionError(null)
    try {
      const actionData: AIDraftActionRequest = {
        action: 'reject',
        draft_id: draftId,
        reason: rejectReason,
      }
      await performAIDraftAction(episodeId, actionData)
      setShowRejectDialog(null)
      setRejectReason('')
      const [data, timelineData] = await Promise.all([
        getDoctorEpisodeClinicalContext(episodeId),
        getEpisodeTimeline(episodeId),
      ])
      setContext(data)
      setTimeline(timelineData)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject AI draft')
    } finally {
      setActionLoading(null)
    }
  }

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/sign-in')
      return
    }

    let cancelled = false

    async function fetchData() {
      try {
        const [contextData, timelineData] = await Promise.all([
          getDoctorEpisodeClinicalContext(episodeId),
          getEpisodeTimeline(episodeId),
        ])
        if (!cancelled) {
          setContext(contextData)
          setTimeline(timelineData)
          setError(null)
        }
      } catch (err) {
        if (isAuthError(err)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        setError(err instanceof Error ? err.message : 'Unable to load episode clinical context')
      } finally {
        if (!cancelled) {
          setLoading(false)
          setTimelineLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [episodeId, router])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading clinical context...</div>
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
        <button
          type="button"
          onClick={() => router.push('/doctor/workspace')}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Back to Workspace
        </button>
      </div>
    )
  }

  if (!context) return null

  const { episode, intake, field_values, ai_drafts, ai_available } = context
  const intakeResponses =
    intake && typeof intake.responses === 'object' && intake.responses !== null
      ? (intake.responses as Record<string, unknown>)
      : {}

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => router.push('/doctor/workspace')}
            className="mb-4 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            ← Back to Workspace
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Clinical Episode Review</h1>
          <p className="text-gray-500 mt-1">Episode ID: {episode.episode_id}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            {episode.status.replaceAll('_', ' ').toUpperCase()}
          </span>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${episode.ai_draft_ready ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
            {episode.ai_draft_ready ? 'AI DRAFT READY' : episode.latest_ai_job_status?.toUpperCase() || 'NO AI DRAFT'}
          </span>
        </div>
      </div>

      <Section title="Patient">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Name</p>
            <p className="mt-1 font-semibold text-gray-900">{episode.patient.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Email</p>
            <p className="mt-1 text-gray-900">{episode.patient.email || 'Not available'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Phone</p>
            <p className="mt-1 text-gray-900">{episode.patient.phone || 'Not available'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Consultation</p>
            <p className="mt-1 text-gray-900">{episode.consultation_id || 'Not linked yet'}</p>
          </div>
        </div>
      </Section>

      <Section title="Workflow Status">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Created</p>
            <p className="mt-1 text-gray-900">{formatDate(episode.created_at)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Intake Submitted</p>
            <p className="mt-1 text-gray-900">{formatDate(episode.intake_submitted_at)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Field Verification</p>
            <p className="mt-1 text-gray-900">
              {episode.verification_verified_count} of {episode.verification_total_count}
            </p>
          </div>
        </div>
      </Section>

      <Section title="Intake Response">
        {Object.keys(intakeResponses).length === 0 ? (
          <p className="text-gray-500">No intake response has been submitted yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(intakeResponses).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{key.replaceAll('_', ' ')}</p>
                <p className="mt-2 text-sm text-gray-900">{displayValue(value)}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="AI Drafts">
        {!ai_available && <p className="mb-4 text-sm text-amber-700">AI Services is currently unavailable. Episode data is still available.</p>}
        {actionError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{actionError}</p>
          </div>
        )}
        {ai_drafts.length === 0 ? (
          <p className="text-gray-500">No AI draft job exists for this episode yet.</p>
        ) : (
          <div className="space-y-4">
            {ai_drafts.map((job) => {
              const draft = job.draft as Record<string, unknown> | null | undefined
              const jobId = String(job.job_id)
              const draftId = String(job.draft_id || jobId)
              const isReady = draft && job.status === 'completed'
              return (
                <div key={jobId} className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-gray-900">Job {jobId}</p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                      {String(job.status || 'unknown').toUpperCase()}
                    </span>
                  </div>
                  {draft ? (
                    <div className="mt-3 text-sm text-gray-700">
                      <p className="font-medium text-gray-900">Physician review required</p>
                      <p className="mt-1">{displayValue(draft.summary_text)}</p>
                      {isReady && (
                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleAcceptDraft(draftId)}
                            disabled={actionLoading === draftId}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                          >
                            {actionLoading === draftId ? 'Processing...' : 'Accept Draft'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowRejectDialog(draftId)}
                            disabled={actionLoading === draftId}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                          >
                            Reject Draft
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-500">Draft output is not ready yet.</p>
                  )}
                  {showRejectDialog === draftId && (
                    <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
                      <p className="text-sm font-medium text-gray-900 mb-2">Reason for rejection</p>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Please explain why you are rejecting this AI draft..."
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        rows={3}
                      />
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRejectDraft(draftId)}
                          disabled={actionLoading === draftId}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          {actionLoading === draftId ? 'Processing...' : 'Submit Rejection'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowRejectDialog(null)
                            setRejectReason('')
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      <Section title="CWS Field Values">
        {field_values.length === 0 ? (
          <p className="text-gray-500">No structured field values have been created for this episode yet.</p>
        ) : (
          <div className="space-y-3">
            {field_values.map((field) => (
              <div key={String(field.id || field.field_id)} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-gray-900">{String(field.field_id || 'Field')}</p>
                  <span className="text-xs font-semibold text-gray-500">
                    {String(field.verification_status || 'unverified').toUpperCase()}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-700">{displayValue(field.verified_value ?? field.original_value)}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Episode Timeline">
        {timelineLoading ? (
          <p className="text-gray-500">Loading timeline...</p>
        ) : !timeline || timeline.events.length === 0 ? (
          <p className="text-gray-500">No timeline events available for this episode.</p>
        ) : (
          <div className="space-y-4">
            {timeline.events.map((event) => (
              <div key={event.event_id} className="relative pl-8 pb-4 border-l-2 border-gray-200 last:border-l-0 last:pb-0">
                <div className="absolute left-0 top-0 w-6 h-6 -ml-3 bg-blue-100 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-2 h-2 bg-blue-600 rounded-full" />
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-900">{event.description}</p>
                    <span className="text-xs text-gray-500">{formatDate(event.timestamp)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      {event.event_type.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    {event.actor_role && (
                      <span>by {event.actor_role.toLowerCase()}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

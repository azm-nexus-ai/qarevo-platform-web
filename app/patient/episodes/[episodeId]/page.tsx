'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { 
  getPatientEpisode, 
  getPatientEpisodeIntake, 
  getPatientEpisodeTimeline,
  getPatientEpisodeFields,
  type PatientEpisodeTimelineResponse,
  type PatientEpisodeFieldsResponse,
  type EpisodeResponse 
} from '@/lib/api'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import PatientPortalShell from '@/components/patient/PatientPortalShell'

export default function PatientEpisodeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const episodeId = params.episodeId as string

  const [episode, setEpisode] = useState<EpisodeResponse | null>(null)
  const [intake, setIntake] = useState<Record<string, unknown> | null>(null)
  const [timeline, setTimeline] = useState<PatientEpisodeTimelineResponse | null>(null)
  const [fields, setFields] = useState<PatientEpisodeFieldsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        const [episodeData, intakeData, timelineData, fieldsData] = await Promise.all([
          getPatientEpisode(episodeId),
          getPatientEpisodeIntake(episodeId),
          getPatientEpisodeTimeline(episodeId),
          getPatientEpisodeFields(episodeId),
        ])

        setEpisode(episodeData)
        setIntake(intakeData)
        setTimeline(timelineData)
        setFields(fieldsData)
      } catch (err) {
        console.error('Failed to load episode data:', err)
        setError('Failed to load episode data. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    if (episodeId) {
      loadData()
    }
  }, [episodeId])

  if (loading) {
    return (
      <PatientPortalShell
        eyebrow="Episode Details"
        title="Loading..."
        description="Please wait while we load your episode information."
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 20px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid rgba(32,181,223,0.2)', 
            borderTopColor: T.blue, 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite' 
          }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </PatientPortalShell>
    )
  }

  if (error || !episode) {
    return (
      <PatientPortalShell
        eyebrow="Episode Details"
        title="Error"
        description="We encountered an issue loading your episode."
      >
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ color: T.red, marginBottom: '20px' }}>{error || 'Episode not found'}</p>
          <button
            onClick={() => router.push(PATIENT_ROUTES.dashboard)}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              background: T.blue,
              color: '#fff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Return to Dashboard
          </button>
        </div>
      </PatientPortalShell>
    )
  }

  return (
    <>
      <style>{`
        .episode-card { background: rgba(255,255,255,0.9); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%); border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.card}; border-radius: 24px; padding: 24px; margin-bottom: 16px; }
        .timeline-item { position: relative; padding-left: 24px; padding-bottom: 24px; border-left: 2px solid rgba(32,181,223,0.2); }
        .timeline-item:last-child { border-left-color: transparent; }
        .timeline-dot { position: absolute; left: -7px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: ${T.blue}; border: 2px solid #fff; box-shadow: 0 0 0 3px rgba(32,181,223,0.2); }
        .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
        .status-badge.active { background: rgba(32,181,223,0.1); color: ${T.blue}; }
        .status-badge.completed { background: rgba(9,173,112,0.1); color: T.green; }
        .status-badge.pending { background: rgba(245,158,11,0.1); color: '#f59e0b'; }
      `}</style>
      <PatientPortalShell
        eyebrow="Episode Details"
        title="Your Care Episode"
        description="View your episode details, intake information, and clinical timeline."
      >
        {/* Episode Overview */}
        <section className="episode-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Episode ID
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: T.navy, fontWeight: 600 }}>
                {episode.id}
              </p>
            </div>
            <span className={`status-badge ${episode.status === 'active' ? 'active' : episode.status === 'completed' ? 'completed' : 'pending'}`}>
              {episode.status}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '16px' }}>
            <div style={{ padding: '12px', borderRadius: '16px', background: 'rgba(247,250,252,0.9)', border: '1px solid rgba(4,53,77,0.08)' }}>
              <div style={{ fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                Pack ID
              </div>
              <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>
                {episode.pack_id}
              </div>
            </div>
            <div style={{ padding: '12px', borderRadius: '16px', background: 'rgba(247,250,252,0.9)', border: '1px solid rgba(4,53,77,0.08)' }}>
              <div style={{ fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                Flow Type
              </div>
              <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>
                {episode.flow_type}
              </div>
            </div>
            <div style={{ padding: '12px', borderRadius: '16px', background: 'rgba(247,250,252,0.9)', border: '1px solid rgba(4,53,77,0.08)' }}>
              <div style={{ fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                Created
              </div>
              <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>
                {new Date(episode.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </section>

        {/* Intake Information */}
        {intake && (
          <section className="episode-card">
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Intake Information
              </p>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: T.navy }}>
                Your Intake Responses
              </h2>
            </div>
            <div style={{ 
              padding: '16px', 
              borderRadius: '16px', 
              background: 'rgba(247,250,252,0.9)', 
              border: '1px solid rgba(4,53,77,0.08)',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              <pre style={{ margin: 0, fontSize: '13px', color: T.slate, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(intake, null, 2)}
              </pre>
            </div>
          </section>
        )}

        {/* AI-Structured Fields */}
        {fields && fields.fields.length > 0 && (
          <section className="episode-card">
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                AI-Structured Clinical Data
              </p>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: T.navy }}>
                Structured Fields ({fields.total_count})
              </h2>
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: T.slate }}>
                These fields were structured from your intake by AI and reviewed by your doctor.
              </p>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              {fields.fields.map((field) => (
                <div 
                  key={field.field_id}
                  style={{ 
                    padding: '16px', 
                    borderRadius: '16px', 
                    background: 'rgba(247,250,252,0.9)', 
                    border: `1px solid ${
                      field.verification_status === 'verified' 
                        ? 'rgba(9,173,112,0.3)' 
                        : field.verification_status === 'rejected'
                        ? 'rgba(220,38,38,0.3)'
                        : 'rgba(4,53,77,0.08)'
                    }` 
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <p style={{ margin: '0 0 4px', fontSize: '12px', color: T.slate2, fontWeight: 600 }}>
                        {field.field_name}
                      </p>
                      <p style={{ margin: 0, fontSize: '14px', color: T.navy, fontWeight: 700 }}>
                        {field.verified_value || field.original_value || 'Not set'}
                      </p>
                    </div>
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '999px', 
                      fontSize: '10px', 
                      fontWeight: 700, 
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      background: 
                        field.verification_status === 'verified' 
                          ? 'rgba(9,173,112,0.15)' 
                          : field.verification_status === 'rejected'
                          ? 'rgba(220,38,38,0.15)'
                          : 'rgba(245,158,11,0.15)',
                      color: 
                        field.verification_status === 'verified' 
                          ? T.green 
                          : field.verification_status === 'rejected'
                          ? T.red
                          : '#f59e0b'
                    }}>
                      {field.verification_status}
                    </span>
                  </div>
                  {field.source === 'ai' && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '8px' }}>
                      <Ico p={ICONS.zap} size={12} color={T.blue} />
                      <span style={{ fontSize: '11px', color: T.blue, fontWeight: 600 }}>
                        AI-generated
                      </span>
                    </div>
                  )}
                  {field.verified_at && (
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: T.slate2 }}>
                      Verified on {new Date(field.verified_at).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Clinical Timeline */}
        {timeline && timeline.events.length > 0 && (
          <section className="episode-card">
            <div style={{ marginBottom: '20px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Clinical Timeline
              </p>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: T.navy }}>
                Episode Activity ({timeline.total_count} events)
              </h2>
            </div>
            <div>
              {timeline.events.map((event) => (
                <div key={event.event_id} className="timeline-item">
                  <div className="timeline-dot" />
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: T.slate2, fontWeight: 600 }}>
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                    {event.actor_role && (
                      <span style={{ fontSize: '11px', color: T.blue, fontWeight: 700, marginLeft: '8px', textTransform: 'uppercase' }}>
                        {event.actor_role}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: '14px', color: T.navy, fontWeight: 700 }}>
                    {event.description}
                  </p>
                  {event.reason && (
                    <p style={{ margin: '0 0 8px', fontSize: '13px', color: T.slate }}>
                      Reason: {event.reason}
                    </p>
                  )}
                  {(event.from_status || event.to_status) && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                      {event.from_status && (
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '6px', 
                          background: 'rgba(245,158,11,0.1)', 
                          color: '#f59e0b', 
                          fontSize: '11px', 
                          fontWeight: 600 
                        }}>
                          {event.from_status}
                        </span>
                      )}
                      <Ico p={ICONS.arrowFwd} size={14} color={T.slate2} />
                      {event.to_status && (
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '6px', 
                          background: 'rgba(9,173,112,0.1)', 
                          color: T.green, 
                          fontSize: '11px', 
                          fontWeight: 600 
                        }}>
                          {event.to_status}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* No Timeline */}
        {timeline && timeline.events.length === 0 && (
          <section className="episode-card">
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Ico p={ICONS.calendar} size={48} color={T.slate2} />
              <p style={{ margin: '16px 0 8px', fontSize: '14px', color: T.navy, fontWeight: 600 }}>
                No Timeline Events Yet
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: T.slate }}>
                Timeline events will appear here as your episode progresses.
              </p>
            </div>
          </section>
        )}
      </PatientPortalShell>
    </>
  )
}

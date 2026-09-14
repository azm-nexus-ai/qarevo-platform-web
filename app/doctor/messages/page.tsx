'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import HoverBtn from '@/components/buttons/HoverBtn'
import Ico from '@/components/ui/Ico'
import { ICONS } from '@/constants/icons'
import { Sh, T } from '@/lib/tokens'
import {
  clearAuthTokens,
  downloadAuthenticatedFile,
  getDoctorMessages,
  isAuthError,
  markDoctorConversationRead,
  readAccessToken,
  sendDoctorMessage,
  sendDoctorMessageAttachment,
  type PortalConversation,
  type PortalMessage,
} from '@/lib/api'

type FilterType = 'All' | 'Unread'

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'PT'
}

function Avatar({ name, online = false }: { name: string; online?: boolean }) {
  const statusColor = online ? T.green : T.amber
  return (
    <div style={{ position: 'relative', width: '44px', height: '44px', flexShrink: 0 }}>
      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(32,181,223,0.16), rgba(52,140,234,0.24))', border: '1px solid rgba(4,53,77,0.11)', display: 'grid', placeItems: 'center', color: T.navy, fontSize: '14px', fontWeight: 800 }}>
        {initialsFor(name)}
      </div>
      <span style={{ position: 'absolute', right: 0, bottom: '2px', width: '10px', height: '10px', borderRadius: '50%', background: statusColor, border: '2px solid #fff' }} />
    </div>
  )
}

function ReplyPreview({ message, onClear }: { message: PortalMessage; onClear: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(32,181,223,0.08)', border: '1px solid rgba(32,181,223,0.16)' }}>
      <div style={{ flex: 1, minWidth: 0, borderLeft: `3px solid ${T.blue}`, paddingLeft: '10px' }}>
        <p style={{ margin: '0 0 2px', color: T.navy, fontSize: '12px', fontWeight: 800 }}>{message.senderId === 'doctor' ? 'Replying to you' : 'Replying to patient'}</p>
        <p style={{ margin: 0, color: T.slate, fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.text || message.attachmentName || 'Message'}</p>
      </div>
      <button type="button" aria-label="Cancel reply" onClick={onClear} style={{ width: '30px', height: '30px', borderRadius: '9px', border: '1px solid rgba(4,53,77,0.1)', background: '#fff', display: 'grid', placeItems: 'center', color: T.slate, cursor: 'pointer' }}>
        <Ico p={ICONS.x} size={15} sw={2} />
      </button>
    </div>
  )
}

function saveBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}

export default function DoctorMessagesPage() {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [conversations, setConversations] = useState<PortalConversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('All')
  const [reply, setReply] = useState('')
  const [replyToMessage, setReplyToMessage] = useState<PortalMessage | null>(null)
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null)
  const [conversationPage, setConversationPage] = useState(1)
  const [conversationMeta, setConversationMeta] = useState({
    totalCount: 0,
    page: 1,
    pageSize: 20,
    hasNext: false,
    hasPrevious: false,
  })
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadConversations = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const payload = await getDoctorMessages({ page: conversationPage, page_size: 20 })
      setConversations(payload.conversations)
      setConversationMeta({
        totalCount: payload.total_count ?? payload.conversations.length,
        page: payload.page ?? conversationPage,
        pageSize: payload.page_size ?? 20,
        hasNext: Boolean(payload.has_next),
        hasPrevious: Boolean(payload.has_previous),
      })
      setActiveConvId((current) => {
        if (current && payload.conversations.some((conversation) => conversation.id === current)) {
          return current
        }
        return payload.conversations[0]?.id ?? null
      })
      setError(null)
    } catch (err) {
      if (isAuthError(err)) {
        clearAuthTokens()
        router.replace('/auth/doctor/login')
        return
      }
      setError(err instanceof Error ? err.message : 'Unable to load conversations.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [conversationPage, router])

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!readAccessToken()) {
      clearAuthTokens()
      router.replace('/auth/doctor/login')
      return
    }
    void loadConversations(true)
    const poll = window.setInterval(() => {
      void loadConversations(false)
    }, 10000)
    return () => window.clearInterval(poll)
  }, [loadConversations, router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConvId, conversations])

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    return conversations.filter((conversation) => {
      const matchesSearch = !q
        || conversation.contactName.toLowerCase().includes(q)
        || conversation.contactRole.toLowerCase().includes(q)
        || conversation.lastMessage.toLowerCase().includes(q)
        || conversation.messages.some((message) => `${message.text ?? ''} ${message.attachmentName ?? ''}`.toLowerCase().includes(q))
      const matchesFilter = filter === 'All' || conversation.unreadCount > 0
      return matchesSearch && matchesFilter
    })
  }, [conversations, filter, search])

  const activeConversation = conversations.find((conversation) => conversation.id === activeConvId) ?? null

  const selectConversation = async (conversationId: string) => {
    setActiveConvId(conversationId)
    setReplyToMessage(null)
    setConversations((current) => current.map((conversation) => (
      conversation.id === conversationId
        ? { ...conversation, unreadCount: 0, messages: conversation.messages.map((message) => ({ ...message, isRead: true })) }
        : conversation
    )))
    try {
      const updated = await markDoctorConversationRead(conversationId)
      setConversations((current) => current.map((conversation) => conversation.id === conversationId ? updated : conversation))
    } catch {
      await loadConversations(false)
    }
  }

  const handleSend = async () => {
    if (!activeConversation || (!reply.trim() && !selectedAttachment) || sending) return
    const patientId = activeConversation.contactId.startsWith('patient:')
      ? activeConversation.contactId.replace('patient:', '')
      : ''
    if (!patientId) {
      setError('This conversation is missing a patient reference.')
      return
    }

    setSending(true)
    try {
      let updated: PortalConversation
      if (selectedAttachment) {
        const formData = new FormData()
        formData.append('patient_id', patientId)
        formData.append('file', selectedAttachment)
        if (reply.trim()) formData.append('message', reply.trim())
        if (replyToMessage) formData.append('reply_to_message_id', replyToMessage.id)
        updated = await sendDoctorMessageAttachment(formData)
      } else {
        updated = await sendDoctorMessage({
          patient_id: patientId,
          message: reply.trim(),
          ...(replyToMessage ? { reply_to_message_id: replyToMessage.id } : {}),
        })
      }
      setConversations((current) => [updated, ...current.filter((conversation) => conversation.id !== updated.id)])
      setActiveConvId(updated.id)
      setReply('')
      setSelectedAttachment(null)
      setReplyToMessage(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reply.')
    } finally {
      setSending(false)
    }
  }

  const handleDownloadAttachment = async (message: PortalMessage) => {
    if (!message.attachmentUrl) return
    setError(null)
    try {
      const blob = await downloadAuthenticatedFile(message.attachmentUrl)
      saveBlob(blob, message.attachmentName || 'attachment')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download attachment.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#348CEA' }}>Doctor Platform</p>
          <h1 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '30px', fontWeight: 800, color: T.navy }}>Messages</h1>
          <p style={{ margin: 0, color: T.slate, fontSize: '14px' }}>Read and reply to patient conversations connected to your care team.</p>
        </div>
      </header>

      {error ? <div style={{ borderRadius: '14px', border: '1px solid rgba(220,38,38,0.18)', background: 'rgba(254,242,242,0.92)', color: '#991b1b', padding: '12px 14px', fontSize: '13px', fontWeight: 700 }}>{error}</div> : null}

      <section className="doctor-message-grid" style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: '16px', minHeight: '620px' }}>
        <style>{`
          @media (max-width: 980px) {
            .doctor-message-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
        <aside style={{ display: 'flex', flexDirection: 'column', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.88)', background: 'rgba(255,255,255,0.88)', boxShadow: Sh.card, overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(4,53,77,0.08)' }}>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: T.slate2, pointerEvents: 'none' }}>
                <Ico p={ICONS.search} size={15} sw={1.8} />
              </span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patients or messages..." style={{ width: '100%', height: '42px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.12)', padding: '0 12px 0 38px', fontSize: '13.5px', color: T.navy, background: '#fff', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['All', 'Unread'] as FilterType[]).map((item) => (
                <button key={item} type="button" onClick={() => setFilter(item)} style={{ minHeight: '34px', padding: '0 14px', borderRadius: '999px', border: `1px solid ${filter === item ? T.blue : 'rgba(4,53,77,0.1)'}`, background: filter === item ? 'rgba(32,181,223,0.1)' : 'transparent', color: filter === item ? T.blue : T.slate, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {loading ? (
              <p style={{ margin: 0, padding: '30px', textAlign: 'center', color: T.slate2 }}>Loading conversations...</p>
            ) : filteredConversations.length === 0 ? (
              <p style={{ margin: 0, padding: '30px', textAlign: 'center', color: T.slate2 }}>No patient conversations yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '6px' }}>
                {filteredConversations.map((conversation) => {
                  const active = conversation.id === activeConvId
                  return (
                    <button key={conversation.id} type="button" onClick={() => selectConversation(conversation.id)} style={{ display: 'flex', gap: '12px', alignItems: 'center', border: 'none', borderRadius: '14px', background: active ? '#fff' : 'transparent', boxShadow: active ? '0 2px 10px rgba(4,53,77,0.06)' : 'none', padding: '12px', cursor: 'pointer', textAlign: 'left' }}>
                      <Avatar name={conversation.contactName} online={conversation.isOnline} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                          <strong style={{ color: T.navy, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conversation.contactName}</strong>
                          <span style={{ color: conversation.unreadCount ? T.blue : T.slate2, fontSize: '11px', fontWeight: 700 }}>{conversation.lastMessageTime}</span>
                        </div>
                        <p style={{ margin: '3px 0 0', color: T.slate, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conversation.lastMessage || 'No messages yet'}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {!loading && conversationMeta.totalCount > conversationMeta.pageSize ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '12px 14px', borderTop: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.55)' }}>
              <span style={{ fontSize: '12px', color: T.slate2, fontWeight: 700 }}>Page {conversationMeta.page}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" disabled={!conversationMeta.hasPrevious || loading} onClick={() => setConversationPage((current) => Math.max(1, current - 1))} style={{ minHeight: '32px', padding: '0 10px', borderRadius: '9px', border: '1px solid rgba(4,53,77,0.1)', background: '#fff', color: T.navy, fontSize: '12px', fontWeight: 700, cursor: conversationMeta.hasPrevious && !loading ? 'pointer' : 'not-allowed', opacity: conversationMeta.hasPrevious && !loading ? 1 : 0.48 }}>
                  Prev
                </button>
                <button type="button" disabled={!conversationMeta.hasNext || loading} onClick={() => setConversationPage((current) => current + 1)} style={{ minHeight: '32px', padding: '0 10px', borderRadius: '9px', border: '1px solid rgba(4,53,77,0.1)', background: '#fff', color: T.navy, fontSize: '12px', fontWeight: 700, cursor: conversationMeta.hasNext && !loading ? 'pointer' : 'not-allowed', opacity: conversationMeta.hasNext && !loading ? 1 : 0.48 }}>
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </aside>

        <main style={{ display: 'flex', flexDirection: 'column', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.88)', background: 'rgba(255,255,255,0.88)', boxShadow: Sh.card, overflow: 'hidden' }}>
          {activeConversation ? (
            <>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(4,53,77,0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar name={activeConversation.contactName} online={activeConversation.isOnline} />
                <div>
                  <h2 style={{ margin: '0 0 2px', fontSize: '17px', fontWeight: 800, color: T.navy }}>{activeConversation.contactName}</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: T.slate2 }}>
                    {activeConversation.contactRole} · <span style={{ color: activeConversation.isOnline ? T.green : T.amber, fontWeight: 800 }}>{activeConversation.isOnline ? 'Active now' : 'Offline'}</span>
                  </p>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: '420px', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {activeConversation.messages.map((message) => {
                  const isDoctor = message.senderId === 'doctor'
                  return (
                    <div key={message.id} style={{ alignSelf: isDoctor ? 'flex-end' : 'flex-start', maxWidth: '76%' }}>
                      <div style={{ padding: '12px 16px', borderRadius: '18px', borderTopRightRadius: isDoctor ? '4px' : '18px', borderTopLeftRadius: isDoctor ? '18px' : '4px', background: isDoctor ? `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : '#fff', border: isDoctor ? 'none' : '1px solid rgba(4,53,77,0.1)', color: isDoctor ? '#fff' : T.navy, fontSize: '14px', lineHeight: 1.5, boxShadow: isDoctor ? '0 4px 12px rgba(32,181,223,0.2)' : '0 2px 8px rgba(4,53,77,0.04)' }}>
                        {message.replyToText ? (
                          <div style={{ margin: '0 0 8px', padding: '7px 9px', borderRadius: '10px', background: isDoctor ? 'rgba(255,255,255,0.18)' : 'rgba(32,181,223,0.08)', borderLeft: `3px solid ${isDoctor ? 'rgba(255,255,255,0.65)' : T.blue}` }}>
                            <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 800, color: isDoctor ? '#fff' : T.navy }}>{message.replyToSenderId === 'doctor' ? 'Doctor' : 'Patient'}</p>
                            <p style={{ margin: 0, fontSize: '12px', color: isDoctor ? 'rgba(255,255,255,0.86)' : T.slate, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.replyToText}</p>
                          </div>
                        ) : null}
                        {message.type === 'attachment' ? (
                          <div style={{ display: 'grid', gap: '10px', color: isDoctor ? '#fff' : T.navy }}>
                            {message.text ? <p style={{ margin: 0 }}>{message.text}</p> : null}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Ico p={ICONS.paperclip} size={18} sw={1.8} color={isDoctor ? '#fff' : T.blue} />
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ margin: 0, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.attachmentName}</p>
                                <p style={{ margin: 0, opacity: 0.78, fontSize: '12px' }}>{message.attachmentSize} • {message.attachmentContentType || 'File'}</p>
                              </div>
                            </div>
                            <button type="button" onClick={() => handleDownloadAttachment(message)} style={{ minHeight: '32px', borderRadius: '10px', border: isDoctor ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(32,181,223,0.18)', background: isDoctor ? 'rgba(255,255,255,0.16)' : '#fff', color: isDoctor ? '#fff' : T.blue, fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
                              Download
                            </button>
                          </div>
                        ) : message.text}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: isDoctor ? 'flex-end' : 'flex-start', margin: '4px 4px 0' }}>
                        <span style={{ color: T.slate2, fontSize: '11px' }}>{message.timestamp}</span>
                        <button type="button" onClick={() => setReplyToMessage(message)} style={{ border: 'none', background: 'transparent', color: T.blue, fontSize: '11px', fontWeight: 800, cursor: 'pointer', padding: '2px 4px' }}>
                          Reply
                        </button>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
              <div style={{ padding: '16px', borderTop: '1px solid rgba(4,53,77,0.08)', background: 'rgba(255,255,255,0.62)' }}>
                {replyToMessage ? <ReplyPreview message={replyToMessage} onClear={() => setReplyToMessage(null)} /> : null}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                  <button type="button" aria-label="Add attachment" onClick={() => fileInputRef.current?.click()} style={{ width: '50px', height: '50px', borderRadius: '14px', border: '1px solid rgba(4,53,77,0.12)', background: '#fff', color: T.slate, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <Ico p={ICONS.paperclip} size={19} sw={1.8} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt,application/pdf,image/png,image/jpeg,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={(event) => setSelectedAttachment(event.target.files?.[0] ?? null)}
                    style={{ display: 'none' }}
                  />
                  <textarea value={reply} onChange={(event) => setReply(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend() } }} placeholder="Type your reply..." rows={2} style={{ flex: 1, minHeight: '50px', maxHeight: '130px', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(4,53,77,0.12)', background: '#fff', color: T.navy, fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
                  <HoverBtn onClick={handleSend} title="Send reply" base={{ width: '50px', height: '50px', borderRadius: '14px', border: 'none', background: (reply.trim() || selectedAttachment) && !sending ? `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : 'rgba(4,53,77,0.1)', color: (reply.trim() || selectedAttachment) && !sending ? '#fff' : T.slate2, display: 'grid', placeItems: 'center', cursor: (reply.trim() || selectedAttachment) && !sending ? 'pointer' : 'not-allowed' }} on={(reply.trim() || selectedAttachment) && !sending ? { transform: 'translateY(-1px)', boxShadow: '0 6px 16px rgba(52,140,234,0.35)' } : {}}>
                    <Ico p={ICONS.arrowFwd} size={18} sw={1.9} />
                  </HoverBtn>
                </div>
                {selectedAttachment ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', padding: '9px 10px', borderRadius: '12px', background: 'rgba(32,181,223,0.08)', border: '1px solid rgba(32,181,223,0.16)' }}>
                    <Ico p={ICONS.paperclip} size={15} sw={1.8} color={T.blue} />
                    <span style={{ flex: 1, minWidth: 0, color: T.navy, fontSize: '12.5px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedAttachment.name}</span>
                    <button type="button" aria-label="Remove attachment" onClick={() => { setSelectedAttachment(null); if (fileInputRef.current) fileInputRef.current.value = '' }} style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.1)', background: '#fff', color: T.slate, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                      <Ico p={ICONS.x} size={14} sw={2} />
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, minHeight: '620px', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '40px' }}>
              <div>
                <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(32,181,223,0.1)', border: '1px solid rgba(32,181,223,0.2)', display: 'grid', placeItems: 'center', margin: '0 auto 18px', color: T.blue }}>
                  <Ico p={ICONS.message} size={28} sw={1.5} />
                </div>
                <h2 style={{ margin: '0 0 8px', color: T.navy, fontSize: '20px', fontWeight: 800 }}>No conversation selected</h2>
                <p style={{ margin: 0, color: T.slate, fontSize: '14px' }}>Patient conversations will appear here once they message you.</p>
              </div>
            </div>
          )}
        </main>
      </section>
    </div>
  )
}

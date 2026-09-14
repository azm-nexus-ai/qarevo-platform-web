'use client'

import Image from 'next/image'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import {
  downloadAuthenticatedFile,
  getPatientMessageContacts,
  getPatientMessages,
  isAuthError,
  markPatientConversationRead,
  sendPatientMessage,
  sendPatientMessageAttachment,
  type MessageContact,
  type PortalConversation,
  type PortalMessage,
} from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type Conversation = PortalConversation

type FilterType = 'All' | 'Unread' | 'Physicians' | 'Care Team' | 'Support'

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'DR'
}

function ContactAvatar({ name, avatar, size = 44, online = false }: { name: string; avatar?: string | null; size?: number; online?: boolean }) {
  const statusColor = online ? T.green : T.amber
  return (
    <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
      {avatar ? (
        <Image src={avatar} alt={name} width={size} height={size} style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(32,181,223,0.16), rgba(52,140,234,0.24))', border: '1px solid rgba(4,53,77,0.11)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.navy, fontSize: `${Math.max(12, size * 0.32)}px`, fontWeight: 800 }}>
          {initialsFor(name)}
        </div>
      )}
      <div style={{ position: 'absolute', bottom: '2px', right: 0, width: `${Math.max(10, size * 0.24)}px`, height: `${Math.max(10, size * 0.24)}px`, borderRadius: '50%', background: statusColor, border: '2px solid #fff' }} />
    </div>
  )
}

function ReplyPreview({ message, onClear }: { message: PortalMessage; onClear: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(32,181,223,0.08)', border: '1px solid rgba(32,181,223,0.16)' }}>
      <div style={{ flex: 1, minWidth: 0, borderLeft: `3px solid ${T.blue}`, paddingLeft: '10px' }}>
        <p style={{ margin: '0 0 2px', color: T.navy, fontSize: '12px', fontWeight: 800 }}>{message.senderId === 'patient' ? 'Replying to you' : 'Replying to doctor'}</p>
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

function NoticeDialog({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="message-notice-title" style={{ position: 'fixed', inset: 0, zIndex: 320, display: 'grid', placeItems: 'center', padding: '20px' }}>
      <button type="button" aria-label="Close notice" onClick={onClose} style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(4,53,77,0.28)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)', cursor: 'default' }} />
      <section style={{ position: 'relative', width: '100%', maxWidth: '430px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.88)', background: 'rgba(255,255,255,0.98)', boxShadow: Sh.float, padding: '24px' }}>
        <button type="button" aria-label="Close" onClick={onClose} style={{ position: 'absolute', right: '14px', top: '14px', width: '36px', height: '36px', borderRadius: '10px', border: '1px solid rgba(4,53,77,0.1)', background: '#fff', color: T.slate, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <Ico p={ICONS.x} size={18} sw={2} />
        </button>
        <h2 id="message-notice-title" style={{ margin: '0 42px 8px 0', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '19px', fontWeight: 800, color: T.navy }}>{title}</h2>
        <p style={{ margin: 0, color: T.slate, fontSize: '14px', lineHeight: 1.65 }}>{body}</p>
      </section>
    </div>
  )
}

function ContactDetailsDialog({
  conversation,
  profileHref,
  onClose,
  onViewProfile,
}: {
  conversation: Conversation
  profileHref: string | null
  onClose: () => void
  onViewProfile: () => void
}) {
  return (
    <div className="msg-contact-details-modal" role="dialog" aria-modal="true" aria-labelledby="contact-details-title" style={{ position: 'fixed', inset: 0, zIndex: 320, placeItems: 'center', padding: '20px' }}>
      <button type="button" aria-label="Close contact details" onClick={onClose} style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(4,53,77,0.28)', backdropFilter: 'blur(7px)', WebkitBackdropFilter: 'blur(7px)', cursor: 'default' }} />
      <section style={{ position: 'relative', width: '100%', maxWidth: '420px', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.88)', background: 'rgba(255,255,255,0.98)', boxShadow: Sh.float, padding: '26px' }}>
        <button type="button" aria-label="Close" onClick={onClose} style={{ position: 'absolute', right: '14px', top: '14px', width: '38px', height: '38px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.1)', background: '#fff', color: T.slate, cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: '0 6px 18px rgba(4,53,77,0.08)' }}>
          <Ico p={ICONS.x} size={18} sw={2} />
        </button>
        <div style={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: '12px', padding: '18px 12px 20px', borderBottom: '1px solid rgba(4,53,77,0.08)' }}>
          <ContactAvatar name={conversation.contactName} avatar={conversation.contactAvatar} size={72} online={conversation.isOnline} />
          <div>
            <h2 id="contact-details-title" style={{ margin: '0 0 4px', color: T.navy, fontSize: '20px', fontWeight: 800 }}>{conversation.contactName}</h2>
            <p style={{ margin: 0, color: T.slate, fontSize: '14px' }}>{conversation.contactRole}</p>
          </div>
          <span style={{ borderRadius: '999px', padding: '7px 12px', background: conversation.isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.12)', color: conversation.isOnline ? T.green : T.amber, fontSize: '12px', fontWeight: 800 }}>
            {conversation.lastSeenLabel || (conversation.isOnline ? 'Active now' : 'Offline')}
          </span>
        </div>
        <div style={{ display: 'grid', gap: '12px', paddingTop: '18px' }}>
          {profileHref ? (
            <HoverBtn onClick={onViewProfile} base={{ width: '100%', minHeight: '44px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.1)', background: '#fff', color: T.navy, fontSize: '13px', fontWeight: 800, cursor: 'pointer' }} on={{ border: '1px solid rgba(32,181,223,0.3)', color: T.blue }}>
              View Doctor Profile
            </HoverBtn>
          ) : null}
          <div style={{ borderRadius: '16px', background: 'rgba(32,181,223,0.07)', border: '1px solid rgba(32,181,223,0.13)', padding: '14px' }}>
            <p style={{ margin: '0 0 5px', color: T.navy, fontSize: '13px', fontWeight: 800 }}>Conversation access</p>
            <p style={{ margin: 0, color: T.slate, fontSize: '12.5px', lineHeight: 1.55 }}>Only you and authorized care-team users connected to this conversation can view these messages and attachments.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── New Message Modal ─────────────────────────────────────────────────────────

function NewMessageModal({
  contacts,
  sending,
  onClose,
  onSend,
}: {
  contacts: MessageContact[]
  sending: boolean
  onClose: () => void
  onSend: (contactId: string, message: string) => Promise<void>
}) {
  const [recipient, setRecipient] = useState('')
  const [message, setMessage] = useState('')

  const handleSend = async () => {
    if (!recipient || !message.trim() || sending) return
    await onSend(recipient, message)
  }
  const canSend = Boolean(recipient && message.trim() && !sending)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div aria-hidden onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(4,53,77,0.28)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New Message"
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '520px', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: Sh.float, padding: '28px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>New Message</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: '1px solid rgba(4,53,77,0.12)', borderRadius: '8px', cursor: 'pointer', padding: '6px 9px', color: T.slate, fontSize: '16px', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', margin: '0 0 6px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: T.slate2 }}>To:</label>
          <select
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={contacts.length === 0}
            style={{ width: '100%', height: '44px', padding: '0 14px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.15)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '14px', outline: 'none' }}
          >
            <option value="" disabled>{contacts.length === 0 ? 'No eligible physicians yet' : 'Select a recipient...'}</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.role || c.type})</option>
            ))}
          </select>
          {contacts.length === 0 ? (
            <p style={{ margin: '8px 0 0', color: T.slate2, fontSize: '12.5px', lineHeight: 1.5 }}>
              You can start a message after a doctor is connected through an appointment, consultation, or existing care conversation.
            </p>
          ) : null}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', margin: '0 0 6px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: T.slate2 }}>Message:</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            rows={5}
            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.15)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '14px', outline: 'none', resize: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <HoverBtn
            onClick={handleSend}
            base={{ flex: 1, minHeight: '46px', padding: '0 16px', borderRadius: '12px', border: 'none', background: canSend ? `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : 'rgba(4,53,77,0.1)', color: canSend ? '#fff' : T.slate2, fontSize: '13.5px', fontWeight: 700, cursor: canSend ? 'pointer' : 'not-allowed', boxShadow: canSend ? '0 5px 16px rgba(32,181,223,0.28)' : 'none' }}
            on={canSend ? { transform: 'translateY(-1px)', boxShadow: '0 8px 20px rgba(52,140,234,0.34)' } : {}}
          >
            {sending ? 'Sending...' : 'Send Message'}
          </HoverBtn>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page Inner ───────────────────────────────────────────────────────────

function MessagesPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialContactId = searchParams.get('contactId')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('All')
  const [isComposing, setIsComposing] = useState(false)
  const [newMessageText, setNewMessageText] = useState('')
  const [doctorContacts, setDoctorContacts] = useState<MessageContact[]>([])
  const [replyToMessage, setReplyToMessage] = useState<PortalMessage | null>(null)
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [conversationPage, setConversationPage] = useState(1)
  const [conversationMeta, setConversationMeta] = useState({
    totalCount: 0,
    page: 1,
    pageSize: 20,
    hasNext: false,
    hasPrevious: false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const threadDismissedRef = useRef(false)

  const loadConversations = useCallback(async (selectInitial = false, showLoading = true) => {
    if (showLoading) setLoading(true)
    setError('')
    try {
      const payload = await getPatientMessages({ page: conversationPage, page_size: 20 })
      setConversations(payload.conversations)
      setConversationMeta({
        totalCount: payload.total_count ?? payload.conversations.length,
        page: payload.page ?? conversationPage,
        pageSize: payload.page_size ?? 20,
        hasNext: Boolean(payload.has_next),
        hasPrevious: Boolean(payload.has_previous),
      })
      const contacts = await getPatientMessageContacts().catch(() => null)
      if (contacts) setDoctorContacts(contacts.contacts)
      setActiveConvId((current) => {
        if (selectInitial && payload.conversations.length > 0) {
          const initialConversation = initialContactId
            ? payload.conversations.find(c => c.contactId === initialContactId)
            : null
          threadDismissedRef.current = false
          return initialConversation?.id ?? payload.conversations[0]?.id ?? null
        }
        if (current && payload.conversations.some((conversation) => conversation.id === current)) {
          return current
        }
        if (threadDismissedRef.current) {
          return current
        }
        return payload.conversations[0]?.id ?? null
      })
      if (selectInitial && payload.conversations.length > 0) {
        setReplyToMessage(null)
      }
    } catch (err) {
      if (isAuthError(err)) {
        router.replace('/auth/sign-in')
        return
      }
      setError(err instanceof Error ? err.message : 'Unable to load conversations.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [conversationPage, initialContactId, router])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadConversations(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadConversations])

  useEffect(() => {
    const poll = window.setInterval(() => {
      void loadConversations(false, false)
    }, 10000)
    return () => window.clearInterval(poll)
  }, [loadConversations])

  // Scroll to bottom of messages when conversation changes or new message added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConvId, conversations])

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      const matchesSearch = c.contactName.toLowerCase().includes(search.toLowerCase()) || 
                            c.contactRole.toLowerCase().includes(search.toLowerCase()) ||
                            c.lastMessage.toLowerCase().includes(search.toLowerCase()) ||
                            c.messages.some((message) => `${message.text ?? ''} ${message.attachmentName ?? ''}`.toLowerCase().includes(search.toLowerCase()))
      
      const matchesFilter = 
        activeFilter === 'All' ? true :
        activeFilter === 'Unread' ? c.unreadCount > 0 :
        activeFilter === c.contactType

      return matchesSearch && matchesFilter
    })
  }, [conversations, search, activeFilter])

  const activeConversation = conversations.find(c => c.id === activeConvId)
  const activeContactProviderId = activeConversation?.contactId.startsWith('provider:')
    ? activeConversation.contactId.replace('provider:', '')
    : null
  const activeContactProfileHref = activeContactProviderId ? `/patient/physicians/${activeContactProviderId}` : null
  const modalContacts = useMemo(() => {
    const contacts = new Map<string, MessageContact>()
    doctorContacts.forEach((contact) => contacts.set(contact.id, contact))
    conversations.forEach((conversation) => {
      if (conversation.contactType === 'Physician' || conversation.contactId.startsWith('provider:')) {
        contacts.set(conversation.contactId, {
          id: conversation.contactId,
          name: conversation.contactName,
          provider_id: conversation.contactId.replace('provider:', ''),
          role: conversation.contactRole || conversation.contactType,
          type: conversation.contactType,
          avatar: conversation.contactAvatar,
        })
      }
    })
    return Array.from(contacts.values())
  }, [conversations, doctorContacts])

  // Handle send message in active conversation
  const handleSendMessage = async () => {
    if ((!newMessageText.trim() && !selectedAttachment) || !activeConversation || sending) return

    const message = newMessageText.trim()
    setSending(true)
    setError('')
    try {
      let updated: PortalConversation
      if (selectedAttachment) {
        const formData = new FormData()
        formData.append('contact_id', activeConversation.contactId)
        formData.append('file', selectedAttachment)
        if (message) formData.append('message', message)
        if (replyToMessage) formData.append('reply_to_message_id', replyToMessage.id)
        updated = await sendPatientMessageAttachment(formData)
      } else {
        updated = await sendPatientMessage({
          contact_id: activeConversation.contactId,
          message,
          ...(replyToMessage ? { reply_to_message_id: replyToMessage.id } : {}),
        })
      }
      setConversations(prev => [updated, ...prev.filter(c => c.id !== updated.id)])
      setActiveConvId(updated.id)
      threadDismissedRef.current = false
      setNewMessageText('')
      setSelectedAttachment(null)
      setReplyToMessage(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.')
    } finally {
      setSending(false)
    }
  }

  // Handle new message from modal
  const handleSendNewModalMessage = async (contactId: string, message: string) => {
    setSending(true)
    setError('')
    try {
      const updated = await sendPatientMessage({
        contact_id: contactId,
        message: message.trim(),
      })
      setConversations(prev => [updated, ...prev.filter(c => c.id !== updated.id)])
      setActiveConvId(updated.id)
      threadDismissedRef.current = false
      setIsComposing(false)
      setReplyToMessage(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.')
    } finally {
      setSending(false)
    }
  }

  // Handle marking conversation as read
  const handleSelectConversation = async (id: string) => {
    setActiveConvId(id)
    threadDismissedRef.current = false
    setReplyToMessage(null)
    setConversations(prev => prev.map(c => 
      c.id === id ? { ...c, unreadCount: 0, messages: c.messages.map(m => ({ ...m, isRead: true })) } : c
    ))
    try {
      const updated = await markPatientConversationRead(id)
      setConversations(prev => prev.map(c => c.id === id ? updated : c))
    } catch {
      await loadConversations()
    }
  }

  const handleDownloadAttachment = async (message: PortalMessage) => {
    if (!message.attachmentUrl) return
    setError('')
    try {
      const blob = await downloadAuthenticatedFile(message.attachmentUrl)
      saveBlob(blob, message.attachmentName || 'attachment')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download attachment.')
    }
  }

  return (
    <PatientPortalShell
      eyebrow="Patient Platform"
      title="Messages"
      description="Stay connected with your physicians and care team."
      headerActions={
        <HoverBtn
          onClick={() => setIsComposing(true)}
          base={{ minHeight: '44px', padding: '0 18px', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 5px 16px rgba(32,181,223,0.3)', whiteSpace: 'nowrap' }}
          on={{ transform: 'translateY(-1px)', boxShadow: '0 8px 22px rgba(52,140,234,0.34)' }}
        >
          + New Message
        </HoverBtn>
      }
    >
      <style>{`
        .msg-grid {
          display: grid;
          grid-template-columns: minmax(290px, 330px) minmax(0, 1fr);
          gap: 18px;
          height: calc(100vh - 220px);
          min-height: 500px;
          max-height: 800px;
        }
        .msg-grid-details-open {
          grid-template-columns: minmax(280px, 320px) minmax(0, 1fr) minmax(260px, 300px);
        }
        .msg-list-panel {
          display: flex;
          flex-direction: column;
          background: rgba(255,255,255,0.88);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.92);
          box-shadow: ${Sh.card};
          overflow: hidden;
          min-width: 280px;
        }
        .msg-thread-panel {
          display: flex;
          flex-direction: column;
          background: rgba(255,255,255,0.88);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.92);
          box-shadow: ${Sh.card};
          overflow: hidden;
          min-width: 0;
        }
        .msg-list-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
        }
        .msg-thread-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .msg-composer {
          padding: 18px;
          border-top: 1px solid rgba(4,53,77,0.08);
          background: rgba(255,255,255,0.7);
        }
        .msg-composer-input {
          flex: 1;
          min-height: 52px;
          max-height: 140px;
          padding: 14px 18px;
          border-radius: 14px;
          border: 1px solid rgba(4,53,77,0.12);
          background: #fff;
          color: ${T.navy};
          font-size: 14px;
          outline: none;
          resize: none;
          font-family: inherit;
        }
        .msg-composer-input:focus {
          border-color: rgba(32,181,223,0.5);
          box-shadow: 0 0 0 3px rgba(32,181,223,0.1);
        }
        .msg-details-panel {
          display: flex;
          flex-direction: column;
          background: rgba(255,255,255,0.88);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.92);
          box-shadow: ${Sh.card};
          padding: 18px;
          overflow: hidden;
          min-width: 0;
        }
        .msg-contact-details-modal { display: none; }
        .hide-on-mobile { display: flex; }
        .show-on-mobile { display: none; }

        @media (max-width: 1280px) {
          .msg-grid-details-open {
            grid-template-columns: minmax(290px, 330px) minmax(0, 1fr);
          }
          .msg-details-panel { display: none; }
          .msg-contact-details-modal { display: grid; }
        }

        @media (max-width: 1120px) {
          .msg-grid {
            grid-template-columns: minmax(270px, 300px) minmax(0, 1fr);
            gap: 14px;
            height: calc(100vh - 200px);
          }
        }

        @media (max-width: 768px) {
          .msg-grid {
            grid-template-columns: 1fr;
            height: calc(100vh - 180px);
            gap: 0;
          }
          .msg-list-panel {
            display: var(--list-display, flex);
            border-radius: 0;
            border: none;
          }
          .msg-thread-panel {
            display: var(--thread-display, none);
            border-radius: 0;
            border: none;
          }
          .hide-on-mobile { display: none !important; }
          .show-on-mobile { display: flex !important; }
        }
      `}</style>

      {error ? (
        <div style={{ marginBottom: '14px', borderRadius: '14px', border: '1px solid rgba(220,38,38,0.18)', background: 'rgba(254,242,242,0.92)', color: '#991b1b', padding: '12px 14px', fontSize: '13px', fontWeight: 700 }}>
          {error}
        </div>
      ) : null}

      {/* Inject CSS vars to control visibility on mobile */}
      <div 
        className={`msg-grid ${detailsOpen && activeConversation ? 'msg-grid-details-open' : ''}`}
        style={{
          '--list-display': activeConvId ? 'none' : 'flex',
          '--thread-display': activeConvId ? 'flex' : 'none',
        } as React.CSSProperties}
      >
        {/* ─── Conversation List Panel ───────────────────────────── */}
        <div className="msg-list-panel">
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(4,53,77,0.08)' }}>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: T.slate2, pointerEvents: 'none' }}>
                <Ico p={ICONS.search} size={15} sw={1.8} />
              </span>
              <input
                type="search"
                placeholder="Search names or messages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', height: '40px', borderRadius: '11px', border: '1px solid rgba(4,53,77,0.12)', padding: '0 12px 0 38px', fontSize: '13.5px', color: T.navy, background: '#fff', outline: 'none' }}
              />
            </div>
            
            {/* Filters scroll horizontally */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
              {(['All', 'Unread', 'Physicians', 'Care Team', 'Support'] as FilterType[]).map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '999px',
                    border: `1px solid ${activeFilter === f ? T.blue : 'rgba(4,53,77,0.1)'}`,
                    background: activeFilter === f ? 'rgba(32,181,223,0.1)' : 'transparent',
                    color: activeFilter === f ? T.blue : T.slate,
                    fontSize: '12px',
                    fontWeight: activeFilter === f ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="msg-list-scroll">
            {loading ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '14px', color: T.slate2 }}>Loading conversations...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '14px', color: T.slate2 }}>{conversations.length === 0 ? 'No conversations yet.' : 'No conversations found.'}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {filteredConversations.map(conv => {
                  const isActive = conv.id === activeConvId
                  return (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                        padding: '12px',
                        borderRadius: '14px',
                        border: 'none',
                        background: isActive ? 'rgba(255,255,255,0.9)' : 'transparent',
                        boxShadow: isActive ? '0 2px 10px rgba(4,53,77,0.06)' : 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <ContactAvatar name={conv.contactName} avatar={conv.contactAvatar} online={conv.isOnline} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: T.navy, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.contactName}</span>
                          <span style={{ fontSize: '11px', color: conv.unreadCount > 0 ? T.blue : T.slate2, fontWeight: conv.unreadCount > 0 ? 700 : 500, flexShrink: 0 }}>{conv.lastMessageTime}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: T.slate2, marginBottom: '2px' }}>{conv.contactRole}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: conv.unreadCount > 0 ? T.navy : T.slate, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: conv.unreadCount > 0 ? 600 : 400 }}>{conv.lastMessage}</span>
                          {conv.unreadCount > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '18px', borderRadius: '999px', background: T.blue, color: '#fff', fontSize: '10px', fontWeight: 700, marginLeft: '6px' }}>{conv.unreadCount}</span>
                          )}
                        </div>
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
        </div>

        {/* ─── Active Conversation Panel ───────────────────────────── */}
        <div className="msg-thread-panel">
          {activeConversation ? (
            <>
              {/* Thread Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(4,53,77,0.08)', display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(255,255,255,0.6)' }}>
                <button 
                  className="show-on-mobile" 
                  onClick={() => { setActiveConvId(null); threadDismissedRef.current = true; setReplyToMessage(null); setSelectedAttachment(null) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: T.slate2, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '4px' }}
                >
                  <span style={{ transform: 'rotate(180deg)', display: 'inline-block' }}>
                    <Ico p={ICONS.arrowSm} size={20} sw={2} />
                  </span>
                </button>

                <ContactAvatar name={activeConversation.contactName} avatar={activeConversation.contactAvatar} size={48} online={activeConversation.isOnline} />
                <div>
                  <h2 style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: 800, color: T.navy }}>{activeConversation.contactName}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: T.slate2 }}>
                    <span>{activeConversation.contactRole}</span>
                    <span>·</span>
                    <span style={{ color: activeConversation.isOnline ? T.green : T.amber, fontWeight: 800 }}>{activeConversation.isOnline ? 'Active now' : 'Offline'}</span>
                    {activeConversation.context && (
                      <>
                        <span>·</span>
                        <span style={{ color: T.blue, fontWeight: 600 }}>{activeConversation.context}</span>
                      </>
                    )}
                  </div>
                </div>
                <HoverBtn
                  onClick={() => setDetailsOpen(true)}
                  base={{ marginLeft: 'auto', minHeight: '38px', padding: '0 12px', borderRadius: '11px', border: '1px solid rgba(4,53,77,0.1)', background: '#fff', color: T.navy, fontSize: '12.5px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  on={{ border: '1px solid rgba(32,181,223,0.3)', color: T.blue, transform: 'translateY(-1px)' }}
                >
                  Details
                </HoverBtn>
              </div>

              {/* Thread Scroll Area */}
              <div className="msg-thread-scroll">
                {activeConversation.messages.map((msg) => {
                  const isPatient = msg.senderId === 'patient'
                  
                  if (msg.type === 'system') {
                    return (
                      <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                        <span style={{ padding: '4px 12px', borderRadius: '999px', background: 'rgba(4,53,77,0.06)', fontSize: '11px', fontWeight: 600, color: T.slate2 }}>
                          {msg.text} • {msg.timestamp}
                        </span>
                      </div>
                    )
                  }

                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isPatient ? 'flex-end' : 'flex-start', margin: '4px 0' }}>
                      
                      {msg.type === 'text' && (
                        <div style={{
                          maxWidth: '75%',
                          padding: '12px 16px',
                          borderRadius: '18px',
                          borderTopLeftRadius: !isPatient ? '4px' : '18px',
                          borderTopRightRadius: isPatient ? '4px' : '18px',
                          background: isPatient ? `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : '#fff',
                          color: isPatient ? '#fff' : T.navy,
                          border: isPatient ? 'none' : '1px solid rgba(4,53,77,0.1)',
                          boxShadow: isPatient ? '0 4px 12px rgba(32,181,223,0.2)' : '0 2px 8px rgba(4,53,77,0.04)',
                          fontSize: '14px',
                          lineHeight: 1.5,
                        }}>
                          {msg.replyToText ? (
                            <div style={{ margin: '0 0 8px', padding: '7px 9px', borderRadius: '10px', background: isPatient ? 'rgba(255,255,255,0.18)' : 'rgba(32,181,223,0.08)', borderLeft: `3px solid ${isPatient ? 'rgba(255,255,255,0.65)' : T.blue}` }}>
                              <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 800, color: isPatient ? '#fff' : T.navy }}>{msg.replyToSenderId === 'patient' ? 'Patient' : 'Doctor'}</p>
                              <p style={{ margin: 0, fontSize: '12px', color: isPatient ? 'rgba(255,255,255,0.86)' : T.slate, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.replyToText}</p>
                            </div>
                          ) : null}
                          {msg.text}
                        </div>
                      )}

                      {msg.type === 'attachment' && (
                        <div style={{
                          maxWidth: '75%',
                          padding: '12px',
                          borderRadius: '16px',
                          borderTopLeftRadius: !isPatient ? '4px' : '16px',
                          borderTopRightRadius: isPatient ? '4px' : '16px',
                          background: isPatient ? 'rgba(32,181,223,0.1)' : '#fff',
                          border: `1px solid ${isPatient ? 'rgba(32,181,223,0.2)' : 'rgba(4,53,77,0.1)'}`,
                          boxShadow: '0 2px 8px rgba(4,53,77,0.04)',
                          display: 'grid',
                          gap: '10px'
                        }}>
                          {msg.text ? <p style={{ margin: 0, color: T.navy, fontSize: '13px', lineHeight: 1.45 }}>{msg.text}</p> : null}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: isPatient ? 'rgba(32,181,223,0.15)' : 'rgba(4,53,77,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isPatient ? T.blue : T.slate }}>
                              <Ico p={ICONS.paperclip} size={20} sw={1.8} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.attachmentName}</p>
                              <p style={{ margin: 0, fontSize: '11.5px', color: T.slate }}>{msg.attachmentSize} • {msg.attachmentContentType || 'File'}</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => handleDownloadAttachment(msg)} style={{ minHeight: '34px', borderRadius: '10px', border: '1px solid rgba(32,181,223,0.18)', background: '#fff', color: T.blue, fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
                            Download
                          </button>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', padding: '0 4px' }}>
                        <span style={{ fontSize: '11px', color: T.slate2 }}>{msg.timestamp}</span>
                        <button type="button" onClick={() => setReplyToMessage(msg)} style={{ border: 'none', background: 'transparent', color: T.blue, fontSize: '11px', fontWeight: 800, cursor: 'pointer', padding: '2px 4px' }}>
                          Reply
                        </button>
                        {isPatient && msg.isRead && (
                          <Ico p={ICONS.check} size={12} sw={2.5} color={T.blue} />
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className="msg-composer">
                {replyToMessage ? <ReplyPreview message={replyToMessage} onClear={() => setReplyToMessage(null)} /> : null}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    aria-label="Add attachment"
                    title="Add attachment"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ width: '48px', height: '48px', borderRadius: '14px', border: '1px solid rgba(4,53,77,0.12)', background: '#fff', color: T.slate, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <Ico p={ICONS.paperclip} size={19} sw={1.8} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt,application/pdf,image/png,image/jpeg,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={(event) => setSelectedAttachment(event.target.files?.[0] ?? null)}
                    style={{ display: 'none' }}
                  />
                  
                  <textarea
                    className="msg-composer-input"
                    placeholder="Type your message..."
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                  />

                  <HoverBtn
                    onClick={handleSendMessage}
                    title="Send message"
                    base={{ width: '48px', height: '48px', borderRadius: '14px', border: 'none', background: newMessageText.trim() || selectedAttachment ? `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : 'rgba(4,53,77,0.1)', color: newMessageText.trim() || selectedAttachment ? '#fff' : T.slate2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: newMessageText.trim() || selectedAttachment ? 'pointer' : 'not-allowed', flexShrink: 0, boxShadow: newMessageText.trim() || selectedAttachment ? '0 4px 12px rgba(32,181,223,0.3)' : 'none' }}
                    on={newMessageText.trim() || selectedAttachment ? { transform: 'translateY(-1px)', boxShadow: '0 6px 16px rgba(52,140,234,0.35)' } : {}}
                  >
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(32,181,223,0.1)', border: '1px solid rgba(32,181,223,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', color: T.blue }}>
                <Ico p={ICONS.ema} size={28} sw={1.5} />
              </div>
              <h3 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 700, color: T.navy }}>Your Secure Inbox</h3>
              <p style={{ margin: '0 0 24px', fontSize: '14px', color: T.slate, maxWidth: '300px', lineHeight: 1.6 }}>
                Select a conversation from the list to view your messages or start a new conversation.
              </p>
              <HoverBtn
                onClick={() => setIsComposing(true)}
                base={{ minHeight: '44px', padding: '0 20px', borderRadius: '12px', border: 'none', background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`, color: '#fff', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 5px 16px rgba(32,181,223,0.28)' }}
                on={{ transform: 'translateY(-1px)', boxShadow: '0 8px 22px rgba(52,140,234,0.32)' }}
              >
                + Start a Conversation
              </HoverBtn>
            </div>
          )}
        </div>

        {detailsOpen && activeConversation ? (
          <aside className="msg-details-panel">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <button type="button" aria-label="Close contact details" onClick={() => setDetailsOpen(false)} style={{ width: '36px', height: '36px', borderRadius: '11px', border: '1px solid rgba(4,53,77,0.1)', background: '#fff', color: T.slate, cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: '0 6px 18px rgba(4,53,77,0.08)' }}>
                <Ico p={ICONS.x} size={17} sw={2} />
              </button>
            </div>
            <div style={{ display: 'grid', justifyItems: 'center', textAlign: 'center', gap: '10px', padding: '8px 0 16px', borderBottom: '1px solid rgba(4,53,77,0.08)' }}>
              <ContactAvatar name={activeConversation.contactName} avatar={activeConversation.contactAvatar} size={68} online={activeConversation.isOnline} />
              <div>
                <h3 style={{ margin: '0 0 4px', color: T.navy, fontSize: '18px', fontWeight: 800 }}>{activeConversation.contactName}</h3>
                <p style={{ margin: 0, color: T.slate, fontSize: '13px' }}>{activeConversation.contactRole}</p>
              </div>
              <span style={{ borderRadius: '999px', padding: '6px 10px', background: activeConversation.isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.12)', color: activeConversation.isOnline ? T.green : T.amber, fontSize: '12px', fontWeight: 800 }}>
                {activeConversation.lastSeenLabel || (activeConversation.isOnline ? 'Active now' : 'Offline')}
              </span>
            </div>
            <div style={{ display: 'grid', gap: '12px', paddingTop: '16px' }}>
              {activeContactProfileHref ? (
                <HoverBtn onClick={() => router.push(activeContactProfileHref)} base={{ width: '100%', minHeight: '42px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.1)', background: '#fff', color: T.navy, fontSize: '13px', fontWeight: 800, cursor: 'pointer' }} on={{ border: '1px solid rgba(32,181,223,0.3)', color: T.blue }}>
                  View Doctor Profile
                </HoverBtn>
              ) : null}
              <div style={{ borderRadius: '14px', background: 'rgba(32,181,223,0.07)', border: '1px solid rgba(32,181,223,0.13)', padding: '12px' }}>
                <p style={{ margin: '0 0 4px', color: T.navy, fontSize: '13px', fontWeight: 800 }}>Conversation access</p>
                <p style={{ margin: 0, color: T.slate, fontSize: '12.5px', lineHeight: 1.5 }}>Only you and authorized care-team users connected to this conversation can view these messages and attachments.</p>
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      {detailsOpen && activeConversation ? (
        <ContactDetailsDialog
          conversation={activeConversation}
          profileHref={activeContactProfileHref}
          onClose={() => setDetailsOpen(false)}
          onViewProfile={() => {
            setDetailsOpen(false)
            if (activeContactProfileHref) router.push(activeContactProfileHref)
          }}
        />
      ) : null}
      {isComposing && (
        <NewMessageModal
          contacts={modalContacts}
          sending={sending}
          onClose={() => setIsComposing(false)}
          onSend={handleSendNewModalMessage}
        />
      )}
      {notice ? (
        <NoticeDialog
          title={notice.title}
          body={notice.body}
          onClose={() => setNotice(null)}
        />
      ) : null}
    </PatientPortalShell>
  )
}

export default function PatientMessagesPage() {
  return (
    <Suspense>
      <MessagesPageInner />
    </Suspense>
  )
}

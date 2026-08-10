'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES, PATIENT_SIDEBAR_ITEMS, isPatientNavActive } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import AuthenticatedLogo from '@/components/branding/AuthenticatedLogo'
import PatientPortalShell from '@/components/patient/PatientPortalShell'

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageType = 'text' | 'attachment' | 'system'

type Message = {
  id: string
  senderId: string // 'patient' or contactId
  type: MessageType
  text?: string
  attachmentUrl?: string
  attachmentName?: string
  attachmentSize?: string
  timestamp: string
  isRead: boolean
}

type ContactType = 'Physician' | 'Care Team' | 'Support'

type Conversation = {
  id: string
  contactId: string
  contactName: string
  contactRole: string // e.g. "Cardiologist", "Qarevo Support"
  contactType: ContactType
  contactAvatar: string
  isOnline: boolean
  isPinned: boolean
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  context?: string // e.g. "Your consultation: Today, 4:30 PM"
  messages: Message[]
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    contactId: 'dr-reed',
    contactName: 'Dr. Sophia Reed',
    contactRole: 'Cardiologist',
    contactType: 'Physician',
    contactAvatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&h=120&fit=crop',
    isOnline: true,
    isPinned: true,
    lastMessage: 'I have attached the blood pressure guidelines for your review.',
    lastMessageTime: '10:42 AM',
    unreadCount: 2,
    context: 'Your consultation: Today, 4:30 PM',
    messages: [
      { id: 'm1', senderId: 'dr-reed', type: 'text', text: 'Hello John, how are you feeling today?', timestamp: 'Yesterday, 3:00 PM', isRead: true },
      { id: 'm2', senderId: 'patient', type: 'text', text: 'Hi Dr. Reed, I am feeling a bit better, but still monitoring my blood pressure.', timestamp: 'Yesterday, 3:15 PM', isRead: true },
      { id: 'm3', senderId: 'dr-reed', type: 'text', text: 'That is good to hear. Make sure you avoid high sodium foods.', timestamp: 'Yesterday, 4:00 PM', isRead: true },
      { id: 'm4', senderId: 'dr-reed', type: 'text', text: 'I have attached the blood pressure guidelines for your review.', timestamp: '10:42 AM', isRead: false },
      { id: 'm5', senderId: 'dr-reed', type: 'attachment', attachmentName: 'BP_Guidelines_2026.pdf', attachmentSize: '1.2 MB', timestamp: '10:42 AM', isRead: false },
    ],
  },
  {
    id: 'conv-2',
    contactId: 'care-team',
    contactName: 'Qarevo Care Team',
    contactRole: 'Care Coordination',
    contactType: 'Care Team',
    contactAvatar: 'https://images.unsplash.com/photo-1576091160550-2173ff9e8eb4?w=120&h=120&fit=crop',
    isOnline: true,
    isPinned: false,
    lastMessage: 'Your upcoming lab tests have been scheduled.',
    lastMessageTime: 'Yesterday',
    unreadCount: 0,
    messages: [
      { id: 'm1', senderId: 'care-team', type: 'text', text: 'Hello John! We are reaching out to schedule your upcoming lab tests.', timestamp: 'Aug 5, 9:00 AM', isRead: true },
      { id: 'm2', senderId: 'patient', type: 'text', text: 'Great, anytime Thursday works for me.', timestamp: 'Aug 5, 11:30 AM', isRead: true },
      { id: 'm3', senderId: 'care-team', type: 'text', text: 'Your upcoming lab tests have been scheduled.', timestamp: 'Yesterday', isRead: true },
    ],
  },
  {
    id: 'conv-3',
    contactId: 'support-billing',
    contactName: 'Billing Support',
    contactRole: 'Financial Services',
    contactType: 'Support',
    contactAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop',
    isOnline: false,
    isPinned: false,
    lastMessage: 'Thank you. The refund has been processed.',
    lastMessageTime: 'Aug 4',
    unreadCount: 0,
    messages: [
      { id: 'm1', senderId: 'patient', type: 'text', text: 'I cancelled my appointment yesterday but have not seen a refund yet.', timestamp: 'Aug 4, 10:00 AM', isRead: true },
      { id: 'm2', senderId: 'support-billing', type: 'system', text: 'Ticket #10492 created', timestamp: 'Aug 4, 10:05 AM', isRead: true },
      { id: 'm3', senderId: 'support-billing', type: 'text', text: 'Thank you. The refund has been processed. It may take 3-5 business days to appear.', timestamp: 'Aug 4, 11:00 AM', isRead: true },
    ],
  },
]

type FilterType = 'All' | 'Unread' | 'Physicians' | 'Care Team' | 'Support'

// ─── New Message Modal ─────────────────────────────────────────────────────────

function NewMessageModal({ onClose, onSend }: { onClose: () => void; onSend: (contactId: string, message: string) => void }) {
  const [recipient, setRecipient] = useState('')
  const [message, setMessage] = useState('')
  
  // Contacts mock
  const contacts = [
    { id: 'dr-reed', name: 'Dr. Sophia Reed', type: 'Physician' },
    { id: 'dr-okafor', name: 'Dr. Amara Okafor', type: 'Physician' },
    { id: 'care-team', name: 'Qarevo Care Team', type: 'Care Team' },
    { id: 'support-general', name: 'General Support', type: 'Support' },
  ]

  const handleSend = () => {
    if (!recipient || !message.trim()) return
    onSend(recipient, message)
  }

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
            style={{ width: '100%', height: '44px', padding: '0 14px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.15)', background: 'rgba(255,255,255,0.9)', color: T.navy, fontSize: '14px', outline: 'none' }}
          >
            <option value="" disabled>Select a recipient...</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
            ))}
          </select>
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
            base={{ flex: 1, minHeight: '46px', padding: '0 16px', borderRadius: '12px', border: 'none', background: recipient && message.trim() ? `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : 'rgba(4,53,77,0.1)', color: recipient && message.trim() ? '#fff' : T.slate2, fontSize: '13.5px', fontWeight: 700, cursor: recipient && message.trim() ? 'pointer' : 'not-allowed', boxShadow: recipient && message.trim() ? '0 5px 16px rgba(32,181,223,0.28)' : 'none' }}
            on={recipient && message.trim() ? { transform: 'translateY(-1px)', boxShadow: '0 8px 20px rgba(52,140,234,0.34)' } : {}}
          >
            Send Message
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

  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS)
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('All')
  const [isComposing, setIsComposing] = useState(false)
  const [newMessageText, setNewMessageText] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialization: check if query param specifies a contact
  useEffect(() => {
    if (initialContactId) {
      const conv = conversations.find(c => c.contactId === initialContactId)
      if (conv) {
        queueMicrotask(() => setActiveConvId(conv.id))
      }
    }
  }, [initialContactId, conversations])

  // Scroll to bottom of messages when conversation changes or new message added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConvId, conversations])

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      const matchesSearch = c.contactName.toLowerCase().includes(search.toLowerCase()) || 
                            c.contactRole.toLowerCase().includes(search.toLowerCase())
      
      const matchesFilter = 
        activeFilter === 'All' ? true :
        activeFilter === 'Unread' ? c.unreadCount > 0 :
        activeFilter === c.contactType

      return matchesSearch && matchesFilter
    })
  }, [conversations, search, activeFilter])

  const activeConversation = conversations.find(c => c.id === activeConvId)

  // Handle send message in active conversation
  const handleSendMessage = () => {
    if (!newMessageText.trim() || !activeConvId) return

    setConversations(prev => prev.map(c => {
      if (c.id === activeConvId) {
        const newMsg: Message = {
          id: `m-new-${Date.now()}`,
          senderId: 'patient',
          type: 'text',
          text: newMessageText,
          timestamp: 'Just now',
          isRead: true,
        }
        return {
          ...c,
          lastMessage: newMessageText,
          lastMessageTime: 'Just now',
          messages: [...c.messages, newMsg]
        }
      }
      return c
    }))
    setNewMessageText('')
  }

  // Handle new message from modal
  const handleSendNewModalMessage = (contactId: string, message: string) => {
    setIsComposing(false)
    const existing = conversations.find(c => c.contactId === contactId)
    if (existing) {
      setConversations(prev => prev.map(c => {
        if (c.id === existing.id) {
          return {
            ...c,
            lastMessage: message,
            lastMessageTime: 'Just now',
            messages: [...c.messages, { id: `m-new-${Date.now()}`, senderId: 'patient', type: 'text', text: message, timestamp: 'Just now', isRead: true }]
          }
        }
        return c
      }))
      setActiveConvId(existing.id)
    } else {
      // Simulate creating a new conversation
      const newConv: Conversation = {
        id: `conv-new-${Date.now()}`,
        contactId,
        contactName: contactId === 'dr-okafor' ? 'Dr. Amara Okafor' : 'General Support',
        contactRole: contactId === 'dr-okafor' ? 'Endocrinologist' : 'Customer Service',
        contactType: contactId === 'dr-okafor' ? 'Physician' : 'Support',
        contactAvatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=120&h=120&fit=crop',
        isOnline: true,
        isPinned: false,
        lastMessage: message,
        lastMessageTime: 'Just now',
        unreadCount: 0,
        messages: [{ id: `m-new-${Date.now()}`, senderId: 'patient', type: 'text', text: message, timestamp: 'Just now', isRead: true }]
      }
      setConversations([newConv, ...conversations])
      setActiveConvId(newConv.id)
    }
  }

  // Handle marking conversation as read
  const handleSelectConversation = (id: string) => {
    setActiveConvId(id)
    setConversations(prev => prev.map(c => 
      c.id === id ? { ...c, unreadCount: 0, messages: c.messages.map(m => ({ ...m, isRead: true })) } : c
    ))
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
          grid-template-columns: 340px minmax(0, 1fr);
          gap: 16px;
          height: calc(100vh - 240px);
          min-height: 600px;
        }
        .msg-list-panel {
          display: flex;
          flex-direction: column;
          background: rgba(255,255,255,0.82);
          backdrop-filter: blur(22px) saturate(180%);
          -webkit-backdrop-filter: blur(22px) saturate(180%);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.9);
          box-shadow: ${Sh.card};
          overflow: hidden;
        }
        .msg-thread-panel {
          display: flex;
          flex-direction: column;
          background: rgba(255,255,255,0.82);
          backdrop-filter: blur(22px) saturate(180%);
          -webkit-backdrop-filter: blur(22px) saturate(180%);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.9);
          box-shadow: ${Sh.card};
          overflow: hidden;
        }
        .msg-list-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }
        .msg-thread-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .msg-composer {
          padding: 16px;
          border-top: 1px solid rgba(4,53,77,0.08);
          background: rgba(255,255,255,0.6);
        }
        .msg-composer-input {
          flex: 1;
          min-height: 48px;
          max-height: 120px;
          padding: 14px 16px;
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
        .hide-on-mobile { display: flex; }
        .show-on-mobile { display: none; }
        
        @media (max-width: 920px) {
          .msg-grid {
            grid-template-columns: 1fr;
            height: calc(100vh - 200px);
          }
          .msg-list-panel {
            display: var(--list-display, flex);
          }
          .msg-thread-panel {
            display: var(--thread-display, none);
          }
          .hide-on-mobile { display: none !important; }
          .show-on-mobile { display: flex !important; }
        }
      `}</style>

      {/* Inject CSS vars to control visibility on mobile */}
      <div 
        className="msg-grid"
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
                placeholder="Search messages..."
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
            {filteredConversations.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '14px', color: T.slate2 }}>No conversations found.</p>
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
                      <div style={{ position: 'relative' }}>
                        <Image src={conv.contactAvatar} alt={conv.contactName} width={44} height={44} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
                        {conv.isOnline && (
                          <div style={{ position: 'absolute', bottom: '2px', right: '0', width: '10px', height: '10px', borderRadius: '50%', background: T.green, border: '2px solid #fff' }} />
                        )}
                      </div>
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
        </div>

        {/* ─── Active Conversation Panel ───────────────────────────── */}
        <div className="msg-thread-panel">
          {activeConversation ? (
            <>
              {/* Thread Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(4,53,77,0.08)', display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(255,255,255,0.6)' }}>
                <button 
                  className="show-on-mobile" 
                  onClick={() => setActiveConvId(null)} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: T.slate2, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '4px' }}
                >
                  <span style={{ transform: 'rotate(180deg)', display: 'inline-block' }}>
                    <Ico p={ICONS.arrowSm} size={20} sw={2} />
                  </span>
                </button>

                <div style={{ position: 'relative' }}>
                  <Image src={activeConversation.contactAvatar} alt={activeConversation.contactName} width={48} height={48} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                  {activeConversation.isOnline && (
                    <div style={{ position: 'absolute', bottom: '2px', right: '0', width: '12px', height: '12px', borderRadius: '50%', background: T.green, border: '2px solid #fff' }} />
                  )}
                </div>
                <div>
                  <h2 style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: 800, color: T.navy }}>{activeConversation.contactName}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: T.slate2 }}>
                    <span>{activeConversation.contactRole}</span>
                    {activeConversation.context && (
                      <>
                        <span>·</span>
                        <span style={{ color: T.blue, fontWeight: 600 }}>{activeConversation.context}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Thread Scroll Area */}
              <div className="msg-thread-scroll">
                {activeConversation.messages.map((msg, idx) => {
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
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: isPatient ? 'rgba(32,181,223,0.15)' : 'rgba(4,53,77,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isPatient ? T.blue : T.slate }}>
                            <Ico p={ICONS.shield} size={20} sw={1.5} />
                          </div>
                          <div>
                            <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: T.navy }}>{msg.attachmentName}</p>
                            <p style={{ margin: 0, fontSize: '11.5px', color: T.slate }}>{msg.attachmentSize} • PDF</p>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', padding: '0 4px' }}>
                        <span style={{ fontSize: '11px', color: T.slate2 }}>{msg.timestamp}</span>
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
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                  <button type="button" aria-label="Add attachment" style={{ width: '48px', height: '48px', borderRadius: '14px', border: '1px solid rgba(4,53,77,0.12)', background: '#fff', color: T.slate, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <span style={{ transform: 'rotate(-45deg)', display: 'inline-block' }}>
                      <Ico p={ICONS.search} size={18} sw={1.8} /> {/* Using search as a placeholder for paperclip, or just text */}
                      <span style={{ display: 'none' }}>+</span>
                    </span>
                  </button>
                  
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
                    base={{ width: '48px', height: '48px', borderRadius: '14px', border: 'none', background: newMessageText.trim() ? `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : 'rgba(4,53,77,0.1)', color: newMessageText.trim() ? '#fff' : T.slate2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: newMessageText.trim() ? 'pointer' : 'not-allowed', flexShrink: 0, boxShadow: newMessageText.trim() ? '0 4px 12px rgba(32,181,223,0.3)' : 'none' }}
                    on={newMessageText.trim() ? { transform: 'translateY(-1px)', boxShadow: '0 6px 16px rgba(52,140,234,0.35)' } : {}}
                  >
                    <span style={{ transform: 'rotate(-45deg) translateX(2px) translateY(-2px)', display: 'inline-block' }}>
                      <Ico p={ICONS.zap} size={18} sw={1.8} /> {/* Using zap as placeholder for send icon */}
                    </span>
                  </HoverBtn>
                </div>
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
      </div>

      {isComposing && (
        <NewMessageModal
          onClose={() => setIsComposing(false)}
          onSend={handleSendNewModalMessage}
        />
      )}
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

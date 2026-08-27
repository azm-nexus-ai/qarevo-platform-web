import type { StateCreator } from 'zustand'
import type { StoreState } from '../types'

export type MessageType = 'text' | 'attachment' | 'system'

export type Message = {
  id: string
  senderId: string
  type: MessageType
  text?: string
  attachmentUrl?: string
  attachmentName?: string
  attachmentSize?: string
  timestamp: string
  isRead: boolean
}

export type ContactType = 'Physician' | 'Care Team' | 'Support'

export type Conversation = {
  id: string
  contactId: string
  contactName: string
  contactRole: string
  contactType: ContactType
  contactAvatar: string
  isOnline: boolean
  isPinned: boolean
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  context?: string
  messages: Message[]
}

export type MessageFilter = 'All' | 'Unread' | 'Physicians' | 'Care Team' | 'Support'

export interface MessageSlice {
  conversations: Conversation[]
  activeConversationId: string | null
  filter: MessageFilter
  draftMessage: string
  setConversations: (conversations: Conversation[]) => void
  setActiveConversation: (conversationId: string | null) => void
  setFilter: (filter: MessageFilter) => void
  setDraftMessage: (draftMessage: string) => void
  sendMessage: (conversationId: string, message: Message) => void
  markConversationRead: (conversationId: string) => void
  togglePinConversation: (conversationId: string) => void
  resetMessages: () => void
}

export const createMessageSlice: StateCreator<StoreState, [], [], MessageSlice> = (set) => ({
  conversations: [],
  activeConversationId: null,
  filter: 'All',
  draftMessage: '',

  setConversations: (conversations) => set({ conversations }),

  setActiveConversation: (activeConversationId) => set({ activeConversationId }),

  setFilter: (filter) => set({ filter }),

  setDraftMessage: (draftMessage) => set({ draftMessage }),

  sendMessage: (conversationId, message) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) => {
        if (conversation.id !== conversationId) return conversation

        return {
          ...conversation,
          messages: [...conversation.messages, message],
          lastMessage: message.text ?? message.attachmentName ?? 'Attachment',
          lastMessageTime: message.timestamp,
        }
      }),
      draftMessage: '',
    })),

  markConversationRead: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) => {
        if (conversation.id !== conversationId) return conversation

        return {
          ...conversation,
          unreadCount: 0,
          messages: conversation.messages.map((message) => ({ ...message, isRead: true })),
        }
      }),
    })),

  togglePinConversation: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, isPinned: !conversation.isPinned }
          : conversation,
      ),
    })),

  resetMessages: () =>
    set({
      conversations: [],
      activeConversationId: null,
      filter: 'All',
      draftMessage: '',
    }),
})

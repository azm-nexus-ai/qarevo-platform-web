import type { StateCreator } from 'zustand'
import type { StoreState } from '../types'

export type PaymentMethod = {
  brand: string
  label: string
  meta: string
  primary: boolean
}

export type InvoiceStatus = 'Paid' | 'Pending' | 'Refunded'

export type Invoice = {
  id: string
  appointment: string
  date: string
  status: InvoiceStatus
  amount: string
}

export type PaymentSummaryTone = 'success' | 'warning' | 'info' | 'neutral'

export type PaymentSummary = {
  title: string
  value: string
  hint: string
  tone: PaymentSummaryTone
}

export type BillingSummary = {
  outstandingBalance: string
  insuranceCoverage: string
  amountDue: string
  nextAutoDraft: string
}

export interface BillingSlice {
  paymentMethods: PaymentMethod[]
  invoices: Invoice[]
  paymentHistory: PaymentSummary[]
  summary: BillingSummary
  setPaymentMethods: (paymentMethods: PaymentMethod[]) => void
  setInvoices: (invoices: Invoice[]) => void
  setPaymentHistory: (paymentHistory: PaymentSummary[]) => void
  updateSummary: (patch: Partial<BillingSummary>) => void
  resetBilling: () => void
}

const DEFAULT_SUMMARY: BillingSummary = {
  outstandingBalance: '$0.00',
  insuranceCoverage: '$0.00',
  amountDue: '$0.00',
  nextAutoDraft: '',
}

export const createBillingSlice: StateCreator<StoreState, [], [], BillingSlice> = (set) => ({
  paymentMethods: [],
  invoices: [],
  paymentHistory: [],
  summary: DEFAULT_SUMMARY,

  setPaymentMethods: (paymentMethods) => set({ paymentMethods }),

  setInvoices: (invoices) => set({ invoices }),

  setPaymentHistory: (paymentHistory) => set({ paymentHistory }),

  updateSummary: (patch) =>
    set((state) => ({
      summary: { ...state.summary, ...patch },
    })),

  resetBilling: () =>
    set({
      paymentMethods: [],
      invoices: [],
      paymentHistory: [],
      summary: DEFAULT_SUMMARY,
    }),
})

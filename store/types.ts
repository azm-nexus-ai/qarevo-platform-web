import type { AuthFlowState } from '@/lib/auth-flow'
import type { BookingPhysicianData } from '@/lib/booking'
import type { Physician } from '@/constants/physicians'
import type { PatientSlice } from './slices/patientSlice'
import type { PrescriptionSlice } from './slices/prescriptionSlice'
import type { MedicalRecordSlice } from './slices/medicalRecordSlice'
import type { AppointmentSlice } from './slices/appointmentSlice'
import type { LabRequestSlice } from './slices/labRequestSlice'
import type { MessageSlice } from './slices/messageSlice'
import type { BillingSlice } from './slices/billingSlice'
import type { DoctorSlice } from './slices/doctorSlice'

export type StoreState = PatientSlice &
  PrescriptionSlice &
  MedicalRecordSlice &
  AppointmentSlice &
  LabRequestSlice &
  MessageSlice &
  BillingSlice &
  DoctorSlice

export type { AuthFlowState, BookingPhysicianData, Physician }

import { create } from 'zustand'
import { createPatientSlice } from './slices/patientSlice'
import { createPrescriptionSlice } from './slices/prescriptionSlice'
import { createMedicalRecordSlice } from './slices/medicalRecordSlice'
import { createAppointmentSlice } from './slices/appointmentSlice'
import { createLabRequestSlice } from './slices/labRequestSlice'
import { createMessageSlice } from './slices/messageSlice'
import { createBillingSlice } from './slices/billingSlice'
import { createDoctorSlice } from './slices/doctorSlice'
import type { StoreState } from './types'

const useStore = create<StoreState>()((...a) => ({
  ...createPatientSlice(...a),
  ...createPrescriptionSlice(...a),
  ...createMedicalRecordSlice(...a),
  ...createAppointmentSlice(...a),
  ...createLabRequestSlice(...a),
  ...createMessageSlice(...a),
  ...createBillingSlice(...a),
  ...createDoctorSlice(...a),
}))

export default useStore

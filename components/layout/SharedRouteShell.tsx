'use client'
import type { ReactNode } from 'react'
import { usePortalRole } from '@/lib/portal-navigation'
import PatientLayout from '@/app/patient/layout'
import DoctorLayout from '@/app/doctor/layout'
import AdminLayout from '@/app/admin/layout'

/** Shared authenticated routes inherit their existing role layout and authorization. */
export default function SharedRouteShell({ children }: { children: ReactNode }) {
  const role = usePortalRole()
  if (role === 'patient') return <PatientLayout>{children}</PatientLayout>
  if (role === 'doctor') return <DoctorLayout>{children}</DoctorLayout>
  if (role === 'admin') return <AdminLayout>{children}</AdminLayout>
  return <>{children}</>
}

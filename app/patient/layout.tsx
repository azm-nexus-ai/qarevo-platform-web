import PatientMobileNavigation from '@/components/patient/PatientMobileNavigation'

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PatientMobileNavigation />
      {children}
    </>
  )
}

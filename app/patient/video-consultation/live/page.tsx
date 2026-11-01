import FeatureAvailability from '@/components/ui/FeatureAvailability'
import PatientPortalShell from '@/components/patient/PatientPortalShell'

export default function Page() {
  return (
    <PatientPortalShell title="Video consultation" description="Prepare your device and check your saved appointments.">
      <FeatureAvailability title="Video consultation is not connected yet" description="A clinician video connection has not been enabled in this environment. No consultation, recording, chat or clinical notes are created on this screen. You can still check your camera and microphone, or return to your appointments." actions={[
        { href: '/patient/video-consultation/device-check', label: 'Check camera and microphone' },
        { href: '/patient/appointments', label: 'View appointments' },
      ]} />
    </PatientPortalShell>
  )
}

import FeatureAvailability from '@/components/ui/FeatureAvailability'

export default function VideoConsultationPage() {
  return <FeatureAvailability title="Video consultation is not connected yet" description="Clinician video sessions have not been enabled in this environment. This screen does not create a call, recording or clinical record. Your existing appointments and clinical workspace remain available." actions={[
    { href: '/doctor/appointments', label: 'View appointments' },
    { href: '/doctor/workspace', label: 'Open clinical workspace' },
  ]} />
}

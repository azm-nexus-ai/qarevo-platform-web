'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalBadge, PortalButton, PortalCard, PortalSkeleton } from '@/components/patient/PatientPortalPrimitives'
import Ico from '@/components/ui/Ico'
import { ICONS } from '@/constants/icons'
import { T } from '@/lib/tokens'
import { clearAuthTokens, createEmergencyContact, createInsurance, deleteEmergencyContact, getPatientHealthInfo, getPatientSettings, isAuthError, readAccessToken, updateInsurance, updatePatientHealthInfo, updateProfile, type PatientHealthInfoUpdate, type EmergencyContact, type Insurance, type InsuranceCreate, type EmergencyContactCreate } from '@/lib/api'

type ToggleKey =
  | 'emailNotifications'
  | 'smsNotifications'
  | 'pushNotifications'
  | 'appointmentReminders'
  | 'medicationReminders'
  | 'labResultAlerts'
  | 'marketingEmails'
  | 'dataSharing'
  | 'physicianAccess'
  | 'darkMode'
  | 'highContrast'

type HealthInfo = {
  bloodPressure: string
  weight: string
  height: string
  bloodType: string
  allergies: string
  conditions: string
}


const SECURITY_ITEMS = [
  { title: 'Change Password', body: 'Last updated 42 days ago', badge: 'Recommended', tone: 'warning' as const },
  { title: 'Two-Factor Authentication', body: 'SMS verification is currently enabled', badge: 'Enabled', tone: 'success' as const },
  { title: 'Active Devices', body: '3 devices currently signed in', badge: 'Monitored', tone: 'info' as const },
  { title: 'Login History', body: 'No suspicious attempts detected this month', badge: 'Clean', tone: 'success' as const },
  { title: 'Face ID / Biometrics', body: 'Placeholder for device-level secure access', badge: 'Placeholder', tone: 'neutral' as const },
]

export default function PatientSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [accountData, setAccountData] = useState({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
  })
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true,
    appointmentReminders: true,
    medicationReminders: true,
    labResultAlerts: true,
    marketingEmails: false,
    dataSharing: true,
    physicianAccess: true,
    darkMode: false,
    highContrast: false,
  })
  const [fontSize, setFontSize] = useState('Medium')
  const [language, setLanguage] = useState('English')
  const [timeZone, setTimeZone] = useState('Africa/Lagos (GMT+1)')
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [insurance, setInsurance] = useState<Insurance | null>(null)
  const [healthInfo, setHealthInfo] = useState<HealthInfo>({
    bloodPressure: '',
    weight: '',
    height: '',
    bloodType: '',
    allergies: '',
    conditions: '',
  })
  const [showAddContactForm, setShowAddContactForm] = useState(false)
  const [newContact, setNewContact] = useState<EmergencyContactCreate>({
    name: '',
    relationship: '',
    phone: '',
  })
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [profileEdit, setProfileEdit] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    phone: '',
  })
  const [showInsuranceEdit, setShowInsuranceEdit] = useState(false)
  const [insuranceEdit, setInsuranceEdit] = useState({
    insurance_provider_name: '',
    insurance_number: '',
    insured_status: '',
    validity_start: '',
    validity_end: '',
  })

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 500)

    if (!readAccessToken()) {
      router.replace('/auth/sign-in')
      return () => window.clearTimeout(timer)
    }
    
    // Load account data and health info from API
    const loadData = async () => {
      try {
        const [settingsData, healthData] = await Promise.all([
          getPatientSettings(),
          getPatientHealthInfo(),
        ])
        
        const fullName = [settingsData.first_name, settingsData.last_name].filter(Boolean).join(' ')
        const formattedDate = settingsData.date_of_birth 
          ? new Date(settingsData.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
          : ''
        
        setAccountData({
          fullName: fullName || 'Not set',
          email: settingsData.email || '',
          phone: settingsData.phone || 'Not set',
          dateOfBirth: formattedDate || 'Not set',
          gender: settingsData.gender || 'Not set',
        })
        
        setContacts(settingsData.emergency_contacts || [])
        setInsurance(settingsData.insurance || null)
        
        setHealthInfo({
          bloodPressure: healthData.blood_pressure || '',
          weight: healthData.weight || '',
          height: healthData.height || '',
          bloodType: healthData.blood_type || '',
          allergies: healthData.allergies || '',
          conditions: healthData.medical_conditions || '',
        })
      } catch (error) {
        if (isAuthError(error)) {
          clearAuthTokens()
          router.replace('/auth/sign-in')
          return
        }
        console.error('Failed to load settings data:', error)
      }
    }
    loadData()
    
    return () => window.clearTimeout(timer)
  }, [router])

  function toggleSetting(key: ToggleKey) {
    setToggles((current) => ({ ...current, [key]: !current[key] }))
  }

  async function handleDeleteContact(contactId: string) {
    try {
      await deleteEmergencyContact(contactId)
      setContacts(contacts.filter(c => c.id !== contactId))
    } catch (error) {
      console.error('Failed to delete emergency contact:', error)
    }
  }

  async function handleAddContact() {
    try {
      const created = await createEmergencyContact(newContact)
      setContacts([...contacts, created])
      setNewContact({ name: '', relationship: '', phone: '' })
      setShowAddContactForm(false)
    } catch (error) {
      console.error('Failed to add emergency contact:', error)
    }
  }

  async function handleProfileSave() {
    try {
      const updated = await updateProfile(profileEdit)
      const fullName = [updated.first_name, updated.last_name].filter(Boolean).join(' ')
      const formattedDate = updated.date_of_birth 
        ? new Date(updated.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : ''
      
      setAccountData({
        fullName: fullName || 'Not set',
        email: updated.email || '',
        phone: updated.phone || 'Not set',
        dateOfBirth: formattedDate || 'Not set',
        gender: updated.gender || 'Not set',
      })
      setShowProfileEdit(false)
      setSaveMessage('Profile updated successfully')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Failed to update profile:', error)
      setSaveMessage('Failed to update profile')
    }
  }

  function openProfileEdit() {
    setProfileEdit({
      first_name: accountData.fullName.split(' ')[0] || '',
      last_name: accountData.fullName.split(' ').slice(1).join(' ') || '',
      date_of_birth: accountData.dateOfBirth !== 'Not set' ? new Date(accountData.dateOfBirth).toISOString().split('T')[0] : '',
      gender: accountData.gender !== 'Not set' ? accountData.gender : '',
      phone: accountData.phone !== 'Not set' ? accountData.phone : '',
    })
    setShowProfileEdit(true)
  }

  async function handleInsuranceSave() {
    try {
      if (insurance) {
        const updated = await updateInsurance(insuranceEdit)
        setInsurance(updated)
      } else {
        const created = await createInsurance(insuranceEdit)
        setInsurance(created)
      }
      setShowInsuranceEdit(false)
      setSaveMessage('Insurance information saved successfully')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Failed to save insurance:', error)
      setSaveMessage('Failed to save insurance information')
    }
  }

  function openInsuranceEdit() {
    if (insurance) {
      setInsuranceEdit({
        insurance_provider_name: insurance.insurance_provider_name || '',
        insurance_number: insurance.insurance_number || '',
        insured_status: insurance.insured_status || '',
        validity_start: insurance.validity_start ? insurance.validity_start.split('T')[0] : '',
        validity_end: insurance.validity_end ? insurance.validity_end.split('T')[0] : '',
      })
    }
    setShowInsuranceEdit(true)
  }

  async function handleSave() {
    setSaving(true)
    setSaveMessage('')
    
    try {
      // Save health info to backend
      const healthUpdate: PatientHealthInfoUpdate = {
        blood_pressure: healthInfo.bloodPressure || undefined,
        weight: healthInfo.weight || undefined,
        height: healthInfo.height || undefined,
        blood_type: healthInfo.bloodType || undefined,
        allergies: healthInfo.allergies || undefined,
        medical_conditions: healthInfo.conditions || undefined,
      }
      await updatePatientHealthInfo(healthUpdate)
      
      setSaving(false)
      setSaveMessage('Settings saved successfully.')
    } catch (error) {
      if (isAuthError(error)) {
        setSaving(false)
        clearAuthTokens()
        router.replace('/auth/sign-in')
        return
      }
      console.error('Failed to save settings:', error)
      setSaving(false)
      setSaveMessage('Failed to save settings. Please try again.')
    }
  }

  function handleCancel() {
    setSaveMessage('Changes reverted to the last saved version.')
  }

  const headerActions = (
    <>
      <PortalButton tone='secondary' onClick={handleCancel}>Cancel</PortalButton>
      <PortalButton tone='primary' onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</PortalButton>
    </>
  )

  const rightRail = (
    <div className='grid gap-3'>
      <PortalCard>
        <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Profile Health</p>
        <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 800, color: T.navy }}>Your preferences are current</h2>
        <div className='grid gap-2'>
          {[
            ['Security score', '92%'],
            ['Notification setup', '6 of 7 enabled'],
            ['Insurance coverage', 'Verified'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(4,53,77,0.03)', border: '1px solid rgba(4,53,77,0.06)' }}>
              <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
              <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </div>
      </PortalCard>

      <PortalCard>
        <div className='flex items-center gap-2 mb-2'>
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(32,181,223,0.12)', display: 'grid', placeItems: 'center' }}>
            <Ico p={ICONS.lock} size={15} sw={1.7} color={T.blue} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>Trusted access</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: T.slate }}>Review sign-ins and privacy controls regularly.</p>
          </div>
        </div>
        <PortalButton tone='secondary' fullWidth>Review Login History</PortalButton>
      </PortalCard>
    </div>
  )

  return (
    <PatientPortalShell
      title='Settings'
      description='Manage account details, privacy, notifications, accessibility, insurance information, and the preferences that shape your care experience.'
      headerActions={headerActions}
      rightRail={rightRail}
    >
      {loading ? (
        <div className='grid gap-4'>
          <PortalSkeleton height={180} />
          <PortalSkeleton height={220} />
          <PortalSkeleton height={180} />
        </div>
      ) : (
        <div className='grid gap-4'>
          {saveMessage ? <PortalBadge tone='success'>{saveMessage}</PortalBadge> : null}

          <PortalCard>
            <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Account Information</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Profile and contact identity</h2>
              </div>
              <PortalButton tone='secondary' onClick={() => { if (!showProfileEdit) openProfileEdit(); else setShowProfileEdit(false) }}>
                {showProfileEdit ? 'Cancel' : 'Edit'}
              </PortalButton>
            </div>
            <div className='grid gap-4 md:grid-cols-[96px_minmax(0,1fr)]'>
              <div className='flex items-center justify-center md:justify-start'>
                <div style={{ width: '88px', height: '88px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(32,181,223,0.18), rgba(52,140,234,0.22))', border: '1px solid rgba(4,53,77,0.1)', display: 'grid', placeItems: 'center', color: T.navy, fontSize: '26px', fontWeight: 800 }}>
                  {accountData.fullName.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className='grid gap-3 sm:grid-cols-2'>
                {showProfileEdit ? (
                  <>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)', gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>First Name</label>
                      <input
                        type='text'
                        value={profileEdit.first_name}
                        onChange={(e) => setProfileEdit({ ...profileEdit, first_name: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)', gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Last Name</label>
                      <input
                        type='text'
                        value={profileEdit.last_name}
                        onChange={(e) => setProfileEdit({ ...profileEdit, last_name: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Phone Number</label>
                      <input
                        type='text'
                        value={profileEdit.phone}
                        onChange={(e) => setProfileEdit({ ...profileEdit, phone: e.target.value })}
                        placeholder='+234 XXX XXX XXXX'
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date of Birth</label>
                      <input
                        type='date'
                        value={profileEdit.date_of_birth}
                        onChange={(e) => setProfileEdit({ ...profileEdit, date_of_birth: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gender</label>
                      <select
                        value={profileEdit.gender}
                        onChange={(e) => setProfileEdit({ ...profileEdit, gender: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                      >
                        <option value=''>Select</option>
                        <option value='MALE'>Male</option>
                        <option value='FEMALE'>Female</option>
                        <option value='OTHER'>Other</option>
                      </select>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)', gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{accountData.email}</p>
                    </div>
                    <div className='flex gap-2' style={{ gridColumn: 'span 2' }}>
                      <PortalButton tone='primary' onClick={handleProfileSave}>Save Changes</PortalButton>
                      <PortalButton tone='secondary' onClick={() => setShowProfileEdit(false)}>Cancel</PortalButton>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Full Name</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{accountData.fullName}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{accountData.email}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Phone Number</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{accountData.phone}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date of Birth</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{accountData.dateOfBirth}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gender</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{accountData.gender}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </PortalCard>

          <PortalCard>
            <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Health Information</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Vital signs and medical details</h2>
              </div>
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Blood Pressure</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{healthInfo.bloodPressure ? `${healthInfo.bloodPressure} mmHg` : 'Not set'}</p>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Weight</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{healthInfo.weight ? `${healthInfo.weight} kg` : 'Not set'}</p>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Height</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{healthInfo.height ? `${healthInfo.height} cm` : 'Not set'}</p>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Blood Type</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{healthInfo.bloodType || 'Not set'}</p>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)', gridColumn: 'span 2' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Allergies</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{healthInfo.allergies || 'None'}</p>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)', gridColumn: 'span 2' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Medical Conditions</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{healthInfo.conditions || 'None'}</p>
              </div>
            </div>
          </PortalCard>

          <PortalCard>
            <div className='mb-4'>
              <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Security</p>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Secure access controls</h2>
            </div>
            <div className='grid gap-3'>
              {SECURITY_ITEMS.map((item) => (
                <div key={item.title} style={{ padding: '14px', borderRadius: '16px', background: 'rgba(247,250,252,0.9)', border: '1px solid rgba(4,53,77,0.08)' }}>
                  <div className='flex flex-wrap items-start justify-between gap-2 mb-2'>
                    <div>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{item.title}</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: T.slate, lineHeight: 1.55 }}>{item.body}</p>
                    </div>
                    <PortalBadge tone={item.tone}>{item.badge}</PortalBadge>
                  </div>
                </div>
              ))}
            </div>
          </PortalCard>

          <PortalCard>
            <div className='mb-4'>
              <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Notification Preferences</p>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Care communication and reminders</h2>
            </div>
            <div className='grid gap-3'>
              {[
                ['Email Notifications', 'emailNotifications'],
                ['SMS Notifications', 'smsNotifications'],
                ['Push Notifications', 'pushNotifications'],
                ['Appointment Reminders', 'appointmentReminders'],
                ['Medication Reminders', 'medicationReminders'],
                ['Lab Result Alerts', 'labResultAlerts'],
                ['Marketing Emails', 'marketingEmails'],
              ].map(([label, key]) => (
                <ToggleRow key={key} label={label} enabled={toggles[key as ToggleKey]} onToggle={() => toggleSetting(key as ToggleKey)} />
              ))}
            </div>
          </PortalCard>

          <div className='grid gap-4 xl:grid-cols-2'>
            <PortalCard>
              <div className='mb-4'>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Privacy</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Control your health data</h2>
              </div>
              <div className='grid gap-3'>
                <ToggleRow label='Data Sharing' enabled={toggles.dataSharing} onToggle={() => toggleSetting('dataSharing')} description='Allow anonymized usage insights to improve care workflows.' />
                <ToggleRow label='Physician Access' enabled={toggles.physicianAccess} onToggle={() => toggleSetting('physicianAccess')} description='Keep authorized care teams connected to your profile and records.' />
                {['Download My Data', 'Delete Account', 'Privacy Policy'].map((item) => (
                  <div key={item} className='flex items-center justify-between gap-3 rounded-2xl border p-3' style={{ borderColor: 'rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.9)' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{item}</span>
                    <PortalButton tone={item === 'Delete Account' ? 'danger' : 'secondary'}>{item === 'Delete Account' ? 'Manage' : 'Open'}</PortalButton>
                  </div>
                ))}
              </div>
            </PortalCard>

            <PortalCard>
              <div className='mb-4'>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Accessibility</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Personalize readability and comfort</h2>
              </div>
              <div className='grid gap-3'>
                <ToggleRow label='Dark Mode' enabled={toggles.darkMode} onToggle={() => toggleSetting('darkMode')} description='Placeholder for future theme support.' />
                <ToggleRow label='High Contrast' enabled={toggles.highContrast} onToggle={() => toggleSetting('highContrast')} />
                <SelectRow label='Font Size' value={fontSize} options={['Small', 'Medium', 'Large']} onChange={setFontSize} />
                <SelectRow label='Language' value={language} options={['English', 'French', 'Arabic']} onChange={setLanguage} />
                <SelectRow label='Time Zone' value={timeZone} options={['Africa/Lagos (GMT+1)', 'UTC', 'Europe/London (GMT)']} onChange={setTimeZone} />
              </div>
            </PortalCard>
          </div>

          <div className='grid gap-4 xl:grid-cols-2'>
            <PortalCard>
              <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Emergency Contacts</p>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>People to contact quickly</h2>
                </div>
                <PortalButton tone='primary' onClick={() => setShowAddContactForm(!showAddContactForm)}>
                  {showAddContactForm ? 'Cancel' : 'Add Contact'}
                </PortalButton>
              </div>
              
              {showAddContactForm && (
                <div style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(247,250,252,0.95)', padding: '16px', marginBottom: '16px' }}>
                  <div className='grid gap-3'>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: T.slate }}>Name</label>
                      <input
                        type='text'
                        value={newContact.name}
                        onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                        placeholder='Contact name'
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: T.slate }}>Relationship</label>
                      <input
                        type='text'
                        value={newContact.relationship}
                        onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                        placeholder='e.g., Spouse, Parent, Sibling'
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: T.slate }}>Phone Number</label>
                      <input
                        type='text'
                        value={newContact.phone}
                        onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                        placeholder='+234 XXX XXX XXXX'
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                      />
                    </div>
                    <div className='flex gap-2'>
                      <PortalButton tone='primary' onClick={handleAddContact} disabled={!newContact.name || !newContact.relationship || !newContact.phone}>
                        Add Contact
                      </PortalButton>
                      <PortalButton tone='secondary' onClick={() => setShowAddContactForm(false)}>
                        Cancel
                      </PortalButton>
                    </div>
                  </div>
                </div>
              )}
              
              <div className='grid gap-3'>
                {contacts.length === 0 ? (
                  <div style={{ borderRadius: '18px', border: '1px dashed rgba(4,53,77,0.14)', background: 'rgba(247,250,252,0.82)', padding: '20px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: T.navy }}>No emergency contacts saved</p>
                    <p style={{ margin: 0, fontSize: '12.5px', color: T.slate, lineHeight: 1.6 }}>Add a trusted contact for faster response during urgent situations.</p>
                  </div>
                ) : (
                  contacts.map((contact) => (
                    <div key={contact.id} className='rounded-2xl border p-4' style={{ borderColor: 'rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.9)' }}>
                      <div className='flex flex-wrap items-start justify-between gap-3'>
                        <div>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{contact.name}</p>
                          <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: T.slate }}>{contact.relationship} • {contact.phone}</p>
                        </div>
                        <div className='flex gap-2'>
                          <PortalButton tone='secondary'>Edit</PortalButton>
                          <PortalButton tone='danger' onClick={() => handleDeleteContact(contact.id)}>Delete</PortalButton>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </PortalCard>

            <PortalCard>
              <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Insurance Information</p>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Coverage and card upload</h2>
                </div>
                <div className='flex gap-2'>
                  {insurance && <PortalBadge tone='success'>Coverage Active</PortalBadge>}
                  <PortalButton tone='secondary' onClick={() => { if (!showInsuranceEdit) openInsuranceEdit(); else setShowInsuranceEdit(false) }}>
                    {showInsuranceEdit ? 'Cancel' : insurance ? 'Edit' : 'Add Insurance'}
                  </PortalButton>
                </div>
              </div>
              
              {showInsuranceEdit && (
                <div style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.12)', background: 'rgba(247,250,252,0.95)', padding: '16px', marginBottom: '16px' }}>
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: T.slate }}>Insurance Provider</label>
                      <input
                        type='text'
                        value={insuranceEdit.insurance_provider_name}
                        onChange={(e) => setInsuranceEdit({ ...insuranceEdit, insurance_provider_name: e.target.value })}
                        placeholder='e.g., Axa Mansard, HMO'
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: T.slate }}>Policy Number</label>
                      <input
                        type='text'
                        value={insuranceEdit.insurance_number}
                        onChange={(e) => setInsuranceEdit({ ...insuranceEdit, insurance_number: e.target.value })}
                        placeholder='e.g., QH-8892-4481'
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: T.slate }}>Coverage Status</label>
                      <select
                        value={insuranceEdit.insured_status}
                        onChange={(e) => setInsuranceEdit({ ...insuranceEdit, insured_status: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                      >
                        <option value=''>Select</option>
                        <option value='SELF_INSURED'>Self Insured</option>
                        <option value='FAMILY_MEMBER'>Family Member</option>
                        <option value='STUDENT'>Student</option>
                        <option value='PENSIONER'>Pensioner</option>
                        <option value='OTHER'>Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: T.slate }}>Valid From</label>
                      <input
                        type='date'
                        value={insuranceEdit.validity_start}
                        onChange={(e) => setInsuranceEdit({ ...insuranceEdit, validity_start: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: T.slate }}>Valid Until</label>
                      <input
                        type='date'
                        value={insuranceEdit.validity_end}
                        onChange={(e) => setInsuranceEdit({ ...insuranceEdit, validity_end: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                      />
                    </div>
                    <div className='flex gap-2' style={{ gridColumn: 'span 2' }}>
                      <PortalButton tone='primary' onClick={handleInsuranceSave}>Save Insurance</PortalButton>
                      <PortalButton tone='secondary' onClick={() => setShowInsuranceEdit(false)}>Cancel</PortalButton>
                    </div>
                  </div>
                </div>
              )}
              
              <div className='grid gap-3 sm:grid-cols-2'>
                {insurance ? (
                  <>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Insurance Provider</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{insurance.insurance_provider_name || 'Not set'}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Policy Number</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{insurance.insurance_number || 'Not set'}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coverage Status</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{insurance.insured_status || 'Not set'}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Valid Until</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>
                        {insurance.validity_end 
                          ? new Date(insurance.validity_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                          : 'Not set'}
                      </p>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)', gridColumn: '1 / -1' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: T.slate2 }}>No insurance information on file</p>
                  </div>
                )}
              </div>
              <div className='flex gap-2 flex-wrap mt-4'>
                <PortalButton tone='secondary'>Upload Insurance Card</PortalButton>
              </div>
            </PortalCard>
          </div>
        </div>
      )}
    </PatientPortalShell>
  )
}

function ToggleRow({ label, enabled, onToggle, description }: { label: string; enabled: boolean; onToggle: () => void; description?: string }) {
  return (
    <button
      type='button'
      onClick={onToggle}
      className='flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-px focus:outline-none focus:ring-2'
      style={{
        borderColor: enabled ? 'rgba(32,181,223,0.2)' : 'rgba(4,53,77,0.08)',
        background: enabled ? 'rgba(32,181,223,0.06)' : 'rgba(247,250,252,0.9)',
        boxShadow: enabled ? '0 8px 20px rgba(32,181,223,0.08)' : 'none',
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{label}</p>
        {description ? <p style={{ margin: '4px 0 0', fontSize: '12px', color: T.slate, lineHeight: 1.5 }}>{description}</p> : null}
      </div>
      <span style={{ width: '44px', height: '24px', borderRadius: '999px', background: enabled ? T.blue : 'rgba(4,53,77,0.12)', padding: '2px', display: 'inline-flex', justifyContent: enabled ? 'flex-end' : 'flex-start', transition: 'all 0.18s ease' }}>
        <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', boxShadow: '0 2px 6px rgba(4,53,77,0.16)' }} />
      </span>
    </button>
  )
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (next: string) => void }) {
  return (
    <label className='flex items-center justify-between gap-3 rounded-2xl border p-3' style={{ borderColor: 'rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.9)' }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className='rounded-xl border px-3 py-2 text-sm' style={{ borderColor: 'rgba(4,53,77,0.12)', color: T.navy, background: '#fff' }}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

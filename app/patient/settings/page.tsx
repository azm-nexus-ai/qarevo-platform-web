'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalBadge, PortalButton, PortalCard, PortalSkeleton } from '@/components/patient/PatientPortalPrimitives'
import Ico from '@/components/ui/Ico'
import { ICONS } from '@/constants/icons'
import { T } from '@/lib/tokens'
import { clearAuthTokens, createEmergencyContact, createInsurance, deactivatePatientAccount, deleteEmergencyContact, deletePatientPasskey, downloadPatientDataExport, getApiErrorDetail, getPatientActiveDevices, getPatientHealthInfo, getPatientLoginHistory, getPatientPasskeyStatus, getPatientPasskeys, getPatientSettings, isAuthError, readAccessToken, registerPatientPasskey, revokeOtherPatientActiveDevices, revokePatientActiveDevice, updateEmergencyContact, updateInsurance, updatePatientHealthInfo, updatePatientSettings, updateProfile, uploadMedicalRecord, type PatientActiveDevice, type PatientHealthInfoUpdate, type PatientLoginHistoryItem, type PatientPasskeyCredential, type PatientPasskeyStatus, type EmergencyContact, type Insurance, type EmergencyContactCreate } from '@/lib/api'

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

const DEFAULT_TOGGLES: Record<ToggleKey, boolean> = {
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
}

const SECURITY_ITEMS = [
  { title: 'Change Password', body: 'Use password reset from the sign-in screen until in-app password change is added.', badge: 'Available', tone: 'info' as const },
  { title: 'Two-Factor Authentication', body: 'Email verification is required during secure sign-in.', badge: 'Enabled', tone: 'success' as const },
  { title: 'Active Devices', body: 'Review current browser sessions and sign out devices you no longer use.', badge: 'Available', tone: 'info' as const },
  { title: 'Login History', body: 'Recent sign-in events are available from the audit log.', badge: 'Available', tone: 'info' as const },
  { title: 'Face ID / Biometrics', body: 'Set up passkeys so this browser can sign in with your device security.', badge: 'Available', tone: 'info' as const },
]

export default function PatientSettingsPage() {
  const router = useRouter()
  const insuranceCardInputRef = useRef<HTMLInputElement | null>(null)
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
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>(DEFAULT_TOGGLES)
  const [savedToggles, setSavedToggles] = useState<Record<ToggleKey, boolean>>(DEFAULT_TOGGLES)
  const [fontSize, setFontSize] = useState('Medium')
  const [language, setLanguage] = useState('English')
  const [timeZone, setTimeZone] = useState('Africa/Lagos (GMT+1)')
  const [savedDisplayPrefs, setSavedDisplayPrefs] = useState({
    fontSize: 'Medium',
    language: 'English',
    timeZone: 'Africa/Lagos (GMT+1)',
  })
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
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false)
  const [showLoginHistory, setShowLoginHistory] = useState(false)
  const [loginHistory, setLoginHistory] = useState<PatientLoginHistoryItem[]>([])
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false)
  const [showActiveDevices, setShowActiveDevices] = useState(false)
  const [activeDevices, setActiveDevices] = useState<PatientActiveDevice[]>([])
  const [activeDevicesLoading, setActiveDevicesLoading] = useState(false)
  const [showPasskeys, setShowPasskeys] = useState(false)
  const [passkeys, setPasskeys] = useState<PatientPasskeyCredential[]>([])
  const [passkeysLoading, setPasskeysLoading] = useState(false)
  const [registeringPasskey, setRegisteringPasskey] = useState(false)
  const [passkeyStatus, setPasskeyStatus] = useState<PatientPasskeyStatus | null>(null)
  const [contactSaving, setContactSaving] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [contactEdit, setContactEdit] = useState<EmergencyContactCreate>({
    name: '',
    relationship: '',
    phone: '',
  })
  const [uploadingInsuranceCard, setUploadingInsuranceCard] = useState(false)
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'active' | 'signed-out'>('checking')
  const [insuranceEdit, setInsuranceEdit] = useState({
    insurance_provider_name: '',
    insurance_number: '',
    insured_status: '',
    validity_start: '',
    validity_end: '',
  })

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 500)

    const hasAccessToken = Boolean(readAccessToken())
    const sessionTimer = window.setTimeout(() => {
      setSessionStatus(hasAccessToken ? 'active' : 'signed-out')
    }, 0)

    if (!hasAccessToken) {
      router.replace('/auth/sign-in')
      return () => {
        window.clearTimeout(timer)
        window.clearTimeout(sessionTimer)
      }
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
        getPatientPasskeyStatus()
          .then(setPasskeyStatus)
          .catch(() => setPasskeyStatus(null))
        const loadedToggles = {
          emailNotifications: settingsData.email_notifications ?? DEFAULT_TOGGLES.emailNotifications,
          smsNotifications: settingsData.sms_notifications ?? DEFAULT_TOGGLES.smsNotifications,
          pushNotifications: settingsData.push_notifications ?? DEFAULT_TOGGLES.pushNotifications,
          appointmentReminders: settingsData.appointment_reminders ?? DEFAULT_TOGGLES.appointmentReminders,
          medicationReminders: settingsData.medication_reminders ?? DEFAULT_TOGGLES.medicationReminders,
          labResultAlerts: settingsData.lab_result_alerts ?? DEFAULT_TOGGLES.labResultAlerts,
          marketingEmails: settingsData.marketing_emails ?? DEFAULT_TOGGLES.marketingEmails,
          dataSharing: settingsData.data_sharing ?? DEFAULT_TOGGLES.dataSharing,
          physicianAccess: settingsData.physician_access ?? DEFAULT_TOGGLES.physicianAccess,
          darkMode: settingsData.dark_mode ?? DEFAULT_TOGGLES.darkMode,
          highContrast: settingsData.high_contrast ?? DEFAULT_TOGGLES.highContrast,
        }
        setToggles(loadedToggles)
        setSavedToggles(loadedToggles)
        const loadedDisplayPrefs = {
          fontSize: settingsData.font_size || 'Medium',
          language: settingsData.language || 'English',
          timeZone: settingsData.time_zone || 'Africa/Lagos (GMT+1)',
        }
        setFontSize(loadedDisplayPrefs.fontSize)
        setLanguage(loadedDisplayPrefs.language)
        setTimeZone(loadedDisplayPrefs.timeZone)
        setSavedDisplayPrefs(loadedDisplayPrefs)
        
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
    
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(sessionTimer)
    }
  }, [router])

  const settingsAppearance = useMemo(() => ({
    darkMode: toggles.darkMode,
    highContrast: toggles.highContrast,
    fontSize,
  }), [fontSize, toggles.darkMode, toggles.highContrast])

  const broadcastAppearance = useCallback((appearance: typeof settingsAppearance) => {
    window.dispatchEvent(new CustomEvent('qarevo:patient-appearance-changed', { detail: appearance }))
  }, [])

  useEffect(() => {
    if (loading) return
    const timer = window.setTimeout(() => {
      broadcastAppearance(settingsAppearance)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [broadcastAppearance, loading, settingsAppearance])

  function toggleSetting(key: ToggleKey) {
    setToggles((current) => ({ ...current, [key]: !current[key] }))
    setSaveMessage('')
  }

  function updateFontSizePreference(nextFontSize: string) {
    setFontSize(nextFontSize)
    setSaveMessage('')
  }

  function showError(error: unknown, fallback: string) {
    if (isAuthError(error)) {
      clearAuthTokens()
      router.replace('/auth/sign-in')
      return
    }
    setSaveMessage(getApiErrorDetail(error) || fallback)
  }

  async function handleDeleteContact(contactId: string) {
    try {
      await deleteEmergencyContact(contactId)
      setContacts(contacts.filter(c => c.id !== contactId))
      setSaveMessage('Emergency contact deleted.')
    } catch (error) {
      showError(error, 'Failed to delete emergency contact.')
    }
  }

  async function handleAddContact() {
    setContactSaving(true)
    try {
      const created = await createEmergencyContact(newContact)
      setContacts([...contacts, created])
      setNewContact({ name: '', relationship: '', phone: '' })
      setShowAddContactForm(false)
      setSaveMessage('Emergency contact added.')
    } catch (error) {
      showError(error, 'Failed to add emergency contact.')
    } finally {
      setContactSaving(false)
    }
  }

  function openContactEdit(contact: EmergencyContact) {
    setEditingContactId(contact.id)
    setContactEdit({
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone,
    })
  }

  async function handleContactEditSave() {
    if (!editingContactId) return
    setContactSaving(true)
    try {
      const updated = await updateEmergencyContact(editingContactId, contactEdit)
      setContacts((current) => current.map((contact) => contact.id === updated.id ? updated : contact))
      setEditingContactId(null)
      setSaveMessage('Emergency contact updated.')
    } catch (error) {
      showError(error, 'Failed to update emergency contact.')
    } finally {
      setContactSaving(false)
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
      showError(error, 'Failed to update profile.')
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
      showError(error, 'Failed to save insurance information.')
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
      const [updatedSettings] = await Promise.all([
        updatePatientSettings({
          email_notifications: toggles.emailNotifications,
          sms_notifications: toggles.smsNotifications,
          push_notifications: toggles.pushNotifications,
          appointment_reminders: toggles.appointmentReminders,
          medication_reminders: toggles.medicationReminders,
          lab_result_alerts: toggles.labResultAlerts,
          marketing_emails: toggles.marketingEmails,
          data_sharing: toggles.dataSharing,
          physician_access: toggles.physicianAccess,
          dark_mode: toggles.darkMode,
          high_contrast: toggles.highContrast,
          font_size: fontSize,
          language,
          time_zone: timeZone,
        }),
        updatePatientHealthInfo(healthUpdate),
      ])

      setSavedToggles({
        emailNotifications: updatedSettings.email_notifications,
        smsNotifications: updatedSettings.sms_notifications,
        pushNotifications: updatedSettings.push_notifications,
        appointmentReminders: updatedSettings.appointment_reminders,
        medicationReminders: updatedSettings.medication_reminders,
        labResultAlerts: updatedSettings.lab_result_alerts,
        marketingEmails: updatedSettings.marketing_emails,
        dataSharing: updatedSettings.data_sharing,
        physicianAccess: updatedSettings.physician_access,
        darkMode: updatedSettings.dark_mode,
        highContrast: updatedSettings.high_contrast,
      })
      setSavedDisplayPrefs({
        fontSize: updatedSettings.font_size,
        language: updatedSettings.language,
        timeZone: updatedSettings.time_zone,
      })
      setSaving(false)
      setSaveMessage('Settings saved successfully.')
    } catch (error) {
      if (isAuthError(error)) {
        setSaving(false)
        clearAuthTokens()
        router.replace('/auth/sign-in')
        return
      }
      setSaving(false)
      showError(error, 'Failed to save settings. Please try again.')
    }
  }

  function handleCancel() {
    setToggles(savedToggles)
    setFontSize(savedDisplayPrefs.fontSize)
    setLanguage(savedDisplayPrefs.language)
    setTimeZone(savedDisplayPrefs.timeZone)
    setSaveMessage('Changes reverted to the last saved version.')
  }

  async function handleDataExport() {
    try {
      const data = await downloadPatientDataExport()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `qarevo-patient-data-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(url)
      setSaveMessage('Your data export is ready.')
    } catch (error) {
      showError(error, 'Failed to download your data export.')
    }
  }

  async function handleOpenLoginHistory() {
    setShowLoginHistory(true)
    setLoginHistoryLoading(true)
    try {
      const history = await getPatientLoginHistory()
      setLoginHistory(history.items || [])
    } catch (error) {
      showError(error, 'Failed to load login history.')
    } finally {
      setLoginHistoryLoading(false)
    }
  }

  async function loadActiveDevices() {
    setActiveDevicesLoading(true)
    try {
      const devices = await getPatientActiveDevices()
      setActiveDevices(devices.items || [])
    } catch (error) {
      showError(error, 'Failed to load active devices.')
    } finally {
      setActiveDevicesLoading(false)
    }
  }

  async function handleOpenActiveDevices() {
    setShowActiveDevices(true)
    await loadActiveDevices()
  }

  async function handleRevokeDevice(deviceId: string, isCurrent: boolean) {
    try {
      await revokePatientActiveDevice(deviceId)
      if (isCurrent) {
        clearAuthTokens()
        router.replace('/auth/sign-in')
        return
      }
      setSaveMessage('Device signed out.')
      await loadActiveDevices()
    } catch (error) {
      showError(error, 'Failed to sign out device.')
    }
  }

  async function handleRevokeOtherDevices() {
    try {
      const result = await revokeOtherPatientActiveDevices()
      setSaveMessage(result.message)
      await loadActiveDevices()
    } catch (error) {
      showError(error, 'Failed to sign out other devices.')
    }
  }

  async function loadPasskeys() {
    setPasskeysLoading(true)
    try {
      const [items, status] = await Promise.all([
        getPatientPasskeys(),
        getPatientPasskeyStatus(),
      ])
      setPasskeys(items)
      setPasskeyStatus(status)
    } catch (error) {
      showError(error, 'Failed to load passkeys.')
    } finally {
      setPasskeysLoading(false)
    }
  }

  async function handlePasskeyClick() {
    const browserSupportsPasskeys = typeof window !== 'undefined' && !!window.PublicKeyCredential
    if (!browserSupportsPasskeys) {
      setSaveMessage('This browser does not support passkeys.')
      return
    }
    setShowPasskeys(true)
    await loadPasskeys()
  }

  async function handleRegisterPasskey() {
    setRegisteringPasskey(true)
    try {
      const platform = typeof navigator !== 'undefined' ? navigator.platform : ''
      const credential = await registerPatientPasskey(platform ? `${platform} passkey` : 'This device passkey')
      setPasskeys((items) => [credential, ...items.filter((item) => item.id !== credential.id)])
      const status = await getPatientPasskeyStatus()
      setPasskeyStatus(status)
      setSaveMessage('Passkey added. You can now sign in with this device.')
    } catch (error) {
      showError(error, 'Failed to add passkey.')
    } finally {
      setRegisteringPasskey(false)
    }
  }

  async function handleDeletePasskey(credentialId: string) {
    try {
      await deletePatientPasskey(credentialId)
      setSaveMessage('Passkey removed.')
      await loadPasskeys()
    } catch (error) {
      showError(error, 'Failed to remove passkey.')
    }
  }

  async function handleDeactivateAccount() {
    try {
      await deactivatePatientAccount()
      clearAuthTokens()
      router.replace('/auth/sign-in')
    } catch (error) {
      showError(error, 'Failed to deactivate account.')
    }
  }

  async function handleInsuranceCardSelected(file: File | null) {
    if (!file) return
    setUploadingInsuranceCard(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('record_type', 'Insurance')
      formData.append('title', 'Insurance Card')
      formData.append('description', 'Patient-uploaded insurance card')
      formData.append('provider_name', insurance?.insurance_provider_name || 'Insurance provider')
      formData.append('record_date', new Date().toISOString())
      await uploadMedicalRecord(formData)
      setSaveMessage('Insurance card uploaded to your medical records.')
    } catch (error) {
      showError(error, 'Failed to upload insurance card.')
    } finally {
      setUploadingInsuranceCard(false)
      if (insuranceCardInputRef.current) insuranceCardInputRef.current.value = ''
    }
  }

  const headerActions = (
    <>
      <PortalButton tone='secondary' onClick={handleCancel}>Cancel</PortalButton>
      <PortalButton tone='primary' onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</PortalButton>
    </>
  )

  const enabledNotificationCount = [
    toggles.emailNotifications,
    toggles.smsNotifications,
    toggles.pushNotifications,
    toggles.appointmentReminders,
    toggles.medicationReminders,
    toggles.labResultAlerts,
    toggles.marketingEmails,
  ].filter(Boolean).length

  const rightRail = (
    <div className='grid gap-3'>
      <PortalCard>
        <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Profile Health</p>
        <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 800, color: T.navy }}>Your preferences are current</h2>
        <div className='grid gap-2'>
          {[
            ['Security status', sessionStatus === 'checking' ? 'Checking' : sessionStatus === 'active' ? 'Active session' : 'Signed out'],
            ['Notification setup', `${enabledNotificationCount} of 7 enabled`],
            ['Insurance coverage', insurance ? 'On file' : 'Not added'],
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
        <PortalButton tone='secondary' fullWidth onClick={handleOpenLoginHistory}>Review Login History</PortalButton>
      </PortalCard>
    </div>
  )

  return (
    <PatientPortalShell
      title='Settings'
      description='Manage account details, privacy, notifications, accessibility, insurance information, and the preferences that shape your care experience.'
      headerActions={headerActions}
      rightRail={rightRail}
      appearance={settingsAppearance}
    >
      <style>{`
        .settings-stack { display: grid; gap: 16px; }
        .settings-card { position: relative; overflow: hidden; }
        .settings-two-up { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .settings-info-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .settings-profile-grid { display: grid; gap: 16px; grid-template-columns: 96px minmax(0, 1fr); }
        .settings-wide { grid-column: 1 / -1; }
        .settings-field-value { overflow-wrap: anywhere; word-break: break-word; }
        .settings-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-radius: 16px; border: 1px solid rgba(4,53,77,0.08); background: rgba(247,250,252,0.9); padding: 12px; }
        .settings-row-control { flex: 0 0 auto; }
        .pps-theme-dark .settings-card {
          background: rgba(11, 32, 48, 0.96) !important;
          border-color: rgba(125, 211, 252, 0.2) !important;
          box-shadow: 0 18px 48px rgba(0,0,0,0.26) !important;
        }
        .pps-theme-dark .settings-card h2,
        .pps-theme-dark .settings-card p,
        .pps-theme-dark .settings-card span,
        .pps-theme-dark .settings-card strong,
        .pps-theme-dark .settings-card label {
          color: #E6F6FF !important;
        }
        .pps-theme-dark .settings-card [style*="color: rgb(114, 139, 154)"],
        .pps-theme-dark .settings-card [style*="color: rgb(78, 111, 130)"] {
          color: #B8D6E7 !important;
        }
        .pps-theme-dark .settings-row,
        .pps-theme-dark .settings-info-grid > div,
        .pps-theme-dark .settings-profile-grid [style*="background: rgba(247,250,252"] {
          background: rgba(15, 47, 70, 0.9) !important;
          border-color: rgba(125, 211, 252, 0.18) !important;
        }
        .pps-theme-dark .settings-row[aria-pressed="true"] {
          background: rgba(32,181,223,0.14) !important;
          border-color: rgba(32,181,223,0.4) !important;
        }
        .pps-theme-dark .settings-card input,
        .pps-theme-dark .settings-card select {
          background: rgba(7, 23, 35, 0.96) !important;
          border-color: rgba(125, 211, 252, 0.24) !important;
          color: #E6F6FF !important;
        }
        .pps-theme-dark .settings-card button:not([style*="linear-gradient"]) {
          background: rgba(15, 47, 70, 0.96) !important;
          border-color: rgba(125, 211, 252, 0.24) !important;
          color: #E6F6FF !important;
        }
        .pps-theme-dark .settings-card button[style*="linear-gradient"] {
          color: #fff !important;
        }
        @media (max-width: 900px) {
          .settings-two-up { grid-template-columns: 1fr; }
          .settings-profile-grid { grid-template-columns: 1fr; }
          .settings-profile-avatar { justify-content: flex-start !important; }
        }
        @media (max-width: 640px) {
          .settings-stack { gap: 12px; }
          .settings-info-grid { grid-template-columns: 1fr; }
          .settings-card-title { font-size: 18px !important; line-height: 1.25 !important; }
          .settings-row { align-items: stretch; flex-direction: column; }
          .settings-row-control,
          .settings-row-control button,
          .settings-row-control select { width: 100%; }
          .settings-header-actions button { width: 100%; }
        }
      `}</style>
      {loading ? (
        <div className='grid gap-4'>
          <PortalSkeleton height={180} />
          <PortalSkeleton height={220} />
          <PortalSkeleton height={180} />
        </div>
      ) : (
        <div className='settings-stack'>
          {saveMessage ? <PortalBadge tone='success'>{saveMessage}</PortalBadge> : null}

          <PortalCard className='settings-card'>
            <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Account Information</p>
                <h2 className='settings-card-title' style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Profile and contact identity</h2>
              </div>
              <PortalButton tone='secondary' onClick={() => { if (!showProfileEdit) openProfileEdit(); else setShowProfileEdit(false) }}>
                {showProfileEdit ? 'Cancel' : 'Edit'}
              </PortalButton>
            </div>
            <div className='settings-profile-grid'>
              <div className='settings-profile-avatar flex items-center justify-center md:justify-start'>
                <div style={{ width: '88px', height: '88px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(32,181,223,0.18), rgba(52,140,234,0.22))', border: '1px solid rgba(4,53,77,0.1)', display: 'grid', placeItems: 'center', color: T.navy, fontSize: '26px', fontWeight: 800 }}>
                  {accountData.fullName.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className='settings-info-grid'>
                {showProfileEdit ? (
                  <>
                    <div className='settings-wide' style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>First Name</label>
                      <input
                        type='text'
                        value={profileEdit.first_name}
                        onChange={(e) => setProfileEdit({ ...profileEdit, first_name: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                      />
                    </div>
                    <div className='settings-wide' style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
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
                    <div className='settings-wide' style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{accountData.email}</p>
                    </div>
                    <div className='settings-wide flex gap-2'>
                      <PortalButton tone='primary' onClick={handleProfileSave}>Save Changes</PortalButton>
                      <PortalButton tone='secondary' onClick={() => setShowProfileEdit(false)}>Cancel</PortalButton>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Full Name</p>
                      <p className='settings-field-value' style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{accountData.fullName}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</p>
                      <p className='settings-field-value' style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{accountData.email}</p>
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

          <PortalCard className='settings-card'>
            <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Health Information</p>
              <h2 className='settings-card-title' style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Vital signs and medical details</h2>
              </div>
            </div>
            <div className='settings-info-grid'>
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
              <div className='settings-wide' style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Allergies</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{healthInfo.allergies || 'None'}</p>
              </div>
              <div className='settings-wide' style={{ padding: '12px 14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Medical Conditions</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{healthInfo.conditions || 'None'}</p>
              </div>
            </div>
          </PortalCard>

          <PortalCard className='settings-card'>
            <div className='mb-4'>
              <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Security</p>
              <h2 className='settings-card-title' style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Secure access controls</h2>
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
                  {item.title === 'Active Devices' ? (
                    <PortalButton tone='secondary' onClick={handleOpenActiveDevices}>Manage devices</PortalButton>
                  ) : null}
                  {item.title === 'Face ID / Biometrics' ? (
                    <PortalButton tone='secondary' onClick={handlePasskeyClick}>
                      {passkeyStatus?.enabled ? 'Manage passkeys' : 'Set up passkey'}
                    </PortalButton>
                  ) : null}
                </div>
              ))}
            </div>
          </PortalCard>

          <PortalCard className='settings-card'>
            <div className='mb-4'>
              <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Notification Preferences</p>
              <h2 className='settings-card-title' style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Care communication and reminders</h2>
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

          <div className='settings-two-up'>
            <PortalCard className='settings-card'>
              <div className='mb-4'>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Privacy</p>
                <h2 className='settings-card-title' style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Control your health data</h2>
              </div>
              <div className='grid gap-3'>
                <ToggleRow label='Data Sharing' enabled={toggles.dataSharing} onToggle={() => toggleSetting('dataSharing')} description='Allow anonymized usage insights to improve care workflows.' />
                <ToggleRow label='Physician Access' enabled={toggles.physicianAccess} onToggle={() => toggleSetting('physicianAccess')} description='Keep authorized care teams connected to your profile and records.' />
                <PreferenceActionRow label='Download My Data' buttonLabel='Open' onClick={handleDataExport} />
                <PreferenceActionRow label='Delete Account' buttonLabel='Manage' tone='danger' onClick={() => setShowDeleteAccountConfirm(true)} />
                <PreferenceActionRow label='Privacy Policy' buttonLabel='Open' onClick={() => router.push('/privacy')} />
              </div>
            </PortalCard>

            <PortalCard className='settings-card'>
              <div className='mb-4'>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Accessibility</p>
                <h2 className='settings-card-title' style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Personalize readability and comfort</h2>
              </div>
              <div className='grid gap-3'>
                <ToggleRow label='Dark Mode' enabled={toggles.darkMode} onToggle={() => toggleSetting('darkMode')} description='Save this as your preferred display mode.' />
                <ToggleRow label='High Contrast' enabled={toggles.highContrast} onToggle={() => toggleSetting('highContrast')} />
                <SelectRow label='Font Size' value={fontSize} options={['Small', 'Medium', 'Large']} onChange={updateFontSizePreference} />
                <SelectRow label='Language' value={language} options={['English', 'French', 'Arabic']} onChange={setLanguage} />
                <SelectRow label='Time Zone' value={timeZone} options={['Africa/Lagos (GMT+1)', 'UTC', 'Europe/London (GMT)']} onChange={setTimeZone} />
              </div>
            </PortalCard>
          </div>

          <div className='settings-two-up'>
            <PortalCard className='settings-card'>
              <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Emergency Contacts</p>
                  <h2 className='settings-card-title' style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>People to contact quickly</h2>
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
                      <PortalButton tone='primary' onClick={handleAddContact} disabled={contactSaving || !newContact.name || !newContact.relationship || !newContact.phone}>
                        {contactSaving ? 'Saving…' : 'Add Contact'}
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
                      {editingContactId === contact.id ? (
                        <div className='grid gap-3'>
                          <input
                            type='text'
                            value={contactEdit.name}
                            onChange={(e) => setContactEdit({ ...contactEdit, name: e.target.value })}
                            placeholder='Contact name'
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                          />
                          <input
                            type='text'
                            value={contactEdit.relationship}
                            onChange={(e) => setContactEdit({ ...contactEdit, relationship: e.target.value })}
                            placeholder='Relationship'
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                          />
                          <input
                            type='text'
                            value={contactEdit.phone}
                            onChange={(e) => setContactEdit({ ...contactEdit, phone: e.target.value })}
                            placeholder='Phone number'
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(4,53,77,0.12)', fontSize: '14px' }}
                          />
                          <div className='flex flex-wrap gap-2'>
                            <PortalButton tone='primary' onClick={handleContactEditSave} disabled={contactSaving || !contactEdit.name || !contactEdit.relationship || !contactEdit.phone}>
                              {contactSaving ? 'Saving…' : 'Save'}
                            </PortalButton>
                            <PortalButton tone='secondary' onClick={() => setEditingContactId(null)}>Cancel</PortalButton>
                          </div>
                        </div>
                      ) : (
                        <div className='flex flex-wrap items-start justify-between gap-3'>
                          <div>
                            <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{contact.name}</p>
                            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: T.slate }}>{contact.relationship} • {contact.phone}</p>
                          </div>
                          <div className='flex gap-2'>
                            <PortalButton tone='secondary' onClick={() => openContactEdit(contact)}>Edit</PortalButton>
                            <PortalButton tone='danger' onClick={() => handleDeleteContact(contact.id)}>Delete</PortalButton>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </PortalCard>

            <PortalCard className='settings-card'>
              <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Insurance Information</p>
                  <h2 className='settings-card-title' style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Coverage and card upload</h2>
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
                  <div className='settings-info-grid'>
                    <div className='settings-wide'>
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
                    <div className='settings-wide flex gap-2'>
                      <PortalButton tone='primary' onClick={handleInsuranceSave}>Save Insurance</PortalButton>
                      <PortalButton tone='secondary' onClick={() => setShowInsuranceEdit(false)}>Cancel</PortalButton>
                    </div>
                  </div>
                </div>
              )}
              
              <div className='settings-info-grid'>
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
                <input
                  ref={insuranceCardInputRef}
                  type='file'
                  accept='.pdf,.png,.jpg,.jpeg,.webp'
                  onChange={(event) => handleInsuranceCardSelected(event.target.files?.[0] || null)}
                  style={{ display: 'none' }}
                />
                <PortalButton tone='secondary' onClick={() => insuranceCardInputRef.current?.click()} disabled={uploadingInsuranceCard}>
                  {uploadingInsuranceCard ? 'Uploading…' : 'Upload Insurance Card'}
                </PortalButton>
              </div>
            </PortalCard>
          </div>
        </div>
      )}
      {showDeleteAccountConfirm ? (
        <ConfirmDialog
          title='Deactivate account'
          body='This will sign you out and deactivate your account. Clinical records are preserved for compliance and care continuity.'
          confirmLabel='Deactivate'
          onCancel={() => setShowDeleteAccountConfirm(false)}
          onConfirm={handleDeactivateAccount}
        />
      ) : null}
      {showLoginHistory ? (
        <LoginHistoryDialog
          items={loginHistory}
          loading={loginHistoryLoading}
          onClose={() => setShowLoginHistory(false)}
        />
      ) : null}
      {showActiveDevices ? (
        <ActiveDevicesDialog
          items={activeDevices}
          loading={activeDevicesLoading}
          onClose={() => setShowActiveDevices(false)}
          onRevoke={handleRevokeDevice}
          onRevokeOthers={handleRevokeOtherDevices}
        />
      ) : null}
      {showPasskeys ? (
        <PasskeysDialog
          items={passkeys}
          loading={passkeysLoading}
          registering={registeringPasskey}
          onClose={() => setShowPasskeys(false)}
          onRegister={handleRegisterPasskey}
          onDelete={handleDeletePasskey}
        />
      ) : null}
    </PatientPortalShell>
  )
}

function PreferenceActionRow({ label, buttonLabel, tone = 'secondary', onClick }: { label: string; buttonLabel: string; tone?: 'secondary' | 'danger'; onClick: () => void }) {
  return (
    <div className='settings-row'>
      <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{label}</span>
      <div className='settings-row-control'>
        <PortalButton tone={tone} onClick={onClick}>{buttonLabel}</PortalButton>
      </div>
    </div>
  )
}

function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div
      role='presentation'
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        background: 'rgba(4, 53, 77, 0.34)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='confirm-dialog-title'
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(100%, 420px)',
          borderRadius: '18px',
          border: '1px solid rgba(255,255,255,0.9)',
          background: '#fff',
          boxShadow: '0 24px 70px rgba(4,53,77,0.24)',
          padding: '20px',
        }}
      >
        <h2 id='confirm-dialog-title' style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: T.navy }}>{title}</h2>
        <p style={{ margin: '0 0 18px', color: T.slate, fontSize: '13px', lineHeight: 1.6 }}>{body}</p>
        <div className='flex flex-wrap justify-end gap-2'>
          <PortalButton tone='secondary' onClick={onCancel}>Cancel</PortalButton>
          <PortalButton tone='danger' onClick={onConfirm}>{confirmLabel}</PortalButton>
        </div>
      </div>
    </div>
  )
}

function LoginHistoryDialog({ items, loading, onClose }: { items: PatientLoginHistoryItem[]; loading: boolean; onClose: () => void }) {
  return (
    <div
      role='presentation'
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        background: 'rgba(4, 53, 77, 0.34)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='login-history-title'
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(100%, 560px)',
          maxHeight: 'min(680px, calc(100vh - 40px))',
          overflow: 'auto',
          borderRadius: '18px',
          border: '1px solid rgba(255,255,255,0.9)',
          background: '#fff',
          boxShadow: '0 24px 70px rgba(4,53,77,0.24)',
          padding: '20px',
        }}
      >
        <div className='mb-4 flex items-start justify-between gap-3'>
          <div>
            <h2 id='login-history-title' style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800, color: T.navy }}>Login history</h2>
            <p style={{ margin: 0, color: T.slate, fontSize: '13px', lineHeight: 1.5 }}>Recent security events from your account audit log.</p>
          </div>
          <button
            type='button'
            aria-label='Close login history'
            onClick={onClose}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              border: '1px solid rgba(4,53,77,0.1)',
              background: 'rgba(247,250,252,0.92)',
              color: T.navy,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              flex: '0 0 auto',
            }}
          >
            <Ico p={ICONS.x} size={18} sw={1.8} />
          </button>
        </div>

        {loading ? (
          <PortalSkeleton height={120} />
        ) : items.length === 0 ? (
          <div style={{ borderRadius: '16px', border: '1px dashed rgba(4,53,77,0.14)', background: 'rgba(247,250,252,0.9)', padding: '18px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 800, color: T.navy }}>No login history yet</p>
            <p style={{ margin: 0, color: T.slate, fontSize: '13px', lineHeight: 1.5 }}>Your future sign-in audit events will appear here.</p>
          </div>
        ) : (
          <div className='grid gap-2'>
            {items.map((item) => (
              <div key={item.id} style={{ borderRadius: '14px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.9)', padding: '12px' }}>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: T.navy }}>{formatAuditEvent(item.event_type)}</p>
                  <PortalBadge tone={item.success ? 'success' : 'danger'}>{item.success ? 'Successful' : 'Failed'}</PortalBadge>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: T.slate }}>
                  {new Date(item.created_at).toLocaleString()} {item.ip_address ? `• ${item.ip_address}` : ''}
                </p>
                {item.failure_reason ? <p style={{ margin: '6px 0 0', fontSize: '12px', color: T.red }}>{item.failure_reason}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ActiveDevicesDialog({
  items,
  loading,
  onClose,
  onRevoke,
  onRevokeOthers,
}: {
  items: PatientActiveDevice[]
  loading: boolean
  onClose: () => void
  onRevoke: (deviceId: string, isCurrent: boolean) => void
  onRevokeOthers: () => void
}) {
  return (
    <div
      role='presentation'
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        background: 'rgba(4, 53, 77, 0.34)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='active-devices-title'
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(100%, 620px)',
          maxHeight: 'min(720px, calc(100vh - 40px))',
          overflow: 'auto',
          borderRadius: '18px',
          border: '1px solid rgba(255,255,255,0.9)',
          background: '#fff',
          boxShadow: '0 24px 70px rgba(4,53,77,0.24)',
          padding: '20px',
        }}
      >
        <div className='mb-4 flex items-start justify-between gap-3'>
          <div>
            <h2 id='active-devices-title' style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800, color: T.navy }}>Active devices</h2>
            <p style={{ margin: 0, color: T.slate, fontSize: '13px', lineHeight: 1.5 }}>These are browser sessions that can currently refresh access to your account.</p>
          </div>
          <button
            type='button'
            aria-label='Close active devices'
            onClick={onClose}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              border: '1px solid rgba(4,53,77,0.1)',
              background: 'rgba(247,250,252,0.92)',
              color: T.navy,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              flex: '0 0 auto',
            }}
          >
            <Ico p={ICONS.x} size={18} sw={1.8} />
          </button>
        </div>

        {loading ? (
          <PortalSkeleton height={150} />
        ) : items.length === 0 ? (
          <div style={{ borderRadius: '16px', border: '1px dashed rgba(4,53,77,0.14)', background: 'rgba(247,250,252,0.9)', padding: '18px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 800, color: T.navy }}>No active devices found</p>
            <p style={{ margin: 0, color: T.slate, fontSize: '13px', lineHeight: 1.5 }}>Your current browser may need to sign in again.</p>
          </div>
        ) : (
          <div className='grid gap-3'>
            <div className='flex flex-wrap justify-end gap-2'>
              <PortalButton tone='secondary' onClick={onRevokeOthers} disabled={items.filter((item) => !item.is_current).length === 0}>
                Sign out other devices
              </PortalButton>
            </div>
            {items.map((item) => (
              <div key={item.id} style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.08)', background: item.is_current ? 'rgba(32,181,223,0.06)' : 'rgba(247,250,252,0.9)', padding: '14px' }}>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div>
                    <div className='flex flex-wrap items-center gap-2'>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: T.navy }}>{item.device_name}</p>
                      {item.is_current ? <PortalBadge tone='success'>Current</PortalBadge> : null}
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: T.slate }}>
                      {[item.browser_name, item.operating_system, item.ip_address].filter(Boolean).join(' • ') || 'Device details unavailable'}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: T.slate2 }}>
                      Last active {item.last_seen_at ? new Date(item.last_seen_at).toLocaleString() : 'recently'}
                    </p>
                  </div>
                  <PortalButton tone={item.is_current ? 'danger' : 'secondary'} onClick={() => onRevoke(item.id, item.is_current)}>
                    {item.is_current ? 'Sign out now' : 'Sign out'}
                  </PortalButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PasskeysDialog({
  items,
  loading,
  registering,
  onClose,
  onRegister,
  onDelete,
}: {
  items: PatientPasskeyCredential[]
  loading: boolean
  registering: boolean
  onClose: () => void
  onRegister: () => void
  onDelete: (credentialId: string) => void
}) {
  return (
    <div
      role='presentation'
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
        background: 'rgba(4, 53, 77, 0.34)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='passkeys-title'
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(100%, 600px)',
          maxHeight: 'min(720px, calc(100vh - 40px))',
          overflow: 'auto',
          borderRadius: '18px',
          border: '1px solid rgba(255,255,255,0.9)',
          background: '#fff',
          boxShadow: '0 24px 70px rgba(4,53,77,0.24)',
          padding: '20px',
        }}
      >
        <div className='mb-4 flex items-start justify-between gap-3'>
          <div>
            <h2 id='passkeys-title' style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800, color: T.navy }}>Passkeys</h2>
            <p style={{ margin: 0, color: T.slate, fontSize: '13px', lineHeight: 1.5 }}>Use your device security, such as Face ID, Touch ID, or a screen lock, to sign in without a password.</p>
          </div>
          <button
            type='button'
            aria-label='Close passkeys'
            onClick={onClose}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              border: '1px solid rgba(4,53,77,0.1)',
              background: 'rgba(247,250,252,0.92)',
              color: T.navy,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              flex: '0 0 auto',
            }}
          >
            <Ico p={ICONS.x} size={18} sw={1.8} />
          </button>
        </div>

        <div className='mb-4 flex flex-wrap justify-end gap-2'>
          <PortalButton tone='primary' onClick={onRegister} disabled={registering}>
            {registering ? 'Adding…' : 'Add passkey'}
          </PortalButton>
        </div>

        {loading ? (
          <PortalSkeleton height={130} />
        ) : items.length === 0 ? (
          <div style={{ borderRadius: '16px', border: '1px dashed rgba(4,53,77,0.14)', background: 'rgba(247,250,252,0.9)', padding: '18px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 800, color: T.navy }}>No passkeys added</p>
            <p style={{ margin: 0, color: T.slate, fontSize: '13px', lineHeight: 1.5 }}>Add this device as a passkey to enable faster sign-in.</p>
          </div>
        ) : (
          <div className='grid gap-3'>
            {items.map((item) => (
              <div key={item.id} style={{ borderRadius: '16px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.9)', padding: '14px' }}>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: T.navy }}>{item.device_name || 'Passkey'}</p>
                    <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: T.slate }}>
                      Added {item.created_at ? new Date(item.created_at).toLocaleString() : 'recently'}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: T.slate2 }}>
                      Last used {item.last_used_at ? new Date(item.last_used_at).toLocaleString() : 'not yet'}
                    </p>
                  </div>
                  <PortalButton tone='danger' onClick={() => onDelete(item.id)}>
                    Remove
                  </PortalButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatAuditEvent(eventType: string) {
  return eventType.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function ToggleRow({ label, enabled, onToggle, description }: { label: string; enabled: boolean; onToggle: () => void; description?: string }) {
  return (
    <button
      type='button'
      onClick={onToggle}
      aria-pressed={enabled}
      className='settings-row text-left transition hover:-translate-y-px focus:outline-none focus:ring-2'
      style={{
        borderColor: enabled ? 'rgba(32,181,223,0.2)' : 'rgba(4,53,77,0.08)',
        background: enabled ? 'rgba(32,181,223,0.06)' : 'rgba(247,250,252,0.9)',
        boxShadow: enabled ? '0 8px 20px rgba(32,181,223,0.08)' : 'none',
        width: '100%',
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{label}</p>
        {description ? <p style={{ margin: '4px 0 0', fontSize: '12px', color: T.slate, lineHeight: 1.5 }}>{description}</p> : null}
      </div>
      <span className='settings-row-control' style={{ width: '44px', height: '24px', borderRadius: '999px', background: enabled ? T.blue : 'rgba(4,53,77,0.12)', padding: '2px', display: 'inline-flex', justifyContent: enabled ? 'flex-end' : 'flex-start', transition: 'all 0.18s ease' }}>
        <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', boxShadow: '0 2px 6px rgba(4,53,77,0.16)' }} />
      </span>
    </button>
  )
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (next: string) => void }) {
  return (
    <label className='settings-row'>
      <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className='settings-row-control rounded-xl border px-3 py-2 text-sm' style={{ borderColor: 'rgba(4,53,77,0.12)', color: T.navy, background: '#fff' }}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

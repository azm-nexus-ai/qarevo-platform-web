'use client'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import AccountSecurity from '@/components/security/AccountSecurity'

import { ProfileImageEditor } from '@/components/patient/ProfileImage'
import { FieldFeedback } from '@/components/ui/ValidationFeedback'
import { useTheme } from '@/components/ui/ThemeProvider'
import { LOCALE_COOKIE } from '@/i18n/locale'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalBadge, PortalButton, PortalCard, PortalSkeleton } from '@/components/patient/PatientPortalPrimitives'
import Ico from '@/components/ui/Ico'
import { ICONS } from '@/constants/icons'
import { T } from '@/lib/tokens'
import { useInsurancePresentation } from '@/lib/use-insurance-presentation'
import { medicalUploadError } from '@/lib/clinical-upload'
import { clearPortalSession, createEmergencyContact, createInsurance, deactivatePatientAccount, deleteEmergencyContact, deletePatientPasskey, downloadPatientDataExport, getApiErrorDetail, getPatientActiveDevices, getPatientHealthInfo, getPatientLoginHistory, getPatientPasskeyStatus, getPatientPasskeys, getPatientSettings, isAuthError, readSessionMarker, registerPatientPasskey, revokeOtherPatientActiveDevices, revokePatientActiveDevice, updateEmergencyContact, updateInsurance, updatePatientSettings, updateProfile, uploadMedicalRecord, type PatientActiveDevice, type PatientLoginHistoryItem, type PatientPasskeyCredential, type PatientPasskeyStatus, type EmergencyContact, type Insurance, type EmergencyContactCreate } from '@/lib/api'

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

/** Security rows; `id` drives behaviour and names the secItem* messages. */
const SECURITY_ITEMS = [
  { id: 'EmailVerification', badge: 'badgeRequired', tone: 'success' as const },
  { id: 'ActiveDevices', badge: 'badgeAvailable', tone: 'info' as const },
  { id: 'LoginHistory', badge: 'badgeAvailable', tone: 'info' as const },
  { id: 'Passkeys', badge: 'badgeAvailable', tone: 'info' as const },
]

export default function PatientSettingsPage() {
  const t = useTranslations('patientSettings'), german = useLocale().startsWith('de'), presentInsurance = useInsurancePresentation()
  const longDate = (value: string) => localDate(value, german)
  const genderLabel = (value: string) => ({ Male: t('male'), Female: t('female'), Other: t('other') } as Record<string, string>)[value] ?? value
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({})
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  // Same-portal return path only (e.g. back to costs or the doctor search).
  const [returnTo, setReturnTo] = useState('')
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('return') ?? ''
    if (!/^\/patient\/[A-Za-z0-9/_-]*(\?[A-Za-z0-9=&_%-]*)?$/.test(value)) return
    const timer = window.setTimeout(() => setReturnTo(value), 0)
    return () => window.clearTimeout(timer)
  }, [])
  const insuranceCardInputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
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
  // One language setting: the field shows the portal language (the header switch) and saving
  // a different choice switches the portal, so the two can never disagree.
  const portalLanguage = german ? 'German' : 'English'
  const [languageChoice, setLanguage] = useState<string | null>(null)
  const language = languageChoice ?? portalLanguage
  const [timeZone, setTimeZone] = useState('Europe/Berlin')
  const [savedDisplayPrefs, setSavedDisplayPrefs] = useState({
    fontSize: 'Medium',
    language: 'English',
    timeZone: 'Europe/Berlin',
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
  const [insuranceCardError, setInsuranceCardError] = useState<string | null>(null)
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'active' | 'signed-out'>('checking')
  const [insuranceEdit, setInsuranceEdit] = useState({
    insurance_provider_name: '',
    insurance_number: '',
    insured_status: '',
    insurance_type: 'SELF_PAY',
    validity_start: '',
    validity_end: '',
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')

    const hasAccessToken = Boolean(readSessionMarker())
    const sessionTimer = window.setTimeout(() => {
      setSessionStatus(hasAccessToken ? 'active' : 'signed-out')
    }, 0)

    if (!hasAccessToken) {
      router.replace('/auth/sign-in')
      return () => {
        cancelled = true
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

        if (cancelled) return
        const fullName = [settingsData.first_name, settingsData.last_name].filter(Boolean).join(' ')

        setAccountData({
          fullName,
          email: settingsData.email || '',
          phone: settingsData.phone || '',
          dateOfBirth: settingsData.date_of_birth || '',
          gender: settingsData.gender || '',
        })

        setContacts(settingsData.emergency_contacts || [])
        setInsurance(settingsData.insurance || null)
        getPatientPasskeyStatus()
          .then(value => { if (!cancelled) setPasskeyStatus(value) })
          .catch(() => { if (!cancelled) setPasskeyStatus(null) })
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
          timeZone: settingsData.time_zone || 'Europe/Berlin',
        }
        setFontSize(loadedDisplayPrefs.fontSize)
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
          clearPortalSession()
          router.replace('/auth/sign-in')
          return
        }
        if (!cancelled) setLoadError(t('loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()

    return () => {
      cancelled = true
      window.clearTimeout(sessionTimer)
    }
  }, [router, loadAttempt, t])

  const settingsAppearance = useMemo(() => ({
    darkMode: theme === 'dark',
    highContrast: toggles.highContrast,
    fontSize,
  }), [fontSize, theme, toggles.highContrast])

  const broadcastAppearance = useCallback((appearance: typeof settingsAppearance) => {
    window.dispatchEvent(new CustomEvent('qarevo:patient-appearance-changed', { detail: appearance }))
  }, [])

  // Links such as "Review insurance details" open this section directly, with its
  // heading in view and focused, instead of the top of a long settings page.
  useEffect(() => {
    if (loading || loadError || window.location.hash !== '#insurance') return
    const heading = document.getElementById('insurance-heading')
    document.getElementById('insurance')?.scrollIntoView({ block: 'start' })
    heading?.focus({ preventScroll: true })
  }, [loading, loadError])

  useEffect(() => {
    if (loading || loadError) return
    const timer = window.setTimeout(() => {
      broadcastAppearance(settingsAppearance)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [broadcastAppearance, loading, loadError, settingsAppearance])

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
      clearPortalSession()
      router.replace('/auth/sign-in')
      return
    }
    setSaveMessage(getApiErrorDetail(error) || fallback)
  }

  async function handleDeleteContact(contactId: string) {
    try {
      await deleteEmergencyContact(contactId)
      setContacts(contacts.filter(c => c.id !== contactId))
      setSaveMessage(t('contactDeleted'))
    } catch (error) {
      showError(error, t('contactDeleteFailed'))
    }
  }

  function validateContact(value: { name: string; relationship: string; phone: string }) {
    const errors: Record<string, string> = {}
    for (const key of ['name', 'relationship'] as const) {
      if (value[key].trim().length < 2 || value[key].trim().length > 100 || !/\p{L}/u.test(value[key]) || /[<>]/.test(value[key])) errors[key] = t(key === 'name' ? 'contactNameError' : 'contactRelationshipError')
    }
    if (!/^\+[1-9][0-9]{6,14}$/.test(value.phone.replace(/[\s().-]/g, ''))) errors.phone = t('contactPhoneError')
    setContactErrors(errors)
    return !Object.keys(errors).length
  }

  async function handleAddContact() {
    if (!validateContact(newContact)) return
    setContactSaving(true)
    try {
      const created = await createEmergencyContact(newContact)
      setContacts([...contacts, created])
      setNewContact({ name: '', relationship: '', phone: '' })
      setShowAddContactForm(false)
      setSaveMessage(t('contactAdded'))
    } catch (error) {
      showError(error, t('contactAddFailed'))
    } finally {
      setContactSaving(false)
    }
  }

  function openContactEdit(contact: EmergencyContact) {
    setContactErrors({})
    setEditingContactId(contact.id)
    setContactEdit({
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone,
    })
  }

  async function handleContactEditSave() {
    if (!editingContactId || !validateContact(contactEdit)) return
    setContactSaving(true)
    try {
      const updated = await updateEmergencyContact(editingContactId, contactEdit)
      setContacts((current) => current.map((contact) => contact.id === updated.id ? updated : contact))
      setEditingContactId(null)
      setSaveMessage(t('contactUpdated'))
    } catch (error) {
      showError(error, t('contactUpdateFailed'))
    } finally {
      setContactSaving(false)
    }
  }

  async function handleProfileSave() {
    try {
      const updated = await updateProfile(profileEdit)
      const fullName = [updated.first_name, updated.last_name].filter(Boolean).join(' ')

      setAccountData({
        fullName,
        email: updated.email || '',
        phone: updated.phone || '',
        dateOfBirth: updated.date_of_birth || '',
        gender: updated.gender || '',
      })
      setShowProfileEdit(false)
      setSaveMessage(t('profileUpdated'))
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      showError(error, t('profileUpdateFailed'))
    }
  }

  function openProfileEdit() {
    setProfileEdit({
      first_name: accountData.fullName.split(' ')[0] || '',
      last_name: accountData.fullName.split(' ').slice(1).join(' ') || '',
      date_of_birth: accountData.dateOfBirth.slice(0, 10),
      gender: accountData.gender,
      phone: accountData.phone,
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
      setSaveMessage(t('insuranceSaved'))
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      showError(error, t('insuranceSaveFailed'))
    }
  }

  function openInsuranceEdit() {
    if (insurance) {
      setInsuranceEdit({
        insurance_provider_name: insurance.insurance_provider_name || '',
        insurance_number: insurance.insurance_number || '',
        insured_status: insurance.insured_status || '',
        insurance_type: insurance.insurance_type || 'SELF_PAY',
        validity_start: insurance.validity_start ? insurance.validity_start.split('T')[0] : '',
        validity_end: insurance.validity_end ? insurance.validity_end.split('T')[0] : '',
      })
    }
    setShowInsuranceEdit(true)
  }

  async function handleSave() {
    if (loading || loadError) return
    setSaving(true)
    setSaveMessage('')

    try {
      // Saving preferences must not overwrite medical history loaded earlier.
      const updatedSettings = await updatePatientSettings({
          email_notifications: toggles.emailNotifications,
          sms_notifications: toggles.smsNotifications,
          push_notifications: toggles.pushNotifications,
          appointment_reminders: toggles.appointmentReminders,
          medication_reminders: toggles.medicationReminders,
          lab_result_alerts: toggles.labResultAlerts,
          marketing_emails: toggles.marketingEmails,
          dark_mode: theme === 'dark',
          high_contrast: toggles.highContrast,
          font_size: fontSize,
          language,
          time_zone: timeZone,
        })

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
      setSaveMessage(t('settingsSaved'))
      setLanguage(null)
      if (language !== portalLanguage) {
        document.cookie = `${LOCALE_COOKIE}=${language === 'German' ? 'de' : 'en'}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
        router.refresh()
      }
    } catch (error) {
      if (isAuthError(error)) {
        setSaving(false)
        clearPortalSession()
        router.replace('/auth/sign-in')
        return
      }
      setSaving(false)
      showError(error, t('saveFailed'))
    }
  }

  function handleCancel() {
    setToggles(savedToggles)
    setFontSize(savedDisplayPrefs.fontSize)
    setLanguage(null)
    setTimeZone(savedDisplayPrefs.timeZone)
    setSaveMessage(t('changesReverted'))
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
      setSaveMessage(t('exportReady'))
    } catch (error) {
      showError(error, t('exportFailed'))
    }
  }

  async function handleOpenLoginHistory() {
    setShowLoginHistory(true)
    setLoginHistoryLoading(true)
    try {
      const history = await getPatientLoginHistory()
      setLoginHistory(history.items || [])
    } catch (error) {
      showError(error, t('historyFailed'))
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
      showError(error, t('devicesFailed'))
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
        clearPortalSession()
        router.replace('/auth/sign-in')
        return
      }
      setSaveMessage(t('deviceSignedOut'))
      await loadActiveDevices()
    } catch (error) {
      showError(error, t('deviceSignOutFailed'))
    }
  }

  async function handleRevokeOtherDevices() {
    try {
      const result = await revokeOtherPatientActiveDevices()
      setSaveMessage(result.message)
      await loadActiveDevices()
    } catch (error) {
      showError(error, t('othersSignOutFailed'))
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
      showError(error, t('passkeysFailed'))
    } finally {
      setPasskeysLoading(false)
    }
  }

  async function handlePasskeyClick() {
    const browserSupportsPasskeys = typeof window !== 'undefined' && !!window.PublicKeyCredential
    if (!browserSupportsPasskeys) {
      setSaveMessage(t('passkeysUnsupported'))
      return
    }
    setShowPasskeys(true)
    await loadPasskeys()
  }

  async function handleRegisterPasskey() {
    setRegisteringPasskey(true)
    try {
      const platform = typeof navigator !== 'undefined' ? navigator.platform : ''
      const credential = await registerPatientPasskey(platform ? t('platformPasskey', { platform }) : t('devicePasskey'))
      setPasskeys((items) => [credential, ...items.filter((item) => item.id !== credential.id)])
      const status = await getPatientPasskeyStatus()
      setPasskeyStatus(status)
      setSaveMessage(t('passkeyAdded'))
    } catch (error) {
      showError(error, t('passkeyAddFailed'))
    } finally {
      setRegisteringPasskey(false)
    }
  }

  async function handleDeletePasskey(credentialId: string) {
    try {
      await deletePatientPasskey(credentialId)
      setSaveMessage(t('passkeyRemoved'))
      await loadPasskeys()
    } catch (error) {
      showError(error, t('passkeyRemoveFailed'))
    }
  }

  async function handleDeactivateAccount() {
    try {
      await deactivatePatientAccount()
      clearPortalSession()
      router.replace('/auth/sign-in')
    } catch (error) {
      showError(error, t('deactivateFailed'))
    }
  }

  async function handleInsuranceCardSelected(file: File | null) {
    if (!file) return
    const validationError = medicalUploadError(file.size)
    setInsuranceCardError(validationError)
    if (validationError) {
      if (insuranceCardInputRef.current) insuranceCardInputRef.current.value = ''
      return
    }
    setUploadingInsuranceCard(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('record_type', 'Insurance')
      formData.append('title', t('cardTitle'))
      formData.append('description', t('cardDescription'))
      formData.append('provider_name', insurance?.insurance_provider_name || t('cardProvider'))
      formData.append('record_date', new Date().toISOString())
      await uploadMedicalRecord(formData)
      setSaveMessage(t('cardUploaded'))
    } catch (error) {
      showError(error, t('cardUploadFailed'))
    } finally {
      setUploadingInsuranceCard(false)
      if (insuranceCardInputRef.current) insuranceCardInputRef.current.value = ''
    }
  }

  const headerActions = (
    <>
      <PortalButton tone='secondary' onClick={handleCancel}>{t('cancel')}</PortalButton>
      <PortalButton tone='primary' onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('saveChanges')}</PortalButton>
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
  const insuranceInfo = presentInsurance(insurance)

  const rightRail = (
    <div className='grid gap-3'>
      <PortalCard>
        <p style={{ margin: '0 0 6px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('profileHealth')}</p>
        <h2 className='portal-h2'>{t('yourPreferencesAreCurrent')}</h2>
        <div className='grid gap-2'>
          {[
            [t('summarySecurity'), sessionStatus === 'checking' ? t('summaryChecking') : sessionStatus === 'active' ? t('summaryActive') : t('summarySignedOut')],
            [t('summaryNotifications'), t('enabledCount', { count: enabledNotificationCount, total: 7 })],
            [t('summaryInsurance'), loading ? t('loading') : loadError ? t('summaryUnavailable') : insuranceInfo.hasDetails ? t('summaryRecorded') : t('summaryNotAdded')],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: "var(--surface-hover)", border: "1px solid var(--border)" }}>
              <span style={{ fontSize: "13px", color: T.slate2 }}>{label}</span>
              <span style={{ fontSize: "13px", color: T.navy, fontWeight: 700 }}>{value}</span>
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
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{t('trustedAccess')}</p>
            <p style={{ margin: '2px 0 0', fontSize: "13px", color: T.slate }}>{t('reviewSignInsAndPrivacy')}</p>
          </div>
        </div>
        <PortalButton tone='secondary' fullWidth onClick={handleOpenLoginHistory}>{t('reviewLoginHistory')}</PortalButton>
      </PortalCard>
    </div>
  )

  return (
    <PatientPortalShell
      title={t('settings')}
      description={t('manageAccountDetailsPrivacyNotifications')}
      headerActions={!loading && !loadError ? headerActions : undefined}
      rightRail={!loading && !loadError ? rightRail : undefined}
      appearance={settingsAppearance}
    >
      <style>{`
        .settings-stack { display: grid; gap: var(--space-6); }
        .settings-card { --portal-card-padding: clamp(20px, 3vw, 28px); position: relative; min-width: 0; }
        .settings-two-up { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .settings-info-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .settings-profile-grid { display: grid; gap: 16px; grid-template-columns: minmax(180px, 260px) minmax(0, 1fr); }
        .settings-wide { grid-column: 1 / -1; }
        .settings-field-value { overflow-wrap: anywhere; word-break: break-word; }
        .settings-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-radius: 16px; border: 1px solid var(--border); background: var(--surface-subtle); padding: 12px; }
        .settings-row-control { flex: 0 0 auto; }
        @media (max-width: 900px) {
          .settings-two-up { grid-template-columns: 1fr; }
          .settings-profile-grid { grid-template-columns: 1fr; }
          .settings-profile-avatar { justify-content: flex-start !important; }
        }
        @media (max-width: 640px) {
          .settings-stack { gap: var(--space-4); }
          .settings-info-grid { grid-template-columns: 1fr; }

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
      ) : loadError ? (
        <PortalCard><h2>{t('weCouldnTLoadYour')}</h2><p role='alert'>{loadError}</p><PortalButton onClick={() => setLoadAttempt(value => value + 1)}>{t('tryAgain')}</PortalButton></PortalCard>
      ) : (
        <div className='settings-stack'>
          {saveMessage ? <PortalBadge tone='success'>{saveMessage}</PortalBadge> : null}

          <PortalCard className='settings-card'>
            <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('accountInformation')}</p>
                <h2 className='portal-h2 settings-card-title'>{t('profileAndContactIdentity')}</h2>
              </div>
              <PortalButton tone='secondary' onClick={() => { if (!showProfileEdit) openProfileEdit(); else setShowProfileEdit(false) }}>
                {showProfileEdit ? t('cancel') : t('edit')}
              </PortalButton>
            </div>
            <div className='settings-profile-grid'>
              <div className='settings-profile-avatar'><ProfileImageEditor name={accountData.fullName}/></div>
              <div className='settings-info-grid'>
                {showProfileEdit ? (
                  <>
                    <div className='settings-wide' style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('firstName')}</label>
                      <input
                        type='text'
                        value={profileEdit.first_name}
                        onChange={(e) => setProfileEdit({ ...profileEdit, first_name: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: "1px solid var(--border)", fontSize: '14px' }}
                      />
                    </div>
                    <div className='settings-wide' style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('lastName')}</label>
                      <input
                        type='text'
                        value={profileEdit.last_name}
                        onChange={(e) => setProfileEdit({ ...profileEdit, last_name: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: "1px solid var(--border)", fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('phoneNumber')}</label>
                      <input
                        type='text'
                        value={profileEdit.phone}
                        onChange={(e) => setProfileEdit({ ...profileEdit, phone: e.target.value })}
                        placeholder='+49 151 23456789'
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: "1px solid var(--border)", fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('dateOfBirth')}</label>
                      <input
                        type='date'
                        value={profileEdit.date_of_birth}
                        onChange={(e) => setProfileEdit({ ...profileEdit, date_of_birth: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: "1px solid var(--border)", fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('gender')}</label>
                      <select
                        value={profileEdit.gender}
                        onChange={(e) => setProfileEdit({ ...profileEdit, gender: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: "1px solid var(--border)", fontSize: '14px' }}
                      >
                        <option value=''>{t('select')}</option>
                        <option value='MALE'>{t('male')}</option>
                        <option value='FEMALE'>{t('female')}</option>
                        <option value='OTHER'>{t('other')}</option>
                      </select>
                    </div>
                    <div className='settings-wide' style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('email')}</label>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{accountData.email}</p>
                    </div>
                    <div className='settings-wide flex gap-2'>
                      <PortalButton tone='primary' onClick={handleProfileSave}>{t('saveChanges')}</PortalButton>
                      <PortalButton tone='secondary' onClick={() => setShowProfileEdit(false)}>{t('cancel')}</PortalButton>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('fullName')}</p>
                      <p className='settings-field-value' style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{accountData.fullName || t('notSet')}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('email')}</p>
                      <p className='settings-field-value' style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{accountData.email}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('phoneNumber')}</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{accountData.phone || t('notSet')}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('dateOfBirth')}</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{accountData.dateOfBirth ? longDate(accountData.dateOfBirth) : t('notSet')}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('gender')}</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{accountData.gender ? genderLabel(accountData.gender) : t('notSet')}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </PortalCard>

          <PortalCard className='settings-card'>
            <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('healthInformation')}</p>
              <h2 className='portal-h2 settings-card-title'>{t('vitalSignsAndMedicalDetails')}</h2>
              </div>
            </div>
            <div className='settings-info-grid'>
              <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('bloodPressure')}</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{healthInfo.bloodPressure ? `${healthInfo.bloodPressure} mmHg` : t('notSet')}</p>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('weight')}</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{healthInfo.weight ? `${healthInfo.weight} kg` : t('notSet')}</p>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('height')}</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{healthInfo.height ? `${healthInfo.height} cm` : t('notSet')}</p>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('bloodType')}</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{healthInfo.bloodType || t('notSet')}</p>
              </div>
              <div className='settings-wide' style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('allergies')}</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{healthInfo.allergies || t('notRecorded')}</p>
              </div>
              <div className='settings-wide' style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('medicalConditions')}</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{healthInfo.conditions || t('notRecorded')}</p>
              </div>
            </div>
          </PortalCard>

          <PortalCard className='settings-card'>
            <div className='mb-4'>
              <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('security')}</p>
              <AccountSecurity/>
            </div>
            <div className='grid gap-3'>
              {SECURITY_ITEMS.map((item) => (
                <div key={item.id} style={{ padding: '14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                  <div className='flex flex-wrap items-start justify-between gap-2 mb-2'>
                    <div>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{t(`secItem${item.id}`)}</p>
                      <p style={{ margin: '4px 0 0', fontSize: "13px", color: T.slate, lineHeight: 1.55 }}>{t(`secItem${item.id}Body`)}</p>
                    </div>
                    <PortalBadge tone={item.tone}>{t(item.badge)}</PortalBadge>
                  </div>
                  {item.id === 'ActiveDevices' ? (
                    <PortalButton tone='secondary' onClick={handleOpenActiveDevices}>{t('manageDevices')}</PortalButton>
                  ) : null}
                  {item.id === 'Passkeys' ? (
                    <PortalButton tone='secondary' onClick={handlePasskeyClick}>
                      {passkeyStatus?.enabled ? t('managePasskeys') : t('setUpPasskey')}
                    </PortalButton>
                  ) : null}
                </div>
              ))}
            </div>
          </PortalCard>

          <PortalCard className='settings-card'>
            <div className='mb-4'>
              <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('notificationPreferences')}</p>
              <h2 className='portal-h2 settings-card-title'>{t('careCommunicationAndReminders')}</h2>
            </div>
            <div className='grid gap-3'>
              {[
                ['notifEmail', 'emailNotifications'],
                ['notifSms', 'smsNotifications'],
                ['notifPush', 'pushNotifications'],
                ['notifAppointments', 'appointmentReminders'],
                ['notifMedication', 'medicationReminders'],
                ['notifLab', 'labResultAlerts'],
                ['notifMarketing', 'marketingEmails'],
              ].map(([label, key]) => (
                <ToggleRow key={key} label={t(label)} enabled={toggles[key as ToggleKey]} onToggle={() => toggleSetting(key as ToggleKey)} />
              ))}
            </div>
          </PortalCard>

          <div className='settings-two-up'>
            <PortalCard className='settings-card'>
              <div className='mb-4'>
                <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('privacy')}</p>
                <h2 className='portal-h2 settings-card-title'>{t('controlYourHealthData')}</h2>
              </div>
              <div className='grid gap-3'>
                <p style={{ color: T.slate, lineHeight: 1.6 }}>{t('privacyChoicesAndConsentWithdrawal')}</p>
                <PreferenceActionRow label={t('downloadMyData')} buttonLabel={t('open')} onClick={handleDataExport} />
                <PreferenceActionRow label={t('deleteAccount')} buttonLabel={t('manage')} tone='danger' onClick={() => setShowDeleteAccountConfirm(true)} />
                <PreferenceActionRow label={t('privacyPolicy')} buttonLabel={t('open')} onClick={() => router.push('/privacy')} />
              </div>
            </PortalCard>

            <PortalCard className='settings-card'>
              <div className='mb-4'>
                <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('accessibility')}</p>
                <h2 className='portal-h2 settings-card-title'>{t('personalizeReadabilityAndComfort')}</h2>
              </div>
              <div className='grid gap-3'>
                <ToggleRow label={t('darkMode')} enabled={theme === 'dark'} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} description={t('savedAutomaticallyInThisBrowser')} />
                <ToggleRow label={t('highContrast')} enabled={toggles.highContrast} onToggle={() => toggleSetting('highContrast')} />
                <SelectRow label={t('fontSize')} value={fontSize} options={['Small', 'Medium', 'Large']} onChange={updateFontSizePreference} optionLabel={option => t(`fontSize${option}`)} />
                <SelectRow label={t('language')} value={language} options={['German', 'English']} onChange={setLanguage} optionLabel={option => t(`language${option}`)} />
                <p className='m-0 text-xs leading-5 text-muted'>{t('languageHint')}</p>
                <SelectRow label={t('timeZone')} value={timeZone} options={['Europe/Berlin', 'UTC', 'Europe/London']} onChange={setTimeZone} />
              </div>
            </PortalCard>
          </div>

          <div className='settings-two-up'>
            <PortalCard className='settings-card'>
              <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('emergencyContacts')}</p>
                  <h2 className='portal-h2 settings-card-title'>{t('peopleToContactQuickly')}</h2>
                </div>
                <PortalButton tone='primary' onClick={() => setShowAddContactForm(!showAddContactForm)}>
                  {showAddContactForm ? t('cancel') : t('addContact')}
                </PortalButton>
              </div>

              {showAddContactForm && (
                <div style={{ borderRadius: '16px', border: "1px solid var(--border)", background: "var(--surface-subtle)", padding: '16px', marginBottom: '16px' }}>
                  <div className='grid gap-3'>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: "13px", fontWeight: 600, color: T.slate }}>{t('name')}</label>
                      <input
                        type='text'
                        id='newContact-name' aria-label={t('contactNameRequired')} required aria-invalid={!!contactErrors.name} aria-describedby={contactErrors.name ? 'newContact-name-error' : undefined}
                            value={newContact.name}
                        onChange={(e) => { setNewContact({ ...newContact, name: e.target.value }); setContactErrors(previous => ({ ...previous, name: '' })) }}
                        placeholder={t('contactName')}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                      />
                          <FieldFeedback name='newContact-name' error={contactErrors.name} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: "13px", fontWeight: 600, color: T.slate }}>{t('relationship')}</label>
                      <input
                        type='text'
                        id='newContact-relationship' aria-label={t('relationshipRequired')} required aria-invalid={!!contactErrors.relationship} aria-describedby={contactErrors.relationship ? 'newContact-relationship-error' : undefined}
                            value={newContact.relationship}
                        onChange={(e) => { setNewContact({ ...newContact, relationship: e.target.value }); setContactErrors(previous => ({ ...previous, relationship: '' })) }}
                        placeholder={t('eGSpouseParentSibling')}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                      />
                          <FieldFeedback name='newContact-relationship' error={contactErrors.relationship} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: "13px", fontWeight: 600, color: T.slate }}>{t('phoneNumber')}</label>
                      <input
                        type='text'
                        id='newContact-phone' aria-label={t('phoneNumberRequired')} required aria-invalid={!!contactErrors.phone} aria-describedby={contactErrors.phone ? 'newContact-phone-error' : undefined}
                            value={newContact.phone}
                        onChange={(e) => { setNewContact({ ...newContact, phone: e.target.value }); setContactErrors(previous => ({ ...previous, phone: '' })) }}
                        placeholder='+49 151 23456789'
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                      />
                          <FieldFeedback name='newContact-phone' error={contactErrors.phone} hint={t('phoneHint')} />
                    </div>
                    <div className='flex gap-2'>
                      <PortalButton tone='primary' onClick={handleAddContact} disabled={contactSaving}>
                        {contactSaving ? t('saving') : t('addContact')}
                      </PortalButton>
                      <PortalButton tone='secondary' onClick={() => setShowAddContactForm(false)}>
                        {t('cancel')}
                      </PortalButton>
                    </div>
                  </div>
                </div>
              )}

              <div className='grid gap-3'>
                {contacts.length === 0 ? (
                  <div style={{ borderRadius: '18px', border: "1px dashed var(--border)", background: "var(--surface-subtle)", padding: '20px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: T.navy }}>{t('noEmergencyContactsSaved')}</p>
                    <p style={{ margin: 0, fontSize: "13px", color: T.slate, lineHeight: 1.6 }}>{t('addATrustedContactFor')}</p>
                  </div>
                ) : (
                  contacts.map((contact) => (
                    <div key={contact.id} className='rounded-2xl border p-4' style={{ borderColor: "var(--border)", background: "var(--surface-subtle)" }}>
                      {editingContactId === contact.id ? (
                        <div className='grid gap-3'>
                          <input
                            type='text'
                            id='contactEdit-name' aria-label={t('contactNameRequired')} required aria-invalid={!!contactErrors.name} aria-describedby={contactErrors.name ? 'contactEdit-name-error' : undefined}
                            value={contactEdit.name}
                            onChange={(e) => { setContactEdit({ ...contactEdit, name: e.target.value }); setContactErrors(previous => ({ ...previous, name: '' })) }}
                            placeholder={t('contactName')}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                          />
                          <FieldFeedback name='contactEdit-name' error={contactErrors.name} />
                          <input
                            type='text'
                            id='contactEdit-relationship' aria-label={t('relationshipRequired')} required aria-invalid={!!contactErrors.relationship} aria-describedby={contactErrors.relationship ? 'contactEdit-relationship-error' : undefined}
                            value={contactEdit.relationship}
                            onChange={(e) => { setContactEdit({ ...contactEdit, relationship: e.target.value }); setContactErrors(previous => ({ ...previous, relationship: '' })) }}
                            placeholder={t('relationship')}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                          />
                          <FieldFeedback name='contactEdit-relationship' error={contactErrors.relationship} />
                          <input
                            type='text'
                            id='contactEdit-phone' aria-label={t('phoneNumberRequired')} required aria-invalid={!!contactErrors.phone} aria-describedby={contactErrors.phone ? 'contactEdit-phone-error' : undefined}
                            value={contactEdit.phone}
                            onChange={(e) => { setContactEdit({ ...contactEdit, phone: e.target.value }); setContactErrors(previous => ({ ...previous, phone: '' })) }}
                            placeholder={t('phoneNumber2')}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                          />
                          <FieldFeedback name='contactEdit-phone' error={contactErrors.phone} hint={t('phoneHint')} />
                          <div className='flex flex-wrap gap-2'>
                            <PortalButton tone='primary' onClick={handleContactEditSave} disabled={contactSaving}>
                              {contactSaving ? t('saving') : t('save')}
                            </PortalButton>
                            <PortalButton tone='secondary' onClick={() => setEditingContactId(null)}>{t('cancel')}</PortalButton>
                          </div>
                        </div>
                      ) : (
                        <div className='flex flex-wrap items-start justify-between gap-3'>
                          <div>
                            <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{contact.name}</p>
                            <p style={{ margin: '4px 0 0', fontSize: "13px", color: T.slate }}>{contact.relationship} • {contact.phone}</p>
                          </div>
                          <div className='flex gap-2'>
                            <PortalButton tone='secondary' onClick={() => openContactEdit(contact)}>{t('edit')}</PortalButton>
                            <PortalButton tone='danger' onClick={() => handleDeleteContact(contact.id)}>{t('delete')}</PortalButton>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </PortalCard>

            <PortalCard className='settings-card' id='insurance' style={{ scrollMarginTop: '96px' }}>
              <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: "13px", fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('insuranceInformation')}</p>
                  <h2 className='portal-h2 settings-card-title' id='insurance-heading' tabIndex={-1}>{t('coverageAndCardUpload')}</h2>
                </div>
                <div className='flex gap-2'>
                  <PortalBadge tone={insuranceInfo.tone}>{insuranceInfo.label}</PortalBadge>
                  <PortalButton tone='secondary' onClick={() => { if (!showInsuranceEdit) openInsuranceEdit(); else setShowInsuranceEdit(false) }}>
                    {showInsuranceEdit ? t('cancel') : insurance ? t('edit') : t('addInsurance')}
                  </PortalButton>
                </div>
              </div>

              <p className='mb-4 text-sm leading-6 text-muted'>{insuranceInfo.notice}</p>
              {returnTo && (
                <p className='mb-4 text-sm'>
                  <Link href={returnTo} style={{ color: 'var(--link)', fontWeight: 700 }}>{t('backToPreviousStep')}</Link>
                </p>
              )}
              {showInsuranceEdit && (
                <div style={{ borderRadius: '16px', border: "1px solid var(--border)", background: "var(--surface-subtle)", padding: '16px', marginBottom: '16px' }}>
                  <div className='settings-info-grid'>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: "13px", fontWeight: 600, color: T.slate }}>{t('insuranceType')}</label>
                      <select
                        value={insuranceEdit.insurance_type}
                        onChange={(e) => setInsuranceEdit({ ...insuranceEdit, insurance_type: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                      >
                        <option value='SELF_PAY'>{t('selfPayPrivate')}</option>
                        <option value='GKV'>{t('statutoryGkv')}</option>
                        <option value='PKV'>{t('privatePkv')}</option>
                      </select>
                    </div>
                    <div className='settings-wide'>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: "13px", fontWeight: 600, color: T.slate }}>{t('insuranceProvider')}</label>
                      <input
                        type='text'
                        value={insuranceEdit.insurance_provider_name}
                        onChange={(e) => setInsuranceEdit({ ...insuranceEdit, insurance_provider_name: e.target.value })}
                        placeholder={t('eGAxaMansardHmo')}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: "13px", fontWeight: 600, color: T.slate }}>{t('policyNumber')}</label>
                      <input
                        type='text'
                        value={insuranceEdit.insurance_number}
                        onChange={(e) => setInsuranceEdit({ ...insuranceEdit, insurance_number: e.target.value })}
                        placeholder={t('eGQh88924481')}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: "13px", fontWeight: 600, color: T.slate }}>{t('membershipCategoryPatientReported')}</label>
                      <select
                        value={insuranceEdit.insured_status}
                        onChange={(e) => setInsuranceEdit({ ...insuranceEdit, insured_status: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                      >
                        <option value=''>{t('select')}</option>
                        <option value='SELF_INSURED'>{t('selfInsured')}</option>
                        <option value='FAMILY_MEMBER'>{t('familyMember')}</option>
                        <option value='STUDENT'>{t('student')}</option>
                        <option value='PENSIONER'>{t('pensioner')}</option>
                        <option value='OTHER'>{t('other')}</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: "13px", fontWeight: 600, color: T.slate }}>{t('reportedCardValidityFrom')}</label>
                      <input
                        type='date'
                        value={insuranceEdit.validity_start}
                        onChange={(e) => setInsuranceEdit({ ...insuranceEdit, validity_start: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: "13px", fontWeight: 600, color: T.slate }}>{t('reportedCardValidityUntil')}</label>
                      <input
                        type='date'
                        value={insuranceEdit.validity_end}
                        onChange={(e) => setInsuranceEdit({ ...insuranceEdit, validity_end: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: "1px solid var(--border)", fontSize: '14px' }}
                      />
                    </div>
                    <div className='settings-wide flex gap-2'>
                      <PortalButton tone='primary' onClick={handleInsuranceSave}>{t('saveInsurance')}</PortalButton>
                      <PortalButton tone='secondary' onClick={() => setShowInsuranceEdit(false)}>{t('cancel')}</PortalButton>
                    </div>
                  </div>
                </div>
              )}

              <div className='settings-info-grid'>
                {insurance ? (
                  <>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('insuranceType')}</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{insuranceInfo.fundingLabel}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('insuranceProvider')}</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{insurance.insurance_provider_name || t('notSet')}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('policyNumber')}</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{insurance.insurance_number || t('notSet')}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('membershipCategoryPatientReported')}</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>{insuranceInfo.membershipLabel}</p>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)" }}>
                      <p style={{ margin: '0 0 4px', fontSize: "13px", color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('reportedCardValidityUntil')}</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.navy }}>
                        {insurance.validity_end
                          ? longDate(insurance.validity_end)
                          : t('notSet')}
                      </p>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '12px 14px', borderRadius: '16px', background: "var(--surface-subtle)", border: "1px solid var(--border)", gridColumn: '1 / -1' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: T.slate2 }}>{t('noInsuranceInformationOnFile')}</p>
                  </div>
                )}
              </div>
              <div className='flex gap-2 flex-wrap mt-4'>
                <input
                  ref={insuranceCardInputRef}
                  type='file'
                  aria-label={t('uploadInsuranceCard')}
                  aria-describedby='insurance-card-upload-help insurance-card-upload-error'
                  aria-invalid={Boolean(insuranceCardError)}
                  accept='.pdf,.png,.jpg,.jpeg,.webp'
                  onChange={(event) => handleInsuranceCardSelected(event.target.files?.[0] || null)}
                  style={{ display: 'none' }}
                />
                <PortalButton tone='secondary' onClick={() => insuranceCardInputRef.current?.click()} disabled={uploadingInsuranceCard}>
                  {uploadingInsuranceCard ? t('uploading') : t('uploadCard')}
                </PortalButton>
                <p id='insurance-card-upload-help' className='mt-2 text-sm text-muted'>{t('maximum3MbPerFile')}</p>
                <p id='insurance-card-upload-error' role={insuranceCardError ? 'alert' : undefined} className='mt-2 text-sm text-ink'>{insuranceCardError}</p>
              </div>
            </PortalCard>
          </div>
        </div>
      )}
      {showDeleteAccountConfirm ? (
        <ConfirmDialog
          title={t('deactivateAccount')}
          body={t('deactivateBody')}
          confirmLabel={t('deactivate')}
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
  const t = useTranslations('patientSettings')
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
        background: "var(--surface-hover)",
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
          border: "1px solid var(--border)",
          background: "var(--surface)",
          boxShadow: '0 24px 70px rgba(4,53,77,0.24)',
          padding: '20px',
        }}
      >
        <h2 id='confirm-dialog-title' className='portal-h2'>{title}</h2>
        <p style={{ margin: '0 0 18px', color: T.slate, fontSize: '13px', lineHeight: 1.6 }}>{body}</p>
        <div className='flex flex-wrap justify-end gap-2'>
          <PortalButton tone='secondary' onClick={onCancel}>{t('cancel')}</PortalButton>
          <PortalButton tone='danger' onClick={onConfirm}>{confirmLabel}</PortalButton>
        </div>
      </div>
    </div>
  )
}

function LoginHistoryDialog({ items, loading, onClose }: { items: PatientLoginHistoryItem[]; loading: boolean; onClose: () => void }) {
  const t = useTranslations('patientSettings'), german = useLocale().startsWith('de')
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
        background: "var(--surface-hover)",
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
          border: "1px solid var(--border)",
          background: "var(--surface)",
          boxShadow: '0 24px 70px rgba(4,53,77,0.24)',
          padding: '20px',
        }}
      >
        <div className='mb-4 flex items-start justify-between gap-3'>
          <div>
            <h2 id='login-history-title' className='portal-h2'>{t('loginHistory')}</h2>
            <p style={{ margin: 0, color: T.slate, fontSize: '13px', lineHeight: 1.5 }}>{t('recentSecurityEventsFromYour')}</p>
          </div>
          <button
            type='button'
            aria-label={t('closeLoginHistory')}
            onClick={onClose}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              border: "1px solid var(--border)",
              background: "var(--surface-subtle)",
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
          <div style={{ borderRadius: '16px', border: "1px dashed var(--border)", background: "var(--surface-subtle)", padding: '18px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 800, color: T.navy }}>{t('noLoginHistoryYet')}</p>
            <p style={{ margin: 0, color: T.slate, fontSize: '13px', lineHeight: 1.5 }}>{t('yourFutureSignInAudit')}</p>
          </div>
        ) : (
          <div className='grid gap-2'>
            {items.map((item) => (
              <div key={item.id} style={{ borderRadius: '14px', border: "1px solid var(--border)", background: "var(--surface-subtle)", padding: '12px' }}>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: T.navy }}>{({ LOGIN_SUCCESS: t('eventLoginSuccess'), LOGIN_FAILURE: t('eventLoginFailure'), LOGOUT: t('eventLogout'), TOKEN_REFRESHED: t('eventTokenRefreshed') } as Record<string, string>)[item.event_type] ?? formatAuditEvent(item.event_type)}</p>
                  <PortalBadge tone={item.success ? 'success' : 'danger'}>{item.success ? t('successful') : t('failed')}</PortalBadge>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: "13px", color: T.slate }}>
                  {localDateTime(item.created_at, german)} {item.ip_address ? `• ${item.ip_address}` : ''}
                </p>
                {item.failure_reason ? <p style={{ margin: '6px 0 0', fontSize: "13px", color: T.red }}>{item.failure_reason}</p> : null}
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
  const t = useTranslations('patientSettings'), german = useLocale().startsWith('de')
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
        background: "var(--surface-hover)",
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
          border: "1px solid var(--border)",
          background: "var(--surface)",
          boxShadow: '0 24px 70px rgba(4,53,77,0.24)',
          padding: '20px',
        }}
      >
        <div className='mb-4 flex items-start justify-between gap-3'>
          <div>
            <h2 id='active-devices-title' className='portal-h2'>{t('activeDevices')}</h2>
            <p style={{ margin: 0, color: T.slate, fontSize: '13px', lineHeight: 1.5 }}>{t('theseAreBrowserSessionsThat')}</p>
          </div>
          <button
            type='button'
            aria-label={t('closeActiveDevices')}
            onClick={onClose}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              border: "1px solid var(--border)",
              background: "var(--surface-subtle)",
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
          <div style={{ borderRadius: '16px', border: "1px dashed var(--border)", background: "var(--surface-subtle)", padding: '18px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 800, color: T.navy }}>{t('noActiveDevicesFound')}</p>
            <p style={{ margin: 0, color: T.slate, fontSize: '13px', lineHeight: 1.5 }}>{t('yourCurrentBrowserMayNeed')}</p>
          </div>
        ) : (
          <div className='grid gap-3'>
            <div className='flex flex-wrap justify-end gap-2'>
              <PortalButton tone='secondary' onClick={onRevokeOthers} disabled={items.filter((item) => !item.is_current).length === 0}>
                {t('signOutOtherDevices')}
              </PortalButton>
            </div>
            {items.map((item) => (
              <div key={item.id} style={{ borderRadius: '16px', border: "1px solid var(--border)", background: item.is_current ? 'rgba(32,181,223,0.06)' : "var(--surface-subtle)", padding: '14px' }}>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div>
                    <div className='flex flex-wrap items-center gap-2'>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: T.navy }}>{item.device_name}</p>
                      {item.is_current ? <PortalBadge tone='success'>{t('current')}</PortalBadge> : null}
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: "13px", color: T.slate }}>
                      {[item.browser_name, item.operating_system, item.ip_address].filter(Boolean).join(' • ') || t('deviceUnknown')}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: "13px", color: T.slate2 }}>
                      {t('lastActive', { time: item.last_seen_at ? localDateTime(item.last_seen_at, german) : t('recently') })}
                    </p>
                  </div>
                  <PortalButton tone={item.is_current ? 'danger' : 'secondary'} onClick={() => onRevoke(item.id, item.is_current)}>
                    {item.is_current ? t('signOutNow') : t('signOut')}
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
  const t = useTranslations('patientSettings'), german = useLocale().startsWith('de')
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
        background: "var(--surface-hover)",
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
          border: "1px solid var(--border)",
          background: "var(--surface)",
          boxShadow: '0 24px 70px rgba(4,53,77,0.24)',
          padding: '20px',
        }}
      >
        <div className='mb-4 flex items-start justify-between gap-3'>
          <div>
            <h2 id='passkeys-title' className='portal-h2'>{t('passkeys')}</h2>
            <p style={{ margin: 0, color: T.slate, fontSize: '13px', lineHeight: 1.5 }}>{t('useYourDeviceSecuritySuch')}</p>
          </div>
          <button
            type='button'
            aria-label={t('closePasskeys')}
            onClick={onClose}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              border: "1px solid var(--border)",
              background: "var(--surface-subtle)",
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
            {registering ? t('adding') : t('addPasskey')}
          </PortalButton>
        </div>

        {loading ? (
          <PortalSkeleton height={130} />
        ) : items.length === 0 ? (
          <div style={{ borderRadius: '16px', border: "1px dashed var(--border)", background: "var(--surface-subtle)", padding: '18px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 800, color: T.navy }}>{t('noPasskeysAdded')}</p>
            <p style={{ margin: 0, color: T.slate, fontSize: '13px', lineHeight: 1.5 }}>{t('addThisDeviceAsA')}</p>
          </div>
        ) : (
          <div className='grid gap-3'>
            {items.map((item) => (
              <div key={item.id} style={{ borderRadius: '16px', border: "1px solid var(--border)", background: "var(--surface-subtle)", padding: '14px' }}>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: T.navy }}>{item.device_name || t('passkeyFallback')}</p>
                    <p style={{ margin: '6px 0 0', fontSize: "13px", color: T.slate }}>
                      {t('addedAt', { time: item.created_at ? localDateTime(item.created_at, german) : t('recently') })}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: "13px", color: T.slate2 }}>
                      {t('lastUsed', { time: item.last_used_at ? localDateTime(item.last_used_at, german) : t('notYet') })}
                    </p>
                  </div>
                  <PortalButton tone='danger' onClick={() => onDelete(item.id)}>
                    {t('remove')}
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

/** English keeps its existing formats; German uses de-DE. */
function localDate(value: string, german: boolean) {
  return new Date(value).toLocaleDateString(german ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
function localDateTime(value: string, german: boolean) {
  return new Date(value).toLocaleString(german ? 'de-DE' : undefined)
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
        borderColor: enabled ? 'rgba(32,181,223,0.2)' : "var(--border)",
        background: enabled ? 'rgba(32,181,223,0.06)' : "var(--surface-subtle)",
        boxShadow: enabled ? '0 8px 20px rgba(32,181,223,0.08)' : 'none',
        width: '100%',
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{label}</p>
        {description ? <p style={{ margin: '4px 0 0', fontSize: "13px", color: T.slate, lineHeight: 1.5 }}>{description}</p> : null}
      </div>
      <span className='settings-row-control' style={{ width: '44px', height: '24px', borderRadius: '999px', background: enabled ? T.blue : "var(--surface-hover)", padding: '2px', display: 'inline-flex', justifyContent: enabled ? 'flex-end' : 'flex-start', transition: 'all 0.18s ease' }}>
        <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: "var(--surface)", boxShadow: '0 2px 6px rgba(4,53,77,0.16)' }} />
      </span>
    </button>
  )
}

function SelectRow({ label, value, options, onChange, optionLabel = option => option }: { label: string; value: string; options: string[]; onChange: (next: string) => void; optionLabel?: (option: string) => string }) {
  return (
    <label className='settings-row'>
      <span style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className='settings-row-control rounded-xl border px-3 py-2 text-sm' style={{ borderColor: "var(--border)", color: T.navy, background: "var(--surface)" }}>
        {options.map((option) => (
          <option key={option} value={option}>{optionLabel(option)}</option>
        ))}
      </select>
    </label>
  )
}

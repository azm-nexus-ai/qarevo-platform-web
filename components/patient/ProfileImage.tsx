'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { apiDelete, apiGet, apiPost, getApiErrorDetail } from '@/lib/api'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import ProfileAvatar from '@/components/branding/ProfileAvatar'
import { notifyProfileChanged, subscribeProfileChanges } from '@/lib/profile-events'
import { isPortalIdentityEvent } from '@/lib/portal-scope'
import { PROFILE_IMAGE_ACCEPT, ProfileImageError, prepareProfileImage, profileImageFileProblem, type PreparedProfileImage } from '@/lib/profile-image-prepare'

const requests = new Map<string, Promise<{ image: string | null }>>()
function loadImage() {
  const scope = readAccountScope('patient')
  if (!scope) return Promise.resolve({ image: null })
  const existing = requests.get(scope)
  if (existing) return existing
  const request = apiGet<{ image: string | null }>('/api/v1/patient/profile-image').finally(() => { if (requests.get(scope) === request) requests.delete(scope) })
  requests.set(scope, request)
  return request
}

/**
 * The signed-in patient's own image, shared by every avatar in the portal.
 * After an upload or removal the current picture stays until the new one has
 * loaded (no flash of initials). Switching accounts clears it at once, so one
 * person's photo is never shown for another.
 */
function useProfileImage() {
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    const scope = readAccountScope('patient')
    void loadImage()
      .then(result => { if (active && scope === readAccountScope('patient')) { setImage(result.image); setError('') } })
      .catch(() => { if (active && scope === readAccountScope('patient')) setError('Your profile image could not be loaded.') })
    const refresh = () => { const owner = readAccountScope('patient'); if (owner) requests.delete(owner); setError(''); setAttempt(value => value + 1) }
    const switchAccount = (event?: Event) => { if (event && !isPortalIdentityEvent(event, 'patient')) return; setImage(null); refresh() }
    const unsubscribe = subscribeProfileChanges('patient', refresh)
    window.addEventListener(ACCOUNT_CHANGED, switchAccount)
    const crossTab = (event: StorageEvent) => { if (isPortalIdentityEvent(event, 'patient')) switchAccount() }
    window.addEventListener('storage', crossTab)
    return () => { active = false; unsubscribe(); window.removeEventListener(ACCOUNT_CHANGED, switchAccount); window.removeEventListener('storage', crossTab) }
  }, [attempt])
  return { image, error, retry: () => setAttempt(value => value + 1) }
}

export default function ProfileImage({ name, size = 42 }: { name: string; size?: number }) {
  const { image } = useProfileImage()
  return <ProfileAvatar name={name} src={image} size={size} kind='patient' />
}

export function ProfileImageEditor({ name }: { name: string }) {
  const { image, error: loadError, retry } = useProfileImage()
  const [prepared, setPrepared] = useState<PreparedProfileImage | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const helpId = useId()
  const preview = prepared ? `data:${prepared.contentType};base64,${prepared.base64}` : ''

  useEffect(() => {
    const reset = (event: Event) => { if (!isPortalIdentityEvent(event, 'patient')) return; setPrepared(null); setConfirmRemove(false); setError(''); setMessage(''); setBusy(false) }
    window.addEventListener(ACCOUNT_CHANGED, reset)
    return () => window.removeEventListener(ACCOUNT_CHANGED, reset)
  }, [])

  const clearInput = () => { if (input.current) input.current.value = '' }

  async function choose(file: File | undefined) {
    setError(''); setMessage(''); setConfirmRemove(false)
    if (!file) { setPrepared(null); return }
    const problem = profileImageFileProblem(file)
    if (problem) { setPrepared(null); setError(problem); clearInput(); return }
    setPreparing(true)
    try { setPrepared(await prepareProfileImage(file)) }
    catch (cause) { setPrepared(null); setError(cause instanceof ProfileImageError ? cause.message : 'This photo could not be prepared. Choose another file.'); clearInput() }
    finally { setPreparing(false) }
  }

  async function save(remove = false) {
    const owner = readAccountScope('patient')
    setError(''); setMessage(''); setBusy(true)
    try {
      if (!owner) throw new Error('Sign in again before changing your profile image.')
      if (remove) await apiDelete('/api/v1/patient/profile-image')
      else if (prepared) await apiPost('/api/v1/patient/profile-image', { content_type: prepared.contentType, content_base64: prepared.base64 })
      else return
      if (owner !== readAccountScope('patient')) return
      setPrepared(null); setConfirmRemove(false); clearInput()
      requests.delete(owner)
      notifyProfileChanged('patient')
      setMessage(remove ? 'Profile image removed.' : 'Profile image updated.')
    } catch (cause) {
      if (owner === readAccountScope('patient')) setError(getApiErrorDetail(cause) || (cause instanceof Error && cause.message) || 'Your image could not be saved. Please try again.')
    } finally { if (owner === readAccountScope('patient')) setBusy(false) }
  }

  const disabled = busy || preparing
  return <section aria-label='Profile image' className='pie'>
    <style>{`
      .pie { display: grid; gap: 12px; justify-items: start; max-width: 100%; }
      .pie-frame { position: relative; width: 96px; height: 96px; border-radius: 50%; overflow: hidden; box-shadow: 0 0 0 3px var(--surface), 0 0 0 4px var(--border); }
      .pie-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .pie-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .pie-button { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
      .pie-button.primary { background: var(--action-primary); color: var(--surface); border-color: transparent; }
      .pie-button.danger { color: var(--danger); }
      .pie-button:disabled { opacity: .6; cursor: progress; }
      .pie-file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
      .pie-file:focus-visible + .pie-button, .pie-button:focus-visible { outline: 3px solid var(--action-primary); outline-offset: 2px; }
      .pie-help { font-size: 13px; margin: 0; color: var(--text-secondary); line-height: 1.5; max-width: 280px; }
      .pie-note { font-size: 13px; margin: 0; line-height: 1.5; }
      .pie-note.error { color: var(--danger); }
      .pie-confirm { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-subtle); max-width: 300px; }
      .pie-confirm p { margin: 0; font-size: 13px; line-height: 1.5; }
    `}</style>
    {preview
      ? <div className='pie-frame'><img src={preview} width={96} height={96} alt='Selected profile image preview' /></div>
      : <ProfileAvatar name={name} src={image} size={96} kind='patient' />}
    <div className='pie-actions'>
      <input ref={input} id={`${helpId}-file`} className='pie-file' type='file' accept={PROFILE_IMAGE_ACCEPT} disabled={disabled} aria-label='Profile image'
        aria-describedby={helpId} onChange={event => { void choose(event.target.files?.[0]) }} />
      {!prepared && <label htmlFor={`${helpId}-file`} className='pie-button' aria-disabled={disabled || undefined}>{image ? 'Replace photo' : 'Upload photo'}</label>}
      {prepared && <>
        <button type='button' className='pie-button primary' disabled={disabled} onClick={() => save()}>Save image</button>
        <button type='button' className='pie-button' disabled={disabled} onClick={() => { setPrepared(null); clearInput() }}>Cancel selection</button>
      </>}
      {image && !prepared && !confirmRemove && <button type='button' className='pie-button danger' disabled={disabled} onClick={() => setConfirmRemove(true)}>Remove image</button>}
    </div>
    {confirmRemove && <div className='pie-confirm' role='group' aria-label='Confirm removal'>
      <p>Remove your photo? Your initials are shown instead until you upload a new one.</p>
      <div className='pie-actions'>
        <button type='button' className='pie-button danger' disabled={disabled} onClick={() => save(true)}>Remove photo</button>
        <button type='button' className='pie-button' disabled={disabled} onClick={() => setConfirmRemove(false)}>Keep photo</button>
      </div>
    </div>}
    <p id={helpId} className='pie-help'>JPEG, PNG, WebP or HEIC, up to 20 MB. Photos are resized on your device and their location and camera data removed before upload.</p>
    <div aria-live='polite' className='pie-note'>
      {preparing && <span role='status'>Preparing your photo…</span>}
      {busy && <span role='status'>Saving profile image…</span>}
      {message && <span role='status'>{message}</span>}
    </div>
    {error && <p role='alert' className='pie-note error'>{error}</p>}
    {loadError && <p role='alert' className='pie-note error'>{loadError} <button type='button' className='pie-button' onClick={retry}>Retry image</button></p>}
  </section>
}

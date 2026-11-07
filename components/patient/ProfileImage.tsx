'use client'
import { useEffect, useRef, useState } from 'react'
import { apiDelete, apiGet, apiPost, getApiErrorDetail } from '@/lib/api'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import ProfileAvatar from '@/components/branding/ProfileAvatar'
import { notifyProfileChanged, subscribeProfileChanges } from '@/lib/profile-events'
import { isPortalIdentityEvent } from '@/lib/portal-scope'

const requests = new Map<string, Promise<{image:string|null}>>()
function loadImage() {
  const scope = readAccountScope('patient')
  if (!scope) return Promise.resolve({image:null})
  const existing = requests.get(scope)
  if (existing) return existing
  const request = apiGet<{image:string|null}>('/api/v1/patient/profile-image').finally(()=>{if(requests.get(scope)===request)requests.delete(scope)})
  requests.set(scope,request)
  return request
}
function useProfileImage() {
  const [image,setImage] = useState<string|null>(null)
  const [error,setError] = useState('')
  const [attempt,setAttempt] = useState(0)
  useEffect(()=>{
    let active = true
    const scope = readAccountScope('patient')
    void loadImage().then(result=>{if(active && scope===readAccountScope('patient')){setImage(result.image);setError('')}}).catch(()=>{if(active && scope===readAccountScope('patient'))setError('Your profile image could not be loaded.')})
    const reset=(event?:Event)=>{if(event&&!isPortalIdentityEvent(event,'patient'))return;const owner=readAccountScope('patient');if(owner)requests.delete(owner);setImage(null);setError('');setAttempt(value=>value+1)}
    const unsubscribe=subscribeProfileChanges('patient',reset)
    window.addEventListener(ACCOUNT_CHANGED,reset)
    const crossTab=(event:StorageEvent)=>{if(isPortalIdentityEvent(event,'patient'))reset()}
    window.addEventListener('storage',crossTab)
    return()=>{active=false;unsubscribe();window.removeEventListener(ACCOUNT_CHANGED,reset);window.removeEventListener('storage',crossTab)}
  },[attempt])
  return {image,error,retry:()=>setAttempt(value=>value+1)}
}
export default function ProfileImage({name,size=42}:{name:string;size?:number}) {
  const {image}=useProfileImage()
  return <ProfileAvatar name={name} src={image} size={size} kind='patient' />
}
export function ProfileImageEditor({name}:{name:string}) {
  const {image,error:loadError,retry}=useProfileImage()
  const [preview,setPreview]=useState('')
  const [selected,setSelected]=useState<File|null>(null)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const input=useRef<HTMLInputElement>(null)
  useEffect(()=>{if(!selected){setPreview('');return}const url=URL.createObjectURL(selected);setPreview(url);return()=>URL.revokeObjectURL(url)},[selected])
  useEffect(()=>{const reset=(event:Event)=>{if(!isPortalIdentityEvent(event,'patient'))return;setSelected(null);setError('');setMessage('');setBusy(false)};window.addEventListener(ACCOUNT_CHANGED,reset);return()=>window.removeEventListener(ACCOUNT_CHANGED,reset)},[])
  async function save(remove=false) {
    const owner=readAccountScope('patient')
    setError('');setMessage('');setBusy(true)
    try {
      if(!owner)throw new Error('Sign in again before changing your profile image.')
      if(remove) await apiDelete('/api/v1/patient/profile-image')
      else if(selected) {
        const encoded=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('The file could not be read.'));reader.readAsDataURL(selected)})
        if(owner!==readAccountScope('patient'))return
        await apiPost('/api/v1/patient/profile-image',{content_type:selected.type,content_base64:encoded})
      } else return
      if(owner!==readAccountScope('patient'))return
      setSelected(null);if(input.current)input.current.value=''
      requests.delete(owner)
      notifyProfileChanged('patient');setMessage(remove?'Profile image removed.':'Profile image updated.')
    } catch(cause){if(owner===readAccountScope('patient'))setError(getApiErrorDetail(cause)||'Your image could not be saved. Please try again.')} finally{if(owner===readAccountScope('patient'))setBusy(false)}
  }
  return <section aria-label='Profile image' style={{display:'grid',gap:10,justifyItems:'start',maxWidth:'100%'}}>
    {preview?<img src={preview} width={88} height={88} alt='Selected profile image preview' style={{borderRadius:16,objectFit:'cover'}}/>:<ProfileAvatar name={name} src={image} size={88} kind='patient'/>}
    <label style={{fontSize:13,fontWeight:600}}>Profile image<input ref={input} type='file' accept='image/jpeg,image/png,image/webp' disabled={busy} onChange={event=>{setError('');setMessage('');const file=event.target.files?.[0];if(!file){setSelected(null);return}if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024){setSelected(null);setError('Choose a JPEG, PNG or WebP image, up to 2 MB.');event.target.value='';return}setSelected(file)}} style={{display:'block',width:'100%',maxWidth:260,minHeight:44,marginTop:6}} aria-describedby='profile-image-help'/></label>
    <p id='profile-image-help' style={{fontSize:13,margin:0,color:'var(--text-secondary)'}}>JPEG, PNG or WebP · up to 2 MB. Photo metadata is removed.</p>
    {selected&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type='button' disabled={busy} onClick={()=>save()} style={{minHeight:44}}>Save image</button><button type='button' disabled={busy} onClick={()=>{setSelected(null);if(input.current)input.current.value=''}} style={{minHeight:44}}>Cancel selection</button></div>}
    {image&&<button type='button' disabled={busy} onClick={()=>save(true)} style={{minHeight:44,color:'var(--danger)'}}>Remove image</button>}
    {busy&&<p role='status'>Saving profile image…</p>}{message&&<p role='status'>{message}</p>}{error&&<p role='alert'>{error}</p>}{loadError&&<p role='alert'>{loadError} <button type='button' onClick={retry}>Retry image</button></p>}
  </section>
}

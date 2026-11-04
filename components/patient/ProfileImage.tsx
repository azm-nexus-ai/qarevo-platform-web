'use client'
import { useEffect, useRef, useState } from 'react'
import { apiDelete, apiGet, apiPost, getApiErrorDetail } from '@/lib/api'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'

const changed = 'qarevo:profile-image-changed'
const requests = new Map<string, Promise<{image:string|null}>>()
function loadImage() {
  const scope = readAccountScope()
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
    const scope = readAccountScope()
    void loadImage().then(result=>{if(active && scope===readAccountScope()){setImage(result.image);setError('')}}).catch(()=>{if(active)setError('Your profile image could not be loaded.')})
    const reset=()=>{setImage(null);setError('');setAttempt(value=>value+1)}
    window.addEventListener(changed,reset);window.addEventListener(ACCOUNT_CHANGED,reset)
    const crossTab=(event:StorageEvent)=>{if(event.key==='qarevo_user_id'||event.key==='qarevo_session_revision')reset()}
    window.addEventListener('storage',crossTab)
    return()=>{active=false;window.removeEventListener(changed,reset);window.removeEventListener(ACCOUNT_CHANGED,reset);window.removeEventListener('storage',crossTab)}
  },[attempt])
  return {image,error,retry:()=>setAttempt(value=>value+1)}
}
export default function ProfileImage({name,size=42}:{name:string;size?:number}) {
  const {image}=useProfileImage()
  const [broken,setBroken]=useState<string|null>(null)
  const initials=name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'P'
  return <span role='img' aria-label={`${name || 'Patient'} profile image`} style={{display:'inline-grid',placeItems:'center',width:size,height:size,flexShrink:0,borderRadius:'50%',overflow:'hidden',background:'var(--surface-hover)',color:'var(--text)',fontWeight:700}}>
    {image && broken!==image ? <img src={image} alt='' width={size} height={size} onError={()=>setBroken(image)} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : initials}
  </span>
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
  useEffect(()=>{const reset=()=>{setSelected(null);setError('');setMessage('')};window.addEventListener(ACCOUNT_CHANGED,reset);return()=>window.removeEventListener(ACCOUNT_CHANGED,reset)},[])
  async function save(remove=false) {
    setError('');setMessage('');setBusy(true)
    try {
      if(remove) await apiDelete('/api/v1/patient/profile-image')
      else if(selected) {
        const encoded=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('The file could not be read.'));reader.readAsDataURL(selected)})
        await apiPost('/api/v1/patient/profile-image',{content_type:selected.type,content_base64:encoded})
      } else return
      setSelected(null);if(input.current)input.current.value=''
      const scope=readAccountScope();if(scope)requests.delete(scope)
      window.dispatchEvent(new Event(changed));setMessage(remove?'Profile image removed.':'Profile image updated.')
    } catch(cause){setError(getApiErrorDetail(cause)||'Your image could not be saved. Please try again.')} finally{setBusy(false)}
  }
  return <section aria-label='Profile image' style={{display:'grid',gap:10,justifyItems:'start',maxWidth:'100%'}}>
    {preview?<img src={preview} width={88} height={88} alt='Selected profile image preview' style={{borderRadius:16,objectFit:'cover'}}/>:<ProfileImage name={name} size={88}/>}
    <label style={{fontSize:13,fontWeight:600}}>Profile image<input ref={input} type='file' accept='image/jpeg,image/png,image/webp' disabled={busy} onChange={event=>{setError('');setMessage('');const file=event.target.files?.[0];if(!file){setSelected(null);return}if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024){setSelected(null);setError('Choose a JPEG, PNG or WebP image, up to 2 MB.');event.target.value='';return}setSelected(file)}} style={{display:'block',width:'100%',maxWidth:260,minHeight:44,marginTop:6}} aria-describedby='profile-image-help'/></label>
    <p id='profile-image-help' style={{fontSize:13,margin:0,color:'var(--text-secondary)'}}>JPEG, PNG or WebP · up to 2 MB. Photo metadata is removed.</p>
    {selected&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type='button' disabled={busy} onClick={()=>save()} style={{minHeight:44}}>Save image</button><button type='button' disabled={busy} onClick={()=>{setSelected(null);if(input.current)input.current.value=''}} style={{minHeight:44}}>Cancel selection</button></div>}
    {image&&<button type='button' disabled={busy} onClick={()=>save(true)} style={{minHeight:44,color:'var(--danger)'}}>Remove image</button>}
    {busy&&<p role='status'>Saving profile image…</p>}{message&&<p role='status'>{message}</p>}{error&&<p role='alert'>{error}</p>}{loadError&&<p role='alert'>{loadError} <button type='button' onClick={retry}>Retry image</button></p>}
  </section>
}

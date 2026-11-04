'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiDelete, apiGet, apiPost, clearAuthTokens, getApiErrorDetail } from '@/lib/api'
import { recoveryPortal } from '@/lib/auth-recovery'
import { usePathname } from 'next/navigation'

type Session={id:string;current:boolean;device_name:string;browser_name:string|null;operating_system:string|null;last_seen_at:string;created_at:string;expires_at:string}
type Security={password_change_available:boolean;mfa:{available:boolean;enabled:boolean;method:string|null;message:string};sessions:Session[];sessions_total:number}
const button={minHeight:44,padding:'10px 14px',border:'1px solid var(--border)',borderRadius:10,background:'var(--surface-hover)',color:'var(--text)',fontWeight:600} as const
export default function AccountSecurity() {
  const router=useRouter();const pathname=usePathname()
  const login=pathname.startsWith('/admin')?'/auth/admin/login':pathname.startsWith('/doctor')?'/auth/doctor/login':recoveryPortal('/auth/sign-in').signIn
  const [data,setData]=useState<Security|null>(null)
  const [error,setError]=useState('');const [notice,setNotice]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false)
  const [current,setCurrent]=useState('');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('')
  const load=useCallback(async()=>{setLoading(true);setError('');try{setData(await apiGet<Security>('/api/v1/security'))}catch(cause){setError(getApiErrorDetail(cause)||'Security settings could not be loaded.')}finally{setLoading(false)}},[])
  useEffect(()=>{void load()},[load])
  const signOut=()=>{clearAuthTokens();router.replace(login)}
  async function mutate(path:string,method:'POST'|'DELETE'='POST') {
    setBusy(true);setError('');setNotice('')
    try{const result=method==='POST'?await apiPost<{message:string;current_session_revoked:boolean}>(path,{}):await apiDelete<{message:string;current_session_revoked:boolean}>(path)
      if(result.current_session_revoked){signOut();return}setNotice(result.message);await load()
    }catch(cause){setError(getApiErrorDetail(cause)||'The security action failed. Please retry.')}finally{setBusy(false)}
  }
  async function changePassword(event:React.FormEvent) {
    event.preventDefault();setError('');setNotice('')
    if(!current){setError('Enter your current password.');return}
    if(password.length<8||password.length>128||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)){setError('New password must be 8–128 characters with uppercase, lowercase, a number and a special character.');return}
    if(password!==confirm){setError('Confirm your new password exactly.');return}
    setBusy(true)
    try{await apiPost('/api/v1/security/password',{current_password:current,new_password:password});setCurrent('');setPassword('');setConfirm('');signOut()}
    catch(cause){setError(getApiErrorDetail(cause)||'Your password could not be changed.')}finally{setBusy(false)}
  }
  return <section aria-label='Account security' style={{display:'grid',gap:20,minWidth:0,color:'var(--text)'}}>
    <h2 style={{margin:0,fontSize:22}}>Account security</h2>
    {error&&<p role='alert' style={{color:'var(--danger)',margin:0}}>{error}</p>}{notice&&<p role='status'>{notice}</p>}
    {loading?<p role='status'>Loading security settings…</p>:!data?<button type='button' onClick={()=>void load()} style={button}>Retry security settings</button>:<>
      <form onSubmit={changePassword} noValidate style={{display:'grid',gap:12}} aria-label='Change password'>
        <h3 style={{margin:0,fontSize:17}}>Change password</h3>
        <p style={{margin:0,fontSize:13,color:'var(--text-secondary)'}}>Changing your password signs out all devices. Sign in again with the new password.</p>
        {([['Current password',current,setCurrent,'current-password'],['New password',password,setPassword,'new-password'],['Confirm new password',confirm,setConfirm,'new-password']] as const).map(([label,value,setValue,complete])=><label key={label} style={{display:'grid',gap:6,fontSize:14,fontWeight:600}}>{label} (Required)<input type='password' autoComplete={complete} required maxLength={128} value={value} onChange={e=>setValue(e.target.value)} style={{minHeight:44,width:'100%',minWidth:0,padding:10,borderRadius:10,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text)'}}/></label>)}
        <p style={{margin:0,fontSize:13}}>8–128 characters, with uppercase, lowercase, a number and a special character.</p>
        <button style={button} disabled={busy||!data.password_change_available} type='submit'>{busy?'Working…':'Change password and sign out'}</button>
      </form>
      {!pathname.startsWith('/admin')&&<p><Link href='/auth/social/connect' style={{color:'var(--link)',display:'inline-flex',minHeight:44,alignItems:'center'}}>Connect Google or Apple sign-in</Link></p>}
      <div><h3 style={{fontSize:17}}>Two-factor authentication</h3><p style={{fontSize:14}}>{data.mfa.message}</p>{!data.mfa.available&&<button style={button} disabled type='button'>Two-factor enrollment unavailable</button>}</div>
      <div><h3 style={{fontSize:17}}>Sessions and devices</h3><p style={{fontSize:13}}>Only your account’s sessions are shown. Revoking a session signs that device out.</p>
        {data.sessions.length===0?<p>No active sessions are available.</p>:<ul style={{padding:0,listStyle:'none',display:'grid',gap:10}}>{data.sessions.map(session=><li key={session.id} style={{padding:12,border:'1px solid var(--border)',borderRadius:12,display:'flex',gap:12,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}><div><strong>{session.device_name||'Device'}{session.current?' · This device':''}</strong><p style={{margin:'4px 0',fontSize:13}}>{[session.browser_name,session.operating_system].filter(Boolean).join(' · ')}<br/>Last active: {new Date(session.last_seen_at).toLocaleString()}</p></div><button type='button' style={button} disabled={busy} onClick={()=>void mutate(`/api/v1/security/sessions/${encodeURIComponent(session.id)}`,'DELETE')}>{session.current?'Sign out this device':'Revoke session'}</button></li>)}</ul>}
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button type='button' style={button} disabled={busy} onClick={()=>void mutate('/api/v1/security/sessions/revoke-others')}>Sign out other devices</button><button type='button' style={{...button,color:'var(--danger)'}} disabled={busy} onClick={()=>void mutate('/api/v1/security/sessions/revoke-all')}>Sign out all devices</button></div>
      </div>
    </>}
  </section>
}

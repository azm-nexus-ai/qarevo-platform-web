'use client'
import AccountSecurity from '@/components/security/AccountSecurity'
import { useTheme } from '@/components/ui/ThemeProvider'
export default function AdminSettingsPage() {
  const {theme,setTheme}=useTheme()
  return <main style={{display:'grid',gap:24,minWidth:0,color:'var(--text)'}}>
    <header><h1 style={{fontSize:28,margin:0}}>Admin settings</h1><p>Manage your administrator appearance, password and active sessions.</p></header>
    <section style={{padding:24,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16}}><h2>Appearance</h2><label>Theme<select value={theme} onChange={event=>setTheme(event.target.value as 'light'|'dark')} style={{display:'block',minHeight:44,background:'var(--surface)',color:'var(--text)',border:'1px solid var(--border)',borderRadius:10,padding:10}}><option value='light'>Light</option><option value='dark'>Dark</option></select></label><p>Saved across pages and browser sessions.</p></section>
    <div style={{padding:'clamp(16px,3vw,24px)',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16}}><AccountSecurity/></div>
    <section style={{padding:24,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16}}><h2>Notifications and privacy operations</h2><p>Administrator notification preferences, data export and activity deletion are not connected to server workflows yet.</p><button type='button' disabled style={{minHeight:44}}>Administrator data export unavailable</button></section>
  </main>
}

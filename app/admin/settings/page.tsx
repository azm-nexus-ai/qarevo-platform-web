'use client'
import { useTranslations } from 'next-intl'
import AccountSecurity from '@/components/security/AccountSecurity'
import { useTheme } from '@/components/ui/ThemeProvider'
export default function AdminSettingsPage() {
  const t = useTranslations('adminSettings')
  const {theme,setTheme}=useTheme()
  return <main style={{display:'grid',gap:24,minWidth:0,color:'var(--text)'}}>
    <header><h1 style={{fontSize:28,margin:0}}>{t('adminSettings')}</h1><p>{t('manageYourAdministratorAppearancePassword')}</p></header>
    <section style={{padding:24,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16}}><h2>{t('appearance')}</h2><label>{t('theme')}<select value={theme} onChange={event=>setTheme(event.target.value as 'light'|'dark')} style={{display:'block',minHeight:44,background:'var(--surface)',color:'var(--text)',border:'1px solid var(--border)',borderRadius:10,padding:10}}><option value='light'>{t('light')}</option><option value='dark'>{t('dark')}</option></select></label><p>{t('savedAcrossPagesAndBrowser')}</p></section>
    <div style={{padding:'clamp(16px,3vw,24px)',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16}}><AccountSecurity/></div>
    <section style={{padding:24,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:16}}><h2>{t('notificationsAndPrivacyOperations')}</h2><p>{t('administratorNotificationPreferencesDataExport')}</p><button type='button' disabled style={{minHeight:44}}>{t('administratorDataExportUnavailable')}</button></section>
  </main>
}

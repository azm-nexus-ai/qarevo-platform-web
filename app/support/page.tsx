'use client'
import { useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import SupportContentShell from '@/components/support/SupportContentShell'
const subscribe=(update: () => void)=>{ window.addEventListener('popstate', update); return ()=>window.removeEventListener('popstate', update) }
const linkedTopic=()=>(new URLSearchParams(window.location.search).get('q') ?? '').slice(0, 80)
const FAQS = ['signIn', 'recoveryLink', 'joinConsultation', 'changeProfile', 'patientBilling', 'doctorBilling', 'documentUpload', 'sessionEnded'] as const
export default function SupportPage() {
  const t = useTranslations('support')
  // Screens link here with ?q=<topic> so the matching article is shown straight away; typing replaces it.
  const topic=useSyncExternalStore(subscribe, linkedTopic, ()=>'')
  const [typed,setSearch]=useState<string|null>(null), search=typed ?? topic
  // Each article also carries search terms in both languages, so "billing" and "Rechnung" find the same article.
  const rows=FAQS.map(key=>[t(`faq.${key}.question`), t(`faq.${key}.answer`), t.has(`faq.${key}.keywords`) ? t(`faq.${key}.keywords`) : ''] as const)
  const found=rows.filter(row=>row.join(' ').toLowerCase().includes(search.trim().toLowerCase()))
  return <SupportContentShell title={t('helpSupport')}>
    <section className='support-help-card'><label htmlFor='help-search'>{t('searchHelpArticles')}</label><input id='help-search' type='search' value={search} onChange={event=>setSearch(event.target.value)} placeholder={t('searchByTopic')} /></section>
    <section aria-label={t('helpArticles')} className='support-help-card'>{found.length ? found.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>) : <p role='status'>{t('noArticlesMatchYourSearch')}</p>}</section>
    <section className='support-help-card' aria-labelledby='support-availability'><h2 id='support-availability'>{t('contactSupport')}</h2><p>{t('liveChatAndSupportTickets')}</p><p>{t('supportChannelsAndResponseTimes')}</p></section>
  </SupportContentShell>
}

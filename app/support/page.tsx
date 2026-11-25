'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import SupportContentShell from '@/components/support/SupportContentShell'
const FAQS = ['signIn', 'recoveryLink', 'joinConsultation', 'changeProfile'] as const
export default function SupportPage() {
  const t = useTranslations('support')
  const [search,setSearch]=useState('')
  const rows=FAQS.map(key=>[t(`faq.${key}.question`), t(`faq.${key}.answer`)] as const)
  const found=rows.filter(row=>row.join(' ').toLowerCase().includes(search.trim().toLowerCase()))
  return <SupportContentShell title={t('helpSupport')}>
    <section className='support-help-card'><label htmlFor='help-search'>{t('searchHelpArticles')}</label><input id='help-search' type='search' value={search} onChange={event=>setSearch(event.target.value)} placeholder={t('searchByTopic')} /></section>
    <section aria-label={t('helpArticles')} className='support-help-card'>{found.length ? found.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>) : <p role='status'>{t('noArticlesMatchYourSearch')}</p>}</section>
    <section className='support-help-card' aria-labelledby='support-availability'><h2 id='support-availability'>{t('contactSupport')}</h2><p>{t('liveChatAndSupportTickets')}</p><p>{t('supportChannelsAndResponseTimes')}</p></section>
  </SupportContentShell>
}

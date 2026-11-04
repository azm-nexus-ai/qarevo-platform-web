'use client'
import { useState } from 'react'
import SupportContentShell from '@/components/support/SupportContentShell'
const FAQS = [
  ['I cannot sign in', 'Use Forgot password from your portal’s sign-in page. Open the newest recovery email and choose a new password. A successful reset clears the password-attempt lockout.'],
  ['My recovery link is missing or invalid', 'Reopen the full link in your newest recovery email. Requesting another email replaces earlier links. Refreshing the recovery page removes the link from page memory.'],
  ['I cannot join my consultation', 'Open your scheduled consultation from your dashboard. Check your connection and browser camera and microphone permissions.'],
  ['I need to change my profile', 'Open Settings in your portal. Required fields and validation messages explain what must be completed.'],
]
export default function SupportPage() {
  const [search,setSearch]=useState('')
  const found=FAQS.filter(row=>row.join(' ').toLowerCase().includes(search.trim().toLowerCase()))
  return <SupportContentShell title='Help & Support'>
    <section className='support-help-card'><label htmlFor='help-search'>Search help articles</label><input id='help-search' type='search' value={search} onChange={event=>setSearch(event.target.value)} placeholder='Search by topic' /></section>
    <section aria-label='Help articles' className='support-help-card'>{found.length ? found.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>) : <p role='status'>No articles match your search. Try a different term.</p>}</section>
    <section className='support-help-card' aria-labelledby='support-availability'><h2 id='support-availability'>Contact support</h2><p>Live chat and support tickets are not connected in this development environment. No support request can be submitted here yet.</p><p>Support channels and response times will be published once they are configured.</p></section>
  </SupportContentShell>
}

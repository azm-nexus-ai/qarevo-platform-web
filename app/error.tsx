'use client'

import RoleHomeLink from '@/components/branding/RoleHomeLink'

// Keep the root theme, account isolation and session guard mounted on page errors.
export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return <main className='grid min-h-[60vh] place-items-center bg-surface-subtle px-6 py-16 text-ink'>
    <section aria-labelledby='page-error-title' className='w-full max-w-lg rounded-2xl border border-theme bg-surface p-8 shadow-sm'>
      <p className='text-sm font-semibold text-secondary'>Qarevo Health</p>
      <h1 id='page-error-title' className='mt-3 text-2xl font-semibold tracking-tight'>This page could not be displayed</h1>
      <p role='alert' className='mt-4 text-sm leading-7 text-secondary'>Please try again. Your previously saved information remains in your account. Unsaved changes may need to be entered again.</p>
      <div className='mt-6 flex flex-wrap gap-3'>
        <button onClick={reset} className='rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'>Try again</button>
        <RoleHomeLink className='rounded-xl border border-theme px-5 py-3 font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'>Return to home</RoleHomeLink>
      </div>
    </section>
  </main>
}

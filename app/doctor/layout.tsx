import React from 'react'
import { DOCTOR_SIDEBAR_ITEMS, DOCTOR_ROUTES, isDoctorNavActive } from '@/constants/doctor-navigation'
import { ICONS } from '@/constants/icons'

function Icon({ icon }: { icon: string | readonly string[] }) {
  if (typeof icon === 'string') {
    return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
  }
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon.map((path, i) => <path key={i} d={path} />)}</svg>
}

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-screen fixed left-0 top-0 z-10">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Qarevo Health</h1>
            <p className="text-sm text-gray-500 mt-1">Doctor Portal</p>
          </div>
          
          <nav className="p-4">
            <ul className="space-y-1">
              {DOCTOR_SIDEBAR_ITEMS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isDoctorNavActive(typeof window !== 'undefined' ? window.location.pathname : item.href, item.href)
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="mr-3"><Icon icon={item.icon} /></span>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 ml-64">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Welcome, Doctor</h2>
                <p className="text-sm text-gray-500">Manage your consultations and patients</p>
              </div>
              <div className="flex items-center space-x-4">
                <button className="p-2 text-gray-500 hover:text-gray-700">
                  <Icon icon={ICONS.info} />
                </button>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    DR
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Page content */}
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

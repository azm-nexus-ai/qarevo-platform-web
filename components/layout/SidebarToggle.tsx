'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

export const SIDEBAR_PREFERENCE_CHANGED = 'qarevo:sidebar-preference'
export type PortalRole = 'patient' | 'doctor' | 'admin'

export default function SidebarToggle({ role }: { role: PortalRole }) {
  const path = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [available, setAvailable] = useState(false)
  const key = `qarevo.sidebar.${role}`
  const attribute = `data-${role}-sidebar`
  useEffect(() => {
    const sync = (event?: Event) => {
      if (event instanceof StorageEvent && event.key !== key && event.key !== null) return
      let value = document.documentElement.getAttribute(attribute) === 'collapsed'
      if (event?.type !== SIDEBAR_PREFERENCE_CHANGED) {
        try { value = localStorage.getItem(key) === 'collapsed' } catch { /* Optional preference. */ }
      }
      document.documentElement.setAttribute(attribute, value ? 'collapsed' : 'expanded')
      setCollapsed(value)
      setAvailable(!!document.getElementById(`${role}-primary-sidebar`))
    }
    sync()
    // Some pages mount their navigation only after private data has loaded.
    const observer = new MutationObserver(() => {
      if (document.getElementById(`${role}-primary-sidebar`)) { setAvailable(true); observer.disconnect() }
    })
    if (!document.getElementById(`${role}-primary-sidebar`)) observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('storage', sync)
    window.addEventListener(SIDEBAR_PREFERENCE_CHANGED, sync)
    return () => { observer.disconnect(); window.removeEventListener('storage', sync); window.removeEventListener(SIDEBAR_PREFERENCE_CHANGED, sync) }
  }, [attribute, key, path, role])
  if (!available) return null
  return <button type='button' className='theme-toggle sidebar-toggle' aria-controls={`${role}-primary-sidebar`} aria-expanded={!collapsed}
    onClick={() => {
      const next = !collapsed
      setCollapsed(next)
      document.documentElement.setAttribute(attribute, next ? 'collapsed' : 'expanded')
      try { localStorage.setItem(key, next ? 'collapsed' : 'expanded') } catch { /* Keep working without persistence. */ }
      window.dispatchEvent(new Event(SIDEBAR_PREFERENCE_CHANGED))
    }}>
    {collapsed ? <PanelLeftOpen size={18} aria-hidden='true' /> : <PanelLeftClose size={18} aria-hidden='true' />}
    <span>{collapsed ? 'Show sidebar' : 'Hide sidebar'}</span>
  </button>
}

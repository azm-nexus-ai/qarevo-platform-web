'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'

export const SIDEBAR_PREFERENCE_CHANGED = 'qarevo:sidebar-preference'
export type PortalRole = 'patient' | 'doctor' | 'admin'

export default function SidebarToggle({ role, side = 'left' }: { role: PortalRole; side?: 'left' | 'right' }) {
  const path = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [available, setAvailable] = useState(false)
  const preferenceRole = side === 'right' ? `${role}-right` : role
  const key = `qarevo.sidebar.${preferenceRole}`
  const sidebarId = `${role}-${side === 'right' ? 'secondary' : 'primary'}-sidebar`
  const attribute = `data-${preferenceRole}-sidebar`
  useEffect(() => {
    const sync = (event?: Event) => {
      if (event instanceof StorageEvent && event.key !== key && event.key !== null) return
      let value = document.documentElement.getAttribute(attribute) === 'collapsed'
      if (event?.type !== SIDEBAR_PREFERENCE_CHANGED) {
        try { value = localStorage.getItem(key) === 'collapsed' } catch { /* Optional preference. */ }
      }
      document.documentElement.setAttribute(attribute, value ? 'collapsed' : 'expanded')
      setCollapsed(value)
      setAvailable(!!document.getElementById(sidebarId))
    }
    sync()
    // Some pages mount their navigation only after private data has loaded.
    const observer = new MutationObserver(() => {
      if (document.getElementById(sidebarId)) { setAvailable(true); observer.disconnect() }
    })
    if (!document.getElementById(sidebarId)) observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('storage', sync)
    window.addEventListener(SIDEBAR_PREFERENCE_CHANGED, sync)
    return () => { observer.disconnect(); window.removeEventListener('storage', sync); window.removeEventListener(SIDEBAR_PREFERENCE_CHANGED, sync) }
  }, [attribute, key, path, role, sidebarId])
  if (!available) return null
  return <button type='button' className='theme-toggle sidebar-toggle' aria-controls={sidebarId} aria-expanded={!collapsed} title={`${collapsed ? 'Show' : 'Hide'} ${side} sidebar`} aria-label={`${collapsed ? 'Show' : 'Hide'} ${side === 'right' ? 'right ' : ''}sidebar`}
    onClick={() => {
      const next = !collapsed
      setCollapsed(next)
      document.documentElement.setAttribute(attribute, next ? 'collapsed' : 'expanded')
      try { localStorage.setItem(key, next ? 'collapsed' : 'expanded') } catch { /* Keep working without persistence. */ }
      window.dispatchEvent(new Event(SIDEBAR_PREFERENCE_CHANGED))
    }}>
    {side === 'right' ? (collapsed ? <PanelRightOpen size={18} aria-hidden='true' /> : <PanelRightClose size={18} aria-hidden='true' />) : (collapsed ? <PanelLeftOpen size={18} aria-hidden='true' /> : <PanelLeftClose size={18} aria-hidden='true' />)}
    <span>{collapsed ? 'Show' : 'Hide'} {side === 'right' ? 'right ' : ''}sidebar</span>
  </button>
}

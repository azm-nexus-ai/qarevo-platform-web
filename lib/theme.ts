import { currentPortal, type Portal } from './portal-scope'

export type Theme = 'light' | 'dark'
export const LEGACY_THEME_KEY = 'qarevo.theme.v1'
export const THEME_CHANGED = 'qarevo:theme-change'
export const themeKey = (portal = currentPortal()) => `qarevo:${portal}:theme`

/** Self-contained so the same resolver/migration runs before the first browser paint. */
function bootstrapTheme(portal?: Portal, apply = true): Theme {
  const root = document.documentElement
  let resolved = portal
  if (!resolved) {
    const portals = ['patient', 'doctor', 'admin']
    const host = window.location.hostname.split('.')[0]
    const path = window.location.pathname
    if (portals.includes(host)) resolved = host as Portal
    else if (/^\/(?:admin|auth\/admin)(?:\/|$)/.test(path)) resolved = 'admin'
    else if (/^\/(?:doctor|auth\/doctor)(?:\/|$)|^\/auth\/doctor-(?:register|verify-email|verify-phone)(?:\/|$)/.test(path)) resolved = 'doctor'
    else if (/^\/(?:patient|auth\/(?:sign-in|sign-up|forgot-password|reset-password|profile-setup|otp|verify-email|account-created|welcome))(?:\/|$)/.test(path)) resolved = 'patient'
    else {
      try {
        const saved = sessionStorage.getItem('qarevo:active-portal')
        if (saved && portals.includes(saved)) resolved = saved as Portal
      } catch { /* Tab context is optional. */ }
      resolved ||= 'patient'
    }
  }
  let theme: Theme = 'light'
  try {
    const key = `qarevo:${resolved}:theme`
    const current = localStorage.getItem(key)
    const legacy = localStorage.getItem('qarevo.theme.v1')
    if (current === null && (legacy === 'dark' || legacy === 'light')) {
      localStorage.setItem(key, legacy)
      theme = legacy
    } else theme = current === 'dark' ? 'dark' : 'light'
    // Migrate once to this portal; never copy the old shared choice to another role.
    localStorage.removeItem('qarevo.theme.v1')
  } catch {
    if (root.dataset.themePortal === resolved) theme = root.dataset.theme === 'dark' ? 'dark' : 'light'
  }
  if (apply) {
    root.dataset.theme = theme
    root.dataset.themePortal = resolved
    try { sessionStorage.setItem('qarevo:active-portal', resolved) } catch { /* Theme remains usable without storage. */ }
  }
  return theme
}

export function readPortalTheme(portal = currentPortal()): Theme {
  return typeof window === 'undefined' ? 'light' : bootstrapTheme(portal, false)
}
export function applyPortalTheme(portal = currentPortal()): Theme {
  return typeof window === 'undefined' ? 'light' : bootstrapTheme(portal)
}
export function setPortalTheme(theme: Theme, portal = currentPortal()) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(themeKey(portal), theme) } catch { /* Current page still responds. */ }
  if (portal === currentPortal()) {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.themePortal = portal
  }
}

// Appearance only: this script embeds no identity, credential or clinical data.
export const THEME_BOOTSTRAP = `(${bootstrapTheme.toString()})();['patient','patient-right','doctor','admin'].forEach(function(r){try{document.documentElement.setAttribute('data-'+r+'-sidebar',localStorage.getItem('qarevo.sidebar.'+r)==='collapsed'?'collapsed':'expanded')}catch(e){}})`

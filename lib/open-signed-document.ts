import { apiGet } from './api'
import { object } from './practice'

/**
 * Opens a short-lived signed document URL in a new tab.
 * The tab is opened synchronously (inside the click) so popup blockers allow it, then detached from
 * this page before it navigates. `window.open(..., 'noopener')` would return null, so the opener is
 * cleared by hand instead. Without a tab, the document opens in this one.
 */
export async function openSignedDocument(path: string): Promise<boolean> {
  const tab = window.open('', '_blank')
  if (tab) tab.opener = null
  try {
    const result = await apiGet<unknown>(path)
    if (!object(result) || typeof result.url !== 'string' || !result.url.startsWith('https://')) throw new Error('unsigned')
    if (tab) tab.location.replace(result.url); else window.location.assign(result.url)
    return true
  } catch { tab?.close(); return false }
}

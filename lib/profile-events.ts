type ProfilePortal = 'patient' | 'doctor'
const channelName = 'qarevo:profile-updates:v1'
const eventName = (portal: ProfilePortal) => `qarevo:${portal === 'patient' ? 'profile-image' : 'doctor-profile'}-changed`
const senderId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2)

function openChannel() {
  if (typeof BroadcastChannel === 'undefined') return null
  try { return new BroadcastChannel(channelName) } catch { return null }
}

/** Broadcast invalidation only; images, names and credentials never enter storage. */
export function notifyProfileChanged(portal: ProfilePortal) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(eventName(portal)))
  const channel = openChannel()
  if (!channel) return
  try { channel.postMessage({ portal, senderId }) } finally { channel.close() }
}

export function subscribeProfileChanges(portal: ProfilePortal, refresh: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(eventName(portal), refresh)
  const channel = openChannel()
  // The local event already invalidated this tab; avoid duplicate network reads.
  if (channel) channel.onmessage = event => { if (event.data?.portal === portal && event.data.senderId !== senderId) refresh() }
  return () => { window.removeEventListener(eventName(portal), refresh); channel?.close() }
}

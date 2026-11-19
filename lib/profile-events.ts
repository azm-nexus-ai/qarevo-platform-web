type ProfilePortal = 'patient' | 'doctor'
const channelName = 'qarevo:profile-updates:v1'
const eventName = (portal: ProfilePortal) => `qarevo:${portal === 'patient' ? 'profile-image' : 'doctor-profile'}-changed`
const senderId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2)
const revisions: Record<ProfilePortal, number> = { patient: 0, doctor: 0 }
let subscribers = 0
let sharedChannel: BroadcastChannel | null = null

export function profileRevision(portal: ProfilePortal) { return revisions[portal] }

function invalidate(portal: ProfilePortal) {
  revisions[portal]++
  window.dispatchEvent(new Event(eventName(portal)))
}

function openChannel() {
  if (typeof BroadcastChannel === 'undefined') return null
  try { return new BroadcastChannel(channelName) } catch { return null }
}

function subscribeChannel() {
  if (sharedChannel) return
  sharedChannel = openChannel()
  if (sharedChannel) sharedChannel.onmessage = event => {
    const portal = event.data?.portal
    if ((portal === 'patient' || portal === 'doctor') && event.data.senderId !== senderId) invalidate(portal)
  }
}

/** Broadcast invalidation only; images, names and credentials never enter storage. */
export function notifyProfileChanged(portal: ProfilePortal) {
  if (typeof window === 'undefined') return
  invalidate(portal)
  const channel = sharedChannel || openChannel()
  if (!channel) return
  try { channel.postMessage({ portal, senderId }) } finally { if (channel !== sharedChannel) channel.close() }
}

export function subscribeProfileChanges(portal: ProfilePortal, refresh: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(eventName(portal), refresh)
  subscribers++
  // One channel dispatches once to all local consumers, including desktop/mobile.
  subscribeChannel()
  return () => {
    window.removeEventListener(eventName(portal), refresh)
    subscribers--
    if (!subscribers) { sharedChannel?.close(); sharedChannel = null }
  }
}

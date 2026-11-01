const DRAFT_PREFIX = 'qarevo.draft.v2:'
const REVISION_KEY = 'qarevo_session_revision'

export const ACCOUNT_CHANGED = 'qarevo:account-changed'

function isPrivateKey(key: string) {
    return key.startsWith(DRAFT_PREFIX)
        || key.startsWith('qarevo.onboarding.')
        || key === 'qarevo.auth.signup.v1'
        || key === 'qarevo.auth.flow.v1'
        || key === 'qarevo_booking_state'
}

function purge(storage: Storage) {
    for (const key of Object.keys(storage)) {
        if (isPrivateKey(key)) storage.removeItem(key)
    }
}

export function clearPrivateBrowserState() {
    if (typeof window === 'undefined') return
    purge(window.localStorage)
    purge(window.sessionStorage)
}

export function readAccountScope(): string | null {
    if (typeof window === 'undefined') return null

    const id = window.localStorage.getItem('qarevo_user_id')
    const token = window.localStorage.getItem('qarevo_access_token')

    if (!id || !token) return null
    return JSON.stringify([id, window.localStorage.getItem(REVISION_KEY)])
}

let tabScope = readAccountScope()

export function assertCurrentAccount() {
    if (typeof window !== 'undefined' && tabScope !== readAccountScope()) {
        throw new Error('Your account changed in another tab. Reload this page.')
    }
}

export function accountChanged() {
    if (typeof window === 'undefined') return

    clearPrivateBrowserState()
    window.localStorage.setItem(REVISION_KEY, crypto.randomUUID())
    tabScope = readAccountScope()
    window.dispatchEvent(new Event(ACCOUNT_CHANGED))
}

export function createAccountDraftStorage() {
    const owner = readAccountScope()
    const available = () => owner !== null && owner === readAccountScope()
    const keyFor = (key: string) => DRAFT_PREFIX + owner + ':' + key

    return {
        getItem(key: string): string | null {
            if (typeof window === 'undefined') return null

            // Old drafts have no reliable owner: discard them.
            purge(window.localStorage)
            return available() ? window.sessionStorage.getItem(keyFor(key)) : null
        },

        setItem(key: string, value: string) {
            if (!available()) {
                throw new Error('Your session changed. Sign in again before saving.')
            }
            window.sessionStorage.setItem(keyFor(key), value)
        },

        removeItem(key: string) {
            if (available()) window.sessionStorage.removeItem(keyFor(key))
        },
    }
}
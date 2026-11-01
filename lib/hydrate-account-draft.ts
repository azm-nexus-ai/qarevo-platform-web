import type { createAccountDraftStorage } from './account-storage'

// An account-owned tab draft takes precedence. Otherwise restore the saved server step.
export function hydrateAccountDraft<T>(storage: ReturnType<typeof createAccountDraftStorage>, key: string,
  load: () => Promise<Partial<T>>, apply: (data: Partial<T>) => void,
  failed: (error: unknown) => void, ready: () => void) {
  let current = true
  const hydrate = async () => {
    try {
      let cached: Partial<T> | null = null
      try {
        const raw = storage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) cached = parsed as Partial<T>
        }
      } catch { /* A malformed draft must not prevent restoring saved records. */ }
      const data = cached || await load()
      if (current) apply(data)
    } catch (error) { if (current) failed(error) }
    finally { if (current) ready() }
  }
  void hydrate()
  return () => { current = false }
}

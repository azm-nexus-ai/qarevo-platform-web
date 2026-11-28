// Public physician URLs: /patient/physicians/dr-anna-schmidt--<token>
//
// The token is the provider UUID in unpadded base64url (22 characters), so a
// link always resolves to exactly one provider without a lookup table, and the
// readable name part can change (marriage, a typo fixed) without breaking old
// links. Bare UUID links from before this change still resolve and are
// replaced by the canonical slug.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOKEN = /^[A-Za-z0-9_-]{22}$/
const SEPARATOR = '--'

function base64url(bytes: number[]) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function uuidToToken(uuid: string): string | null {
  if (!UUID.test(uuid)) return null
  const hex = uuid.replace(/-/g, '').toLowerCase()
  const bytes: number[] = []
  for (let i = 0; i < 32; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16))
  return base64url(bytes)
}

export function tokenToUuid(token: string): string | null {
  if (!TOKEN.test(token)) return null
  let binary: string
  try { binary = atob(token.replace(/-/g, '+').replace(/_/g, '/') + '==') } catch { return null }
  if (binary.length !== 16) return null
  const hex = Array.from(binary, char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** "Dr. Anna-Lena Müller" → "dr-anna-lena-mueller" (German umlauts transliterated, other marks dropped). */
export function nameSlug(name: string): string {
  const german: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', Ä: 'ae', Ö: 'oe', Ü: 'ue' }
  const cleaned = name.replace(/^\s*dr\.?\s+/i, '').replace(/[äöüßÄÖÜ]/g, char => german[char])
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '')
  return cleaned ? `dr-${cleaned}` : 'dr'
}

export function physicianSlug(id: string, name = ''): string {
  const token = uuidToToken(id)
  if (!token) return encodeURIComponent(id) // not a provider UUID (e.g. a fixture); keep it as given
  return `${nameSlug(name)}${SEPARATOR}${token}`
}

export function physicianPath(id: string, name = '', query?: string | URLSearchParams): string {
  const search = query ? (typeof query === 'string' ? query.replace(/^\?/, '') : query.toString()) : ''
  return `/patient/physicians/${physicianSlug(id, name)}${search ? `?${search}` : ''}`
}

/** The provider UUID for a route parameter: a slug, or a bare UUID from an older link. */
export function physicianIdFromParam(param: string | undefined | null): string | null {
  if (!param) return null
  let value = param
  try { value = decodeURIComponent(param) } catch { /* keep the raw value */ }
  if (UUID.test(value)) return value.toLowerCase()
  const at = value.lastIndexOf(SEPARATOR)
  return at === -1 ? null : tokenToUuid(value.slice(at + SEPARATOR.length))
}

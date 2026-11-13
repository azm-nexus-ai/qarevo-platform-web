import { PORTALS, PORTAL_PATH_PREFIXES, type Portal } from '../portal-scope'

type Environment = Record<string, string | undefined>
export type PortalHostRedirect = {
  source: string
  destination: string
  permanent: false
  has: Array<{ type: 'host'; value: string }>
}

const canonicalHostname = (hostname: string) => hostname.length <= 253 && hostname.includes('.') && hostname.split('.').every(label => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))

function configuredOrigins(env: Environment): Record<Portal, URL> | null {
  const names = PORTALS.map(portal => `PORTAL_${portal.toUpperCase()}_ORIGIN`)
  const configured = names.filter(name => env[name] !== undefined && env[name] !== '')
  if (!configured.length) return null
  if (configured.length !== PORTALS.length) throw new Error('Configure all three PORTAL_PATIENT_ORIGIN, PORTAL_DOCTOR_ORIGIN and PORTAL_ADMIN_ORIGIN together, or leave all unset for shared-host development.')
  const origins = {} as Record<Portal, URL>
  const hosts = new Set<string>()
  for (const portal of PORTALS) {
    const name = `PORTAL_${portal.toUpperCase()}_ORIGIN`
    const raw = env[name]!
    let url: URL
    try { url = new URL(raw) }
    catch { throw new Error(`${name} must be a valid HTTPS origin.`) }
    if (raw !== raw.trim() || !/^https:\/\/[^/]+\/?$/i.test(raw) || /[\u0000-\u001f\u007f\\?#@]/.test(raw) || url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !canonicalHostname(url.hostname)) {
      throw new Error(`${name} must be an HTTPS origin with a canonical hostname and no credentials, path, query or fragment.`)
    }
    // Next host conditions discard ports. Cookies are host-scoped as well.
    if (hosts.has(url.hostname)) throw new Error('PORTAL_*_ORIGIN values must use distinct hostnames, including when ports differ.')
    hosts.add(url.hostname)
    origins[portal] = url
  }
  for (const portal of PORTALS) {
    if (origins[portal].hostname.split('.')[0] !== portal) throw new Error(`PORTAL_${portal.toUpperCase()}_ORIGIN must use the canonical ${portal}. subdomain so browser session and theme context agree with host routing.`)
  }
  return origins
}

const escapeHost = (host: string) => host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Build-time rules only: no middleware, server proxy invocation or DNS mutation. */
export function portalHostRedirects(env: Environment): PortalHostRedirect[] {
  const origins = configuredOrigins(env)
  if (!origins) return []
  const rules: PortalHostRedirect[] = []
  for (const portal of PORTALS) {
    const has = [{ type: 'host' as const, value: escapeHost(origins[portal].hostname) }]
    for (const source of ['/', '/auth']) rules.push({ source, destination: `${origins[portal].origin}/${portal}/dashboard`, permanent: false, has })
    for (const target of PORTALS) {
      if (target === portal) continue
      for (const prefix of PORTAL_PATH_PREFIXES[target]) {
        // Generic recovery links predate role-specific paths and may contain a
        // URL fragment token. Resolve patient scope on a shared development
        // host, but retain host authority on an isolated portal deployment.
        if (prefix === '/auth/forgot-password' || prefix === '/auth/reset-password') continue
        // /auth/verify-email/link handles both roles and carries a fragment-only
        // verification token. Keep this shared route on the current host.
        const source = prefix === '/auth/verify-email' ? prefix : `${prefix}/:path*`
        rules.push({ source, destination: `${origins[target].origin}${source}`, permanent: false, has })
      }
    }
  }
  return rules
}

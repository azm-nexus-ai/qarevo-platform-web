/** Same-origin, portal-scoped boundary. FastAPI remains the identity authority. */
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { signProxyContext } from './proxy-context';

export type Portal = 'patient' | 'doctor' | 'admin';
type Environment = Record<string, string | undefined>;
type BffDiagnostic = { event: 'bff_request_failed' | 'bff_request_slow'; request_id: string; status_code: number; duration_ms: number; portal: Portal | 'unknown'; method: string; route_template: '/api/v1/[...path]' };
type BffOptions = { fetchImpl?: typeof fetch; env?: Environment; now?: () => number; diagnosticLogger?: (level: 'warn' | 'error', event: BffDiagnostic) => void | Promise<void> };
const BFF_SLOW_REQUEST_MS = 1000;
type BrowserSession = { user_id: string; role: string; provider_id: string | null; session_id: string };
type CookieContext = { secure: boolean; prefix: string; csrf: string; values: Map<string, string> };

const ROLES: Record<Portal, string> = { patient: 'PATIENT', doctor: 'PROVIDER', admin: 'ADMIN' };
const SAFE_METHODS = new Set(['GET', 'HEAD']);
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const SECRET_FIELDS = new Set(['access_token', 'refresh_token', 'temp_token']);
const RESPONSE_HEADERS = ['content-type', 'content-disposition', 'retry-after', 'server-timing', 'x-query-count', 'x-querycount'];
const SHARED_NAMESPACES = new Set(['session', 'security', 'consultations', 'meetings']);
const MFA_PATHS = new Set(['mfa/verify-email', 'mfa/resend-email', 'mfa/verify-phone', 'mfa/resend-phone']);
const PUBLIC_AUTH = new Set(['forgot-password', 'resend-password-reset', 'reset-password', 'resend-verification-email',
  'resend-verification-sms', 'verify-email', 'verify-email-code', 'verify-phone-code', 'verify-otp']);

class BoundaryError extends Error {
  constructor(readonly status: number, message: string, readonly errorCode?: string) { super(message); }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } });
}

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function trustedUrl(value: string | undefined): URL {
  if (!value) throw new BoundaryError(503, 'The application service is not configured.');
  let url: URL;
  try { url = new URL(value); } catch { throw new BoundaryError(503, 'The application service configuration is invalid.'); }
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback(url.hostname))) ||
    url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new BoundaryError(503, 'The application service configuration is invalid.');
  }
  return url;
}

/** Next's self-hosted request URL may use its internal localhost hostname.
 * The HTTP Host identifies the browser origin; browsers cannot override it.
 * Forwarded host is deliberately ignored. Only Vercel's overwritten HTTPS
 * protocol metadata is accepted when actually running on that platform.
 */
function browserUrl(request: Request, env: Environment): URL {
  const url=new URL(request.url), host=request.headers.get('host');
  if(host) {
    if(/[\s,\/\\@?#]/.test(host))throw new BoundaryError(400,'Invalid application host.');
    let candidate:URL;
    try {candidate=new URL(`${url.protocol}//${host}`);} catch {throw new BoundaryError(400,'Invalid application host.');}
    if(candidate.host.toLowerCase()!==host.toLowerCase() || candidate.username || candidate.password)throw new BoundaryError(400,'Invalid application host.');
    url.host=candidate.host;
  }
  if(env.VERCEL==='1' && request.headers.get('x-forwarded-proto')==='https')url.protocol='https:';
  return url;
}

function cookies(request: Request, portal: Portal, env:Environment): CookieContext {
  const url = browserUrl(request,env);
  const secure = url.protocol === 'https:';
  if (!secure && !(url.protocol === 'http:' && isLoopback(url.hostname))) {
    throw new BoundaryError(400, 'A secure application connection is required.');
  }
  const prefix = `${secure ? '__Host-' : ''}qarevo_${portal}_`;
  const csrf = `qarevo_${portal}_csrf`;
  const values = new Map<string, string>();
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const divider = part.indexOf('=');
    if (divider < 1) continue;
    const name = part.slice(0, divider).trim();
    if (![`${prefix}access`, `${prefix}refresh`, `${prefix}mfa`, csrf].includes(name)) continue;
    if (values.has(name)) throw new BoundaryError(400, 'Conflicting application cookies. Clear this portal’s cookies and sign in again.');
    try { values.set(name, decodeURIComponent(part.slice(divider + 1).trim())); }
    catch { throw new BoundaryError(400, 'Invalid application cookie.'); }
  }
  return { secure, prefix, csrf, values };
}

function cookieValue(context: CookieContext, kind: 'access' | 'refresh' | 'mfa'): string | undefined {
  return context.values.get(`${context.prefix}${kind}`);
}

function setCookie(response: Response, name: string, value: string, context: CookieContext, expires: Date, httpOnly = true) {
  response.headers.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; Expires=${expires.toUTCString()}; SameSite=Lax${context.secure ? '; Secure' : ''}${httpOnly ? '; HttpOnly' : ''}`);
}

function clearSession(response: Response, context: CookieContext) {
  for (const kind of ['access', 'refresh', 'mfa']) setCookie(response, `${context.prefix}${kind}`, '', context, new Date(0));
}

function verifyCsrf(request: Request, context: CookieContext, env:Environment) {
  if (request.headers.get('origin') !== browserUrl(request,env).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new BoundaryError(403, 'This request must originate from the current application.');
  }
  const supplied = request.headers.get('X-Qarevo-CSRF') ?? '';
  const expected = context.values.get(context.csrf) ?? '';
  if (!/^[a-f0-9]{64}$/.test(supplied) || !/^[a-f0-9]{64}$/.test(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    throw new BoundaryError(403, 'Your security check expired. Please try again.');
  }
}

function verifyHost(request: Request, portal: Portal, env: Environment) {
  const origin = browserUrl(request,env).origin;
  for (const candidate of Object.keys(ROLES) as Portal[]) {
    const configured = env[`PORTAL_${candidate.toUpperCase()}_ORIGIN`];
    if (configured && trustedUrl(configured).origin === origin && candidate !== portal) {
      throw new BoundaryError(403, 'Use the correct portal for this application.');
    }
  }
}

function validatePath(path: string[]): string {
  if (path.length < 3 || path[0] !== 'api' || path[1] !== 'v1' || path.some(segment =>
    !/^[A-Za-z0-9._~-]+$/.test(segment) || segment === '.' || segment === '..')) {
    throw new BoundaryError(404, 'The requested application service is unavailable.');
  }
  return '/' + path.join('/');
}

/** Only explicit public identity flows bypass the portal's access cookie. */
function routeAccess(path: string[], portal: Portal): 'public' | 'access' | 'mfa' | 'refresh' {
  const namespace = path[2];
  const suffix = path.slice(3).join('/');
  if (['patient', 'doctor', 'admin'].includes(namespace)) {
    if (namespace !== portal) throw new BoundaryError(403, 'This operation belongs to a different portal.');
    if ((portal === 'patient' && suffix === 'register') ||
      (portal === 'doctor' && ['register', 'username-availability'].includes(suffix))) return 'public';
    return 'access';
  }
  if (SHARED_NAMESPACES.has(namespace)) return 'access';
  if (namespace !== 'auth') throw new BoundaryError(404, 'The requested application service is unavailable.');
  if (['refresh', 'logout'].includes(suffix)) return 'refresh';
  if (MFA_PATHS.has(suffix)) {
    if (portal !== 'doctor') throw new BoundaryError(403, 'This verification belongs to the physician portal.');
    return 'mfa';
  }
  if (PUBLIC_AUTH.has(suffix)) return 'public';
  if (suffix === 'login' && portal === 'patient') return 'public';
  if (suffix === 'doctor/login' && portal === 'doctor') return 'public';
  if (portal === 'doctor' && ['doctor/resend-phone-verification', 'doctor/verify-phone-code'].includes(suffix)) return 'public';
  if (suffix === 'admin/login' && portal === 'admin') return 'public';
  if (suffix.startsWith('admin/invitations/') && portal === 'admin' && ['admin/invitations/accept', 'admin/invitations/validate'].includes(suffix)) return 'public';
  if (['register/doctor'].includes(suffix) && portal === 'doctor') return 'public';
  if (['passkeys/authenticate', 'passkeys/authentication-options'].includes(suffix) && portal === 'patient') return 'public';
  if (/^social\/(providers|(google|apple)\/(start|finish|link\/(start|finish)))$/.test(suffix) && portal !== 'admin') {
    return suffix.includes('/link/') ? 'access' : 'public';
  }
  throw new BoundaryError(403, 'This identity operation is unavailable in this portal.');
}

function cleanJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET_FIELDS.has(key.toLowerCase())).map(([key, item]) => [key, cleanJson(item)]));
}

/** A concurrency marker only: the upstream still verifies signature and claims. */
function sessionMarker(access: string | undefined): string | null {
  if (!access) return null;
  try {
    const parts = access.split('.');
    if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.sid === 'string' && payload.sid.length > 0 && payload.sid.length <= 200 ? payload.sid : null;
  } catch { return null; }
}

function sessionMetadata(data: Record<string, unknown>, portal: Portal): BrowserSession {
  if (data.role !== ROLES[portal] || typeof data.user_id !== 'string' || !data.user_id ||
    typeof data.session_id !== 'string' || !data.session_id ||
    (portal === 'doctor' && (typeof data.provider_id !== 'string' || !data.provider_id))) {
    throw new BoundaryError(403, 'This account is not authorized for this portal.');
  }
  return { user_id: data.user_id, role: data.role, provider_id: typeof data.provider_id === 'string' ? data.provider_id : null, session_id: data.session_id };
}

function expiry(data: Record<string, unknown>): Date {
  const value = typeof data.absolute_expires_at === 'string' ? new Date(data.absolute_expires_at) : new Date(NaN);
  if (!Number.isFinite(value.getTime()) || value.getTime() <= Date.now()) throw new BoundaryError(401, 'Your session has expired. Please sign in again.');
  return value;
}

async function boundedBody(request: Request): Promise<ArrayBuffer> {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) throw new BoundaryError(413, 'This upload exceeds the application request limit.');
  const reader = request.body?.getReader();
  if (!reader) return new ArrayBuffer(0);
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    length += item.value.byteLength;
    if (length > MAX_BODY_BYTES) { await reader.cancel(); throw new BoundaryError(413, 'This upload exceeds the application request limit.'); }
    chunks.push(item.value);
  }
  const result = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) { result.set(chunk, position); position += chunk.byteLength; }
  return result.buffer;
}

export async function handlePortalRequest(request: Request, params: { portal: string; path: string[] }, options: BffOptions = {}): Promise<Response> {
  // Correlation is diagnostic metadata, never identity, authorization or idempotency.
  // Mint before validation and never forward a browser-supplied reference.
  const requestId = randomUUID(), now = options.now ?? (() => performance.now());
  const started = now();
  const response = await proxyPortalRequest(request, params, options, requestId);
  response.headers.set('X-Request-ID', requestId);
  // Only bounded, server-selected metadata reaches the existing logging sink.
  // A broken sink must never replace a response or alter session cookies.
  try {
    const elapsed = now() - started;
    const duration = Number.isFinite(elapsed) ? Math.min(86400000, Math.max(0, Math.round(elapsed))) : 0;
    if (response.status >= 400 || duration >= BFF_SLOW_REQUEST_MS) {
      const diagnostic: BffDiagnostic = { event: response.status >= 400 ? 'bff_request_failed' : 'bff_request_slow', request_id: requestId, status_code: response.status, duration_ms: duration,
        portal: Object.hasOwn(ROLES, params.portal) ? params.portal as Portal : 'unknown',
        method: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) ? request.method : 'UNKNOWN', route_template: '/api/v1/[...path]' };
      const level = response.status >= 500 ? 'error' : 'warn';
      const logger = options.diagnosticLogger ?? ((severity, event) => console[severity](JSON.stringify(event)));
      const pending = logger(level, diagnostic);
      if (pending) void pending.catch(() => { /* An asynchronous sink is best-effort too. */ });
    }
  } catch { /* Diagnostics are best-effort; response and security semantics remain authoritative. */ }
  return response;
}

async function proxyPortalRequest(request: Request, params: { portal: string; path: string[] }, options: BffOptions, requestId: string): Promise<Response> {
  let context: CookieContext | undefined;
  let upstreamPath = '';
  let forwardingStarted = false;
  try {
    if (!Object.hasOwn(ROLES, params.portal)) throw new BoundaryError(404, 'This portal is unavailable.');
    const portal = params.portal as Portal;
    const env = options.env ?? process.env;
    const fetchImpl = options.fetchImpl ?? fetch;
    verifyHost(request, portal, env);
    context = cookies(request, portal, env);
    if (params.path.length === 1 && params.path[0] === 'csrf') {
      if (request.method !== 'GET') throw new BoundaryError(405, 'This operation requires GET.');
      const previous = context.values.get(context.csrf);
      const token = previous && /^[a-f0-9]{64}$/.test(previous) ? previous : randomBytes(32).toString('hex');
      const response = json({ csrf_token: token });
      setCookie(response, context.csrf, token, context, new Date(Date.now() + 24 * 60 * 60 * 1000), false);
      return response;
    }
    upstreamPath = validatePath(params.path);
    if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) throw new BoundaryError(405, 'This HTTP method is unavailable.');
    if (!SAFE_METHODS.has(request.method)) verifyCsrf(request, context, env);
    const mode = routeAccess(params.path, portal);
    const credential = mode === 'mfa' ? cookieValue(context, 'mfa') : cookieValue(context, 'access');
    const refresh = cookieValue(context, 'refresh');
    if ((mode === 'access' || mode === 'mfa') && !credential) throw new BoundaryError(401, 'Please sign in to this portal.');
    if (mode === 'refresh' && !refresh) throw new BoundaryError(401, 'Please sign in to this portal.');
    let acceptedSession: string | null = null;
    if (mode === 'access' || mode === 'refresh') {
      acceptedSession = sessionMarker(cookieValue(context, 'access'));
      if (!acceptedSession) throw new BoundaryError(401, 'Please sign in to this portal.');
      const marker = request.headers.get('X-Qarevo-Session');
      if (!(request.method === 'GET' && upstreamPath === '/api/v1/session' && !marker) && marker !== acceptedSession) {
        throw new BoundaryError(409, 'Your session changed. Reload this portal before continuing.', 'SESSION_CHANGED');
      }
    }
    const base = trustedUrl(env.API_BASE_URL || env.NEXT_PUBLIC_API_BASE_URL);
    const target = new URL(upstreamPath, base);
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some(key => SECRET_FIELDS.has(key.toLowerCase()))) throw new BoundaryError(400, 'Session credentials must not appear in URLs.');
    target.search = query.toString();
    const headers = new Headers({ 'X-Request-ID': requestId });
    for (const name of ['content-type', 'accept', 'range', 'user-agent']) {
      const value = request.headers.get(name); if (value) headers.set(name, value);
    }
    for (const [name,value] of Object.entries(signProxyContext(request,target,env))) headers.set(name,value);
    // Never accept browser-supplied Authorization, Cookie, proxy context or refresh headers.
    if (credential && mode !== 'public') headers.set('Authorization', `Bearer ${credential}`);
    if (refresh && (upstreamPath.includes('/settings/active-devices') || upstreamPath.startsWith('/api/v1/security'))) headers.set('X-Qarevo-Refresh-Token', refresh);
    let body: BodyInit | undefined;
    if (!SAFE_METHODS.has(request.method)) {
      const raw = await boundedBody(request);
      if (mode === 'refresh' || upstreamPath.startsWith('/api/v1/auth/social/')) {
        let payload: Record<string, unknown>;
        try {
          const parsed = raw.byteLength ? JSON.parse(new TextDecoder().decode(raw)) : {};
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
          payload = parsed;
        } catch { throw new BoundaryError(400, 'Enter a valid request.'); }
        if (mode === 'refresh') payload.refresh_token = refresh;
        if (Object.hasOwn(payload, 'portal') && payload.portal !== ROLES[portal]) throw new BoundaryError(403, 'This sign-in belongs to a different portal.');
        body = JSON.stringify(payload); headers.set('Content-Type', 'application/json');
      } else body = raw.byteLength ? raw : undefined;
    }
    forwardingStarted = true;
    const upstream = await fetchImpl(target, { method: request.method, headers, body, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    if (upstream.status >= 300 && upstream.status < 400) throw new BoundaryError(502, 'The application service returned an unexpected redirect.');
    const responseHeaders = new Headers({ 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' });
    if (acceptedSession) responseHeaders.set('X-Qarevo-Session-Id', acceptedSession);
    for (const name of RESPONSE_HEADERS) { const value = upstream.headers.get(name); if (value) responseHeaders.set(name, value); }
    let response: Response;
    if (/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(upstream.headers.get('content-type') ?? '') && ![204, 205].includes(upstream.status) && request.method !== 'HEAD') {
      const decoded = await upstream.json() as unknown;
      if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
        if (upstreamPath.startsWith('/api/v1/auth/') || upstreamPath === '/api/v1/session') throw new BoundaryError(502, 'The application service returned an invalid session response.');
        return new Response(JSON.stringify(cleanJson(decoded)), { status: upstream.status, headers: responseHeaders });
      }
      const original = decoded as Record<string, unknown>;
      let payload = cleanJson(original) as Record<string, unknown>;
      if (upstream.ok && (Object.hasOwn(original, 'access_token') || Object.hasOwn(original, 'refresh_token')) &&
        (typeof original.access_token !== 'string' || !original.access_token || typeof original.refresh_token !== 'string' || !original.refresh_token)) {
        throw new BoundaryError(502, 'The application service returned an incomplete session response.');
      }
      if (upstream.ok && typeof original.access_token === 'string' && typeof original.refresh_token === 'string') {
        const verified = await fetchImpl(new URL('/api/v1/session', base), { headers: { Authorization: `Bearer ${original.access_token}`, 'X-Request-ID': requestId }, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(15_000) });
        if (!verified.ok) throw new BoundaryError(verified.status === 401 || verified.status === 403 ? verified.status : 502, 'The authenticated session could not be verified. Please sign in again.');
        const identity = await verified.json() as Record<string, unknown>;
        const metadata = sessionMetadata(identity, portal);
        const deadline = expiry(identity);
        payload = { ...payload, ...metadata, browser_session: metadata };
        responseHeaders.set('X-Qarevo-Session-Id', metadata.session_id);
        response = new Response(JSON.stringify(payload), { status: upstream.status, headers: responseHeaders });
        setCookie(response, `${context.prefix}access`, original.access_token, context, deadline);
        setCookie(response, `${context.prefix}refresh`, original.refresh_token, context, deadline);
        setCookie(response, `${context.prefix}mfa`, '', context, new Date(0));
      } else if (upstream.ok && typeof original.temp_token === 'string') {
        if (portal !== 'doctor' || !['/api/v1/auth/doctor/login', '/api/v1/auth/social/google/finish', '/api/v1/auth/social/apple/finish'].includes(upstreamPath)) throw new BoundaryError(502, 'An unexpected verification challenge was returned.');
        const seconds = Number(original.expires_in);
        if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 15 * 60) throw new BoundaryError(502, 'The verification challenge could not be validated.');
        response = new Response(JSON.stringify({ ...payload, mfa_pending: true }), { status: upstream.status, headers: responseHeaders });
        clearSession(response, context);
        setCookie(response, `${context.prefix}mfa`, original.temp_token, context, new Date(Date.now() + seconds * 1000));
      } else {
        if (upstream.ok && upstreamPath === '/api/v1/session') payload = { ...payload, browser_session: sessionMetadata(original, portal) };
        response = new Response(JSON.stringify(payload), { status: upstream.status, headers: responseHeaders });
      }
    } else {
      if (upstreamPath.startsWith('/api/v1/auth/') && ![204, 205].includes(upstream.status) && request.method !== 'HEAD') throw new BoundaryError(502, 'The application service returned an invalid identity response.');
      response = new Response(request.method === 'HEAD' || [204, 205, 304].includes(upstream.status) ? null : upstream.body, { status: upstream.status, headers: responseHeaders });
    }
    if (upstreamPath === '/api/v1/auth/logout' || (upstreamPath === '/api/v1/auth/refresh' && [401, 403].includes(upstream.status)) ||
      (upstream.ok && ['/api/v1/security/password', '/api/v1/security/sessions/revoke-all'].includes(upstreamPath))) clearSession(response, context);
    return response;
  } catch (error) {
    const response = error instanceof BoundaryError ? json({ detail: error.errorCode ? { error_code: error.errorCode, message: error.message } : error.message }, error.status) : json({ detail: 'The application service could not be reached. Please try again.' }, 502);
    if (context && forwardingStarted && upstreamPath === '/api/v1/auth/logout') clearSession(response, context);
    return response;
  }
}

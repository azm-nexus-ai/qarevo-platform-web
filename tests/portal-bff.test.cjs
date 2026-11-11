const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadServer(name) {
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/server', name + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: mod, exports: mod.exports, require: dependency => dependency.startsWith('./') ? loadServer(dependency.slice(2)) : require(dependency), Request, Response, Headers, URL, Buffer, TextDecoder, AbortSignal, Date, process });
  return mod.exports;
}
const { handlePortalRequest } = loadServer('portal-bff');
const origin = 'https://dev.qarevo.example';
const csrf = 'a'.repeat(64);
const env = { API_BASE_URL: 'https://api.qarevo.example' };
const roles = { patient: 'PATIENT', doctor: 'PROVIDER', admin: 'ADMIN' };
const access = portal => `header.${Buffer.from(JSON.stringify({ sid: `${portal}-family` })).toString('base64url')}.signature`;

function cookie(portal = 'patient', extra = '') {
  return `qarevo_${portal}_csrf=${csrf}; __Host-qarevo_${portal}_access=${access(portal)}; __Host-qarevo_${portal}_refresh=${portal}-refresh${extra}`;
}
function req(endpoint, { portal = 'patient', method = 'GET', headers = {}, body, url = origin, cookies = cookie(portal) } = {}) {
  return new Request(url + endpoint, { method, headers: { Cookie: cookies, 'X-Qarevo-Session': `${portal}-family`, ...(method !== 'GET' && method !== 'HEAD' ? { Origin: new URL(url).origin, 'X-Qarevo-CSRF': csrf, 'Content-Type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body) } : {}) });
}
function run(request, portal = 'patient', fetchImpl = async () => Response.json({ ok: true }), environment = env, params) {
  return handlePortalRequest(request, { portal, path: params ?? new URL(request.url).pathname.split('/').filter(Boolean) }, { fetchImpl, env: environment });
}
function identity(portal = 'patient', extra = {}) {
  return { user_id: `${portal}-user`, role: roles[portal], provider_id: portal === 'doctor' ? 'doctor-profile' : null, session_id: `${portal}-family`, absolute_expires_at: '2030-01-01T00:00:00Z', server_time: new Date().toISOString(), ...extra };
}
function authResponse(extra = {}) { return Response.json({ access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 900, ...extra }); }

test('CSRF bootstrap is random, public, no-store and portal-specific without auth cookies', async () => {
  const first = await run(req('/api/v1/browser-csrf', { cookies: '' }), 'patient', undefined, env, ['csrf']);
  const token = (await first.json()).csrf_token;
  assert.match(token, /^[a-f0-9]{64}$/);
  const set = first.headers.get('set-cookie');
  assert.match(set, /qarevo_patient_csrf=/);
  assert.match(set, /Path=\/.*SameSite=Lax; Secure/);
  assert.doesNotMatch(set, /HttpOnly|Domain=/);
  assert.equal(first.headers.get('cache-control'), 'no-store, private');
  const second = await run(req('/csrf', { cookies: '' }), 'doctor', undefined, env, ['csrf']);
  assert.notEqual((await second.json()).csrf_token, token);
  assert.match(second.headers.get('set-cookie'), /qarevo_doctor_csrf=/);
});

test('CSRF bootstrap retains valid token so concurrent tabs do not invalidate one another', async () => {
  const response = await run(req('/csrf'), 'patient', undefined, env, ['csrf']);
  assert.equal((await response.json()).csrf_token, csrf);
});

test('unsafe requests require exact origin, same-site metadata and matching CSRF', async () => {
  for (const headers of [{ Origin: 'https://attacker.example' }, { Origin: '' }, { 'X-Qarevo-CSRF': 'b'.repeat(64) }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    let calls = 0;
    const response = await run(req('/api/v1/patient/settings', { method: 'PUT', body: {}, headers }), 'patient', async () => { calls++; return Response.json({}); });
    assert.equal(response.status, 403);
    assert.equal(calls, 0);
  }
});

test('duplicate scoped cookies fail closed instead of using an ambiguous domain cookie', async () => {
  const response = await run(req('/api/v1/session', { cookies: cookie('patient', '; __Host-qarevo_patient_access=forged') }));
  assert.equal(response.status, 400);
});

test('one portal cannot use another portal cookies or call its namespace', async () => {
  let calls = 0;
  const mock = async () => { calls++; return Response.json({}); };
  assert.equal((await run(req('/api/v1/patient/dashboard', { cookies: cookie('doctor') }), 'patient', mock)).status, 401);
  assert.equal((await run(req('/api/v1/doctor/workspace'), 'patient', mock)).status, 403);
  assert.equal((await run(req('/api/v1/auth/admin/login', { method: 'POST', body: {} }), 'patient', mock)).status, 403);
  assert.equal(calls, 0);
});

test('configured portal origins reject other logical scopes on that host', async () => {
  const bound = { ...env, PORTAL_PATIENT_ORIGIN: origin };
  assert.equal((await run(req('/api/v1/session', { portal: 'doctor' }), 'doctor', undefined, bound)).status, 403);
  assert.equal((await run(req('/api/v1/session'), 'patient', async () => Response.json(identity()), bound)).status, 200);
});

test('invalid portal, traversal, encoded separators and unknown namespaces never proxy', async () => {
  for (const segments of [['api', 'v1', '..', 'admin'], ['api', 'v1', 'patient%2Fadmin'], ['api', 'v1', 'patient', '..'], ['api', 'v1', 'patient', 'a/b'], ['internal', 'v1', 'patient'], ['api', 'v1', 'internal']]) {
    let calls = 0;
    assert.ok([403, 404].includes((await run(req('/anything'), 'patient', async () => { calls++; return Response.json({}); }, env, segments)).status));
    assert.equal(calls, 0);
  }
  assert.equal((await run(req('/api/v1/session'), 'owner')).status, 404);
});

test('upstream origin is fixed, secure and never taken from request headers or path', async () => {
  for (const base of ['http://api.qarevo.example', 'https://user:password@api.qarevo.example', 'https://api.qarevo.example/path', 'https://api.qarevo.example/?secret=1', 'file:///tmp/api']) {
    assert.equal((await run(req('/api/v1/session'), 'patient', undefined, { API_BASE_URL: base })).status, 503);
  }
  assert.equal((await run(req('/api/v1/session'), 'patient', undefined, {})).status, 503);
  assert.equal((await run(req('/api/v1/session', { url: 'http://dev.qarevo.example' }))).status, 400);
});

test('browser Authorization, cookies, forwarding and refresh headers are not trusted or forwarded', async () => {
  await run(req('/api/v1/patient/dashboard?limit=10', { headers: { Authorization: 'Bearer attacker', 'X-Qarevo-Refresh-Token': 'attacker-refresh', 'X-Forwarded-For': '1.1.1.1', Host: 'attacker.example' } }), 'patient', async (url, init) => {
    assert.equal(url.toString(), 'https://api.qarevo.example/api/v1/patient/dashboard?limit=10');
    assert.equal(init.headers.get('authorization'), `Bearer ${access('patient')}`);
    for (const name of ['cookie', 'x-qarevo-refresh-token', 'x-forwarded-for', 'host']) assert.equal(init.headers.get(name), null);
    assert.equal(init.redirect, 'manual');
    assert.equal(init.cache, 'no-store');
    return Response.json({ ok: true });
  });
});

test('public sign-in does not accidentally forward an existing identity', async () => {
  const response = await run(req('/api/v1/auth/login', { method: 'POST', body: { email: 'synthetic@example.test', password: 'not-a-real-secret' } }), 'patient', async (_url, init) => {
    assert.equal(init.headers.get('authorization'), null);
    assert.equal(init.headers.get('cookie'), null);
    return Response.json({ detail: 'Invalid credentials' }, { status: 401 });
  });
  assert.equal(response.status, 401);
});

for (const portal of Object.keys(roles)) test(`${portal} sign-in verifies role before issuing host-only HttpOnly cookies and strips all credentials`, async () => {
  const endpoint = portal === 'patient' ? '/api/v1/auth/login' : `/api/v1/auth/${portal}/login`;
  let calls = 0;
  const response = await run(req(endpoint, { portal, method: 'POST', body: {} }), portal, async (url, init) => {
    if (++calls === 1) return authResponse({ nested: { temp_token: 'never-expose', preserved: true } });
    assert.equal(url.pathname, '/api/v1/session');
    assert.equal(init.headers.Authorization, 'Bearer private-access');
    return Response.json(identity(portal));
  });
  assert.equal(calls, 2);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.browser_session, { user_id: `${portal}-user`, role: roles[portal], provider_id: portal === 'doctor' ? 'doctor-profile' : null, session_id: `${portal}-family` });
  assert.deepEqual(payload.nested, { preserved: true });
  assert.equal(payload.access_token, undefined);
  assert.equal(payload.refresh_token, undefined);
  const allCookies = response.headers.getSetCookie();
  assert.equal(allCookies.length, 3);
  assert.match(allCookies[0], new RegExp(`^__Host-qarevo_${portal}_access=private-access;`));
  assert.match(allCookies[1], new RegExp(`^__Host-qarevo_${portal}_refresh=private-refresh;`));
  for (const value of allCookies) {
    assert.match(value, /Path=\/; Expires=.*SameSite=Lax; Secure; HttpOnly$/);
    assert.doesNotMatch(value, /Domain=/);
  }
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
});

test('role mismatch, missing clinician identity, invalid deadline and failed session verification issue no cookies', async () => {
  const cases = [
    { data: identity('doctor'), portal: 'patient', status: 403 },
    { data: identity('doctor', { provider_id: null }), portal: 'doctor', status: 403 },
    { data: identity('patient', { session_id: '' }), portal: 'patient', status: 403 },
    { data: identity('patient', { absolute_expires_at: 'invalid' }), portal: 'patient', status: 401 },
    { data: identity('patient', { absolute_expires_at: '2020-01-01T00:00:00Z' }), portal: 'patient', status: 401 },
  ];
  for (const item of cases) {
    const endpoint = item.portal === 'doctor' ? '/api/v1/auth/doctor/login' : '/api/v1/auth/login';
    let count = 0;
    const response = await run(req(endpoint, { portal: item.portal, method: 'POST', body: {} }), item.portal, async () => ++count === 1 ? authResponse() : Response.json(item.data));
    assert.equal(response.status, item.status);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.doesNotMatch(await response.text(), /private-access|private-refresh/);
  }
  let count = 0;
  const unavailable = await run(req('/api/v1/auth/login', { method: 'POST', body: {} }), 'patient', async () => ++count === 1 ? authResponse() : Response.json({ detail: 'Down' }, { status: 500 }));
  assert.equal(unavailable.status, 502);
  assert.equal(unavailable.headers.get('set-cookie'), null);
});

test('physician MFA token stays HttpOnly and is used only for verify/resend operations', async () => {
  const challenge = await run(req('/api/v1/auth/doctor/login', { portal: 'doctor', method: 'POST', body: {} }), 'doctor', async () => Response.json({ temp_token: 'mfa-secret', expires_in: 600, email_verified: true }));
  const body = await challenge.json();
  assert.equal(body.mfa_pending, true);
  assert.equal(body.temp_token, undefined);
  assert.ok(challenge.headers.getSetCookie().some(value => value.startsWith('__Host-qarevo_doctor_mfa=mfa-secret;') && value.endsWith('; Secure; HttpOnly')));
  const response = await run(req('/api/v1/auth/mfa/resend-email', { portal: 'doctor', method: 'POST', body: {}, cookies: cookie('doctor', '; __Host-qarevo_doctor_mfa=stored-mfa'), headers: { Authorization: 'Bearer injected' } }), 'doctor', async (_url, init) => {
    assert.equal(init.headers.get('authorization'), 'Bearer stored-mfa');
    return Response.json({ message: 'Sent' });
  });
  assert.equal(response.status, 200);
  assert.equal((await run(req('/api/v1/auth/mfa/verify-email', { portal: 'doctor', method: 'POST', body: {} }), 'doctor')).status, 401);
});

test('refresh and logout inject only their portal refresh cookie, never the supplied body token', async () => {
  for (const endpoint of ['refresh', 'logout']) {
    const response = await run(req(`/api/v1/auth/${endpoint}`, { method: 'POST', body: { refresh_token: 'injected-refresh' } }), 'patient', async (_url, init) => {
      assert.equal(JSON.parse(init.body).refresh_token, 'patient-refresh');
      return Response.json({ message: endpoint }, { status: endpoint === 'refresh' ? 401 : 200 });
    });
    const values = response.headers.getSetCookie();
    assert.equal(values.length, 3);
    for (const value of values) {
      assert.match(value, /^__Host-qarevo_patient_/);
      assert.match(value, /Expires=Thu, 01 Jan 1970/);
      assert.doesNotMatch(value, /doctor|admin/);
    }
  }
});

test('shared session metadata is nonsecret and refresh header is injected on device/security actions only', async () => {
  const response = await run(req('/api/v1/session'), 'patient', async () => Response.json(identity()));
  assert.equal((await response.json()).browser_session.session_id, 'patient-family');
  assert.equal(response.headers.get('X-Qarevo-Session-Id'), 'patient-family');
  for (const endpoint of ['/api/v1/security', '/api/v1/patient/settings/active-devices']) {
    await run(req(endpoint), 'patient', async (_url, init) => {
      assert.equal(init.headers.get('X-Qarevo-Refresh-Token'), 'patient-refresh');
      return Response.json({});
    });
  }
});

test('stale tabs cannot mutate, refresh or log out a newer session and cannot clear its cookies', async () => {
  for (const endpoint of ['/api/v1/patient/settings', '/api/v1/auth/refresh', '/api/v1/auth/logout']) {
    for (const marker of ['older-family', '']) {
      let calls = 0;
      const response = await run(req(endpoint, { method: 'POST', body: {}, headers: { 'X-Qarevo-Session': marker } }), 'patient', async () => { calls++; return Response.json({}); });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).detail.error_code, 'SESSION_CHANGED');
      assert.equal(response.headers.get('set-cookie'), null);
      assert.equal(calls, 0);
    }
  }
});

test('session bootstrap alone accepts absent marker; a conflicting explicit marker is rejected', async () => {
  const bootstrap = await run(req('/api/v1/session', { headers: { 'X-Qarevo-Session': '' } }), 'patient', async () => Response.json(identity()));
  assert.equal(bootstrap.status, 200);
  assert.equal(bootstrap.headers.get('X-Qarevo-Session-Id'), 'patient-family');
  const changed = await run(req('/api/v1/session', { headers: { 'X-Qarevo-Session': 'old-family' } }));
  assert.equal(changed.status, 409);
});

test('social linking requires scoped auth and cannot request a different portal', async () => {
  assert.equal((await run(req('/api/v1/auth/social/google/link/start', { method: 'POST', body: {}, cookies: `qarevo_patient_csrf=${csrf}` }))).status, 401);
  assert.equal((await run(req('/api/v1/auth/social/google/start', { method: 'POST', body: { portal: 'PROVIDER' } }))).status, 403);
  assert.equal((await run(req('/api/v1/auth/social/providers', { portal: 'admin' }), 'admin')).status, 403);
});

test('binary uploads/downloads preserve bytes and safe headers without leaking upstream cookies', async () => {
  const bytes = new Uint8Array([0, 255, 1, 128]);
  const response = await run(req('/api/v1/patient/medical-records/upload', { method: 'POST', body: bytes, headers: { 'Content-Type': 'multipart/form-data; boundary=synthetic' } }), 'patient', async (_url, init) => {
    assert.deepEqual(new Uint8Array(init.body), bytes);
    assert.equal(init.headers.get('content-type'), 'multipart/form-data; boundary=synthetic');
    return new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="synthetic.bin"', 'Server-Timing': 'db;dur=8', 'X-Query-Count': '2', 'Retry-After': '30', 'Set-Cookie': 'global=bad; Domain=.example', 'Cache-Control': 'public' } });
  });
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="synthetic.bin"');
  assert.equal(response.headers.get('server-timing'), 'db;dur=8');
  assert.equal(response.headers.get('x-query-count'), '2');
  assert.equal(response.headers.get('retry-after'), '30');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
});

test('bounded uploads reject oversized declared and streamed bodies before upstream', async () => {
  for (const options of [{ body: '{}', headers: { 'Content-Length': String(5 * 1024 * 1024) } }, { body: new Uint8Array(4 * 1024 * 1024 + 1) }]) {
    let calls = 0;
    const response = await run(req('/api/v1/patient/medical-records/upload', { method: 'POST', ...options }), 'patient', async () => { calls++; return Response.json({}); });
    assert.equal(response.status, 413);
    assert.equal(calls, 0);
  }
});

test('redirects, credentials in query and upstream errors never become an open proxy or secret leak', async () => {
  assert.equal((await run(req('/api/v1/patient/dashboard?access_token=bad'))).status, 400);
  const redirected = await run(req('/api/v1/patient/dashboard'), 'patient', async () => new Response(null, { status: 307, headers: { Location: 'https://attacker.example' } }));
  assert.equal(redirected.status, 502);
  assert.equal(redirected.headers.get('location'), null);
  const error = await run(req('/api/v1/patient/dashboard'), 'patient', async () => Response.json({ detail: { message: 'Unavailable', refresh_token: 'private' } }, { status: 500 }));
  assert.equal(error.status, 500);
  assert.equal((await error.json()).detail.refresh_token, undefined);
  const network = await run(req('/api/v1/patient/dashboard'), 'patient', async () => { throw new Error('sensitive upstream URL/token'); });
  assert.equal(network.status, 502);
  assert.doesNotMatch(await network.text(), /sensitive/);
});

test('loopback development alone uses non-Secure development names', async () => {
  let count = 0;
  const response = await run(req('/api/v1/auth/login', { url: 'http://localhost:3000', method: 'POST', body: {}, cookies: `qarevo_patient_csrf=${csrf}` }), 'patient', async () => ++count === 1 ? authResponse() : Response.json(identity()), { API_BASE_URL: 'http://127.0.0.1:8000' });
  assert.equal(response.status, 200);
  assert.match(response.headers.getSetCookie()[0], /^qarevo_patient_access=/);
  assert.doesNotMatch(response.headers.getSetCookie()[0], /Secure|Domain=/);
  assert.match(response.headers.getSetCookie()[0], /HttpOnly/);
});

test('JSON arrays/null, structured JSON types, HEAD and no-content responses preserve supported shapes', async () => {
  for (const body of [null, [{ id: 'synthetic', temp_token: 'must-strip' }]]) {
    const response = await run(req('/api/v1/patient/appointments'), 'patient', async () => Response.json(body));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), body === null ? null : [{ id: 'synthetic' }]);
    assert.equal(response.headers.get('X-Qarevo-Session-Id'), 'patient-family');
  }
  const problem = await run(req('/api/v1/patient/dashboard'), 'patient', async () => new Response(JSON.stringify({ detail: 'Unavailable', access_token: 'secret' }), { status: 500, headers: { 'Content-Type': 'application/problem+json' } }));
  assert.equal(problem.status, 500);
  assert.equal((await problem.json()).access_token, undefined);
  for (const method of ['DELETE', 'HEAD']) {
    const response = await run(req('/api/v1/patient/settings/passkeys/synthetic', { method, ...(method === 'DELETE' ? { body: {} } : {}) }), 'patient', async () => new Response(null, { status: 204, headers: { 'Content-Type': 'application/json' } }));
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
  }
});

test('incomplete or non-JSON identity responses never leak credentials or issue cookies', async () => {
  for (const upstream of [Response.json({ access_token: 'secret' }), Response.json({ refresh_token: 'secret' }), Response.json(null), new Response('secret', { headers: { 'Content-Type': 'text/plain' } })]) {
    const response = await run(req('/api/v1/auth/login', { method: 'POST', body: {} }), 'patient', async () => upstream);
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.doesNotMatch(await response.text(), /secret/);
  }
});

test('route wrapper requires portal header and preserves existing API paths', () => {
  const wrapper = fs.readFileSync(path.join(__dirname, '../app/api/v1/[...path]/route.ts'), 'utf8');
  assert.match(wrapper, /request.headers.get\('X-Qarevo-Portal'\)/);
  assert.match(wrapper, /'api', 'v1', \.\.\.path/);
  assert.match(wrapper, /'browser-csrf'/);
});

test('proxy client context is signed only in Vercel with an explicit sufficient secret and valid overwritten IP', () => {
  const { signProxyContext } = loadServer('proxy-context');
  const request = new Request(origin + '/api/v1/patient/dashboard', { headers: {
    'X-Forwarded-For': '198.51.100.55', 'X-Qarevo-Client-IP': '198.51.100.99', 'X-Qarevo-Proxy-Signature': 'forged',
  } });
  const target = new URL('https://api.qarevo.example/api/v1/patient/dashboard?limit=10');
  const secret = 'synthetic-test-secret-at-least-32-characters';
  for (const environment of [{}, { VERCEL: '1' }, { VERCEL: '1', BROWSER_PROXY_SECRET: 'short' }, { VERCEL: '0', BROWSER_PROXY_SECRET: secret }]) {
    assert.equal(Object.keys(signProxyContext(request, target, environment)).length, 0);
  }
  assert.equal(Object.keys(signProxyContext(request, target, { VERCEL: '1', BROWSER_PROXY_SECRET: secret })).length, 0);
  for (const invalid of ['not-an-ip', '198.51.100.1, 198.51.100.2', '127.0.0.1:3000', '198.51.100.1\nforged']) {
    const headers = new Headers();
    // Native Headers rejects newlines before they can reach the signer.
    if (invalid.includes('\n')) { assert.throws(() => headers.set('x-vercel-forwarded-for', invalid)); continue; }
    headers.set('x-vercel-forwarded-for', invalid);
    assert.equal(Object.keys(signProxyContext(new Request(origin, { headers }), target, { VERCEL: '1', BROWSER_PROXY_SECRET: secret })).length, 0);
  }
});

test('proxy signature binds exact timestamp, method, path, query and client IP without exposing the secret', () => {
  const { signProxyContext } = loadServer('proxy-context');
  const { createHmac } = require('node:crypto');
  const secret = 'synthetic-test-secret-at-least-32-characters';
  const environment = { VERCEL: '1', BROWSER_PROXY_SECRET: secret };
  const target = new URL('https://api.qarevo.example/api/v1/patient/settings?version=2');
  for (const ip of ['198.51.100.12', '2001:db8::12']) {
    const request = new Request(origin + '/api/v1/patient/settings', { method: 'PUT', headers: { 'x-vercel-forwarded-for': ip, 'x-forwarded-for': '198.51.100.99' } });
    const result = signProxyContext(request, target, environment, 2_000_000_001_234);
    assert.equal(result['X-Qarevo-Client-IP'], ip);
    assert.equal(result['X-Qarevo-Proxy-Time'], '2000000001');
    const expected = createHmac('sha256', secret).update(`2000000001\nPUT\n/api/v1/patient/settings?version=2\n${ip}`).digest('hex');
    assert.equal(result['X-Qarevo-Proxy-Signature'], expected);
    assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));
    const nextTime = signProxyContext(request, target, environment, 2_000_000_002_234);
    assert.notEqual(nextTime['X-Qarevo-Proxy-Signature'], expected);
    const nextPath = signProxyContext(request, new URL('https://api.qarevo.example/api/v1/patient/settings?version=3'), environment, 2_000_000_001_234);
    assert.notEqual(nextPath['X-Qarevo-Proxy-Signature'], expected);
    const nextMethod = signProxyContext(new Request(origin, { headers: { 'x-vercel-forwarded-for': ip } }), target, environment, 2_000_000_001_234);
    assert.notEqual(nextMethod['X-Qarevo-Proxy-Signature'], expected);
  }
});

test('doctor registration phone verification is public only within the physician portal', async () => {
  for (const suffix of ['doctor/resend-phone-verification', 'doctor/verify-phone-code']) {
    let calls = 0
    const endpoint = `/api/v1/auth/${suffix}`
    const response = await run(req(endpoint, { portal: 'doctor', method: 'POST', body: { phone: '15123456789', country_code: '49', code: '123456' }, cookies: `qarevo_doctor_csrf=${csrf}` }), 'doctor', async (url, init) => {
      calls++
      assert.equal(url.pathname, endpoint)
      assert.equal(init.headers.get('Authorization'), null)
      return Response.json({ message: 'Synthetic verification response' })
    })
    assert.equal(response.status, 200)
    assert.equal(calls, 1)
    for (const portal of ['patient', 'admin']) {
      assert.equal((await run(req(endpoint, { portal, method: 'POST', body: {} }), portal)).status, 403)
    }
  }
})

 test('browser origin uses HTTP Host when Next constructs an internal localhost URL; forwarded host is ignored',async()=>{
  let calls=0;
  const request=req('/api/v1/auth/login',{url:'http://localhost:3000',cookies:`qarevo_patient_csrf=${csrf}`,method:'POST',body:{},headers:{Host:'127.0.0.1:3100',Origin:'http://127.0.0.1:3100','X-Forwarded-Host':'attacker.example'}});
  const result=await run(request,'patient',async()=>{calls++;return Response.json({detail:'Invalid credentials'},{status:401})});
  assert.equal(result.status,401);assert.equal(calls,1);
  const forged=req('/api/v1/auth/login',{url:'http://localhost:3000',cookies:`qarevo_patient_csrf=${csrf}`,method:'POST',body:{},headers:{Host:'127.0.0.1:3100',Origin:'https://attacker.example','X-Forwarded-Host':'attacker.example'}});
  assert.equal((await run(forged)).status,403);
});
 test('malformed HTTP Host is rejected before any upstream request',async()=>{
  for(const host of ['good.example,evil.example','good.example/evil','evil@example.test','good.example?bad']) {
    const result=await run(req('/api/v1/session',{headers:{Host:host}}));assert.equal(result.status,400);
  }
});

const requestUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
test('the boundary mints one reference per request, ignores browser/upstream IDs and preserves safe timing metadata', async () => {
  for (const portal of ['patient', 'doctor', 'admin']) {
    const forged = '11111111-1111-4111-8111-111111111111'; let forwarded;
    const response = await run(req(`/api/v1/${portal}/settings`, { portal, headers: { 'X-Request-ID': forged } }), portal, async (_url, init) => {
      forwarded = init.headers.get('X-Request-ID'); assert.match(forwarded, requestUuid); assert.notEqual(forwarded, forged);
      return Response.json({ detail: 'Synthetic service unavailable' }, { status: 503, headers: { 'X-Request-ID': 'malformed-upstream', 'Server-Timing': 'db;dur=4', 'X-Query-Count': '2', 'Set-Cookie': 'foreign=private; Domain=.example' } });
    });
    assert.equal(response.headers.get('X-Request-ID'), forwarded); assert.equal(response.status, 503);
    assert.equal(response.headers.get('server-timing'), 'db;dur=4'); assert.equal(response.headers.get('x-query-count'), '2');
    assert.equal(response.headers.get('set-cookie'), null); assert.equal(response.headers.get('cache-control'), 'no-store, private');
    assert.equal((await response.json()).detail, 'Synthetic service unavailable');
  }
});
test('local boundary failures and unavailable upstreams always return fresh references without sensitive exception data', async () => {
  const responses = [await run(req('/api/v1/patient/settings', { method: 'POST', body: {}, headers: { Origin: 'https://foreign.invalid' } })),
    await run(req('/api/v1/doctor/settings'), 'patient'), await run(req('/api/v1/patient/settings'), 'patient', async () => { throw new Error('Synthetic secret token https://private.invalid/clinical'); }),
    await run(req('/api/v1/patient/settings'), 'unknown'), await run(req('/api/v1/patient/settings'), 'patient', undefined, {})];
  const references = responses.map(response => response.headers.get('X-Request-ID'));
  references.forEach(value => assert.match(value, requestUuid)); assert.equal(new Set(references).size, references.length);
  for (const response of responses) { assert.equal(response.headers.get('cache-control'), 'no-store, private'); assert.doesNotMatch(await response.text(), /secret token|private.invalid|clinical/); }
});
test('login and its private identity verification share correlation without changing host-only cookies or browser payloads', async () => {
  const references = [];
  const response = await run(req('/api/v1/auth/login', { method: 'POST', body: { email: 'synthetic@example.test' } }), 'patient', async (url, init) => {
    references.push(init.headers instanceof Headers ? init.headers.get('X-Request-ID') : init.headers['X-Request-ID']);
    return new URL(url).pathname === '/api/v1/session' ? Response.json(identity()) : authResponse();
  });
  assert.equal(response.status, 200); assert.equal(references.length, 2); references.forEach(value => assert.equal(value, response.headers.get('X-Request-ID')));
  assert.match(response.headers.get('set-cookie'), /__Host-qarevo_patient_access=.*HttpOnly/); assert.doesNotMatch(response.headers.get('set-cookie'), /Domain=/);
  const body = await response.json(); assert.equal(body.access_token, undefined); assert.equal(body.refresh_token, undefined); assert.equal(body.browser_session.role, 'PATIENT');
});
test('CSRF bootstrap, no-content and HEAD keep their original body/cookie semantics with a boundary reference', async () => {
  const csrfResponse = await run(req('/api/v1/browser-csrf', { cookies: '' }), 'patient', undefined, env, ['csrf']); assert.match(csrfResponse.headers.get('X-Request-ID'), requestUuid); assert.match(csrfResponse.headers.get('set-cookie'), /qarevo_patient_csrf=/);
  for (const method of ['GET', 'HEAD']) { const response = await run(req('/api/v1/patient/settings', { method }), 'patient', async () => new Response(null, { status: 204 })); assert.match(response.headers.get('X-Request-ID'), requestUuid); assert.equal(response.status, 204); assert.equal(await response.text(), ''); }
});

test('local boundary failures produce one safe diagnostic with the exact returned reference', async () => {
  const events = [], sentinel = 'SyntheticPrivateClinicalToken', request = req('/api/v1/patient/' + sentinel + '?q=' + sentinel, { method: 'POST', body: { note: sentinel }, headers: { Origin: 'https://foreign.invalid/' + sentinel, 'X-Request-ID': sentinel, 'X-Sensitive': sentinel } });
  const response = await handlePortalRequest(request, { portal: 'patient', path: ['api', 'v1', 'patient', sentinel] }, { env, now: () => 10, diagnosticLogger: (level, event) => events.push({ level, event }), fetchImpl: async () => { throw new Error('Must not forward'); } });
  assert.equal(response.status, 403); assert.equal(events.length, 1); assert.equal(events[0].level, 'warn');
  assert.equal(events[0].event.request_id, response.headers.get('X-Request-ID')); assert.equal(events[0].event.route_template, '/api/v1/[...path]');
  assert.deepEqual(Object.keys(events[0].event).sort(), ['duration_ms', 'event', 'method', 'portal', 'request_id', 'route_template', 'status_code']);
  assert.equal(events[0].event.method, 'POST'); assert.equal(events[0].event.portal, 'patient'); assert.equal(events[0].event.status_code, 403);
  assert.doesNotMatch(JSON.stringify(events), new RegExp(sentinel + '|foreign.invalid|Origin|X-Sensitive|Cookie|Authorization|stack|note'));
});
test('upstream timeout and invalid portal diagnostics exclude exception text, raw route values and incoming references', async () => {
  const events = [], sentinel = 'SyntheticPrivateTimeout https://private.invalid/record', references = [];
  for (const portal of ['doctor', 'private-portal-sentinel']) {
    let tick = 0;
    const request = req('/api/v1/doctor/private-record?clinical=private-query-sentinel', { portal: 'doctor', headers: { 'X-Request-ID': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } });
    const response = await handlePortalRequest(request, { portal, path: ['api', 'v1', 'doctor', 'private-record'] }, { env, now: () => (tick++ ? 30001 : 0), diagnosticLogger: (level, event) => events.push({ level, event }), fetchImpl: async () => { throw new DOMException(sentinel, 'TimeoutError'); } });
    references.push(response.headers.get('X-Request-ID')); assert.equal(events.at(-1).event.request_id, references.at(-1));
    assert.equal(response.headers.get('cache-control'), 'no-store, private'); assert.doesNotMatch(await response.text(), /SyntheticPrivateTimeout|private.invalid|private-query-sentinel/);
  }
  assert.equal(events[0].level, 'error'); assert.equal(events[0].event.status_code, 502); assert.equal(events[0].event.duration_ms, 30001);
  assert.equal(events[1].event.portal, 'unknown'); assert.equal(events[1].event.status_code, 404);
  assert.doesNotMatch(JSON.stringify(events), /SyntheticPrivateTimeout|private.invalid|private-record|private-query-sentinel|private-portal-sentinel|aaaaaaaa-aaaa/);
});
test('slow successes log one warning while a failed sink cannot change response headers, bytes or cookies', async () => {
  let tick = 0; const events = [];
  const response = await handlePortalRequest(req('/api/v1/patient/settings'), { portal: 'patient', path: ['api', 'v1', 'patient', 'settings'] }, { env, now: () => tick++ ? 1250.4 : 0, diagnosticLogger: (level, event) => events.push({ level, event }), fetchImpl: async () => Response.json({ ok: true }) });
  assert.equal(response.status, 200); assert.equal(events.length, 1); assert.equal(events[0].level, 'warn'); assert.equal(events[0].event.event, 'bff_request_slow'); assert.equal(events[0].event.duration_ms, 1250); assert.equal(events[0].event.request_id, response.headers.get('X-Request-ID'));
  const failedSink = await handlePortalRequest(req('/api/v1/browser-csrf', { cookies: '' }), { portal: 'patient', path: ['csrf'] }, { env, fetchImpl: async () => { throw new Error('CSRF must not forward'); }, now: () => 1000 * tick++, diagnosticLogger: () => { throw new Error('Synthetic sink unavailable'); } });
  assert.equal(failedSink.status, 200); assert.match(failedSink.headers.get('X-Request-ID'), requestUuid); assert.match(failedSink.headers.get('set-cookie'), /qarevo_patient_csrf=.*SameSite=Lax; Secure/); assert.match((await failedSink.json()).csrf_token, /^[a-f0-9]{64}$/);
});

test('a rejected asynchronous diagnostic sink is isolated from the actual boundary response', async () => {
  const response = await handlePortalRequest(req('/api/v1/doctor/settings'), { portal: 'patient', path: ['api', 'v1', 'doctor', 'settings'] }, { env, fetchImpl: async () => Response.json({}), diagnosticLogger: async () => { throw new Error('Synthetic asynchronous sink failure'); } });
  assert.equal(response.status, 403); assert.match(response.headers.get('X-Request-ID'), requestUuid); assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.doesNotMatch(await response.text(), /asynchronous sink failure/);
})

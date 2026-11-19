const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { webcrypto } = require('node:crypto')

function providersFor(portal) {
  const mod = { exports: {} }, paths = []
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/social-auth.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports,
    require(name) {
      if (name === '@/lib/portal-scope') return { currentPortal: () => portal }
      if (name === '@/lib/portal-handoff') return {}
      if (name === '@/lib/api') return { apiGet: async path => { paths.push(path); return { google: { enabled: true }, apple: { enabled: false } } } }
      throw new Error('Unexpected import: ' + name)
    },
  })
  return { api: mod.exports, paths }
}

for (const [portal, role] of [['patient', 'PATIENT'], ['doctor', 'PROVIDER']]) {
  test(`${portal} social availability requests its canonical role`, async () => {
    const { api, paths } = providersFor(portal)
    const result = await api.socialProviders()
    assert.deepEqual(paths, [`/api/v1/auth/social/providers?portal=${role}`])
    assert.equal(result.google.enabled, true)
  })
}

test('administrator social availability stays disabled without calling patient or physician flows', async () => {
  const { api, paths } = providersFor('admin')
  const result = await api.socialProviders()
  assert.equal(paths.length, 0)
  assert.equal(result.google.enabled, false)
  assert.equal(result.apple.enabled, false)
})

for (const leavePage of [false, true]) test(`provider start ${leavePage ? 'does not redirect or retain a transaction after leaving its initiating page' : 'preserves PKCE and redirects while the initiating page remains active'}`, async () => {
  const mod = {exports:{}}, saved=[], redirects=[]
  let release, started, active=true
  const held=new Promise(resolve=>{release=resolve}), requested=new Promise(resolve=>{started=resolve})
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/social-auth.ts'),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText
  vm.runInNewContext(code,{
    module:mod,exports:mod.exports,URL,URLSearchParams,TextEncoder,crypto:webcrypto,btoa,
    window:{location:{origin:'https://web.qarevo.example',search:'',assign:url=>redirects.push(url)}},
    sessionStorage:{setItem:(key,value)=>saved.push({key,value:JSON.parse(value)})},
    require(name){
      if(name==='@/lib/portal-scope')return{}
      if(name==='@/lib/portal-handoff')return{safePortalDestination:()=>null}
      if(name==='@/lib/api')return{apiPost:async(path,body)=>{
        assert.equal(path,'/api/v1/auth/social/google/start')
        assert.equal(body.portal,'PATIENT');assert.match(body.challenge,/^[A-Za-z0-9_-]{43}$/)
        started();await held
        return{authorization_url:'https://accounts.google.com/o/oauth2/auth?redirect_uri=https%3A%2F%2Fweb.qarevo.example%2Fauth%2Fsocial%2Fcallback',state:'synthetic-state',expires_in:300}
      }}
      throw new Error('Unexpected import: '+name)
    },
  })
  const pending=mod.exports.beginSocial('google','PATIENT',undefined,()=>active)
  await requested
  if(leavePage)active=false
  release();await pending
  assert.equal(saved.length,leavePage?0:1)
  assert.equal(redirects.length,leavePage?0:1)
  if(!leavePage){assert.equal(saved[0].value.state,'synthetic-state');assert.match(saved[0].value.verifier,/^[A-Za-z0-9_-]{43}$/)}
})

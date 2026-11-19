import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'

/** Only Vercel's overwritten connection header is signed; browser headers are never relayed. */
export function signProxyContext(request: Request, target: URL, env: Record<string,string|undefined>, now = Date.now()): Record<string,string> {
  const secret=env.BROWSER_PROXY_SECRET
  if(!secret || secret.length<32 || env.VERCEL!=='1')return {}
  const ip=request.headers.get('x-vercel-forwarded-for')?.trim()
  if(!ip || !isIP(ip))return {}
  const timestamp=String(Math.floor(now/1000))
  const signature=createHmac('sha256',secret).update(`${timestamp}\n${request.method}\n${target.pathname}${target.search}\n${ip}`).digest('hex')
  return {'X-Qarevo-Client-IP':ip,'X-Qarevo-Proxy-Time':timestamp,'X-Qarevo-Proxy-Signature':signature}
}

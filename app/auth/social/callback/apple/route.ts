/** Apple's cross-site form_post is converted to a browser-only fragment, never logged as a query. */
export async function POST(request: Request) {
  const length = Number(request.headers.get('content-length') || 0)
  if (length > 16384) return new Response('Callback payload is too large.', {status:413})
  const form = await request.formData()
  const fragment = new URLSearchParams()
  for (const key of ['code','state','error']) {
    const value = form.get(key)
    if (typeof value === 'string' && value.length <= 4096) fragment.set(key,value)
  }
  const target = new URL('/auth/social/callback', request.url)
  target.hash = fragment.toString()
  return new Response(null,{status:303,headers:{Location:target.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})
}

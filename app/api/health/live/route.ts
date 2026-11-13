import { frontendLiveness } from '@/lib/server/build-revision'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(frontendLiveness(process.env.QAREVO_BUILD_REVISION), {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

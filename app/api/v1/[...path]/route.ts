import { handlePortalRequest } from '@/lib/server/portal-bff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ path: string[] }> };
async function handler(request: Request, context: Context) {
  const portal = request.headers.get('X-Qarevo-Portal') ?? '';
  const { path } = await context.params;
  return handlePortalRequest(request, { portal, path: path.length === 1 && path[0] === 'browser-csrf' ? ['csrf'] : ['api', 'v1', ...path] });
}

export { handler as GET, handler as HEAD, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as OPTIONS };

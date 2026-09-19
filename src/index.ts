import { routeAdminRequest } from './routes/admin.ts';
import { routeUserRequest } from './routes/user.ts';
import { requireAdmin, requireUser } from './utils/auth.ts';
import { getCorsOrigin } from './utils/cors.ts';
import { corsResponse, errorResponse } from './utils/response.ts';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = getCorsOrigin(request);
    const origin = cors.origin;

    if (!cors.allowed) return errorResponse(403, 'FORBIDDEN', 'Origin không được phép', '');

    if (request.method === 'OPTIONS') return corsResponse(origin);

    const pathname = new URL(request.url).pathname;
    if (pathname === '/' || pathname === '/info') {
      return new Response(JSON.stringify({
        name: 'math-kids-worker',
        version: '1.0.1',
        api: {
          admin: '/v1/admin',
          user: '/v1',
        },
      }), {
        headers: {
          'content-type': 'application/json',
          'Access-Control-Allow-Origin': origin || '*',
        },
      });
    }

    if (pathname === '/v1/admin' || pathname.startsWith('/v1/admin/')) {
      const auth = await requireAdmin(request, env, origin);
      if (!auth.ok) return auth.response;
      return routeAdminRequest(request, env, origin, pathname);
    }

    if (pathname === '/v1' || pathname.startsWith('/v1/')) {
      const auth = await requireUser(request, env, origin);
      if (!auth.ok) return auth.response;
      return routeUserRequest(request, env, origin, pathname, auth.payload.sub, auth.payload.role);
    }

    return errorResponse(404, 'NOT_FOUND', 'Endpoint not found', origin);
  },
} satisfies ExportedHandler<Env>;

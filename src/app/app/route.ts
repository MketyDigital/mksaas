import type { TenantRole } from '@/shared/db/schema/auth';
import { auth } from '@/shared/lib/auth';

function redirectTo(request: Request, pathname: string) {
  return Response.redirect(new URL(pathname, request.url), 307);
}

export async function GET(request: Request) {
  const session = await auth(request);
  if (!session?.user) return redirectTo(request, '/login');

  const roles = (session.user.roles ?? {}) as Record<string, TenantRole>;
  const tenantSlugs = Object.keys(roles);

  if (tenantSlugs.length === 0) return redirectTo(request, '/create-workspace');
  if (tenantSlugs.length === 1) return redirectTo(request, `/app/${tenantSlugs[0]}`);
  return redirectTo(request, '/select-tenant');
}

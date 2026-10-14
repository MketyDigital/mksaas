import { requireMailArchiveImportAccess } from '@/features/mail/server/archive-import-service';

function redirectToMigration(request: Request, tenantSlug: string, query: string) {
  const destination = new URL(`/app/${encodeURIComponent(tenantSlug)}/mail/migration?${query}`, request.url);
  return Response.redirect(destination, 303);
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const tenantSlug = requestUrl.searchParams.get('tenant')?.trim() || '';
  if (!/^[a-z0-9-]{2,63}$/.test(tenantSlug)) return new Response('Invalid tenant.', { status: 400 });

  const origin = request.headers.get('origin');
  if (origin !== requestUrl.origin) return new Response('Cross-origin upload rejected.', { status: 403 });

  await requireMailArchiveImportAccess(tenantSlug);
  return redirectToMigration(request, tenantSlug, 'error=upload-version');
}

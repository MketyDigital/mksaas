import { NextResponse } from 'next/server';

import { getCanonicalMketyPublicUrl } from '@/features/platform-content/public-host-routing';
import type { TenantRole } from '@/shared/db/schema/auth';
import { db } from '@/shared/db';
import { customDomains, tenants } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { eq } from 'drizzle-orm';

export default auth(async (request) => {
  const { pathname, hostname } = request.nextUrl;
  let effectivePathname = pathname;

  const canonicalPublicUrl = getCanonicalMketyPublicUrl(new URL(request.url));
  if (canonicalPublicUrl) {
    return NextResponse.redirect(canonicalPublicUrl, 308);
  }

  if (!pathname.startsWith('/t/') && hostname) {
    const appHost = (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_APP_URL || '').hostname;
      } catch {
        return '';
      }
    })();
    const vercelHost = process.env.VERCEL_URL || '';
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isKnownAppHost = hostname === appHost || hostname === vercelHost || hostname.endsWith('.vercel.app');

    if (!isLocalHost && !isKnownAppHost && !pathname.startsWith('/api/')) {
      try {
        const domain = await db.query.customDomains.findFirst({
          where: eq(customDomains.hostname, hostname.toLowerCase()),
        });
        if (domain?.status === 'verified') {
          const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, domain.tenantId) });
          if (tenant) {
            effectivePathname = `/t/${tenant.slug}${pathname === '/' ? '' : pathname}`;
            const rewriteUrl = request.nextUrl.clone();
            rewriteUrl.pathname = request.auth?.user ? effectivePathname : `/t/${tenant.slug}/login`;
            return NextResponse.rewrite(rewriteUrl);
          }
        }
      } catch {
        // Custom-domain routing must never break the normal application host.
      }
    }
  }

  const response = NextResponse.next();
  response.headers.set('x-pathname', effectivePathname);

  const tenantMatch = effectivePathname.match(/^\/t\/([^/]+)/);
  if (tenantMatch) {
    const tenantSlug = tenantMatch[1];
    response.headers.set('x-tenant-slug', tenantSlug);

    if (effectivePathname === `/t/${tenantSlug}/login`) return response;

    if (effectivePathname.match(/^\/t\/[^/]+\/admin/)) {
      const userRoles = request.auth?.user?.roles as Record<string, TenantRole> | undefined;
      const userRole = userRoles?.[tenantSlug];

      if (userRole !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = `/t/${tenantSlug}`;
        url.searchParams.set('error', 'unauthorized');
        return NextResponse.redirect(url);
      }

      response.headers.set('x-user-role', userRole);
    }
  }

  return response;
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
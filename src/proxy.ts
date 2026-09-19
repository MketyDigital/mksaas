import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getCanonicalMketyPublicUrl } from '@/features/platform-content/public-host-routing';
import { db } from '@/shared/db/cloudflare';
import { customDomains, tenants } from '@/shared/db/schema';
import type { TenantRole } from '@/shared/db/schema/auth';
import { auth } from '@/shared/lib/auth';

const MKETY_PUBLIC_PATHS = new Set([
  '/',
  '/platform',
  '/workspaces',
  '/solutions',
  '/academy',
  '/pricing',
  '/enterprise',
  '/about',
  '/privacy',
  '/terms',
  '/contact',
  '/login',
  '/signup',
  '/robots.txt',
  '/sitemap.xml',
  '/api/health',
  '/api/public/assistant',
  '/api/payments/enterprise/create',
]);

function isPublicPath(pathname: string): boolean {
  return (
    MKETY_PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/docs') ||
    pathname.startsWith('/api/docs') ||
    pathname.startsWith('/api/auth/') ||
    /^\/t\/[^/]+\/login$/.test(pathname)
  );
}

export default async function proxy(request: Request & { nextUrl?: URL }) {
  const nextUrl = request.nextUrl ?? new URL(request.url);
  const { pathname, hostname } = nextUrl;
  let effectivePathname = pathname;

  const canonicalPublicUrl = getCanonicalMketyPublicUrl(new URL(request.url));
  if (canonicalPublicUrl) {
    return NextResponse.redirect(canonicalPublicUrl, 308);
  }

  const appHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_APP_URL || '').hostname;
    } catch {
      return '';
    }
  })();
  const vercelHost = process.env.VERCEL_URL || '';
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isMketyPublicHost =
    hostname === 'mkety.com' ||
    hostname === appHost ||
    hostname === vercelHost ||
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.workers.dev') ||
    isLocalHost;

  if (isMketyPublicHost && isPublicPath(pathname)) {
    const response = NextResponse.next();
    response.headers.set('x-pathname', pathname);
    return response;
  }

  const session = await auth(request);

  if (!pathname.startsWith('/t/') && hostname) {
    const isKnownAppHost = isMketyPublicHost;

    if (!isLocalHost && !isKnownAppHost && !pathname.startsWith('/api/')) {
      try {
        const domain = await db.query.customDomains.findFirst({
          where: eq(customDomains.hostname, hostname.toLowerCase()),
        });
        if (domain?.status === 'verified') {
          const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, domain.tenantId) });
          if (tenant) {
            effectivePathname = `/t/${tenant.slug}${pathname === '/' ? '' : pathname}`;
            const rewriteUrl = new URL(request.url);
            rewriteUrl.pathname = session ? effectivePathname : `/t/${tenant.slug}/login`;
            return NextResponse.rewrite(rewriteUrl);
          }
        }
      } catch {
        // Custom-domain routing must never break the normal application host.
      }
    }
  }

  if (isPublicPath(effectivePathname)) {
    const response = NextResponse.next();
    response.headers.set('x-pathname', effectivePathname);
    return response;
  }

  if (effectivePathname === '/select-tenant' || effectivePathname.startsWith('/t/')) {
    if (!session) {
      const tenantMatch = effectivePathname.match(/^\/t\/([^/]+)/);
      const redirectPath = tenantMatch ? `/t/${tenantMatch[1]}/login` : '/login';
      const url = new URL(request.url);
      url.pathname = redirectPath;
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  const response = NextResponse.next();
  response.headers.set('x-pathname', effectivePathname);

  const tenantMatch = effectivePathname.match(/^\/t\/([^/]+)/);
  if (tenantMatch) {
    const tenantSlug = tenantMatch[1];
    response.headers.set('x-tenant-slug', tenantSlug);

    if (effectivePathname.match(/^\/t\/[^/]+\/admin/)) {
      const userRoles = session?.user?.roles as Record<string, TenantRole> | undefined;
      const userRole = userRoles?.[tenantSlug];

      if (userRole !== 'admin') {
        const url = new URL(request.url);
        url.pathname = `/t/${tenantSlug}`;
        url.searchParams.set('error', 'unauthorized');
        return NextResponse.redirect(url);
      }

      response.headers.set('x-user-role', userRole);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

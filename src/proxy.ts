import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getCanonicalMketyPublicUrl } from '@/features/platform-content/public-host-routing';
import { db } from '@/shared/db/cloudflare';
import { customDomains, tenants } from '@/shared/db/schema';
import type { TenantRole } from '@/shared/db/schema/auth';
import { auth } from '@/shared/lib/auth';


const LEGACY_PUBLIC_REDIRECTS = new Map<string, string>([
  ['/about-us', '/about'],
  ['/aboutus', '/about'],
  ['/services', '/solutions'],
  ['/service', '/solutions'],
  ['/contact-us', '/contact'],
  ['/contactus', '/contact'],
]);

const LEGACY_PUBLIC_GONE_PATHS = new Set(['/career', '/careers']);

function legacyPublicResponse(url: URL) {
  const host = url.hostname.toLowerCase();
  if (host !== 'mkety.com' && host !== 'www.mkety.com') return null;

  const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
  const target = LEGACY_PUBLIC_REDIRECTS.get(pathname.toLowerCase());
  if (target) {
    return NextResponse.redirect(new URL(target, 'https://mkety.com'), 308);
  }

  if (LEGACY_PUBLIC_GONE_PATHS.has(pathname.toLowerCase())) {
    return new NextResponse('Gone', {
      status: 410,
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  return null;
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/mail' ||
    pathname === '/api/health' ||
    pathname.startsWith('/docs') ||
    pathname.startsWith('/api/docs') ||
    pathname.startsWith('/api/auth/') ||
    /^\/t\/[^/]+\/login$/.test(pathname)
  );
}

export default async function proxy(request: Request & { nextUrl?: URL }) {
  const nextUrl = request.nextUrl ?? new URL(request.url);
  const { pathname, hostname } = nextUrl;
  const legacyResponse = legacyPublicResponse(new URL(request.url));
  if (legacyResponse) return legacyResponse;

  const session = await auth(request);
  let effectivePathname = pathname;
  const appHost=(() => { try { return new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://app.mkety.com').hostname.toLowerCase(); } catch { return 'app.mkety.com'; } })();
  const mailHost=(process.env.MKETY_MAIL_HOST||'mail.mkety.com').toLowerCase();
  const apiHost=(process.env.MKETY_API_HOST||'api.mkety.com').toLowerCase();
  const autoconfigHost=(process.env.MKETY_MAIL_AUTOCONFIG_HOST||'autoconfig.mkety.com').toLowerCase();
  const autodiscoverHost=(process.env.MKETY_MAIL_AUTODISCOVER_HOST||'autodiscover.mkety.com').toLowerCase();

  if(hostname.toLowerCase()===autoconfigHost){
    const url=new URL(request.url);
    url.pathname='/api/mail/autoconfig';
    return NextResponse.rewrite(url);
  }
  if(hostname.toLowerCase()===autodiscoverHost&&pathname.toLowerCase()==='/autodiscover/autodiscover.xml'){
    const url=new URL(request.url);
    url.pathname='/api/mail/autodiscover';
    return NextResponse.rewrite(url);
  }

  if(hostname.toLowerCase()===apiHost && pathname.startsWith('/v1/mail/')){
    const url=new URL(request.url);
    url.pathname='/api'+pathname;
    return NextResponse.rewrite(url);
  }

  if(hostname.toLowerCase()===appHost && pathname==='/'){
    const url=new URL(request.url);
    url.pathname='/app';
    url.search='';
    return NextResponse.redirect(url);
  }

  if(hostname.toLowerCase()===mailHost && (pathname==='/' || pathname==='/mail/app') && !session){
    let centralOrigin='https://app.mkety.com';
    try {
      centralOrigin=new URL(process.env.NEXT_PUBLIC_APP_URL || centralOrigin).origin;
    } catch {
      centralOrigin='https://app.mkety.com';
    }
    const url=new URL('/api/auth/product-handoff/start',centralOrigin);
    url.searchParams.set('product','mail');
    url.searchParams.set('returnTo','/mail/app');
    return NextResponse.redirect(url);
  }
  if(hostname.toLowerCase()===mailHost && pathname==='/' && session){
    const url=new URL(request.url);
    url.pathname='/mail/app';
    url.search='';
    return NextResponse.redirect(url);
  }

  const canonicalPublicUrl = getCanonicalMketyPublicUrl(new URL(request.url));
  if (canonicalPublicUrl) {
    return NextResponse.redirect(canonicalPublicUrl, 308);
  }

  if (!pathname.startsWith('/t/') && hostname) {
    const vercelHost = process.env.VERCEL_URL || '';
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isKnownAppHost =
      hostname === appHost ||
      hostname.toLowerCase() === mailHost ||
      hostname.toLowerCase() === apiHost ||
      hostname.toLowerCase() === autoconfigHost ||
      hostname.toLowerCase() === autodiscoverHost ||
      hostname === vercelHost ||
      hostname.endsWith('.vercel.app') ||
      hostname.endsWith('.workers.dev');

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

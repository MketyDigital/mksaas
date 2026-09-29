import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { resolveEnterpriseAiHostname } from '@/features/ai-runtime/server/enterprise-hostnames';
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

function getPublicHostProductRedirect(url: URL): URL | null {
  const host = url.hostname.toLowerCase();
  if (host !== 'mkety.com' && host !== 'www.mkety.com') return null;

  const pathname = url.pathname;
  const appOnly =
    pathname === '/app' ||
    pathname === '/select-tenant' ||
    pathname === '/create-workspace' ||
    pathname.startsWith('/t/');

  if (appOnly) {
    let appOrigin = 'https://app.mkety.com';
    try {
      appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || appOrigin).origin;
    } catch {
      appOrigin = 'https://app.mkety.com';
    }
    return new URL(pathname + url.search, appOrigin);
  }

  if (pathname === '/mail/app') return new URL(url.search, 'https://mail.mkety.com');
  if (pathname === '/ai/app') return new URL(url.search, 'https://ai.mkety.com');

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
  const requestUrl = new URL(request.url);
  const legacyResponse = legacyPublicResponse(requestUrl);
  if (legacyResponse) return legacyResponse;

  const productRedirect = getPublicHostProductRedirect(requestUrl);
  if (productRedirect) return NextResponse.redirect(productRedirect, 308);

  const session = await auth(request);
  let effectivePathname = pathname;
  const appHost=(() => { try { return new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://app.mkety.com').hostname.toLowerCase(); } catch { return 'app.mkety.com'; } })();
  const mailHost=(process.env.MKETY_MAIL_HOST||'mail.mkety.com').toLowerCase();
  const aiHost=(process.env.MKETY_AI_HOST||'ai.mkety.com').toLowerCase();
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

  if(hostname.toLowerCase()===apiHost && pathname.startsWith('/v1/')){
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

  if(hostname.toLowerCase()===aiHost && (pathname==='/' || pathname==='/ai/app') && !session){
    let centralOrigin='https://app.mkety.com';
    try {
      centralOrigin=new URL(process.env.NEXT_PUBLIC_APP_URL || centralOrigin).origin;
    } catch {
      centralOrigin='https://app.mkety.com';
    }
    const url=new URL('/api/auth/product-handoff/start',centralOrigin);
    url.searchParams.set('product','ai');
    url.searchParams.set('returnTo','/ai/app');
    return NextResponse.redirect(url);
  }
  if(hostname.toLowerCase()===aiHost && pathname==='/' && session){
    const url=new URL(request.url);
    url.pathname='/ai/app';
    url.search='';
    return NextResponse.redirect(url);
  }

  const canonicalPublicUrl = getCanonicalMketyPublicUrl(new URL(request.url));
  if (canonicalPublicUrl) {
    return NextResponse.redirect(canonicalPublicUrl, 308);
  }

  // Enterprise AI customer hostnames are routing context only. They resolve to the
  // same tenant/workspace and use a host-bound one-time auth handoff so no wildcard
  // cross-domain session cookie is required.
  if (!pathname.startsWith('/api/') && hostname.toLowerCase() !== aiHost) {
    try {
      const enterpriseHost = await resolveEnterpriseAiHostname(hostname);
      if (enterpriseHost) {
        if (!session) {
          const loginUrl = new URL(request.url);
          loginUrl.pathname = `/t/${enterpriseHost.tenant.slug}/login`;
          loginUrl.search = '';
          loginUrl.searchParams.set('enterpriseAiHost', hostname.toLowerCase());
          return NextResponse.rewrite(loginUrl);
        }

        const rewriteUrl = new URL(request.url);
        // Customer-owned and managed *.mkety.app hosts expose the customer app,
        // not Mkety's management console. Administration stays on ai.mkety.com/app.mkety.com.
        rewriteUrl.pathname = `/t/${enterpriseHost.tenant.slug}/enterprise-ai/customer`;
        rewriteUrl.search = '';
        return NextResponse.rewrite(rewriteUrl);
      }
    } catch {
      // Enterprise hostname lookup is fail-closed and must not break canonical hosts.
    }
  }

  if (!pathname.startsWith('/t/') && hostname) {
    const vercelHost = process.env.VERCEL_URL || '';
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isKnownAppHost =
      hostname === appHost ||
      hostname.toLowerCase() === mailHost ||
      hostname.toLowerCase() === aiHost ||
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

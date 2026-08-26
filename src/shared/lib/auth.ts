import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import NextAuth, { type NextAuthConfig, type Session } from 'next-auth';
import Auth0 from 'next-auth/providers/auth0';
import Credentials from 'next-auth/providers/credentials';

export type { Session };

import { db } from '@/shared/db';
import * as schema from '@/shared/db/schema';
import type { TenantRole } from '@/shared/db/schema/auth';
import { env } from '@/shared/lib/env';
import { getAllTenantPermissionsForUser } from '@/shared/lib/permissions';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      roles: Record<string, TenantRole>;
      permissions?: Record<string, string[]>;
    };
  }
}

const providers: NextAuthConfig['providers'] = [];

if (env.AUTH0_CLIENT_ID && env.AUTH0_CLIENT_SECRET && env.AUTH0_ISSUER) {
  providers.push(
    Auth0({
      clientId: env.AUTH0_CLIENT_ID,
      clientSecret: env.AUTH0_CLIENT_SECRET,
      issuer: env.AUTH0_ISSUER,
    }),
  );
}

// Explicitly opt into passwordless development/test login with ENABLE_TEST_LOGIN=true.
// This is intentionally disabled by default, including production deployments.
if (env.ENABLE_TEST_LOGIN) {
  providers.push(
    Credentials({
      id: 'development',
      name: 'Development Login',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'dev@example.com' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        if (!email) return null;

        let user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
        if (!user) {
          const [newUser] = await db
            .insert(schema.users)
            .values({ email, name: email.split('@')[0] })
            .returning();
          user = newUser;
        }

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  );
}

async function loadUserRoles(userId: string): Promise<Record<string, TenantRole>> {
  try {
    const memberships = await db.query.tenantMemberships.findMany({
      where: eq(schema.tenantMemberships.userId, userId),
      with: { tenant: true },
    });
    return Object.fromEntries(memberships.map((m) => [m.tenant.slug, m.role]));
  } catch {
    return {};
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
    authenticatorsTable: schema.authenticators,
  }),
  providers,
  session: {
    strategy: env.ENABLE_TEST_LOGIN ? 'jwt' : 'database',
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.roles = await loadUserRoles(user.id);
        token.permissions = await getAllTenantPermissionsForUser(user.id);
      }
      return token;
    },
    async session({ session, user, token }) {
      if (session.user) {
        const userId = user?.id ?? token?.id;
        if (typeof userId === 'string') {
          session.user.id = userId;
          session.user.roles = token?.roles
            ? (token.roles as Record<string, TenantRole>)
            : await loadUserRoles(userId);
          session.user.permissions = token?.permissions
            ? (token.permissions as Record<string, string[]>)
            : await getAllTenantPermissionsForUser(userId);
        } else {
          session.user.roles = {};
          session.user.permissions = {};
        }
      }
      return session;
    },
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const publicRoutes = ['/login', '/api/health', '/'];
      const isPublicRoute =
        publicRoutes.some((route) => pathname === route || pathname.startsWith('/api/auth')) ||
        pathname.startsWith('/docs') ||
        pathname.startsWith('/api/docs');
      if (isPublicRoute) return true;
      if (pathname.match(/^\/t\/[^/]+\/login$/)) return true;
      if (pathname === '/select-tenant') return isLoggedIn;
      if (pathname.startsWith('/t/')) return isLoggedIn;
      return true;
    },
  },
  trustHost: true,
  debug: env.ENABLE_TEST_LOGIN || env.NODE_ENV === 'development',
});

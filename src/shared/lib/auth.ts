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

async function ensureDevelopmentWorkspace(user: { id: string; email: string; name?: string | null; image?: string | null }) {
  if (!env.ENABLE_TEST_LOGIN) return;

  const existingMembership = await db.query.tenantMemberships.findFirst({
    where: eq(schema.tenantMemberships.userId, user.id),
    with: { tenant: true },
  });
  if (existingMembership) return;

  await db.transaction(async (tx) => {
    let tenant = await tx.query.tenants.findFirst({ where: eq(schema.tenants.slug, 'test-workspace') });

    if (!tenant) {
      const [createdTenant] = await tx
        .insert(schema.tenants)
        .values({
          name: 'Test Workspace',
          slug: 'test-workspace',
          description: 'Temporary workspace for testing the application before production authentication is configured.',
        })
        .returning();
      tenant = createdTenant;
    }

    const personName = (user.name || user.email.split('@')[0] || 'Test User').trim().split(/\s+/).filter(Boolean);
    const [person] = await tx
      .insert(schema.persons)
      .values({
        tenantId: tenant.id,
        email: user.email,
        firstName: personName[0] || 'Test',
        lastName: personName.slice(1).join(' ') || 'User',
        displayName: user.name?.trim() || user.email.split('@')[0] || 'Test User',
        avatarUrl: user.image || null,
        status: 'active',
        profileInitialized: true,
      })
      .returning();

    const [membership] = await tx
      .insert(schema.tenantMemberships)
      .values({
        tenantId: tenant.id,
        userId: user.id,
        personId: person.id,
        role: 'admin',
      })
      .returning();

    const existingAdminRole = await tx.query.roles.findFirst({
      where: eq(schema.roles.tenantId, tenant.id),
    });

    const adminRole = existingAdminRole
      ? existingAdminRole
      : (
          await tx
            .insert(schema.roles)
            .values({
              tenantId: tenant.id,
              name: 'Admin',
              slug: 'admin',
              description: 'Full workspace administration access',
              isSystem: true,
            })
            .returning()
        )[0];

    await tx.insert(schema.tenantMembershipRoles).values({ membershipId: membership.id, roleId: adminRole.id });
  });
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

        await ensureDevelopmentWorkspace({
          id: user.id,
          email: user.email!,
          name: user.name,
          image: user.image,
        });

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

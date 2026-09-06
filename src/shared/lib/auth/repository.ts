import { and, eq, gt, isNull } from 'drizzle-orm';

import { db } from '@/shared/db';
import { tenantMemberships, users } from '@/shared/db/schema/auth';
import { authLoginTransactions, authSessions, externalIdentities } from '@/shared/db/schema/mkety-auth';

import { generateOpaqueToken, hashToken } from './crypto';
import type { MketySession } from './types';

export interface CreateExternalIdentityInput {
  provider: string;
  subject: string;
  userId: string;
  email: string | null;
  name: string | null;
  image: string | null;
}

export interface CreateLoginTransactionInput {
  state: string;
  provider: string;
  verifier: string;
  nonce: string;
  returnTo: string;
  expiresAt: Date;
}

export async function findUserByExternalIdentity(provider: string, subject: string) {
  const identity = await db.query.externalIdentities.findFirst({
    where: and(eq(externalIdentities.provider, provider), eq(externalIdentities.subject, subject)),
  });
  if (!identity) return null;
  return db.query.users.findFirst({ where: eq(users.id, identity.userId) });
}

export async function createExternalIdentity(input: CreateExternalIdentityInput) {
  const [record] = await db
    .insert(externalIdentities)
    .values(input)
    .onConflictDoNothing({ target: [externalIdentities.provider, externalIdentities.subject] })
    .returning();

  if (record) return record;

  const existing = await db.query.externalIdentities.findFirst({
    where: and(eq(externalIdentities.provider, input.provider), eq(externalIdentities.subject, input.subject)),
  });
  if (!existing) throw new Error('Failed to persist external identity');
  return existing;
}

export async function findUserByEmail(email: string) {
  return db.query.users.findFirst({ where: eq(users.email, email) });
}

export async function createUser(input: { email: string | null; name: string | null; image: string | null }) {
  const [user] = await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      email: input.email,
      name: input.name,
      image: input.image,
    })
    .returning();
  if (!user) throw new Error('Failed to create Mkety user');
  return user;
}

export async function createLoginTransaction(input: CreateLoginTransactionInput) {
  await db.insert(authLoginTransactions).values(input);
}

export async function consumeLoginTransaction(state: string) {
  const now = new Date();
  const [transaction] = await db
    .delete(authLoginTransactions)
    .where(and(eq(authLoginTransactions.state, state), gt(authLoginTransactions.expiresAt, now)))
    .returning();
  return transaction ?? null;
}

export async function createSession(userId: string, expiresAt: Date) {
  const token = generateOpaqueToken();
  const tokenHash = await hashToken(token);
  const [session] = await db
    .insert(authSessions)
    .values({ userId, tokenHash, expiresAt })
    .returning({ id: authSessions.id, expiresAt: authSessions.expiresAt });
  if (!session) throw new Error('Failed to create Mkety session');
  return { token, expiresAt: session.expiresAt };
}

export async function getSessionByToken(token: string): Promise<MketySession | null> {
  const tokenHash = await hashToken(token);
  const now = new Date();
  const session = await db.query.authSessions.findFirst({
    where: and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, now)),
  });
  if (!session) return null;

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) return null;

  const memberships = await db.query.tenantMemberships.findMany({
    where: eq(tenantMemberships.userId, user.id),
    with: { tenant: { columns: { slug: true } } },
  });

  const roles = Object.fromEntries(memberships.map((membership) => [membership.tenant.slug, membership.role]));

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      roles,
      permissions: {},
    },
    expiresAt: session.expiresAt,
  };
}

export async function revokeSession(token: string) {
  const tokenHash = await hashToken(token);
  await db
    .update(authSessions)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)));
}

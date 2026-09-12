import { and, eq, gt, isNull } from 'drizzle-orm';

import { type Database, db } from '@/shared/db';
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

export async function findUserByExternalIdentity(provider: string, subject: string, database: Database = db) {
  const identity = await database.query.externalIdentities.findFirst({
    where: and(eq(externalIdentities.provider, provider), eq(externalIdentities.subject, subject)),
  });
  if (!identity) return null;
  return database.query.users.findFirst({ where: eq(users.id, identity.userId) });
}

export async function createExternalIdentity(input: CreateExternalIdentityInput, database: Database = db) {
  const [record] = await database
    .insert(externalIdentities)
    .values(input)
    .onConflictDoNothing({ target: [externalIdentities.provider, externalIdentities.subject] })
    .returning();

  if (record) return record;

  const existing = await database.query.externalIdentities.findFirst({
    where: and(eq(externalIdentities.provider, input.provider), eq(externalIdentities.subject, input.subject)),
  });
  if (!existing) throw new Error('Failed to persist external identity');
  return existing;
}

export async function findUserByEmail(email: string, database: Database = db) {
  return database.query.users.findFirst({ where: eq(users.email, email) });
}

export async function createUser(input: { email: string | null; name: string | null; image: string | null }, database: Database = db) {
  const [user] = await database
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

export async function createLoginTransaction(input: CreateLoginTransactionInput, database: Database = db) {
  await database.insert(authLoginTransactions).values(input);
}

export async function consumeLoginTransaction(state: string, database: Database = db) {
  const now = new Date();
  const [transaction] = await database
    .delete(authLoginTransactions)
    .where(and(eq(authLoginTransactions.state, state), gt(authLoginTransactions.expiresAt, now)))
    .returning();
  return transaction ?? null;
}

export async function createSession(userId: string, expiresAt: Date, database: Database = db) {
  const token = generateOpaqueToken();
  const tokenHash = await hashToken(token);
  const [session] = await database
    .insert(authSessions)
    .values({ userId, tokenHash, expiresAt })
    .returning({ id: authSessions.id, expiresAt: authSessions.expiresAt });
  if (!session) throw new Error('Failed to create Mkety session');
  return { token, expiresAt: session.expiresAt };
}

export async function getSessionByToken(token: string, database: Database = db): Promise<MketySession | null> {
  const tokenHash = await hashToken(token);
  const now = new Date();
  const session = await database.query.authSessions.findFirst({
    where: and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, now)),
  });
  if (!session) return null;

  const user = await database.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) return null;

  const memberships = await database.query.tenantMemberships.findMany({
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

export async function revokeSession(token: string, database: Database = db) {
  const tokenHash = await hashToken(token);
  await database
    .update(authSessions)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)));
}

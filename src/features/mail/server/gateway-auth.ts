import { and, eq, isNull } from 'drizzle-orm';

import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { db } from '@/shared/db/cloudflare';
import {
  mailAppPasswords,
  mailDomains,
  mailMailboxes,
  mailWorkspaces,
} from '@/shared/db/schema';

export function requireMailGatewaySecret(request: Request) {
  const expected = process.env.MKETY_MAIL_GATEWAY_INTERNAL_SECRET || '';
  return Boolean(expected) && request.headers.get('authorization') === `Bearer ${expected}`;
}

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

export async function verifyMailAppPasswordHash(secret: string, encoded: string) {
  if (!encoded.startsWith('{SSHA256}')) return false;
  let decoded: Uint8Array;
  try {
    decoded = decodeBase64(encoded.slice('{SSHA256}'.length));
  } catch {
    return false;
  }
  if (decoded.length <= 32) return false;
  const digest = decoded.slice(0, 32);
  const salt = decoded.slice(32);
  const secretBytes = new TextEncoder().encode(secret);
  const input = new Uint8Array(secretBytes.length + salt.length);
  input.set(secretBytes, 0);
  input.set(salt, secretBytes.length);
  const actual = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  return timingSafeEqual(actual, digest);
}

export async function authenticateExternalMailClient(username: string, password: string) {
  const address = username.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return null;
  if (!password.startsWith('mkmail-') || password.length > 128) return null;

  const at = address.lastIndexOf('@');
  const localPart = address.slice(0, at);
  const domainName = address.slice(at + 1);
  const domain = await db.query.mailDomains.findFirst({
    where: eq(mailDomains.domain, domainName),
  });
  if (!domain) return null;

  const [workspace, entitled, mailbox] = await Promise.all([
    db.query.mailWorkspaces.findFirst({
      where: and(
        eq(mailWorkspaces.tenantId, domain.tenantId),
        eq(mailWorkspaces.status, 'active'),
      ),
      columns: { id: true },
    }),
    hasEntitlement({
      tenantId: domain.tenantId,
      entitlement: 'workspace.mail',
    }),
    db.query.mailMailboxes.findFirst({
      where: and(
        eq(mailMailboxes.tenantId, domain.tenantId),
        eq(mailMailboxes.domainId, domain.id),
        eq(mailMailboxes.localPart, localPart),
        eq(mailMailboxes.status, 'active'),
      ),
    }),
  ]);
  if (!workspace || !entitled || !mailbox) return null;

  const credentials = await db.query.mailAppPasswords.findMany({
    where: and(
      eq(mailAppPasswords.tenantId, domain.tenantId),
      eq(mailAppPasswords.mailboxId, mailbox.id),
      isNull(mailAppPasswords.revokedAt),
    ),
  });

  for (const credential of credentials) {
    if (!password.startsWith(credential.passwordPrefix)) continue;
    if (!(await verifyMailAppPasswordHash(password, credential.passwordHash))) continue;
    await db.update(mailAppPasswords)
      .set({ lastUsedAt: new Date() })
      .where(eq(mailAppPasswords.id, credential.id));
    return {
      tenantId: domain.tenantId,
      mailboxId: mailbox.id,
      address,
      displayName: mailbox.displayName || '',
      domainId: domain.id,
      sendingEnabled: domain.sendingEnabled,
      routingEnabled: domain.routingEnabled,
    };
  }

  return null;
}

import { and, eq } from 'drizzle-orm';

import { db } from '../src/shared/db/node';
import { mailDomains, mailMailboxes, mailWorkspaces, tenants } from '../src/shared/db/schema';
import { normalizePlatformControlTenantSlug } from './normalize-platform-control-tenant-slug';

async function main() {
  const configuredSlug = process.env.MKETY_PLATFORM_CONTROL_TENANT_SLUG ?? '';
  const slug = normalizePlatformControlTenantSlug(configuredSlug);
  const matches = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(2);

  if (matches.length !== 1) {
    throw new Error('Platform Control tenant slug did not resolve to exactly one tenant.');
  }

  const tenantId = matches[0].id;
  const [workspace] = await db
    .select({ id: mailWorkspaces.id, status: mailWorkspaces.status })
    .from(mailWorkspaces)
    .where(eq(mailWorkspaces.tenantId, tenantId))
    .limit(1);

  const [domain] = await db
    .select({
      id: mailDomains.id,
      status: mailDomains.status,
      sendingEnabled: mailDomains.sendingEnabled,
      spfStatus: mailDomains.spfStatus,
      dkimStatus: mailDomains.dkimStatus,
      dmarcStatus: mailDomains.dmarcStatus,
    })
    .from(mailDomains)
    .where(and(eq(mailDomains.tenantId, tenantId), eq(mailDomains.domain, 'mail.mkety.com')))
    .limit(1);

  const [mailbox] = domain
    ? await db
        .select({ status: mailMailboxes.status })
        .from(mailMailboxes)
        .where(and(
          eq(mailMailboxes.tenantId, tenantId),
          eq(mailMailboxes.domainId, domain.id),
          eq(mailMailboxes.localPart, 'info'),
        ))
        .limit(1)
    : [];

  console.log(`MKETY_FIRST_PARTY_MAIL_TENANT_ID=${tenantId}`);
  console.log([
    'MKETY_FIRST_PARTY_MAIL_READINESS',
    `workspace=${workspace?.status ?? 'missing'}`,
    `domain=${domain?.status ?? 'missing'}`,
    `sending=${domain?.sendingEnabled ? 'enabled' : 'disabled'}`,
    `spf=${domain?.spfStatus ?? 'missing'}`,
    `dkim=${domain?.dkimStatus ?? 'missing'}`,
    `dmarc=${domain?.dmarcStatus ?? 'missing'}`,
    `info_mailbox=${mailbox ? mailbox.status : 'missing'}`,
  ].join(' '));
}

main()
  .then(() => process.exit(0))
  .catch(() => {
    console.error('First-party Mail tenant readiness lookup failed.');
    process.exit(1);
  });

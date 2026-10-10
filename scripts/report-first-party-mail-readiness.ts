import { and, eq } from 'drizzle-orm';

import { normalizePlatformControlTenantSlug } from './normalize-platform-control-tenant-slug';
import { db } from '../src/shared/db/node';
import { mailDomains, mailMailboxes, mailMailboxIngressAliases, mailWorkspaces, tenants } from '../src/shared/db/schema';

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
    .where(and(eq(mailDomains.tenantId, tenantId), eq(mailDomains.domain, 'mkety.com')))
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

  const [supportMailbox] = domain
    ? await db
        .select({ status: mailMailboxes.status })
        .from(mailMailboxes)
        .where(and(
          eq(mailMailboxes.tenantId, tenantId),
          eq(mailMailboxes.domainId, domain.id),
          eq(mailMailboxes.localPart, 'support'),
        ))
        .limit(1)
    : [];
  const [ingressDomain] = await db
    .select({ id: mailDomains.id, status: mailDomains.status, routingEnabled: mailDomains.routingEnabled })
    .from(mailDomains)
    .where(and(eq(mailDomains.tenantId, tenantId), eq(mailDomains.domain, 'mail.mkety.com')))
    .limit(1);
  const aliases = ingressDomain
    ? await db
        .select({ localPart: mailMailboxIngressAliases.localPart, status: mailMailboxIngressAliases.status })
        .from(mailMailboxIngressAliases)
        .where(and(
          eq(mailMailboxIngressAliases.tenantId, tenantId),
          eq(mailMailboxIngressAliases.domainId, ingressDomain.id),
        ))
    : [];

  console.log(`MKETY_FIRST_PARTY_MAIL_TENANT_ID=${tenantId}`);
  console.log([
    'MKETY_FIRST_PARTY_MAIL_READINESS',
    `workspace=${workspace?.status ?? 'missing'}`,
    `root_sending_domain=${domain?.status ?? 'missing'}`,
    `root_sending=${domain?.sendingEnabled ? 'enabled' : 'disabled'}`,
    `spf=${domain?.spfStatus ?? 'missing'}`,
    `dkim=${domain?.dkimStatus ?? 'missing'}`,
    `dmarc=${domain?.dmarcStatus ?? 'missing'}`,
    `info_mailbox=${mailbox ? mailbox.status : 'missing'}`,
    `support_mailbox=${supportMailbox?.status ?? 'missing'}`,
    `cloudflare_ingress=${ingressDomain?.routingEnabled ? 'enabled' : ingressDomain ? 'disabled' : 'missing'}`,
    `ingress_aliases_active=${aliases.filter((alias) => alias.status === 'active').length}`,
  ].join(' '));
}

main()
  .then(() => process.exit(0))
  .catch(() => {
    console.error('First-party Mail tenant readiness lookup failed.');
    process.exit(1);
  });

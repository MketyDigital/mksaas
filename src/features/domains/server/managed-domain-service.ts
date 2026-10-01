'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db } from '@/shared/db/cloudflare';
import { managedDomains, tenants } from '@/shared/db/schema';
import { requireTenantAdmin } from '@/shared/lib/rbac';

import {
  createCloudflareManagedZone,
  deleteCloudflareDnsRecord,
  findCloudflareManagedZone,
  getCloudflareManagedZone,
  listCloudflareDnsRecords,
  type MketyDnsRecordInput,
  saveCloudflareDnsRecord,
} from './cloudflare-saas';
import { getDomainResellerAdapter, type RegisteredDomain } from './reseller';

function normalizeDomain(value: string) {
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    throw new Error('Invalid managed domain.');
  }
  return domain;
}

function dnsNameForDomain(domain: string, value: string) {
  const raw = value.trim().toLowerCase().replace(/\.$/, '');
  if (!raw || raw === '@') return domain;
  const fqdn = raw.includes('.') ? raw : `${raw}.${domain}`;
  if (fqdn !== domain && !fqdn.endsWith(`.${domain}`)) {
    throw new Error('DNS record name must belong to this Mkety-managed domain.');
  }
  return fqdn;
}

async function tenantBySlug(tenantSlug: string) {
  return db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
}

async function managedDomainForTenant(tenantId: string, id: string) {
  return db.query.managedDomains.findFirst({
    where: and(eq(managedDomains.id, id), eq(managedDomains.tenantId, tenantId)),
  });
}

async function provisionManagedDomainDnsInternal(tenantId: string, managedDomainId: string) {
  const row = await managedDomainForTenant(tenantId, managedDomainId);
  if (!row) throw new Error('Managed domain not found.');

  const domain = normalizeDomain(row.domain);
  let zoneId = row.dnsZoneId;
  let nameServers = Array.isArray(row.nameServers) ? row.nameServers : [];

  if (!zoneId) {
    const zone = await findCloudflareManagedZone(domain) ?? await createCloudflareManagedZone(domain);
    zoneId = zone.id;
    nameServers = 'nameServers' in zone
      ? zone.nameServers
      : Array.isArray(zone.name_servers) ? zone.name_servers : [];
    await db.update(managedDomains).set({
      dnsZoneId: zoneId,
      dnsStatus: zone.status || 'pending',
      nameServers,
      updatedAt: new Date(),
    }).where(eq(managedDomains.id, row.id));
  } else {
    const zone = await getCloudflareManagedZone(zoneId);
    nameServers = Array.isArray(zone.name_servers) ? zone.name_servers : nameServers;
  }

  if (nameServers.length < 2) {
    throw new Error('Mkety DNS zone did not return authoritative nameservers.');
  }

  const registrar = await getDomainResellerAdapter();
  await registrar.setNameServers({
    providerDomainRef: row.providerDomainRef || domain,
    nameServers,
  });

  const zone = await getCloudflareManagedZone(zoneId);
  const dnsStatus = zone.status === 'active' ? 'active' : zone.status || 'pending';
  const [updated] = await db.update(managedDomains).set({
    dnsZoneId: zoneId,
    dnsStatus,
    nameServers,
    metadata: {
      ...(row.metadata ?? {}),
      dnsLastError: null,
      dnsLastProvisionedAt: new Date().toISOString(),
    },
    updatedAt: new Date(),
  }).where(eq(managedDomains.id, row.id)).returning();

  return updated ?? row;
}

export async function recordManagedDomainAfterRegistration(input: {
  tenantId: string;
  orderId: string;
  registered: RegisteredDomain;
}) {
  const domain = normalizeDomain(input.registered.domain);
  const existing = await db.query.managedDomains.findFirst({
    where: eq(managedDomains.domain, domain),
  });

  let row;
  if (existing) {
    if (existing.tenantId !== input.tenantId) {
      throw new Error('Registered domain is already owned by another Mkety tenant.');
    }
    [row] = await db.update(managedDomains).set({
      status: 'active',
      providerDomainRef: input.registered.providerDomainRef,
      registrationOrderId: input.orderId,
      expiresAt: input.registered.expiresAt,
      updatedAt: new Date(),
    }).where(eq(managedDomains.id, existing.id)).returning();
  } else {
    [row] = await db.insert(managedDomains).values({
      tenantId: input.tenantId,
      domain,
      status: 'active',
      providerDomainRef: input.registered.providerDomainRef,
      registrationOrderId: input.orderId,
      expiresAt: input.registered.expiresAt,
      dnsStatus: 'pending',
    }).returning();
  }
  if (!row) throw new Error('Mkety did not persist the registered domain.');

  try {
    return await provisionManagedDomainDnsInternal(input.tenantId, row.id);
  } catch (error) {
    await db.update(managedDomains).set({
      dnsStatus: 'pending',
      metadata: {
        ...(row.metadata ?? {}),
        dnsLastError: error instanceof Error ? error.message : 'DNS provisioning failed.',
        dnsLastAttemptAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    }).where(eq(managedDomains.id, row.id));
    return row;
  }
}

export async function listManagedDomains(tenantSlug: string) {
  const session = await requireTenantAdmin(tenantSlug);
  if (!session) throw new Error('Unauthorized.');
  const tenant = await tenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Tenant not found.');

  return db.query.managedDomains.findMany({
    where: eq(managedDomains.tenantId, tenant.id),
    orderBy: (table, { asc }) => [asc(table.domain)],
  });
}

export async function provisionManagedDomainDns(tenantSlug: string, managedDomainId: string) {
  const session = await requireTenantAdmin(tenantSlug);
  if (!session) throw new Error('Unauthorized.');
  const tenant = await tenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Tenant not found.');
  const result = await provisionManagedDomainDnsInternal(tenant.id, managedDomainId);
  revalidatePath(`/app/${tenantSlug}/admin/settings/domains`);
  return result;
}

export async function listManagedDnsRecords(tenantSlug: string, managedDomainId: string) {
  const session = await requireTenantAdmin(tenantSlug);
  if (!session) throw new Error('Unauthorized.');
  const tenant = await tenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Tenant not found.');
  const domain = await managedDomainForTenant(tenant.id, managedDomainId);
  if (!domain?.dnsZoneId) throw new Error('Mkety DNS is not provisioned for this domain.');
  const records = await listCloudflareDnsRecords(domain.dnsZoneId);
  const editable = new Set(['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV', 'CAA']);
  return records.filter((record) => editable.has(String(record.type).toUpperCase()));
}

export async function saveManagedDnsRecord(
  tenantSlug: string,
  managedDomainId: string,
  input: MketyDnsRecordInput,
) {
  const session = await requireTenantAdmin(tenantSlug);
  if (!session) throw new Error('Unauthorized.');
  const tenant = await tenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Tenant not found.');
  const domain = await managedDomainForTenant(tenant.id, managedDomainId);
  if (!domain?.dnsZoneId) throw new Error('Mkety DNS is not provisioned for this domain.');

  const result = await saveCloudflareDnsRecord(domain.dnsZoneId, {
    ...input,
    name: dnsNameForDomain(domain.domain, input.name),
  });
  revalidatePath(`/app/${tenantSlug}/admin/settings/domains/${managedDomainId}`);
  return result;
}

export async function removeManagedDnsRecord(
  tenantSlug: string,
  managedDomainId: string,
  recordId: string,
) {
  const session = await requireTenantAdmin(tenantSlug);
  if (!session) throw new Error('Unauthorized.');
  const tenant = await tenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Tenant not found.');
  const domain = await managedDomainForTenant(tenant.id, managedDomainId);
  if (!domain?.dnsZoneId) throw new Error('Mkety DNS is not provisioned for this domain.');

  await deleteCloudflareDnsRecord(domain.dnsZoneId, recordId);
  revalidatePath(`/app/${tenantSlug}/admin/settings/domains/${managedDomainId}`);
}

export async function setManagedDomainAutoRenew(
  tenantSlug: string,
  managedDomainId: string,
  enabled: boolean,
) {
  const session = await requireTenantAdmin(tenantSlug);
  if (!session) throw new Error('Unauthorized.');
  const tenant = await tenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Tenant not found.');
  const domain = await managedDomainForTenant(tenant.id, managedDomainId);
  if (!domain) throw new Error('Managed domain not found.');

  const [updated] = await db.update(managedDomains).set({
    autoRenew: enabled,
    updatedAt: new Date(),
  }).where(eq(managedDomains.id, domain.id)).returning();
  revalidatePath(`/app/${tenantSlug}/admin/settings/domains`);
  return updated ?? domain;
}

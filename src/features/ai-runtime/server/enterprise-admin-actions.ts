'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { createCloudflareSaasHostname } from '@/features/domains/server/cloudflare-saas';
import { getTenantSettings, updateTenantSettings } from '@/features/admin/services/settings-service';
import { hasEnterpriseAiWhiteLabelAccess } from '@/features/ai-runtime/server/access';
import { buildEnterpriseAiDnsInstructions } from '@/features/ai-runtime/server/enterprise-hostnames';
import { db } from '@/shared/db/cloudflare';
import { customDomains } from '@/shared/db/schema';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

function normalizeHostname(value: FormDataEntryValue | null) {
  const hostname = String(value ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)) {
    throw new Error('Enter a valid hostname such as ai.example.com.');
  }
  return hostname;
}

export async function saveEnterpriseAiWhiteLabel(tenantSlug: string, formData: FormData) {
  await requirePermission(tenantSlug, 'ai:enterprise:admin');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');
  if (!(await hasEnterpriseAiWhiteLabelAccess(tenant.id))) throw new Error('White-label access is not enabled.');

  const current = await getTenantSettings(tenantSlug);
  const whiteLabel = {
    enabled: true,
    brandName: String(formData.get('brandName') ?? '').trim() || tenant.name,
    productName: String(formData.get('productName') ?? '').trim() || 'AI Assistant',
    logoUrl: String(formData.get('logoUrl') ?? '').trim() || undefined,
    logoDarkUrl: String(formData.get('logoDarkUrl') ?? '').trim() || undefined,
    faviconUrl: String(formData.get('faviconUrl') ?? '').trim() || undefined,
    primaryColor: String(formData.get('primaryColor') ?? '').trim() || '#4F5BD5',
    secondaryColor: String(formData.get('secondaryColor') ?? '').trim() || '#7C6EAF',
    accentColor: String(formData.get('accentColor') ?? '').trim() || '#2BA8A4',
    supportEmail: String(formData.get('supportEmail') ?? '').trim() || undefined,
    supportUrl: String(formData.get('supportUrl') ?? '').trim() || undefined,
    privacyUrl: String(formData.get('privacyUrl') ?? '').trim() || undefined,
    termsUrl: String(formData.get('termsUrl') ?? '').trim() || undefined,
    legalName: String(formData.get('legalName') ?? '').trim() || undefined,
    loginHeading: String(formData.get('loginHeading') ?? '').trim() || undefined,
    loginSubheading: String(formData.get('loginSubheading') ?? '').trim() || undefined,
    managedSubdomain: String(formData.get('managedSubdomain') ?? '').trim().toLowerCase() || undefined,
    customHostname: current.enterpriseAi?.whiteLabel?.customHostname,
    hideMketyBranding: formData.get('hideMketyBranding') !== 'off',
  };

  await updateTenantSettings(tenantSlug, {
    enterpriseAi: {
      ...current.enterpriseAi,
      whiteLabel,
    },
  });
  revalidatePath(`/t/${tenantSlug}/enterprise-ai`);
  revalidatePath(`/t/${tenantSlug}/enterprise-ai/branding`);
}

export async function connectEnterpriseAiHostname(tenantSlug: string, formData: FormData) {
  await requirePermission(tenantSlug, 'ai:enterprise:admin');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');
  if (!(await hasEnterpriseAiWhiteLabelAccess(tenant.id))) throw new Error('White-label access is not enabled.');

  const hostname = normalizeHostname(formData.get('hostname'));
  const existing = await db.query.customDomains.findFirst({ where: eq(customDomains.hostname, hostname) });
  if (existing && existing.tenantId !== tenant.id) throw new Error('That hostname is already connected.');

  const provisioned = await createCloudflareSaasHostname(hostname);
  const metadata = JSON.stringify({
    purpose: 'enterprise-ai',
    cnameTarget: provisioned.cnameTarget,
    cloudflareCustomHostnameId: provisioned.id,
    sslStatus: provisioned.sslStatus,
  });
  const verification = JSON.stringify(provisioned.ownershipVerification ?? {});

  if (existing) {
    await db.update(customDomains).set({
      provider: 'cloudflare-for-saas',
      providerVerified: metadata,
      verification,
      status: provisioned.status === 'active' ? 'verified' : 'pending',
      updatedAt: new Date(),
    }).where(eq(customDomains.id, existing.id));
  } else {
    await db.insert(customDomains).values({
      tenantId: tenant.id,
      hostname,
      provider: 'cloudflare-for-saas',
      providerVerified: metadata,
      verification,
      status: provisioned.status === 'active' ? 'verified' : 'pending',
    });
  }

  const settings = await getTenantSettings(tenantSlug);
  await updateTenantSettings(tenantSlug, {
    enterpriseAi: {
      ...settings.enterpriseAi,
      whiteLabel: {
        ...settings.enterpriseAi?.whiteLabel,
        enabled: true,
        customHostname: hostname,
      },
    },
  });

  revalidatePath(`/t/${tenantSlug}/enterprise-ai/branding`);
  return buildEnterpriseAiDnsInstructions(hostname, provisioned.cnameTarget);
}

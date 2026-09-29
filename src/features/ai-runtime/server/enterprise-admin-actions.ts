'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import {
  createCloudflareSaasHostname,
  getCloudflareSaasHostname,
  provisionMketyAppManagedHostname,
  retryCloudflareSaasHostnameValidation,
} from '@/features/domains/server/cloudflare-saas';
import { getTenantSettings, updateTenantSettings } from '@/features/admin/services/settings-service';
import { hasEnterpriseAiAccess, hasEnterpriseAiWhiteLabelAccess } from '@/features/ai-runtime/server/access';
import { probeEnterpriseAiHostnameRoute } from '@/features/ai-runtime/server/domain-route-proof';
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
      defaultChannel: current.enterpriseAi?.defaultChannel ?? 'website',
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
  const strictProviderVerified =
    provisioned.status === 'active' && provisioned.sslStatus === 'active';
  const baseMetadata = {
    purpose: 'enterprise-ai',
    cnameTarget: provisioned.cnameTarget,
    cloudflareCustomHostnameId: provisioned.id,
    sslStatus: provisioned.sslStatus,
  };
  const initialMetadata = JSON.stringify({
    ...baseMetadata,
    verificationMethod: strictProviderVerified ? 'cloudflare' : 'pending',
    liveRouteVerifiedAt: null,
  });
  const initialVerification = JSON.stringify({
    provider: provisioned.ownershipVerification ?? {},
    liveRouteProof: null,
  });

  let domainId = existing?.id;
  if (existing) {
    await db.update(customDomains).set({
      provider: 'cloudflare-for-saas',
      providerVerified: initialMetadata,
      verification: initialVerification,
      status: strictProviderVerified ? 'verified' : 'pending',
      updatedAt: new Date(),
    }).where(eq(customDomains.id, existing.id));
  } else {
    const [created] = await db.insert(customDomains).values({
      tenantId: tenant.id,
      hostname,
      provider: 'cloudflare-for-saas',
      providerVerified: initialMetadata,
      verification: initialVerification,
      status: strictProviderVerified ? 'verified' : 'pending',
    }).returning({ id: customDomains.id });
    domainId = created?.id;
  }
  if (!domainId) throw new Error('Connected Enterprise AI hostname record could not be created.');

  if (!strictProviderVerified) {
    const liveRouteProof = await probeEnterpriseAiHostnameRoute(hostname, tenant.id);
    const liveVerified =
      liveRouteProof?.ok === true && liveRouteProof.tenantId === tenant.id;
    await db.update(customDomains).set({
      providerVerified: JSON.stringify({
        ...baseMetadata,
        verificationMethod: liveVerified ? 'live_route' : 'pending',
        liveRouteVerifiedAt: liveVerified ? new Date().toISOString() : null,
      }),
      verification: JSON.stringify({
        provider: provisioned.ownershipVerification ?? {},
        liveRouteProof,
      }),
      status: liveVerified ? 'verified' : 'pending',
      updatedAt: new Date(),
    }).where(eq(customDomains.id, domainId));
  }

  const settings = await getTenantSettings(tenantSlug);
  await updateTenantSettings(tenantSlug, {
    enterpriseAi: {
      defaultChannel: settings.enterpriseAi?.defaultChannel ?? 'website',
      whiteLabel: {
        ...settings.enterpriseAi?.whiteLabel,
        enabled: true,
        hideMketyBranding: settings.enterpriseAi?.whiteLabel?.hideMketyBranding ?? true,
        customHostname: hostname,
      },
    },
  });

  revalidatePath(`/t/${tenantSlug}/enterprise-ai/branding`);
}


export async function refreshEnterpriseAiHostname(tenantSlug: string, formData: FormData) {
  await requirePermission(tenantSlug, 'ai:enterprise:admin');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');

  const hostname = normalizeHostname(formData.get('hostname'));
  const domain = await db.query.customDomains.findFirst({ where: eq(customDomains.hostname, hostname) });
  if (!domain || domain.tenantId !== tenant.id || domain.provider !== 'cloudflare-for-saas') {
    throw new Error('Connected Enterprise AI hostname was not found.');
  }

  let metadata: {
    purpose?: string;
    cnameTarget?: string;
    cloudflareCustomHostnameId?: string;
    sslStatus?: string | null;
  } = {};
  try {
    metadata = domain.providerVerified ? JSON.parse(domain.providerVerified) : {};
  } catch {
    metadata = {};
  }
  if (metadata.purpose !== 'enterprise-ai' || !metadata.cloudflareCustomHostnameId) {
    throw new Error('Hostname provisioning metadata is incomplete.');
  }

  let current = await getCloudflareSaasHostname(metadata.cloudflareCustomHostnameId);
  if (current.status !== 'active' || current.ssl?.status !== 'active') {
    current = await retryCloudflareSaasHostnameValidation(metadata.cloudflareCustomHostnameId);
  }

  const strictProviderVerified =
    current.status === 'active' && current.ssl?.status === 'active';
  const liveRouteProof = strictProviderVerified
    ? null
    : await probeEnterpriseAiHostnameRoute(domain.hostname, tenant.id);
  const verified =
    strictProviderVerified ||
    (liveRouteProof?.ok === true && liveRouteProof.tenantId === tenant.id);
  const verificationMethod = strictProviderVerified
    ? 'cloudflare'
    : verified
      ? 'live_route'
      : 'pending';

  await db.update(customDomains).set({
    status: verified ? 'verified' : 'pending',
    providerVerified: JSON.stringify({
      ...metadata,
      sslStatus: current.ssl?.status ?? null,
      verificationMethod,
      liveRouteVerifiedAt:
        verified && verificationMethod === 'live_route'
          ? new Date().toISOString()
          : null,
    }),
    verification: JSON.stringify({
      provider: current.ownership_verification ?? {},
      liveRouteProof,
    }),
    updatedAt: new Date(),
  }).where(eq(customDomains.id, domain.id));

  revalidatePath(`/t/${tenantSlug}/enterprise-ai/branding`);
}


export async function provisionEnterpriseAiManagedHostname(tenantSlug: string, formData: FormData) {
  await requirePermission(tenantSlug, 'ai:enterprise:admin');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) throw new Error('Workspace not found.');
  if (!(await hasEnterpriseAiAccess(tenant.id))) throw new Error('Enterprise AI is not enabled.');

  const subdomain = String(formData.get('managedSubdomain') ?? '').trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
    throw new Error('Enter a valid managed subdomain.');
  }
  const hostname = `${subdomain}.mkety.app`;
  const existing = await db.query.customDomains.findFirst({ where: eq(customDomains.hostname, hostname) });
  if (existing && existing.tenantId !== tenant.id) throw new Error('That managed hostname is already assigned.');

  const provisioned = await provisionMketyAppManagedHostname(subdomain);
  const metadata = JSON.stringify({
    purpose: 'enterprise-ai',
    managed: true,
    cnameTarget: provisioned.cnameTarget,
    cloudflareCustomHostnameId: provisioned.id,
    sslStatus: provisioned.sslStatus,
  });

  if (existing) {
    await db.update(customDomains).set({
      provider: 'cloudflare-for-saas',
      providerVerified: metadata,
      verification: JSON.stringify({ managed: true }),
      status: provisioned.ready ? 'verified' : 'pending',
      updatedAt: new Date(),
    }).where(eq(customDomains.id, existing.id));
  } else {
    await db.insert(customDomains).values({
      tenantId: tenant.id,
      hostname,
      provider: 'cloudflare-for-saas',
      providerVerified: metadata,
      verification: JSON.stringify({ managed: true }),
      status: provisioned.ready ? 'verified' : 'pending',
    });
  }

  if (await hasEnterpriseAiWhiteLabelAccess(tenant.id)) {
    const settings = await getTenantSettings(tenantSlug);
    await updateTenantSettings(tenantSlug, {
      enterpriseAi: {
        defaultChannel: settings.enterpriseAi?.defaultChannel ?? 'website',
        whiteLabel: {
          ...settings.enterpriseAi?.whiteLabel,
          enabled: settings.enterpriseAi?.whiteLabel?.enabled ?? false,
          hideMketyBranding: settings.enterpriseAi?.whiteLabel?.hideMketyBranding ?? true,
          managedSubdomain: subdomain,
        },
      },
    });
  }

  revalidatePath(`/t/${tenantSlug}/enterprise-ai/branding`);
}

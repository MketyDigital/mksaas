import type { TenantSettings } from '@/shared/lib/tenant-settings';

export type EnterpriseAiBrand = {
  enabled: boolean;
  brandName: string;
  productName: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  supportEmail: string | null;
  supportUrl: string | null;
  privacyUrl: string | null;
  termsUrl: string | null;
  legalName: string | null;
  loginHeading: string;
  loginSubheading: string | null;
  managedSubdomain: string | null;
  customHostname: string | null;
  hideMketyBranding: boolean;
};

export function resolveEnterpriseAiBrand(settings: TenantSettings, fallbackTenantName: string): EnterpriseAiBrand {
  const whiteLabel = settings.enterpriseAi?.whiteLabel;
  const enabled = Boolean(whiteLabel?.enabled);
  const brandName = enabled && whiteLabel?.brandName ? whiteLabel.brandName : fallbackTenantName;
  const productName = enabled && whiteLabel?.productName ? whiteLabel.productName : 'AI Assistant';

  return {
    enabled,
    brandName,
    productName,
    logoUrl: enabled ? whiteLabel?.logoUrl ?? null : null,
    logoDarkUrl: enabled ? whiteLabel?.logoDarkUrl ?? null : null,
    faviconUrl: enabled ? whiteLabel?.faviconUrl ?? null : null,
    primaryColor: whiteLabel?.primaryColor ?? '#4F5BD5',
    secondaryColor: whiteLabel?.secondaryColor ?? '#7C6EAF',
    accentColor: whiteLabel?.accentColor ?? '#2BA8A4',
    supportEmail: whiteLabel?.supportEmail ?? null,
    supportUrl: whiteLabel?.supportUrl ?? null,
    privacyUrl: whiteLabel?.privacyUrl ?? null,
    termsUrl: whiteLabel?.termsUrl ?? null,
    legalName: whiteLabel?.legalName ?? null,
    loginHeading: whiteLabel?.loginHeading ?? `Sign in to ${brandName}`,
    loginSubheading: whiteLabel?.loginSubheading ?? null,
    managedSubdomain: whiteLabel?.managedSubdomain ?? null,
    customHostname: whiteLabel?.customHostname?.toLowerCase() ?? null,
    hideMketyBranding: enabled ? whiteLabel?.hideMketyBranding ?? true : false,
  };
}

export function managedEnterpriseAiHostname(subdomain: string) {
  return `${subdomain.toLowerCase()}.mkety.app`;
}

import { redirect } from 'next/navigation';

import { requirePermission } from '@/shared/lib/permissions';

export const PLATFORM_CONTROL_PERMISSION = 'admin:dashboard';
export const PLATFORM_CONTENT_PERMISSION = 'platform:content';
export const PLATFORM_APP_EXPERIENCE_PERMISSION = 'platform:app-experience';

export const PLATFORM_CONTROL_TENANT_ENV = 'MKETY_PLATFORM_CONTROL_TENANT_SLUG';
export const PLATFORM_CONTROL_ADMIN_EMAILS_ENV = 'MKETY_PLATFORM_ADMIN_EMAILS';
export const PLATFORM_CONTROL_OPERATOR_EMAILS_ENV = 'MKETY_PLATFORM_CONTROL_OPERATOR_EMAILS';

export type PlatformAdminArea = 'control-center' | 'public-content' | 'app-experience';

const permissionByArea: Record<PlatformAdminArea, string> = {
  'control-center': PLATFORM_CONTROL_PERMISSION,
  'public-content': PLATFORM_CONTENT_PERMISSION,
  'app-experience': PLATFORM_APP_EXPERIENCE_PERMISSION,
};

export function isPlatformControlTenant(tenantSlug: string) {
  const configuredSlug = process.env[PLATFORM_CONTROL_TENANT_ENV]?.trim();
  return Boolean(configuredSlug && configuredSlug === tenantSlug);
}

export function isPlatformOperatorEmail(email: string) {
  const configured = process.env[PLATFORM_CONTROL_ADMIN_EMAILS_ENV] ?? '';
  const allowed = new Set(
    configured
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  return allowed.has(email.trim().toLowerCase());
}

export function isPlatformControlOperatorEmail(email: string) {
  const allowed = (process.env[PLATFORM_CONTROL_OPERATOR_EMAILS_ENV] ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

export async function requirePlatformAdminArea(tenantSlug: string, area: PlatformAdminArea) {
  if (!isPlatformControlTenant(tenantSlug)) {
    redirect(`/t/${tenantSlug}?error=unauthorized`);
  }
  const actor = await requirePermission(tenantSlug, permissionByArea[area]);
  if (!isPlatformControlOperatorEmail(actor.email)) {
    redirect(`/t/${tenantSlug}?error=unauthorized`);
  }
  return actor;
}

export async function requirePlatformControlAccess(tenantSlug: string) {
  return requirePlatformAdminArea(tenantSlug, 'control-center');
}

export async function requirePlatformContentAccess(tenantSlug: string) {
  return requirePlatformAdminArea(tenantSlug, 'public-content');
}

export async function requirePlatformAppExperienceAccess(tenantSlug: string) {
  return requirePlatformAdminArea(tenantSlug, 'app-experience');
}

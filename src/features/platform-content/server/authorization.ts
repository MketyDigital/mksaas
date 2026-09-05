import { requirePermission } from '@/shared/lib/permissions';

export const PLATFORM_CONTROL_PERMISSION = 'admin:dashboard';
export const PLATFORM_CONTENT_PERMISSION = 'platform:content';
export const PLATFORM_APP_EXPERIENCE_PERMISSION = 'platform:app-experience';

export type PlatformAdminArea = 'control-center' | 'public-content' | 'app-experience';

const permissionByArea: Record<PlatformAdminArea, string> = {
  'control-center': PLATFORM_CONTROL_PERMISSION,
  'public-content': PLATFORM_CONTENT_PERMISSION,
  'app-experience': PLATFORM_APP_EXPERIENCE_PERMISSION,
};

export async function requirePlatformAdminArea(tenantSlug: string, area: PlatformAdminArea) {
  return requirePermission(tenantSlug, permissionByArea[area]);
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

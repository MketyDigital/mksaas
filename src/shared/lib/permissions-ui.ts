/**
 * UI helpers for permission-based visibility in client components.
 */

export function canShowNav(permissions: string[] | undefined, requiredPermission: string): boolean {
  if (permissions === undefined) return true;
  return permissions.includes('*') || permissions.includes(requiredPermission);
}

export function canShowNavAny(permissions: string[] | undefined, requiredPermissions: string[]): boolean {
  if (permissions === undefined) return true;
  return permissions.includes('*') || requiredPermissions.some((p) => permissions.includes(p));
}

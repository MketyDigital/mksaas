export type MailWorkspaceAccessMode = 'platform-operator' | 'tenant-member';

export function getMailWorkspaceAccessMode(tenantId: string, reservedTenantId: string): MailWorkspaceAccessMode {
  return reservedTenantId && tenantId === reservedTenantId ? 'platform-operator' : 'tenant-member';
}

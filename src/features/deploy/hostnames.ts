export type DeploymentHostnameKind = 'preview' | 'production';

export interface ResolvedDeploymentHostname {
  deploymentId: string;
  tenantId: string;
  providerDeploymentRef: string;
  kind: DeploymentHostnameKind;
  status: 'active';
}

export interface DeploymentHostnameRepository {
  findActiveByHostname(hostname: string): Promise<ResolvedDeploymentHostname | null>;
}

const RESERVED_LABELS = new Set([
  'www', 'api', 'app', 'admin', 'ops', 'static', 'assets', 'status', 'support', 'docs',
]);
const CUSTOMER_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Normalize a customer hostname, rejecting the apex and any multi-label host. */
export function normalizeMketyAppHostname(hostname: string): string | null {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
  const match = normalized.match(/^([^.]+)\.mkety\.app$/);
  if (!match) return null;
  const label = match[1];
  if (!CUSTOMER_LABEL.test(label) || RESERVED_LABELS.has(label)) return null;
  return `${label}.mkety.app`;
}

/** Allocate a stable single-label hostname with a suffix from a durable deployment id. */
export function createMketyAppHostname(projectSlug: string, stableDeploymentId: string): string {
  const slug = projectSlug.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 45)
    .replace(/-+$/g, '');
  const suffix = stableDeploymentId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(-10);
  if (suffix.length !== 10) throw new Error('A stable deployment id with at least 10 alphanumeric characters is required.');
  if (!slug) throw new Error('A project slug is required to allocate a customer hostname.');
  const hostname = `${slug}-${suffix}.mkety.app`;
  if (!normalizeMketyAppHostname(hostname)) throw new Error('The generated customer hostname is invalid or reserved.');
  return hostname;
}

export async function resolveMketyAppHostname(
  hostname: string,
  repository: DeploymentHostnameRepository,
): Promise<ResolvedDeploymentHostname | null> {
  const normalized = normalizeMketyAppHostname(hostname);
  if (!normalized) return null;
  return repository.findActiveByHostname(normalized);
}

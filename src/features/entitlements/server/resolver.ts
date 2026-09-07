import { ENTITLEMENT_KEYS, type EntitlementKey, isEntitlementKey } from '../entitlement-keys';
import type { EffectiveEntitlement, EntitlementCheckInput, EntitlementOverrideEffect } from '../types';

export interface EntitlementSource {
  getCurrentPlanVersionId(tenantId: string): Promise<string | null>;
  getPlanEntitlements(planVersionId: string): Promise<Array<{ entitlementKey: string; enabled: boolean }>>;
  getTenantOverrides(
    tenantId: string,
  ): Promise<Array<{ entitlementKey: string; effect: EntitlementOverrideEffect; expiresAt: Date | null }>>;
}

async function getDefaultSource(): Promise<EntitlementSource> {
  const { drizzleEntitlementSource } = await import('./drizzle-source');
  return drizzleEntitlementSource;
}

function isActive(expiresAt: Date | null, now: Date): boolean {
  return expiresAt === null || expiresAt.getTime() > now.getTime();
}

export async function getTenantEntitlements(
  tenantId: string,
  options: { now?: Date; source?: EntitlementSource } = {},
): Promise<EffectiveEntitlement[]> {
  const now = options.now ?? new Date();
  const source = options.source ?? (await getDefaultSource());

  const [planVersionId, overrides] = await Promise.all([
    source.getCurrentPlanVersionId(tenantId),
    source.getTenantOverrides(tenantId),
  ]);
  const planRows = planVersionId ? await source.getPlanEntitlements(planVersionId) : [];

  const activeOverrides = overrides.filter((override) => isActive(override.expiresAt, now));
  const planGrants = new Set(
    planRows
      .filter((row) => row.enabled && isEntitlementKey(row.entitlementKey))
      .map((row) => row.entitlementKey as EntitlementKey),
  );

  return ENTITLEMENT_KEYS.map((entitlement) => {
    const relevantOverrides = activeOverrides.filter((override) => override.entitlementKey === entitlement);
    if (relevantOverrides.some((override) => override.effect === 'deny')) {
      return { entitlement, allowed: false, source: 'tenant-deny' as const };
    }
    if (relevantOverrides.some((override) => override.effect === 'grant')) {
      return { entitlement, allowed: true, source: 'tenant-grant' as const };
    }
    if (planGrants.has(entitlement)) {
      return { entitlement, allowed: true, source: 'plan-version' as const };
    }
    return { entitlement, allowed: false, source: 'default-deny' as const };
  });
}

export async function hasEntitlement(
  input: EntitlementCheckInput,
  source?: EntitlementSource,
): Promise<boolean> {
  if (!isEntitlementKey(input.entitlement)) return false;

  const entitlements = await getTenantEntitlements(input.tenantId, { now: input.now, source });
  return entitlements.find((item) => item.entitlement === input.entitlement)?.allowed ?? false;
}

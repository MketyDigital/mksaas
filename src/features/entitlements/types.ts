import type { EntitlementKey } from './entitlement-keys';

export type EntitlementOverrideEffect = 'grant' | 'deny';

export interface EntitlementCheckInput {
  tenantId: string;
  entitlement: EntitlementKey | string;
  now?: Date;
}

export interface EffectiveEntitlement {
  entitlement: EntitlementKey;
  allowed: boolean;
  source: 'tenant-deny' | 'tenant-grant' | 'plan-version' | 'default-deny';
}

export class EntitlementDeniedError extends Error {
  readonly code = 'ENTITLEMENT_DENIED';

  constructor(readonly entitlement: string) {
    super('This tenant is not entitled to use the requested capability.');
    this.name = 'EntitlementDeniedError';
  }
}

import { type EntitlementSource, hasEntitlement } from './resolver';
import type { EntitlementCheckInput } from '../types';
import { EntitlementDeniedError } from '../types';

export async function requireEntitlement(
  input: EntitlementCheckInput,
  source?: EntitlementSource,
): Promise<void> {
  const allowed = await hasEntitlement(input, source);
  if (!allowed) {
    throw new EntitlementDeniedError(input.entitlement);
  }
}

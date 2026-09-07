import type { EntitlementCheckInput } from '../types';
import { EntitlementDeniedError } from '../types';
import { hasEntitlement, type EntitlementSource } from './resolver';

export async function requireEntitlement(
  input: EntitlementCheckInput,
  source?: EntitlementSource,
): Promise<void> {
  const allowed = await hasEntitlement(input, source);
  if (!allowed) {
    throw new EntitlementDeniedError(input.entitlement);
  }
}

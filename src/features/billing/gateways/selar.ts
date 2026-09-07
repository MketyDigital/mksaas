import type { NormalizedSettlement } from '../domain/settlement';
import { SELAR_CAPABILITIES } from './selar-capabilities';
import { parseVerifiedSettlementFields, toNormalizedSettlement } from './normalization';
import type { BillingGatewayAdapter, VerifiedGatewayEvent } from './types';

export function normalizeSelarSettlement(event: VerifiedGatewayEvent): NormalizedSettlement {
  if (event.provider !== 'selar') {
    throw new Error('Selar adapter received a different provider event.');
  }

  const { payload, fields } = parseVerifiedSettlementFields(event);
  if (payload.status !== 'successful') {
    throw new Error('Selar settlement must have successful payment status.');
  }

  return toNormalizedSettlement('selar', event, fields);
}

export const selarGatewayAdapter: BillingGatewayAdapter = {
  provider: 'selar',
  capabilities: SELAR_CAPABILITIES,
  async createCheckout() {
    throw new Error('Live Selar checkout integration is not configured in Billing core.');
  },
  async verifyIncomingEvent() {
    throw new Error('Live Selar webhook verification must be supplied by the provider integration boundary.');
  },
  normalizeSettlement: normalizeSelarSettlement,
};

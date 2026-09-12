import type { NormalizedSettlement } from '../domain/settlement';
import { NOWPAYMENTS_CAPABILITIES } from './nowpayments-capabilities';
import { parseVerifiedSettlementFields, toNormalizedSettlement } from './normalization';
import type { BillingGatewayAdapter, VerifiedGatewayEvent } from './types';

export function normalizeNowPaymentsSettlement(event: VerifiedGatewayEvent): NormalizedSettlement {
  if (event.provider !== 'nowpayments') {
    throw new Error('NOWPayments adapter received a different provider event.');
  }

  const { payload, fields } = parseVerifiedSettlementFields(event);
  if (payload.paymentStatus !== 'finished') {
    throw new Error('NOWPayments settlement requires final finished payment status.');
  }

  return toNormalizedSettlement('nowpayments', event, fields);
}

export const nowPaymentsGatewayAdapter: BillingGatewayAdapter = {
  provider: 'nowpayments',
  capabilities: NOWPAYMENTS_CAPABILITIES,
  async createCheckout() {
    throw new Error('Live NOWPayments checkout integration is not configured in Billing core.');
  },
  async verifyIncomingEvent() {
    throw new Error('Live NOWPayments webhook verification must be supplied by the provider integration boundary.');
  },
  normalizeSettlement: normalizeNowPaymentsSettlement,
};

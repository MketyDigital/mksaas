import type { NormalizedSettlement } from '../domain/settlement';
import type { GatewayCapabilities } from '../domain/types';

export interface CreateCheckoutInput {
  tenantId: string;
  subscriptionId: string;
  billingPeriodId: string;
  amountExpectedMinor: bigint;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutResult {
  provider: string;
  providerCheckoutId?: string;
  checkoutUrl: string;
  expiresAt?: Date;
}

export interface VerifiedGatewayEvent {
  provider: string;
  rawReference?: string;
  payload: unknown;
}

export interface BillingGatewayAdapter {
  readonly provider: string;
  readonly capabilities: GatewayCapabilities;

  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  verifyIncomingEvent(request: Request): Promise<VerifiedGatewayEvent>;
  normalizeSettlement(event: VerifiedGatewayEvent): NormalizedSettlement;
}

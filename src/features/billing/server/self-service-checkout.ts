import type { BillingGatewayAdapter } from '../gateways/types';
import { getSelfServiceBillingQuote, type SelfServiceBillingPlanKey, type SelfServiceBillingTermKey } from '../catalog/self-service-plans';

export interface PreparedSelfServiceCheckout {
  checkoutId: string;
  tenantId: string;
  subscriptionId: string;
  billingPeriodId: string;
  amountExpectedMinor: bigint;
  currency: string;
}

export interface SelfServiceCheckoutRepository {
  prepareCheckout(input: {
    tenantId: string;
    planKey: SelfServiceBillingPlanKey;
    termKey: SelfServiceBillingTermKey;
    provider: string;
    now: Date;
  }): Promise<PreparedSelfServiceCheckout>;

  markCheckoutReady(input: {
    checkoutId: string;
    providerCheckoutId?: string;
    checkoutUrl: string;
    expiresAt?: Date;
    settlementAmountExpectedMinor?: bigint;
    settlementCurrency?: string;
    updatedAt: Date;
  }): Promise<void>;

  markCheckoutFailed(input: {
    checkoutId: string;
    subscriptionId: string;
    updatedAt: Date;
  }): Promise<void>;
}

export async function createSelfServiceCheckout(
  repository: SelfServiceCheckoutRepository,
  adapter: BillingGatewayAdapter,
  input: {
    tenantId: string;
    planKey: SelfServiceBillingPlanKey;
    termKey: SelfServiceBillingTermKey;
    returnUrl: string;
    cancelUrl: string;
    customer?: {
      email: string;
      name?: string;
    };
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const quote = getSelfServiceBillingQuote(input.planKey, input.termKey);

  const prepared = await repository.prepareCheckout({
    tenantId: input.tenantId,
    planKey: input.planKey,
    termKey: input.termKey,
    provider: adapter.provider,
    now,
  });

  if (
    prepared.amountExpectedMinor !== quote.amountMinor ||
    prepared.currency !== quote.currency
  ) {
    throw new Error('Prepared checkout does not match the authoritative Mkety billing catalog.');
  }

  try {
    const gateway = await adapter.createCheckout({
      checkoutId: prepared.checkoutId,
      tenantId: prepared.tenantId,
      subscriptionId: prepared.subscriptionId,
      billingPeriodId: prepared.billingPeriodId,
      amountExpectedMinor: prepared.amountExpectedMinor,
      currency: prepared.currency,
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
      customer: input.customer,
    });

    await repository.markCheckoutReady({
      checkoutId: prepared.checkoutId,
      providerCheckoutId: gateway.providerCheckoutId,
      checkoutUrl: gateway.checkoutUrl,
      expiresAt: gateway.expiresAt,
      settlementAmountExpectedMinor: gateway.settlementAmountExpectedMinor,
      settlementCurrency: gateway.settlementCurrency,
      updatedAt: now,
    });

    return {
      checkoutId: prepared.checkoutId,
      subscriptionId: prepared.subscriptionId,
      checkoutUrl: gateway.checkoutUrl,
      provider: gateway.provider,
    };
  } catch (error) {
    await repository.markCheckoutFailed({
      checkoutId: prepared.checkoutId,
      subscriptionId: prepared.subscriptionId,
      updatedAt: now,
    });
    throw error;
  }
}

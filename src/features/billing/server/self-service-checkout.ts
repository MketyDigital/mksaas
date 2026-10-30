import type { SelfServiceBillingPlanKey, SelfServiceBillingTermKey } from '../catalog/self-service-plans';
import type { BillingGatewayAdapter } from '../gateways/types';

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
    providerAmountExpectedMinor?: bigint;
    providerCurrency?: string;
    providerPayCurrency?: string;
    expiresAt?: Date;
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
    collectionCurrency?: string;
    payCurrency?: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();

  const prepared = await repository.prepareCheckout({
    tenantId: input.tenantId,
    planKey: input.planKey,
    termKey: input.termKey,
    provider: adapter.provider,
    now,
  });


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
      collectionCurrency: input.collectionCurrency,
      payCurrency: input.payCurrency,
      customer: input.customer,
    });

    await repository.markCheckoutReady({
      checkoutId: prepared.checkoutId,
      providerCheckoutId: gateway.providerCheckoutId,
      checkoutUrl: gateway.checkoutUrl,
      providerAmountExpectedMinor: gateway.providerAmountExpectedMinor,
      providerCurrency: gateway.providerCurrency,
      providerPayCurrency: gateway.providerPayCurrency,
      expiresAt: gateway.expiresAt,
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

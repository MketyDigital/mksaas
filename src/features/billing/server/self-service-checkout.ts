import type { BillingGatewayAdapter } from '../gateways/types';
import { getSelfServiceBillingPlan, type SelfServiceBillingPlanKey } from '../catalog/self-service-plans';

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
    provider: string;
    now: Date;
  }): Promise<PreparedSelfServiceCheckout>;

  markCheckoutReady(input: {
    checkoutId: string;
    providerCheckoutId?: string;
    checkoutUrl: string;
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
    returnUrl: string;
    cancelUrl: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const catalogPlan = getSelfServiceBillingPlan(input.planKey);

  const prepared = await repository.prepareCheckout({
    tenantId: input.tenantId,
    planKey: input.planKey,
    provider: adapter.provider,
    now,
  });

  if (
    prepared.amountExpectedMinor !== catalogPlan.amountMinor ||
    prepared.currency !== catalogPlan.currency
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
    });

    await repository.markCheckoutReady({
      checkoutId: prepared.checkoutId,
      providerCheckoutId: gateway.providerCheckoutId,
      checkoutUrl: gateway.checkoutUrl,
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

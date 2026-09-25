import { eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import {
  billingCheckouts,
  billingSubscriptions,
} from '@/shared/db/schema';

export interface BillingCheckoutSettlementContext {
  checkoutId: string;
  subscriptionId: string;
  billingPeriodId: string;
  amountExpectedMinor: bigint;
  currency: string;
  settlementAmountExpectedMinor: bigint;
  settlementCurrency: string;
  provider: string;
}

export async function findBillingCheckoutSettlementContext(
  checkoutId: string,
): Promise<BillingCheckoutSettlementContext | null> {
  const [checkout] = await db
    .select({
      checkoutId: billingCheckouts.id,
      subscriptionId: billingCheckouts.subscriptionId,
      billingPeriodId: billingCheckouts.billingPeriodId,
      amountExpectedMinor: billingCheckouts.amountExpectedMinor,
      currency: billingCheckouts.currency,
      settlementAmountExpectedMinor: billingCheckouts.settlementAmountExpectedMinor,
      settlementCurrency: billingCheckouts.settlementCurrency,
      provider: billingCheckouts.provider,
    })
    .from(billingCheckouts)
    .where(eq(billingCheckouts.id, checkoutId))
    .limit(1);

  if (!checkout) return null;
  return {
    ...checkout,
    settlementAmountExpectedMinor: checkout.settlementAmountExpectedMinor ?? checkout.amountExpectedMinor,
    settlementCurrency: checkout.settlementCurrency ?? checkout.currency,
  };
}

export async function markBillingCheckoutAwaitingConfirmation(
  checkoutId: string,
  updatedAt: Date,
): Promise<void> {
  await db
    .update(billingCheckouts)
    .set({ status: 'awaiting_confirmation', updatedAt })
    .where(eq(billingCheckouts.id, checkoutId));
}

export async function markBillingCheckoutCompleted(
  checkoutId: string,
  updatedAt: Date,
): Promise<void> {
  await db
    .update(billingCheckouts)
    .set({ status: 'completed', updatedAt })
    .where(eq(billingCheckouts.id, checkoutId));
}

export async function markBillingCheckoutTerminalFailure(
  checkoutId: string,
  subscriptionId: string,
  reason: string,
  updatedAt: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(billingCheckouts)
      .set({ status: 'failed', updatedAt })
      .where(eq(billingCheckouts.id, checkoutId));

    await tx
      .update(billingSubscriptions)
      .set({
        status: 'cancelled',
        cancelledAt: updatedAt,
        cancellationReason: reason,
        updatedAt,
      })
      .where(eq(billingSubscriptions.id, subscriptionId));
  });
}

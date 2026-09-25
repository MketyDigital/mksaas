import type { NormalizedSettlement } from '@/features/billing/domain/settlement';
import {
  findBillingCheckoutSettlementContext,
  markBillingCheckoutAwaitingConfirmation,
  markBillingCheckoutCompleted,
  markBillingCheckoutTerminalFailure,
} from '@/features/billing/server/drizzle-checkout-settlement';
import { createDrizzleBillingRepository } from '@/features/billing/server/drizzle-repository';
import { applyVerifiedSettlement } from '@/features/billing/server/settlement-service';
import { enterpriseOrderRepository } from '@/features/enterprise-checkout/server/repository';
import { db } from '@/shared/db';

import type { MketyPaymentSource } from './reference';

function decimalToMinor(value: unknown): bigint {
  const normalized =
    typeof value === 'number'
      ? value.toFixed(2)
      : typeof value === 'string'
        ? value.trim()
        : '';
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error('Provider returned an invalid payment amount.');
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getTargetId(source: MketyPaymentSource, targetUuid: string | undefined, providerData: Record<string, unknown>) {
  const meta = metadataRecord(providerData.meta ?? providerData.metadata);
  if (source === 'saas') return targetUuid ?? (typeof meta.checkout_id === 'string' ? meta.checkout_id : '');
  if (source === 'enterprise') return targetUuid ? `MKETY-ENT-${targetUuid}` : (typeof meta.order_id === 'string' ? meta.order_id : '');
  if (source === 'media') return typeof meta.invoice_id === 'string' ? meta.invoice_id : '';
  if (source === 'host') return typeof meta.invoice_id === 'string' ? meta.invoice_id : '';
  return '';
}

async function applySaasSettlement(input: {
  checkoutId: string;
  provider: 'flutterwave' | 'kora';
  providerPaymentId: string;
  providerEventId: string;
  amountPaidMinor: bigint;
  currencyPaid: string;
  status: 'success' | 'pending' | 'failed';
  rawReference: string;
  occurredAt: Date;
}) {
  const context = await findBillingCheckoutSettlementContext(input.checkoutId);
  if (!context || context.provider !== input.provider) throw new Error('Billing checkout not found.');

  if (input.status === 'failed') {
    await markBillingCheckoutTerminalFailure(
      input.checkoutId,
      context.subscriptionId,
      `${input.provider}_failed`,
      input.occurredAt,
    );
    return { settled: false, status: 'failed' as const };
  }
  if (input.status !== 'success') {
    await markBillingCheckoutAwaitingConfirmation(input.checkoutId, input.occurredAt);
    return { settled: false, status: 'pending' as const };
  }

  if (input.currencyPaid !== context.currency || input.amountPaidMinor !== context.amountExpectedMinor) {
    throw new Error('Provider settlement does not match the Mkety billing period.');
  }

  const settlement: NormalizedSettlement = {
    provider: input.provider,
    providerPaymentId: input.providerPaymentId,
    providerEventId: input.providerEventId,
    subscriptionId: context.subscriptionId,
    billingPeriodId: context.billingPeriodId,
    amountExpectedMinor: context.amountExpectedMinor,
    currencyExpected: context.currency,
    amountPaidMinor: input.amountPaidMinor,
    currencyPaid: input.currencyPaid,
    status: 'verified_success',
    occurredAt: input.occurredAt,
    rawReference: input.rawReference,
  };

  const repository = createDrizzleBillingRepository(db);
  const result = await applyVerifiedSettlement(repository, settlement, input.occurredAt);
  await markBillingCheckoutCompleted(input.checkoutId, input.occurredAt);
  return { settled: true, status: result.status };
}

async function applyEnterpriseSettlement(input: {
  orderId: string;
  provider: 'flutterwave' | 'kora';
  providerPaymentId: string;
  amountPaidMinor: bigint;
  currencyPaid: string;
  status: 'success' | 'pending' | 'failed';
}) {
  const order = await enterpriseOrderRepository.findById(input.orderId);
  if (!order || order.paymentProvider !== input.provider) throw new Error('Enterprise order not found.');

  if (input.status === 'success') {
    if (input.currencyPaid !== order.currency || input.amountPaidMinor !== order.amountMinor) {
      throw new Error('Provider settlement does not match the Mkety enterprise order.');
    }
    await enterpriseOrderRepository.applyPaymentState({
      orderId: input.orderId,
      paymentStatus: 'confirmed',
      checkoutStatus: 'completed',
      providerPaymentReference: input.providerPaymentId,
      metadata: { lastProviderStatus: 'success' },
    });
    return { settled: true, status: 'confirmed' as const };
  }

  await enterpriseOrderRepository.applyPaymentState({
    orderId: input.orderId,
    paymentStatus: input.status === 'failed' ? 'failed' : 'pending',
    checkoutStatus: input.status === 'failed' ? 'failed' : 'awaiting_confirmation',
    providerPaymentReference: input.providerPaymentId,
    metadata: { lastProviderStatus: input.status },
  });
  return { settled: false, status: input.status };
}

export async function routeVerifiedMketyPayment(input: {
  source: MketyPaymentSource;
  targetUuid?: string;
  provider: 'flutterwave' | 'kora';
  reference: string;
  providerPaymentId: string;
  providerEventId: string;
  amount: unknown;
  currency: unknown;
  status: 'success' | 'pending' | 'failed';
  providerData: Record<string, unknown>;
  occurredAt?: Date;
}) {
  const targetId = getTargetId(input.source, input.targetUuid, input.providerData);
  const amountPaidMinor = decimalToMinor(input.amount);
  const currencyPaid = String(input.currency ?? '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyPaid)) throw new Error('Provider returned an invalid payment currency.');

  if (input.source === 'saas') {
    if (!targetId) throw new Error('Mkety billing checkout reference is invalid.');
    return applySaasSettlement({
      checkoutId: targetId,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      providerEventId: input.providerEventId,
      amountPaidMinor,
      currencyPaid,
      status: input.status,
      rawReference: input.reference,
      occurredAt: input.occurredAt ?? new Date(),
    });
  }

  if (input.source === 'enterprise') {
    if (!targetId) throw new Error('Mkety enterprise order reference is invalid.');
    return applyEnterpriseSettlement({
      orderId: targetId,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      amountPaidMinor,
      currencyPaid,
      status: input.status,
    });
  }

  throw new Error(
    `${input.source} settlements must be handled through original provider-webhook forwarding.`,
  );
}

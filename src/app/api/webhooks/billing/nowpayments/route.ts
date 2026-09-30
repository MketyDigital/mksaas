import { applyEnterpriseAiFundingSettlement } from '@/features/ai-runtime/server/enterprise-funding-settlement';
import {
  buildNowPaymentsSettlementForCheckout,
  createNowPaymentsBillingAdapter,
  parseMketyBillingOrderId,
} from '@/features/billing/gateways/nowpayments';
import {
  findBillingCheckoutSettlementContext,
  markBillingCheckoutAwaitingConfirmation,
  markBillingCheckoutCompleted,
  markBillingCheckoutFailedOnly,
  markBillingCheckoutTerminalFailure,
} from '@/features/billing/server/drizzle-checkout-settlement';
import { createDrizzleBillingRepository } from '@/features/billing/server/drizzle-repository';
import { applyVerifiedSettlement } from '@/features/billing/server/settlement-service';
import { grantCurrentPeriodAllowance } from '@/features/usage-credits/server/period-grants';
import { db } from '@/shared/db';
import { createLogger } from '@/shared/lib/logger';

const logger = createLogger({ module: 'billing-nowpayments-webhook' });

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!ipnSecret) {
    return json({ success: false, message: 'Billing webhook is not configured.' }, 503);
  }

  const adapter = createNowPaymentsBillingAdapter({
    apiKey: process.env.NOWPAYMENTS_API_KEY,
    ipnSecret,
  });

  try {
    const event = await adapter.verifyIncomingEvent(request);
    if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
      return json({ success: false, message: 'Invalid billing webhook.' }, 400);
    }

    const payload = event.payload as Record<string, unknown>;
    const orderId = typeof payload.orderId === 'string' ? payload.orderId : '';
    const checkoutId = parseMketyBillingOrderId(orderId);
    if (!checkoutId) {
      return json({ success: false, message: 'Unknown billing order.' }, 400);
    }

    const context = await findBillingCheckoutSettlementContext(checkoutId);
    if (!context || context.provider !== 'nowpayments') {
      return json({ success: false, message: 'Billing checkout not found.' }, 404);
    }

    const paymentStatus = String(payload.paymentStatus ?? '');
    const now = new Date();

    if (paymentStatus === 'finished') {
      const settlement = buildNowPaymentsSettlementForCheckout(event, context, now);
      if (context.purpose === 'enterprise_ai_funding') {
        const result = await applyEnterpriseAiFundingSettlement({
          checkoutId,
          provider: 'nowpayments',
          providerPaymentId: settlement.providerPaymentId ?? '',
          providerEventId: settlement.providerEventId ?? '',
          providerAmountPaidMinor: settlement.providerAmountPaidMinor ?? settlement.amountPaidMinor,
          providerCurrencyPaid: settlement.providerCurrencyPaid ?? settlement.currencyPaid,
          rawReference: settlement.rawReference ?? '',
          occurredAt: now,
        });
        return json({ success: true, settlement: result.applied ? 'applied' : 'duplicate' });
      }

      const repository = createDrizzleBillingRepository(db);
      const result = await applyVerifiedSettlement(repository, settlement, now);
      await markBillingCheckoutCompleted(checkoutId, now);
      await grantCurrentPeriodAllowance(context.tenantId);

      return json({
        success: true,
        settlement: result.status,
      });
    }

    if (['failed', 'expired', 'refunded'].includes(paymentStatus)) {
      if (context.purpose === 'enterprise_ai_funding') {
        await markBillingCheckoutFailedOnly(checkoutId, now);
      } else {
        await markBillingCheckoutTerminalFailure(
          checkoutId,
          context.subscriptionId,
          `nowpayments_${paymentStatus}`,
          now,
        );
      }
      return json({ success: true, settled: false, status: paymentStatus });
    }

    await markBillingCheckoutAwaitingConfirmation(checkoutId, now);
    return json({ success: true, settled: false, status: paymentStatus || 'unknown' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (
      /signature|required fields|settlement amount|settlement currency|invalid USD amount|verified provider payload/i.test(
        message,
      )
    ) {
      return json({ success: false, message: 'Invalid billing webhook.' }, 400);
    }

    logger.error(
      { errorName: error instanceof Error ? error.name : 'UnknownError' },
      'Self-service NOWPayments billing webhook failed',
    );
    return json({ success: false, message: 'Billing webhook processing failed.' }, 500);
  }
}

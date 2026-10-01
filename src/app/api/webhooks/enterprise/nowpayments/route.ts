import { verifyNowPaymentsWebhook } from '@/features/enterprise-checkout/providers/nowpayments-webhook';
import { enterpriseOrderRepository } from '@/features/enterprise-checkout/server/repository';
import { parseMketyPaymentReference } from '@/features/payments/reference';
import { createLogger } from '@/shared/lib/logger';

const logger = createLogger({ module: 'enterprise-nowpayments-webhook' });

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) return json({ success: false, message: 'Webhook is not configured.' }, 503);

  try {
    const rawBody = await request.text();
    const event = await verifyNowPaymentsWebhook(rawBody, request.headers.get('x-nowpayments-sig'), secret);
    const canonical = parseMketyPaymentReference(event.orderId);
    const resolvedOrderId = canonical?.source === 'enterprise' && canonical.targetUuid
      ? `MKETY-ENT-${canonical.targetUuid}`
      : event.orderId;
    const order = await enterpriseOrderRepository.findById(resolvedOrderId);
    if (!order || order.paymentProvider !== 'nowpayments') {
      return json({ success: false, message: 'Order not found.' }, 404);
    }

    if (event.paymentStatus === 'finished') {
      await enterpriseOrderRepository.applyPaymentState({
        orderId: resolvedOrderId,
        paymentStatus: 'confirmed',
        checkoutStatus: 'completed',
        providerPaymentReference: event.paymentId,
        metadata: { lastProviderStatus: event.paymentStatus },
      });
    } else if (['failed', 'expired', 'refunded'].includes(event.paymentStatus)) {
      await enterpriseOrderRepository.applyPaymentState({
        orderId: resolvedOrderId,
        paymentStatus: 'failed',
        checkoutStatus: 'failed',
        providerPaymentReference: event.paymentId,
        metadata: { lastProviderStatus: event.paymentStatus },
      });
    } else {
      await enterpriseOrderRepository.applyPaymentState({
        orderId: resolvedOrderId,
        paymentStatus: 'pending',
        checkoutStatus: 'awaiting_confirmation',
        providerPaymentReference: event.paymentId,
        metadata: { lastProviderStatus: event.paymentStatus },
      });
    }

    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('signature') || message.includes('required fields')) {
      return json({ success: false, message: 'Invalid webhook.' }, 400);
    }
    logger.error(
      { errorName: error instanceof Error ? error.name : 'UnknownError' },
      'Enterprise NOWPayments webhook failed',
    );
    return json({ success: false, message: 'Webhook processing failed.' }, 500);
  }
}

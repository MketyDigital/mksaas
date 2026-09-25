import { forwardOriginalProviderWebhook } from '@/features/payments/external-webhook-forwarder';
import { retrieveKoraCharge, verifyKoraWebhook } from '@/features/payments/kora';
import { resolveMketyPaymentRoute } from '@/features/payments/reference';
import { routeVerifiedMketyPayment } from '@/features/payments/settlement-router';
import { createLogger } from '@/shared/lib/logger';

const logger = createLogger({ module: 'mkety-kora-webhook' });

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const secretKey = process.env.KORA_SECRET_KEY;
  if (!secretKey) return json({ success: false, message: 'Webhook is not configured.' }, 503);

  try {
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody) as { event?: string; data?: Record<string, unknown> };
    if (!payload.data) return json({ success: false, message: 'Invalid webhook.' }, 400);
    const signature = request.headers.get('x-korapay-signature');
    await verifyKoraWebhook({
      data: payload.data,
      signature,
      secretKey,
    });

    const reference = String(payload.data.reference ?? '');
    const verified = await retrieveKoraCharge({ reference, secretKey });
    const route = resolveMketyPaymentRoute(reference, verified);
    if (!route) return json({ success: false, message: 'Unknown Mkety payment reference.' }, 400);

    if (route.source === 'media' || route.source === 'host') {
      const forwarded = await forwardOriginalProviderWebhook({
        source: route.source,
        provider: 'kora',
        rawBody,
        signature: signature ?? '',
        contentType: request.headers.get('content-type'),
      });
      return json({ success: true, settled: false, routedTo: route.source, ...forwarded });
    }
    const verifiedReference = String(verified.reference ?? '');
    if (verifiedReference !== reference) return json({ success: false, message: 'Payment reference mismatch.' }, 400);

    const status =
      payload.event === 'charge.success' && String(verified.status ?? '') === 'success'
        ? 'success'
        : payload.event === 'charge.failed' || String(verified.status ?? '') === 'failed'
          ? 'failed'
          : 'pending';

    const result = await routeVerifiedMketyPayment({
      source: route.source,
      targetUuid: route.targetUuid,
      provider: 'kora',
      reference,
      providerPaymentId: String(verified.transaction_reference ?? verified.payment_reference ?? verified.reference ?? reference),
      providerEventId: String(verified.transaction_reference ?? verified.reference ?? reference),
      amount: verified.amount_paid ?? verified.amount,
      currency: verified.currency,
      status,
      providerData: verified,
    });

    return json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/signature|reference mismatch|does not match|invalid payment|unknown Mkety|checkout reference|order reference/i.test(message)) {
      return json({ success: false, message: 'Invalid webhook.' }, 400);
    }
    logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'Kora webhook processing failed');
    return json({ success: false, message: 'Webhook processing failed.' }, 503);
  }
}

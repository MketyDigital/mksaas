import { forwardOriginalProviderWebhook } from '@/features/payments/external-webhook-forwarder';
import { retrieveKoraCharge, verifyKoraWebhook } from '@/features/payments/kora';
import { resolveMketyPaymentRoute } from '@/features/payments/reference';
import { routeVerifiedMketyPayment } from '@/features/payments/settlement-router';
import { createLogger } from '@/shared/lib/logger';

const logger = createLogger({ module: 'mkety-kora-webhook' });

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function signAssistAttestation(raw: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  let binary = '';
  for (const byte of signature) binary += String.fromCharCode(byte);
  return btoa(binary);
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

    if (payload.event !== 'charge.success' && payload.event !== 'charge.failed') {
      return json({ success: true, settled: false, ignored: true });
    }

    const reference = String(payload.data.reference ?? '');
    if (!reference) return json({ success: false, message: 'Invalid webhook.' }, 400);
    const verified = await retrieveKoraCharge({ reference, secretKey });
    const verifiedReference = String(verified.reference ?? '');
    if (verifiedReference !== reference) return json({ success: false, message: 'Payment reference mismatch.' }, 400);

    const status =
      payload.event === 'charge.success' && String(verified.status ?? '') === 'success'
        ? 'success'
        : payload.event === 'charge.failed' || String(verified.status ?? '') === 'failed'
          ? 'failed'
          : 'pending';

    const route = resolveMketyPaymentRoute(reference, verified);
    if (!route) return json({ success: false, message: 'Unknown Mkety payment reference.' }, 400);

    if (route.source === 'media' || route.source === 'host') {
      if (status !== 'success') {
        return json({ success: true, settled: false, routedTo: route.source, ignored: true, status });
      }
      const forwarded = await forwardOriginalProviderWebhook({
        source: route.source,
        provider: 'kora',
        rawBody,
        signature: signature ?? '',
        contentType: request.headers.get('content-type'),
      });
      return json({ success: true, settled: false, routedTo: route.source, ...forwarded });
    }

    if (route.source === 'assist') {
      const brokerSecret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
      if (!brokerSecret) return json({ success: false, message: 'Assist payment forwarding is not configured.' }, 503);
      const body = JSON.stringify({
        provider: 'kora',
        reference,
        provider_payment_id: String(verified.transaction_reference ?? verified.payment_reference ?? verified.reference ?? reference),
        provider_event_id: String(verified.transaction_reference ?? verified.reference ?? reference),
        status,
        amount: verified.amount_paid ?? verified.amount,
        currency: String(verified.currency ?? '').toUpperCase(),
      });
      const attestation = await signAssistAttestation(body, brokerSecret);
      const forwarded = await fetch('https://mkety-assist.mkety.app/api/payment/kora/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-mkety-payment-attestation': attestation },
        body,
      });
      if (!forwarded.ok) return json({ success: false, message: 'Assist settlement forwarding failed.' }, 502);
      return json({ success: true, settled: false, routedTo: 'assist', status });
    }

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

import { verifyNowPaymentsWebhook } from '@/features/enterprise-checkout/providers/nowpayments-webhook';
import { resolveMketyPaymentRoute } from '@/features/payments/reference';

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function signAttestation(raw: string, secret: string) {
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
  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
  const brokerSecret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
  if (!ipnSecret || !brokerSecret) return json({ success: false, message: 'Payment forwarding is not configured.' }, 503);
  try {
    const raw = await request.text();
    const event = await verifyNowPaymentsWebhook(raw, request.headers.get('x-nowpayments-sig'), ipnSecret);
    const route = resolveMketyPaymentRoute(event.orderId, event.raw);
    if (!route) return json({ success: false, message: 'Unknown payment reference.' }, 400);
    if (route.source !== 'assist') return json({ success: false, message: 'Unsupported payment owner.' }, 400);

    const status = event.paymentStatus;
    const body = JSON.stringify({
      provider: 'nowpayments',
      reference: event.orderId,
      provider_payment_id: event.paymentId || null,
      provider_event_id: event.paymentId || event.orderId + ':' + status,
      status,
      amount: event.raw.price_amount ?? event.raw.actually_paid ?? null,
      currency: String(event.raw.price_currency ?? '').toUpperCase(),
    });
    const attestation = await signAttestation(body, brokerSecret);
    const forwarded = await fetch('https://mkety-assist.mkety.app/api/payment/nowpayments/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mkety-payment-attestation': attestation },
      body,
    });
    if (!forwarded.ok) return json({ success: false, message: 'Assist settlement forwarding failed.' }, 502);
    return json({ success: true, forwarded: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/signature|required fields/i.test(message)) return json({ success: false, message: 'Invalid webhook.' }, 400);
    return json({ success: false, message: 'Webhook processing failed.' }, 500);
  }
}

import { createMketyPaymentAttestation } from '@/features/payments/attestation';
import { verifyFlutterwavePaymentByReference } from '@/features/payments/flutterwave-standard';
import { resolveKoraPaidAmount, retrieveKoraCharge } from '@/features/payments/kora';
import { resolveMketyPaymentRoute } from '@/features/payments/reference';

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function timingSafeEqualText(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request) {
  const brokerSecret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
  const supplied = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!brokerSecret || !supplied || !timingSafeEqualText(supplied, brokerSecret)) {
    return json({ success: false, message: 'Unauthorized.' }, 401);
  }

  try {
    const body = (await request.json()) as { provider?: unknown; reference?: unknown };
    const provider = String(body.provider || '');
    const reference = String(body.reference || '').trim();
    const route = resolveMketyPaymentRoute(reference);
    if (!route || route.source !== 'assist' || !/^ASSIST-MKA-[A-Za-z0-9-]{6,32}$/.test(reference)) {
      return json({ success: false, message: 'Invalid Assist payment reference.' }, 400);
    }
    let eventBody: Record<string, unknown>;

    if (provider === 'flutterwave') {
      const secretKey = process.env.FLUTTERWAVE_STANDARD_SECRET_KEY;
      if (!secretKey) return json({ success: false, message: 'Payment verification is not configured.' }, 503);
      const verified = await verifyFlutterwavePaymentByReference({ reference, secretKey });
      if (String(verified.tx_ref || '') !== reference) return json({ success: false, message: 'Provider reference mismatch.' }, 409);
      eventBody = { event: 'charge.completed', data: verified };
    } else if (provider === 'kora') {
      const secretKey = process.env.KORA_SECRET_KEY;
      if (!secretKey) return json({ success: false, message: 'Payment verification is not configured.' }, 503);
      const verified = await retrieveKoraCharge({ reference, secretKey });
      if (String(verified.reference || '') !== reference) return json({ success: false, message: 'Provider reference mismatch.' }, 409);
      eventBody = {
        provider: 'kora',
        reference,
        provider_payment_id: String(verified.transaction_reference ?? verified.payment_reference ?? verified.reference ?? reference),
        provider_event_id: String(verified.transaction_reference ?? verified.reference ?? reference),
        status: String(verified.status || '').toLowerCase(),
        amount: resolveKoraPaidAmount(verified),
        currency: String(verified.currency || '').toUpperCase(),
      };
    } else {
      return json({ success: false, message: 'Unsupported payment provider.' }, 400);
    }

    const raw = JSON.stringify(eventBody);
    const attestation = await createMketyPaymentAttestation(raw, brokerSecret);
    const forwarded = await fetch(`https://mkety-assist.mkety.app/api/payment/${provider}/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mkety-payment-attestation': attestation },
      body: raw,
    });
    if (!forwarded.ok) return json({ success: false, message: 'Assist payment recovery could not be completed.' }, 502);
    const result = (await forwarded.json().catch(() => null)) as Record<string, unknown> | null;
    return json({ success: true, status: result?.settled ? 'paid' : 'pending', provider });
  } catch {
    return json({ success: false, message: 'Provider verification could not be completed.' }, 502);
  }
}

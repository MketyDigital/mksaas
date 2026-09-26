import { createMketyPaymentAttestation } from '@/features/payments/attestation';
import { forwardOriginalProviderWebhook } from '@/features/payments/external-webhook-forwarder';
import { verifyFlutterwaveStandardTransaction } from '@/features/payments/flutterwave-standard';
import { resolveMketyPaymentRoute } from '@/features/payments/reference';
import { markFlutterwaveInlineSessionVerified } from '@/features/payments/server/flutterwave-inline-session';
import { routeVerifiedMketyPayment } from '@/features/payments/settlement-router';
import { createLogger } from '@/shared/lib/logger';

const logger = createLogger({ module: 'mkety-flutterwave-webhook' });

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function timingSafeEqualText(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function paymentAmountMinor(value: unknown): bigint {
  const normalized = typeof value === 'number' ? value.toFixed(2) : String(value ?? '').trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error('Invalid Flutterwave payment amount.');
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
}

function assertWebhookMatchesVerified(
  payload: Record<string, unknown>,
  verified: Record<string, unknown>,
): void {
  const rawData = payload.data;
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    throw new Error('Invalid Flutterwave webhook payment data.');
  }

  const data = rawData as Record<string, unknown>;
  const webhookId = String(data.id ?? '');
  const verifiedId = String(verified.id ?? '');
  const webhookReference = String(data.tx_ref ?? '');
  const verifiedReference = String(verified.tx_ref ?? '');
  const webhookStatus = String(data.status ?? '');
  const verifiedStatus = String(verified.status ?? '');
  const webhookCurrency = String(data.currency ?? '').toUpperCase();
  const verifiedCurrency = String(verified.currency ?? '').toUpperCase();

  if (
    !webhookId ||
    webhookId !== verifiedId ||
    !webhookReference ||
    webhookReference !== verifiedReference ||
    webhookStatus !== verifiedStatus ||
    webhookCurrency !== verifiedCurrency ||
    paymentAmountMinor(data.amount ?? data.charged_amount) !==
      paymentAmountMinor(verified.amount ?? verified.charged_amount)
  ) {
    throw new Error('Flutterwave webhook does not match the verified transaction.');
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('verif-hash') ?? '';
    const webhookHash = process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH ?? '';
    const secretKey = process.env.FLUTTERWAVE_STANDARD_SECRET_KEY ?? '';

    if (!signature || !webhookHash || !secretKey || !timingSafeEqualText(signature, webhookHash)) {
      return json({ success: false, message: 'Invalid webhook.' }, 401);
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    if (String(payload.event ?? '') !== 'charge.completed') {
      return json({ success: true, settled: false, ignored: true, mode: 'v3' });
    }

    const rawData = payload.data;
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
      return json({ success: false, message: 'Invalid webhook.' }, 400);
    }
    const transactionId = String((rawData as Record<string, unknown>).id ?? '');
    if (!transactionId) return json({ success: false, message: 'Invalid webhook.' }, 400);

    const verified = await verifyFlutterwaveStandardTransaction({ transactionId, secretKey });
    assertWebhookMatchesVerified(payload, verified);

    const reference = String(verified.tx_ref ?? '');
    const route = resolveMketyPaymentRoute(reference, verified);
    if (!route) return json({ success: false, message: 'Unknown Mkety payment reference.' }, 400);

    if (route.source === 'media' || route.source === 'host') {
      const brokerSecret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
      if (!brokerSecret) {
        return json({ success: false, message: 'Webhook forwarding is not configured.' }, 503);
      }
      const attestation = await createMketyPaymentAttestation(rawBody, brokerSecret);
      const forwarded = await forwardOriginalProviderWebhook({
        source: route.source,
        provider: 'flutterwave',
        rawBody,
        signature,
        signatureHeader: 'verif-hash',
        attestation,
        contentType: request.headers.get('content-type'),
      });
      if (String(verified.status ?? '') === 'successful') {
        await markFlutterwaveInlineSessionVerified(reference).catch(() => undefined);
      }
      return json({ success: true, settled: false, routedTo: route.source, mode: 'v3', ...forwarded });
    }

    const statusValue = String(verified.status ?? '');
    const result = await routeVerifiedMketyPayment({
      source: route.source,
      targetUuid: route.targetUuid,
      provider: 'flutterwave',
      reference,
      providerPaymentId: String(verified.id ?? transactionId),
      providerEventId: String(verified.id ?? transactionId),
      amount: verified.amount ?? verified.charged_amount,
      currency: verified.currency,
      status: statusValue === 'successful' ? 'success' : statusValue === 'failed' ? 'failed' : 'pending',
      providerData: verified,
    });

    if (statusValue === 'successful') {
      await markFlutterwaveInlineSessionVerified(reference).catch(() => undefined);
    }
    return json({ success: true, mode: 'v3', ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      error instanceof SyntaxError ||
      /signature|reference mismatch|does not match|invalid payment|unknown Mkety|checkout reference|order reference|invalid Flutterwave/i.test(
        message,
      )
    ) {
      return json({ success: false, message: 'Invalid webhook.' }, 400);
    }

    logger.error(
      { errorName: error instanceof Error ? error.name : 'UnknownError' },
      'Flutterwave webhook processing failed',
    );
    return json({ success: false, message: 'Webhook processing failed.' }, 503);
  }
}

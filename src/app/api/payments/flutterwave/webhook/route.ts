import { createMketyPaymentAttestation } from '@/features/payments/attestation';
import { forwardOriginalProviderWebhook } from '@/features/payments/external-webhook-forwarder';
import { verifyFlutterwaveStandardTransaction } from '@/features/payments/flutterwave-standard';
import { resolveMketyPaymentRoute } from '@/features/payments/reference';
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
  if (!match) throw new Error('Invalid Flutterwave Standard webhook payment amount.');
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
}

function assertStandardWebhookMatchesVerified(
  payload: Record<string, unknown>,
  verified: Record<string, unknown>,
): void {
  const rawData = payload.data;
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    throw new Error('Invalid Flutterwave Standard webhook payment data.');
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
    throw new Error('Flutterwave Standard webhook does not match the verified transaction.');
  }
}

type IgnoredFlutterwavePayment = {
  mode: 'standard';
  ignored: true;
};

type VerifiedFlutterwavePayment = {
  mode: 'standard';
  payload: Record<string, unknown>;
  verified: Record<string, unknown>;
  reference: string;
  status: 'success' | 'pending' | 'failed';
  paymentId: string;
  eventId: string;
  amount: unknown;
  currency: unknown;
  signature: string;
  signatureHeader: 'verif-hash';
};

async function verifyIncomingFlutterwave(
  rawBody: string,
  request: Request,
): Promise<VerifiedFlutterwavePayment | IgnoredFlutterwavePayment> {
  const standardSignature = request.headers.get('verif-hash');
  const standardHash = process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH;
  const standardSecretKey = process.env.FLUTTERWAVE_STANDARD_SECRET_KEY;
  if (
    !standardSignature ||
    !standardHash ||
    !standardSecretKey ||
    !timingSafeEqualText(standardSignature, standardHash)
  ) {
    throw new Error('Invalid Flutterwave webhook signature.');
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  if (String(payload.event ?? '') !== 'charge.completed') {
    return { mode: 'standard', ignored: true };
  }

  const data = payload.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid Flutterwave webhook.');
  const transactionId = String((data as Record<string, unknown>).id ?? '');
  if (!transactionId) throw new Error('Invalid Flutterwave webhook.');

  const verified = await verifyFlutterwaveStandardTransaction({
    transactionId,
    secretKey: standardSecretKey,
  });
  assertStandardWebhookMatchesVerified(payload, verified);

  const statusValue = String(verified.status ?? '');
  return {
    mode: 'standard',
    payload,
    verified,
    reference: String(verified.tx_ref ?? ''),
    status: statusValue === 'successful' ? 'success' : statusValue === 'failed' ? 'failed' : 'pending',
    paymentId: String(verified.id ?? transactionId),
    eventId: String(verified.id ?? transactionId),
    amount: verified.amount ?? verified.charged_amount,
    currency: verified.currency,
    signature: standardSignature,
    signatureHeader: 'verif-hash',
  };
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const payment = await verifyIncomingFlutterwave(rawBody, request);
    if ('ignored' in payment) {
      return json({ success: true, settled: false, ignored: true, mode: payment.mode });
    }

    const route = resolveMketyPaymentRoute(payment.reference, payment.verified);
    if (!route) return json({ success: false, message: 'Unknown Mkety payment reference.' }, 400);

    if (route.source === 'media' || route.source === 'host') {
      const brokerSecret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
      if (!brokerSecret) throw new Error('Flutterwave Standard forwarding attestation is not configured.');
      const attestation = await createMketyPaymentAttestation(rawBody, brokerSecret);

      const forwarded = await forwardOriginalProviderWebhook({
        source: route.source,
        provider: 'flutterwave',
        rawBody,
        signature: payment.signature,
        signatureHeader: payment.signatureHeader,
        attestation,
        contentType: request.headers.get('content-type'),
      });
      return json({ success: true, settled: false, routedTo: route.source, mode: payment.mode, ...forwarded });
    }

    const result = await routeVerifiedMketyPayment({
      source: route.source,
      targetUuid: route.targetUuid,
      provider: 'flutterwave',
      reference: payment.reference,
      providerPaymentId: payment.paymentId,
      providerEventId: payment.eventId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      providerData: payment.verified,
    });

    return json({ success: true, mode: payment.mode, ...result });
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
    if (/not configured/i.test(message)) return json({ success: false, message: 'Webhook is not configured.' }, 503);

    logger.error(
      { errorName: error instanceof Error ? error.name : 'UnknownError' },
      'Flutterwave webhook processing failed',
    );
    return json({ success: false, message: 'Webhook processing failed.' }, 503);
  }
}

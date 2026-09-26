import { createMketyPaymentAttestation } from '@/features/payments/attestation';
import { createMketyPaymentAttestation } from '@/features/payments/attestation';
import { forwardOriginalProviderWebhook } from '@/features/payments/external-webhook-forwarder';
import { verifyFlutterwaveStandardTransaction } from '@/features/payments/flutterwave-standard';
import { retrieveFlutterwaveV4Charge, verifyFlutterwaveV4Webhook } from '@/features/payments/flutterwave-v4';
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


function decimalToMinor(value: unknown): bigint {
  const normalized =
    typeof value === 'number'
      ? value.toFixed(2)
      : typeof value === 'string'
        ? value.trim()
        : '';
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error('Invalid Flutterwave payment amount.');
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
}

function assertStandardWebhookMatchesVerified(
  payload: Record<string, unknown>,
  verified: Record<string, unknown>,
): void {
  const data = payload.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid Flutterwave webhook.');
  }
  const webhookData = data as Record<string, unknown>;
  const webhookId = String(webhookData.id ?? '');
  const verifiedId = String(verified.id ?? '');
  const webhookReference = String(webhookData.tx_ref ?? '');
  const verifiedReference = String(verified.tx_ref ?? '');
  const webhookCurrency = String(webhookData.currency ?? '').toUpperCase();
  const verifiedCurrency = String(verified.currency ?? '').toUpperCase();
  const webhookStatus = String(webhookData.status ?? '');
  const verifiedStatus = String(verified.status ?? '');

  if (
    !webhookId ||
    webhookId !== verifiedId ||
    !webhookReference ||
    webhookReference !== verifiedReference ||
    webhookCurrency !== verifiedCurrency ||
    webhookStatus !== verifiedStatus ||
    decimalToMinor(webhookData.amount ?? webhookData.charged_amount) !==
      decimalToMinor(verified.amount ?? verified.charged_amount)
  ) {
    throw new Error('Flutterwave Standard webhook does not match the verified transaction.');
  }
}

type IgnoredFlutterwavePayment = {
  mode: 'v4' | 'standard';
  ignored: true;
};


function paymentAmountMinor(value: unknown): bigint {
  const normalized = typeof value === 'number' ? value.toFixed(2) : String(value ?? '').trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error('Invalid Flutterwave Standard webhook payment amount.');
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
}

function assertStandardWebhookMatchesVerified(payment: VerifiedFlutterwavePayment) {
  if (payment.mode !== 'standard') return;
  const rawData = payment.payload.data;
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    throw new Error('Invalid Flutterwave Standard webhook payment data.');
  }
  const data = rawData as Record<string, unknown>;
  const rawReference = String(data.tx_ref ?? '');
  const rawStatus = String(data.status ?? '');
  const rawCurrency = String(data.currency ?? '').toUpperCase();
  const verifiedCurrency = String(payment.verified.currency ?? '').toUpperCase();
  const rawAmount = data.amount ?? data.charged_amount;
  const verifiedAmount = payment.verified.amount ?? payment.verified.charged_amount;

  if (
    rawReference !== payment.reference ||
    rawStatus !== 'successful' ||
    payment.status !== 'success' ||
    rawCurrency !== verifiedCurrency ||
    paymentAmountMinor(rawAmount) !== paymentAmountMinor(verifiedAmount)
  ) {
    throw new Error('Flutterwave Standard webhook data does not match the verified transaction.');
  }
}

type VerifiedFlutterwavePayment = {
  mode: 'v4' | 'standard';
  payload: Record<string, unknown>;
  verified: Record<string, unknown>;
  reference: string;
  status: 'success' | 'pending' | 'failed';
  paymentId: string;
  eventId: string;
  amount: unknown;
  currency: unknown;
  signature: string;
  signatureHeader: 'flutterwave-signature' | 'verif-hash';
};

async function verifyIncomingFlutterwave(
  rawBody: string,
  request: Request,
): Promise<VerifiedFlutterwavePayment | IgnoredFlutterwavePayment> {
  const v4Signature = request.headers.get('flutterwave-signature');
  if (v4Signature) {
    const clientId = process.env.FLUTTERWAVE_CLIENT_ID;
    const clientSecret = process.env.FLUTTERWAVE_CLIENT_SECRET;
    const webhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    if (!clientId || !clientSecret || !webhookSecret) throw new Error('Flutterwave v4 webhook is not configured.');

    const payload = await verifyFlutterwaveV4Webhook({
      rawBody,
      signature: v4Signature,
      secretHash: webhookSecret,
    });
    if (String(payload.type ?? '') !== 'charge.completed') {
      return { mode: 'v4', ignored: true };
    }
    const data = payload.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid Flutterwave webhook.');
    const chargeId = String((data as Record<string, unknown>).id ?? '');
    if (!chargeId) throw new Error('Invalid Flutterwave webhook.');

    const verified = await retrieveFlutterwaveV4Charge({ chargeId, clientId, clientSecret });
    const statusValue = String(verified.status ?? '');
    return {
      mode: 'v4',
      payload,
      verified,
      reference: String(verified.reference ?? ''),
      status: statusValue === 'succeeded' ? 'success' : ['failed', 'voided'].includes(statusValue) ? 'failed' : 'pending',
      paymentId: String(verified.id ?? chargeId),
      eventId: String(payload.id ?? verified.id ?? chargeId),
      amount: verified.amount,
      currency: verified.currency,
      signature: v4Signature,
      signatureHeader: 'flutterwave-signature',
    };
  }

  const legacySignature = request.headers.get('verif-hash');
  const legacyHash = process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH;
  const standardSecretKey = process.env.FLUTTERWAVE_STANDARD_SECRET_KEY;
  if (!legacySignature || !legacyHash || !standardSecretKey || !timingSafeEqualText(legacySignature, legacyHash)) {
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
    signature: legacySignature,
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
      let attestation: string | undefined;
      if (payment.mode === 'standard') {
        assertStandardWebhookMatchesVerified(payment);
        const brokerSecret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
        if (!brokerSecret) throw new Error('Flutterwave Standard forwarding attestation is not configured.');
        attestation = await createMketyPaymentAttestation(rawBody, brokerSecret);
      }

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
      /signature|reference mismatch|does not match|invalid payment|unknown Mkety|checkout reference|order reference|invalid Flutterwave/i.test(message)
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

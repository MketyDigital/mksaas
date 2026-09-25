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

type IgnoredFlutterwavePayment = {
  mode: 'v4' | 'standard';
  ignored: true;
};

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
      const forwarded = await forwardOriginalProviderWebhook({
        source: route.source,
        provider: 'flutterwave',
        rawBody,
        signature: payment.signature,
        signatureHeader: payment.signatureHeader,
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

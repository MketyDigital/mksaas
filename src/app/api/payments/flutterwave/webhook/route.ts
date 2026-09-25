import { forwardOriginalProviderWebhook } from '@/features/payments/external-webhook-forwarder';
import { retrieveFlutterwaveV3Transaction, verifyFlutterwaveV3WebhookSecret } from '@/features/payments/flutterwave-v3';
import { retrieveFlutterwaveV4Charge, verifyFlutterwaveV4Webhook } from '@/features/payments/flutterwave-v4';
import { resolveMketyPaymentRoute } from '@/features/payments/reference';
import { routeVerifiedMketyPayment } from '@/features/payments/settlement-router';
import { createLogger } from '@/shared/lib/logger';

const logger = createLogger({ module: 'mkety-flutterwave-webhook' });

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function processVerifiedPayment(input: {
  rawBody: string;
  contentType: string | null;
  signature: string;
  signatureHeader: 'flutterwave-signature' | 'verif-hash';
  eventId: string;
  verified: Record<string, unknown>;
  reference: string;
  successfulStatus: string;
}) {
  const route = resolveMketyPaymentRoute(input.reference, input.verified);
  if (!route) return json({ success: false, message: 'Unknown Mkety payment reference.' }, 400);

  if (route.source === 'media' || route.source === 'host') {
    const forwarded = await forwardOriginalProviderWebhook({
      source: route.source,
      provider: 'flutterwave',
      rawBody: input.rawBody,
      signature: input.signature,
      signatureHeader: input.signatureHeader,
      contentType: input.contentType,
    });
    return json({ success: true, settled: false, routedTo: route.source, ...forwarded });
  }

  const statusValue = String(input.verified.status ?? '');
  const status =
    statusValue === input.successfulStatus
      ? 'success'
      : ['failed', 'voided', 'cancelled'].includes(statusValue)
        ? 'failed'
        : 'pending';

  const result = await routeVerifiedMketyPayment({
    source: route.source,
    targetUuid: route.targetUuid,
    provider: 'flutterwave',
    reference: input.reference,
    providerPaymentId: String(input.verified.id ?? input.eventId),
    providerEventId: input.eventId,
    amount: input.verified.amount,
    currency: input.verified.currency,
    status,
    providerData: input.verified,
  });

  return json({ success: true, ...result });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const contentType = request.headers.get('content-type');
    const v4Signature = request.headers.get('flutterwave-signature');
    const v3Signature = request.headers.get('verif-hash');

    if (v4Signature) {
      const clientId = process.env.FLUTTERWAVE_CLIENT_ID;
      const clientSecret = process.env.FLUTTERWAVE_CLIENT_SECRET;
      const webhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
      if (!clientId || !clientSecret || !webhookSecret) {
        return json({ success: false, message: 'Flutterwave v4 webhook is not configured.' }, 503);
      }

      const payload = await verifyFlutterwaveV4Webhook({
        rawBody,
        signature: v4Signature,
        secretHash: webhookSecret,
      });
      if (String(payload.type ?? '') !== 'charge.completed') {
        return json({ success: true, settled: false, ignored: true });
      }
      const data = payload.data;
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return json({ success: false, message: 'Invalid webhook.' }, 400);
      }
      const chargeId = String((data as Record<string, unknown>).id ?? '');
      if (!chargeId) return json({ success: false, message: 'Invalid webhook.' }, 400);

      const verified = await retrieveFlutterwaveV4Charge({ chargeId, clientId, clientSecret });
      return processVerifiedPayment({
        rawBody,
        contentType,
        signature: v4Signature,
        signatureHeader: 'flutterwave-signature',
        eventId: String(payload.id ?? verified.id ?? chargeId),
        verified,
        reference: String(verified.reference ?? ''),
        successfulStatus: 'succeeded',
      });
    }

    if (v3Signature) {
      const secretKey = process.env.FLUTTERWAVE_V3_SECRET_KEY;
      const secretHash = process.env.FLUTTERWAVE_V3_SECRET_HASH;
      if (!secretKey || !secretHash) {
        return json({ success: false, message: 'Flutterwave hosted webhook is not configured.' }, 503);
      }
      verifyFlutterwaveV3WebhookSecret({ signature: v3Signature, secretHash });

      const payload = JSON.parse(rawBody || 'null') as { event?: unknown; data?: Record<string, unknown> } | null;
      if (!payload?.data) return json({ success: false, message: 'Invalid webhook.' }, 400);
      if (String(payload.event ?? '') !== 'charge.completed') {
        return json({ success: true, settled: false, ignored: true });
      }
      const transactionId = String(payload.data.id ?? '');
      if (!transactionId) return json({ success: false, message: 'Invalid webhook.' }, 400);
      const verified = await retrieveFlutterwaveV3Transaction({ transactionId, secretKey });

      return processVerifiedPayment({
        rawBody,
        contentType,
        signature: v3Signature,
        signatureHeader: 'verif-hash',
        eventId: transactionId,
        verified,
        reference: String(verified.tx_ref ?? ''),
        successfulStatus: 'successful',
      });
    }

    return json({ success: false, message: 'Flutterwave webhook signature is required.' }, 401);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/signature|reference mismatch|does not match|invalid payment|unknown Mkety|checkout reference|order reference/i.test(message)) {
      return json({ success: false, message: 'Invalid webhook.' }, 400);
    }
    logger.error(
      { errorName: error instanceof Error ? error.name : 'UnknownError' },
      'Flutterwave webhook processing failed',
    );
    return json({ success: false, message: 'Webhook processing failed.' }, 503);
  }
}

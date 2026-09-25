import { retrieveFlutterwaveV4Charge, verifyFlutterwaveV4Webhook } from '@/features/payments/flutterwave-v4';
import { parseMketyPaymentReference } from '@/features/payments/reference';
import { routeVerifiedMketyPayment } from '@/features/payments/settlement-router';
import { createLogger } from '@/shared/lib/logger';

const logger = createLogger({ module: 'mkety-flutterwave-webhook' });

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const clientId = process.env.FLUTTERWAVE_CLIENT_ID;
  const clientSecret = process.env.FLUTTERWAVE_CLIENT_SECRET;
  const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
  if (!clientId || !clientSecret || !secretHash) {
    return json({ success: false, message: 'Webhook is not configured.' }, 503);
  }

  try {
    const rawBody = await request.text();
    const payload = await verifyFlutterwaveV4Webhook({
      rawBody,
      signature: request.headers.get('flutterwave-signature'),
      secretHash,
    });
    const data = payload.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return json({ success: false, message: 'Invalid webhook.' }, 400);
    }

    const eventData = data as Record<string, unknown>;
    const chargeId = String(eventData.id ?? '');
    if (!chargeId) return json({ success: false, message: 'Invalid webhook.' }, 400);
    const verified = await retrieveFlutterwaveV4Charge({ chargeId, clientId, clientSecret });
    const reference = String(verified.reference ?? '');
    const route = parseMketyPaymentReference(reference);
    if (!route) return json({ success: false, message: 'Unknown Mkety payment reference.' }, 400);

    const statusValue = String(verified.status ?? '');
    const status = statusValue === 'succeeded' ? 'success' : ['failed', 'voided'].includes(statusValue) ? 'failed' : 'pending';

    const result = await routeVerifiedMketyPayment({
      source: route.source,
      targetUuid: route.targetUuid,
      provider: 'flutterwave',
      reference,
      providerPaymentId: String(verified.id ?? chargeId),
      providerEventId: String(payload.id ?? verified.id ?? chargeId),
      amount: verified.amount,
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
    logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'Flutterwave webhook processing failed');
    return json({ success: false, message: 'Webhook processing failed.' }, 503);
  }
}

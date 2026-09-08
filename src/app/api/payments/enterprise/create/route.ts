import { enterpriseCheckoutService } from '@/features/enterprise-checkout/server/service';
import { createLogger } from '@/shared/lib/logger';

const logger = createLogger({ module: 'enterprise-checkout-create' });

function sameOriginAllowed(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function safeJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  if (!sameOriginAllowed(request)) return safeJson({ success: false, message: 'Forbidden.' }, 403);

  try {
    const body = await request.json();
    const suppliedKey = request.headers.get('idempotency-key')?.trim();
    const idempotencyKey = suppliedKey && suppliedKey.length >= 8 ? suppliedKey : crypto.randomUUID();
    const result = await enterpriseCheckoutService.createEnterpriseCheckout(body, { idempotencyKey });

    return safeJson({ success: true, ...result }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      message.includes('required') ||
      message.includes('invalid') ||
      message.includes('supported') ||
      message.includes('Amount') ||
      message.includes('USD') ||
      message.includes('Idempotency key conflicts')
    ) {
      return safeJson({ success: false, message }, message.includes('conflicts') ? 409 : 400);
    }

    logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'Enterprise checkout initiation failed');
    return safeJson({ success: false, message: 'Enterprise checkout is temporarily unavailable.' }, 503);
  }
}

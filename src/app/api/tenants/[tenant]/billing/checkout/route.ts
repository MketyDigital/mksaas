import { and, eq } from 'drizzle-orm';

import {
  getSelfServiceBillingPlan,
  isSelfServiceBillingPlanKey,
  isSelfServiceBillingTermKey,
} from '@/features/billing/catalog/self-service-plans';
import { createFlutterwaveStandardBillingAdapter } from '@/features/billing/gateways/flutterwave-standard';
import { createKoraBillingAdapter } from '@/features/billing/gateways/kora';
import { createNowPaymentsBillingAdapter } from '@/features/billing/gateways/nowpayments';
import { drizzleSelfServiceCheckoutRepository } from '@/features/billing/server/drizzle-self-service-checkout-repository';
import { createSelfServiceCheckout } from '@/features/billing/server/self-service-checkout';
import {
  getEnabledFlutterwaveSettlementCurrencies,
  isFlutterwaveSettlementCurrency,
} from '@/features/payments/flutterwave-currency';
import { db } from '@/shared/db';
import { tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

interface RouteContext {
  params: Promise<{ tenant: string }>;
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth(request);
  if (!session?.user?.id) return json({ success: false, message: 'Unauthorized.' }, 401);

  const { tenant: tenantSlug } = await context.params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return json({ success: false, message: 'Workspace not found.' }, 404);

  const membership = await db.query.tenantMemberships.findFirst({
    columns: { tenantId: true },
    where: and(
      eq(tenantMemberships.tenantId, tenant.id),
      eq(tenantMemberships.userId, session.user.id),
    ),
  });
  if (!membership) return json({ success: false, message: 'Forbidden.' }, 403);

  const contentType = request.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json')
    ? ((await request.json().catch(() => ({}))) as {
        planKey?: string;
        termKey?: string;
        provider?: string;
        paymentCurrency?: string;
      })
    : (Object.fromEntries(await request.formData()) as {
        planKey?: string;
        termKey?: string;
        provider?: string;
        paymentCurrency?: string;
      });

  const planKey = String(body.planKey ?? '');
  const termKey = String(body.termKey ?? '1m');
  if (!isSelfServiceBillingPlanKey(planKey)) {
    return json({ success: false, message: 'Unknown self-service plan.' }, 400);
  }
  if (!isSelfServiceBillingTermKey(termKey)) {
    return json({ success: false, message: 'Unknown billing term.' }, 400);
  }

  const provider = String(body.provider ?? 'nowpayments');
  const paymentCurrency = String(body.paymentCurrency ?? 'USD').toUpperCase();
  const flutterwaveHostedEnabled =
    (process.env.FLUTTERWAVE_API_MODE ?? 'v4') === 'v3-hosted' &&
    Boolean(process.env.FLUTTERWAVE_V3_SECRET_KEY && process.env.FLUTTERWAVE_V3_SECRET_HASH);

  let flutterwaveCurrencyEnabled = false;
  if (provider === 'flutterwave' && flutterwaveHostedEnabled && isFlutterwaveSettlementCurrency(paymentCurrency)) {
    try {
      flutterwaveCurrencyEnabled = getEnabledFlutterwaveSettlementCurrencies(
        process.env.MKETY_FLUTTERWAVE_USD_RATES_JSON,
      ).includes(paymentCurrency);
    } catch {
      return json({ success: false, message: 'Flutterwave currency configuration is invalid.' }, 503);
    }
    if (!flutterwaveCurrencyEnabled) {
      return json({ success: false, message: 'Selected Flutterwave payment currency is not enabled.' }, 400);
    }
  }

  const adapter =
    provider === 'nowpayments'
      ? process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET
        ? createNowPaymentsBillingAdapter({
            apiKey: process.env.NOWPAYMENTS_API_KEY,
            ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET,
          })
        : null
      : provider === 'flutterwave'
        ? flutterwaveHostedEnabled && isFlutterwaveSettlementCurrency(paymentCurrency) && flutterwaveCurrencyEnabled
          ? createFlutterwaveStandardBillingAdapter({
              secretKey: process.env.FLUTTERWAVE_V3_SECRET_KEY,
              settlementCurrency: paymentCurrency,
              serializedRates: process.env.MKETY_FLUTTERWAVE_USD_RATES_JSON,
            })
          : null
        : provider === 'kora'
          ? process.env.KORA_SECRET_KEY
            ? createKoraBillingAdapter({ secretKey: process.env.KORA_SECRET_KEY })
            : null
          : null;
  if (!adapter) {
    return json({ success: false, message: 'Selected payment method is not configured.' }, 503);
  }

  const plan = getSelfServiceBillingPlan(planKey);
  const requestOrigin = new URL(request.url).origin;
  const encodedPlan = encodeURIComponent(plan.key);
  const encodedTerm = encodeURIComponent(termKey);
  const checkoutPage = `${requestOrigin}/t/${encodeURIComponent(tenantSlug)}/billing/checkout`;
  try {
    const checkout = await createSelfServiceCheckout(
      drizzleSelfServiceCheckoutRepository,
      adapter,
      {
        tenantId: tenant.id,
        planKey,
        termKey,
        returnUrl: `${checkoutPage}?plan=${encodedPlan}&term=${encodedTerm}&payment=returned`,
        cancelUrl: `${checkoutPage}?plan=${encodedPlan}&term=${encodedTerm}&payment=cancelled`,
        customer: session.user.email
          ? { email: session.user.email, name: session.user.name ?? undefined }
          : undefined,
      },
    );

    if (!contentType.includes('application/json')) {
      return Response.redirect(checkout.checkoutUrl, 303);
    }

    return json({
      success: true,
      checkoutId: checkout.checkoutId,
      provider: checkout.provider,
      checkoutUrl: checkout.checkoutUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout could not be created.';
    const status = /already has a current Mkety subscription/i.test(message) ? 409 : 502;
    return json({ success: false, message }, status);
  }
}

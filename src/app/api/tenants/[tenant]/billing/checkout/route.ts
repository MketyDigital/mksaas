import { and, eq } from 'drizzle-orm';

import {
  getSelfServiceBillingPlan,
  isSelfServiceBillingPlanKey,
  isSelfServiceBillingTermKey,
} from '@/features/billing/catalog/self-service-plans';
import { createFlutterwaveBillingAdapter } from '@/features/billing/gateways/flutterwave';
import { createKoraBillingAdapter } from '@/features/billing/gateways/kora';
import { createNowPaymentsBillingAdapter } from '@/features/billing/gateways/nowpayments';
import { drizzleSelfServiceCheckoutRepository } from '@/features/billing/server/drizzle-self-service-checkout-repository';
import { createSelfServiceCheckout } from '@/features/billing/server/self-service-checkout';
import { getConfiguredMketyFxRates, getEnabledMketyFlutterwaveCurrencies } from '@/features/payments/flutterwave-standard';
import { getAvailableMketyPaymentProviders } from '@/features/payments/provider-availability';
import { buildTenantPaymentReturnPath } from '@/features/payments/return-path';
import { getMketyPaymentSettings } from '@/features/payments/settings';
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
    ? ((await request.json().catch(() => ({}))) as { planKey?: string; termKey?: string; provider?: string; collectionCurrency?: string })
    : (Object.fromEntries(await request.formData()) as { planKey?: string; termKey?: string; provider?: string; collectionCurrency?: string });

  const planKey = String(body.planKey ?? '');
  const termKey = String(body.termKey ?? '1m');
  if (!isSelfServiceBillingPlanKey(planKey)) {
    return json({ success: false, message: 'Unknown self-service plan.' }, 400);
  }
  if (!isSelfServiceBillingTermKey(termKey)) {
    return json({ success: false, message: 'Unknown billing term.' }, 400);
  }

  const provider = String(body.provider ?? 'nowpayments');
  const paymentSettings = await getMketyPaymentSettings();
  const enabledFlutterwaveCurrencies = getEnabledMketyFlutterwaveCurrencies(paymentSettings.flutterwave.fxRates);
  const availableProviders = getAvailableMketyPaymentProviders({
    nowpayments: {
      apiKey: process.env.NOWPAYMENTS_API_KEY,
      ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET,
    },
    flutterwave: {
      brokerSecret: process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET,
      collectionCurrencies: enabledFlutterwaveCurrencies,
      hasConfiguredCurrencyQuote: Object.keys(getConfiguredMketyFxRates(paymentSettings.flutterwave.fxRates)).length > 0,
    },
    kora: { publicKey: process.env.KORA_PUBLIC_KEY, secretKey: process.env.KORA_SECRET_KEY },
  });
  const isAvailable = availableProviders.some((option) => option.provider === provider);
  const adapter = isAvailable
    ? provider === 'nowpayments'
      ? createNowPaymentsBillingAdapter({
          apiKey: process.env.NOWPAYMENTS_API_KEY!,
          ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET!,
        })
      : provider === 'flutterwave'
        ? createFlutterwaveBillingAdapter({ brokerSecret: process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET! })
        : provider === 'kora'
          ? createKoraBillingAdapter({
              publicKey: process.env.KORA_PUBLIC_KEY!,
              secretKey: process.env.KORA_SECRET_KEY!,
            })
          : null
    : null;
  if (!adapter) {
    return json({ success: false, message: 'Selected payment method is not configured.' }, 503);
  }
  const collectionCurrency = String(body.collectionCurrency ?? 'USD');
  if (provider === 'flutterwave' && !enabledFlutterwaveCurrencies.includes(collectionCurrency as (typeof enabledFlutterwaveCurrencies)[number])) {
    return json({ success: false, message: 'Selected Flutterwave currency is not configured.' }, 400);
  }

  const plan = getSelfServiceBillingPlan(planKey);
  const requestOrigin = new URL(request.url).origin;
  const returnUrl = new URL(
    buildTenantPaymentReturnPath({
      tenantSlug,
      surface: 'billing',
      planKey: plan.key,
      termKey,
      currency: provider === 'flutterwave' ? collectionCurrency : undefined,
      state: 'returned',
    }),
    requestOrigin,
  ).toString();
  const cancelUrl = new URL(
    buildTenantPaymentReturnPath({
      tenantSlug,
      surface: 'billing',
      planKey: plan.key,
      termKey,
      currency: provider === 'flutterwave' ? collectionCurrency : undefined,
      state: 'cancelled',
    }),
    requestOrigin,
  ).toString();
  try {
    const checkout = await createSelfServiceCheckout(
      drizzleSelfServiceCheckoutRepository,
      adapter,
      {
        tenantId: tenant.id,
        planKey,
        termKey,
        returnUrl,
        cancelUrl,
        customer: session.user.email
          ? { email: session.user.email, name: session.user.name ?? undefined }
          : undefined,
        collectionCurrency: provider === 'flutterwave' ? collectionCurrency : undefined,
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
    const status = /already has a current Mkety .*subscription/i.test(message) ? 409 : 502;
    return json({ success: false, message }, status);
  }
}

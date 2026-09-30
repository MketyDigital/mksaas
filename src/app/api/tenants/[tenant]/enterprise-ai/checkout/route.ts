import { and, eq } from 'drizzle-orm';

import { createEnterpriseAiContractCheckout } from '@/features/ai-runtime/server/enterprise-contracts';
import { createFlutterwaveBillingAdapter } from '@/features/billing/gateways/flutterwave';
import { createKoraBillingAdapter } from '@/features/billing/gateways/kora';
import { createNowPaymentsBillingAdapter } from '@/features/billing/gateways/nowpayments';
import { db } from '@/shared/db';
import { tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

export async function POST(request: Request, context: { params: Promise<{ tenant: string }> }) {
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });

  const { tenant: tenantSlug } = await context.params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return Response.json({ success: false, message: 'Workspace not found.' }, { status: 404 });

  const membership = await db.query.tenantMemberships.findFirst({
    where: and(
      eq(tenantMemberships.tenantId, tenant.id),
      eq(tenantMemberships.userId, session.user.id),
    ),
    columns: { tenantId: true },
  });
  if (!membership) return Response.json({ success: false, message: 'Forbidden.' }, { status: 403 });

  const contentType = request.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json')
    ? await request.json().catch(() => ({})) as { provider?: string; collectionCurrency?: string; fundingAmountUsd?: string }
    : Object.fromEntries(await request.formData()) as { provider?: string; collectionCurrency?: string; fundingAmountUsd?: string };

  const provider = String(body.provider ?? 'nowpayments');
  const fundingText = String(body.fundingAmountUsd ?? '').trim();
  let fundingAmountMinor: bigint | undefined;
  if (fundingText) {
    const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(fundingText);
    if (!match) return Response.json({ success: false, message: 'Enter a valid funding amount.' }, { status: 400 });
    fundingAmountMinor = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
    if (fundingAmountMinor <= 0n) return Response.json({ success: false, message: 'Funding amount must be greater than zero.' }, { status: 400 });
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
        ? process.env.FLUTTERWAVE_PUBLIC_KEY &&
          process.env.FLUTTERWAVE_STANDARD_SECRET_KEY &&
          process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH
          ? createFlutterwaveBillingAdapter({
              publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
              standardSecretKey: process.env.FLUTTERWAVE_STANDARD_SECRET_KEY,
            })
          : null
        : provider === 'kora'
          ? process.env.KORA_PUBLIC_KEY && process.env.KORA_SECRET_KEY
            ? createKoraBillingAdapter({
                publicKey: process.env.KORA_PUBLIC_KEY,
                secretKey: process.env.KORA_SECRET_KEY,
              })
            : null
          : null;
  if (!adapter) {
    return Response.json({ success: false, message: 'Selected payment method is not configured.' }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const page = `${origin}/t/${encodeURIComponent(tenantSlug)}/enterprise-ai`;

  try {
    const checkout = await createEnterpriseAiContractCheckout({
      tenantId: tenant.id,
      adapter,
      returnUrl: `${page}?payment=returned`,
      cancelUrl: `${page}?payment=cancelled`,
      customer: session.user.email
        ? { email: session.user.email, name: session.user.name ?? undefined }
        : undefined,
      collectionCurrency: provider === 'flutterwave' ? String(body.collectionCurrency ?? 'USD') : undefined,
      fundingAmountMinor,
    });

    if (!contentType.includes('application/json')) {
      return Response.redirect(checkout.checkoutUrl, 303);
    }

    return Response.json({
      success: true,
      checkoutId: checkout.checkoutId,
      checkoutUrl: checkout.checkoutUrl,
      provider: checkout.provider,
      amountExpectedMinor: checkout.amountExpectedMinor.toString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enterprise AI checkout could not be created.';
    return Response.json({ success: false, message }, { status: /already has a current/i.test(message) ? 409 : 502 });
  }
}

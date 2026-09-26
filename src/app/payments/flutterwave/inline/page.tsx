import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { FlutterwaveInlineLauncher } from '@/features/payments/components/FlutterwaveInlineLauncher';
import {
  createFlutterwaveInlinePayload,
  createSaasFlutterwaveMetadata,
} from '@/features/payments/flutterwave-standard';
import { db } from '@/shared/db';
import { billingCheckouts, tenantMemberships, tenants } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

interface PageProps {
  searchParams: Promise<{ checkout?: string; returnPath?: string }>;
}

function validReturnPath(value: string, tenantSlug: string): string | null {
  try {
    const parsed = new URL(value, 'https://mkety.invalid');
    if (parsed.origin !== 'https://mkety.invalid') return null;
    if (parsed.pathname !== `/t/${tenantSlug}/billing/checkout`) return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

export const metadata = {
  title: 'Flutterwave Checkout | Mkety',
  robots: { index: false, follow: false },
};

export default async function FlutterwaveInlinePage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const query = await searchParams;
  const checkoutId = String(query.checkout ?? '');
  if (!checkoutId) notFound();

  const checkout = await db.query.billingCheckouts.findFirst({
    where: and(eq(billingCheckouts.id, checkoutId), eq(billingCheckouts.provider, 'flutterwave')),
  });
  if (!checkout || !checkout.providerCheckoutId) notFound();

  const membership = await db.query.tenantMemberships.findFirst({
    columns: { tenantId: true },
    where: and(
      eq(tenantMemberships.tenantId, checkout.tenantId),
      eq(tenantMemberships.userId, session.user.id),
    ),
  });
  if (!membership) notFound();

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, checkout.tenantId),
  });
  if (!tenant) notFound();

  const returnPath = validReturnPath(String(query.returnPath ?? ''), tenant.slug);
  if (!returnPath) notFound();

  const publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;
  const secretKey = process.env.FLUTTERWAVE_STANDARD_SECRET_KEY;
  const webhookHash = process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH;
  if (!publicKey || !secretKey || !webhookHash) {
    throw new Error('Flutterwave Inline is not fully configured.');
  }

  const amountMinor = checkout.providerAmountExpectedMinor ?? checkout.amountExpectedMinor;
  const currency = checkout.providerCurrency ?? checkout.currency;
  const payload = await createFlutterwaveInlinePayload({
    reference: checkout.providerCheckoutId,
    amountMinor,
    currency,
    email: session.user.email ?? '',
    customerName: session.user.name ?? undefined,
    redirectPath: returnPath,
    metadata: {
      ...createSaasFlutterwaveMetadata(checkout.id, checkout.tenantId),
      canonical_amount_minor: checkout.amountExpectedMinor.toString(),
      canonical_currency: checkout.currency,
      provider_amount_minor: amountMinor.toString(),
      provider_currency: currency,
    },
    publicKey,
    secretKey,
  });

  return (
    <main className="min-h-screen bg-background px-6 py-14">
      <FlutterwaveInlineLauncher payload={payload} />
    </main>
  );
}

import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { FlutterwaveInlineLauncher } from '@/features/payments/components/FlutterwaveInlineLauncher';
import { createCentralFlutterwaveCheckout } from '@/features/payments/central-flutterwave-broker';
import { normalizeTenantPaymentReturnPath } from '@/features/payments/return-path';
import { db } from '@/shared/db';
import { billingCheckouts, tenantMemberships, tenants } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

interface PageProps {
  searchParams: Promise<{ checkout?: string; returnPath?: string }>;
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

  const returnPath = normalizeTenantPaymentReturnPath(String(query.returnPath ?? ''), tenant.slug);
  if (!returnPath) notFound();

  const brokerSecret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
  if (!brokerSecret) throw new Error('Mkety Flutterwave payment broker is not configured.');

  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || 'https://app.mkety.com';
  const broker = await createCentralFlutterwaveCheckout(
    {
      source: 'saas',
      reference: checkout.providerCheckoutId,
      canonicalAmountMinor: checkout.amountExpectedMinor,
      requestedPaymentCurrency: checkout.providerCurrency ?? checkout.currency,
      email: session.user.email ?? '',
      customerName: session.user.name ?? undefined,
      tenantId: checkout.tenantId,
      checkoutId: checkout.id,
      redirectUrl: new URL(returnPath, appOrigin).toString(),
    },
    {
      brokerSecret,
      experience: 'inline',
    },
  );

  if (broker.experience === 'hosted' && broker.checkoutUrl) redirect(broker.checkoutUrl);
  if (!broker.inline) throw new Error('Flutterwave Inline payload was not returned by the Mkety payment broker.');

  return (
    <main className="min-h-screen bg-background px-6 py-14">
      <FlutterwaveInlineLauncher payload={broker.inline} />
    </main>
  );
}

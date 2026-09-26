import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { KoraEmbeddedLauncher } from '@/features/payments/components/KoraEmbeddedLauncher';
import { buildMketyPaymentMetadata } from '@/features/payments/reference';
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
  title: 'Kora Checkout | Mkety',
  robots: { index: false, follow: false },
};

export default async function KoraEmbeddedPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const query = await searchParams;
  const checkoutId = String(query.checkout ?? '');
  if (!checkoutId) notFound();

  const checkout = await db.query.billingCheckouts.findFirst({
    where: and(eq(billingCheckouts.id, checkoutId), eq(billingCheckouts.provider, 'kora')),
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

  const publicKey = process.env.KORA_PUBLIC_KEY;
  const secretKey = process.env.KORA_SECRET_KEY;
  if (!publicKey || !secretKey) {
    throw new Error('Kora embedded checkout is not fully configured.');
  }

  const amountMinor = checkout.providerAmountExpectedMinor ?? checkout.amountExpectedMinor;
  const currency = checkout.providerCurrency ?? checkout.currency;

  return (
    <main className="min-h-screen bg-background px-6 py-14">
      <KoraEmbeddedLauncher
        payload={{
          publicKey,
          reference: checkout.providerCheckoutId,
          amount: Number(amountMinor) / 100,
          currency,
          email: session.user.email ?? '',
          customerName: session.user.name ?? session.user.email ?? 'Mkety customer',
          notificationUrl: 'https://mkety.com/api/payments/kora/webhook',
          redirectPath: returnPath,
          metadata: buildMketyPaymentMetadata({
            source: 'saas',
            checkoutId: checkout.id,
            tenantId: checkout.tenantId,
          }),
        }}
      />
    </main>
  );
}

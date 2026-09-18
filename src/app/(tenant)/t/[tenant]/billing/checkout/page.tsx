import { and, eq } from 'drizzle-orm';
import { CheckCircle2, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import {
  getSelfServiceBillingPlan,
  isSelfServiceBillingPlanKey,
} from '@/features/billing/catalog/self-service-plans';
import { db } from '@/shared/db';
import { tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

interface PageProps {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ plan?: string; payment?: string }>;
}

export const metadata = {
  title: 'Checkout | Mkety',
  description: 'Complete your Mkety subscription checkout.',
  robots: { index: false, follow: false },
};

function formatUsd(amountMinor: bigint) {
  return `$${(Number(amountMinor) / 100).toFixed(2)}`;
}

export default async function BillingCheckoutPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  const membership = await db.query.tenantMemberships.findFirst({
    columns: { tenantId: true },
    where: and(
      eq(tenantMemberships.tenantId, tenant.id),
      eq(tenantMemberships.userId, session.user.id),
    ),
  });
  if (!membership) notFound();

  const query = await searchParams;
  if (!query.plan || !isSelfServiceBillingPlanKey(query.plan)) notFound();

  const plan = getSelfServiceBillingPlan(query.plan);
  const returned = query.payment === 'returned';
  const cancelled = query.payment === 'cancelled';

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Link href={`/t/${tenantSlug}`} className="text-sm font-medium text-primary hover:underline">
          ← Back to workspace
        </Link>

        <div className="mt-6 rounded-3xl border bg-card p-7 shadow-sm md:p-9">
          <img src="/mkety-logo.png" alt="Mkety" className="mb-6 h-9 w-auto" />

          {returned ? (
            <div className="mb-6 rounded-2xl border bg-muted/40 p-4 text-sm leading-6">
              Your payment provider has returned you to Mkety. Access is activated only after Mkety receives and verifies the final payment confirmation.
            </div>
          ) : null}

          {cancelled ? (
            <div className="mb-6 rounded-2xl border bg-muted/40 p-4 text-sm leading-6">
              Checkout was cancelled. No subscription access has been activated.
            </div>
          ) : null}

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Mkety subscription</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{plan.name}</h1>
          <p className="mt-3 text-muted-foreground">{plan.description}</p>

          <div className="mt-7 flex items-end gap-2">
            <span className="text-4xl font-bold">{formatUsd(plan.amountMinor)}</span>
            <span className="pb-1 text-sm text-muted-foreground">/ month</span>
          </div>

          <ul className="mt-7 space-y-3 text-sm">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Fixed server-verified subscription price
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Access activates only after verified payment settlement
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Billing and entitlement history remain tied to this workspace
            </li>
          </ul>

          {!returned ? (
            <form action={`/api/tenants/${tenantSlug}/billing/checkout`} method="post" className="mt-8">
              <input type="hidden" name="planKey" value={plan.key} />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-95"
              >
                <CreditCard className="h-4 w-4" />
                Continue to secure payment
              </button>
            </form>
          ) : (
            <Link
              href={`/t/${tenantSlug}`}
              className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground"
            >
              Return to workspace
            </Link>
          )}

          <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
            Returning from the payment page does not by itself activate access. Mkety waits for verified provider confirmation.
          </p>
        </div>
      </div>
    </main>
  );
}

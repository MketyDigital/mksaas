import { and, eq } from 'drizzle-orm';
import { CheckCircle2, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import {
  getSelfServiceBillingPlan,
  getSelfServiceBillingQuote,
  isSelfServiceBillingPlanKey,
  isSelfServiceBillingTermKey,
  SELF_SERVICE_BILLING_TERMS,
} from '@/features/billing/catalog/self-service-plans';
import { isMketyFlutterwaveCollectionCurrency } from '@/features/payments/flutterwave-standard';
import { getMketyPaymentSettings, quoteMketyFlutterwaveCurrency } from '@/features/payments/settings';
import { db } from '@/shared/db';
import { tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

interface PageProps {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ plan?: string; term?: string; payment?: string; currency?: string }>;
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
  const termKey = query.term && isSelfServiceBillingTermKey(query.term) ? query.term : '1m';
  const quote = getSelfServiceBillingQuote(plan.key, termKey);
  const returned = query.payment === 'returned';
  const cancelled = query.payment === 'cancelled';
  const nowPaymentsEnabled = Boolean(process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET);
  const flutterwaveEnabled = Boolean(
    process.env.FLUTTERWAVE_PUBLIC_KEY &&
      process.env.FLUTTERWAVE_STANDARD_SECRET_KEY &&
      process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH,
  );
  const koraEnabled = Boolean(process.env.KORA_SECRET_KEY);
  const paymentSettings = await getMketyPaymentSettings();
  const flutterwaveCurrencies = paymentSettings.enabledCurrencies;
  const selectedCurrency = flutterwaveCurrencies.includes(
    query.currency as (typeof flutterwaveCurrencies)[number],
  )
    ? String(query.currency)
    : 'USD';

  let flutterwaveQuote: { amountMinor: bigint; currency: string } | null = null;
  if (flutterwaveEnabled && isMketyFlutterwaveCollectionCurrency(selectedCurrency)) {
    try {
      flutterwaveQuote = quoteMketyFlutterwaveCurrency({
        canonicalAmountMinor: quote.amountMinor,
        collectionCurrency: selectedCurrency,
        settings: paymentSettings,
      });
    } catch {
      flutterwaveQuote = null;
    }
  }

  const paymentProviders = [
    ...(nowPaymentsEnabled ? [{ key: 'nowpayments', label: 'Crypto', detail: 'Primary payment method · supported digital assets.' }] : []),
    ...(flutterwaveEnabled && flutterwaveQuote
      ? [{ key: 'flutterwave', label: 'Card / local methods', detail: 'Flutterwave Inline opens securely over Mkety · available methods depend on your selected currency and merchant account.' }]
      : []),
    ...(koraEnabled ? [{ key: 'kora', label: 'Card / bank', detail: 'Kora hosted checkout.' }] : []),
  ];

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

          <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.values(SELF_SERVICE_BILLING_TERMS).map((term) => (
              <Link
                key={term.key}
                href={`/t/${tenantSlug}/billing/checkout?plan=${encodeURIComponent(plan.key)}&term=${term.key}`}
                className={term.key === termKey ? 'rounded-xl border border-primary bg-primary/5 p-3 text-center' : 'rounded-xl border p-3 text-center hover:border-primary/50'}
              >
                <span className="block text-sm font-semibold">{term.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {term.discountPercent ? `${term.discountPercent}% off` : 'Standard'}
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-7">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold">{formatUsd(quote.amountMinor)}</span>
              <span className="pb-1 text-sm text-muted-foreground">total for {quote.term.months} month{quote.term.months === 1 ? '' : 's'}</span>
            </div>
            {quote.term.discountPercent ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {formatUsd(quote.effectiveMonthlyMinor)}/month effective rate · save {formatUsd(quote.savingsMinor)}
              </p>
            ) : null}
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
            <div className="mt-8 space-y-5">
              {flutterwaveEnabled ? (
                <div className="rounded-2xl border bg-muted/30 p-4">
                  <p className="text-sm font-medium">Flutterwave payment currency</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mkety prices remain canonically USD. Choose an enabled collection currency; Mkety locks the quoted amount before opening Flutterwave Inline, and Flutterwave shows the payment methods available for that currency and merchant account.
                  </p>
                  {flutterwaveQuote ? (
                    <p className="mt-3 text-sm font-semibold">
                      Flutterwave collection amount: {new Intl.NumberFormat('en', {
                        style: 'currency',
                        currency: flutterwaveQuote.currency,
                        maximumFractionDigits: 2,
                      }).format(Number(flutterwaveQuote.amountMinor) / 100)}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      A live quote is not currently available for {selectedCurrency}. Choose another currency or use another payment method.
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {flutterwaveCurrencies.map((currency) => (
                      <Link
                        key={currency}
                        href={`/t/${tenantSlug}/billing/checkout?plan=${encodeURIComponent(plan.key)}&term=${termKey}&currency=${currency}`}
                        className={currency === selectedCurrency ? 'rounded-lg border border-primary bg-primary/5 px-2 py-2 text-center text-xs font-semibold' : 'rounded-lg border px-2 py-2 text-center text-xs hover:border-primary/50'}
                      >
                        {currency}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {paymentProviders.length ? paymentProviders.map((provider, index) => (
                <form key={provider.key} action={`/api/tenants/${tenantSlug}/billing/checkout`} method="post">
                  <input type="hidden" name="planKey" value={plan.key} />
                  <input type="hidden" name="termKey" value={termKey} />
                  <input type="hidden" name="provider" value={provider.key} />
                  {provider.key === 'flutterwave' ? (
                    <input type="hidden" name="collectionCurrency" value={selectedCurrency} />
                  ) : null}
                  <button
                    type="submit"
                    className={index === 0
                      ? "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-95"
                      : "inline-flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 font-semibold transition hover:border-primary/60"}
                  >
                    <CreditCard className="h-4 w-4" />
                    Continue to secure payment · {provider.label}
                  </button>
                  <p className="mt-1 text-center text-xs text-muted-foreground">{provider.detail}</p>
                </form>
              )) : (
                <p className="rounded-xl border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                  Secure payment methods are temporarily unavailable.
                </p>
              )}
            </div>
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

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { FlutterwaveInlineLauncher } from '@/features/payments/components/FlutterwaveInlineLauncher';
import { getFlutterwaveInlineSession } from '@/features/payments/server/flutterwave-inline-session';

export const metadata = {
  title: 'Secure Payment | Mkety',
  description: 'Complete your secure Mkety payment.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function FlutterwavePaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const query = await searchParams;
  const sessionId = String(query.session ?? '');
  const publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;

  if (!sessionId || !publicKey) notFound();

  const checkout = await getFlutterwaveInlineSession({ sessionId, publicKey });
  if (!checkout) notFound();

  const { session, inlineConfig } = checkout;

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="rounded-3xl border bg-card p-7 shadow-sm md:p-9">
          <img src="/mkety-logo.png" alt="Mkety" className="mb-6 h-9 w-auto" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Secure Mkety payment</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Complete your payment</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your payment details were prepared and locked by Mkety. Flutterwave handles the payment modal and supported
            payment methods for the selected currency.
          </p>

          <div className="my-7 rounded-2xl border bg-muted/30 p-5">
            <p className="text-sm text-muted-foreground">Amount to collect</p>
            <p className="mt-1 text-3xl font-bold">
              {new Intl.NumberFormat('en', {
                style: 'currency',
                currency: session.collectionCurrency,
                maximumFractionDigits: 2,
              }).format(Number(BigInt(session.collectionAmountMinor)) / 100)}
            </p>
            {session.collectionCurrency !== session.canonicalCurrency ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Canonical Mkety price: USD {(Number(BigInt(session.canonicalAmountMinor)) / 100).toFixed(2)}
              </p>
            ) : null}
          </div>

          <FlutterwaveInlineLauncher config={inlineConfig} />

          <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
            Mkety activates access only after server-side payment verification. This page never receives your raw card
            number, CVV, or expiry details.
          </p>

          <Link
            href={session.redirectUrl}
            className="mt-5 block text-center text-sm font-medium text-primary hover:underline"
          >
            Return without paying
          </Link>
        </div>
      </div>
    </main>
  );
}

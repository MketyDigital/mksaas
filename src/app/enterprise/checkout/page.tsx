import Link from 'next/link';

import { MketyPublicShell } from '@/features/platform-content/components/public/MketyPublicShell';
import { getPublishedPublicChrome } from '@/features/platform-content/server/public-chrome';

export const metadata = {
  title: 'Enterprise Payment | Mkety',
  description: 'Enterprise payment links are issued after Mkety and the customer agree the project scope and amount.',
};

export default async function EnterpriseCheckoutPage() {
  const chrome = await getPublishedPublicChrome();

  return (
    <MketyPublicShell {...chrome}>
      <section className="mx-auto max-w-4xl px-6 py-16 md:py-24">
        <div className="mx-auto rounded-3xl border bg-card p-8 text-center shadow-sm md:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Mkety Enterprise</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Your payment amount is agreed before checkout.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Enterprise projects, including specialized Trading solutions, are scoped and priced with Mkety first. Mkety then sends a secure hosted payment link for the exact agreed deposit, milestone, balance, or full project amount.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            Customers do not enter or change the agreed amount here. Payment confirmation also does not automatically grant subscriptions, credits, wallet funds, infrastructure, or workspace access; fulfillment and access are controlled separately after verification.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/enterprise" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Back to Enterprise</Link>
            <Link href="/contact" className="rounded-xl border px-5 py-3 text-sm font-semibold">Contact Mkety</Link>
          </div>
        </div>
      </section>
    </MketyPublicShell>
  );
}

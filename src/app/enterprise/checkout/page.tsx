import { EnterpriseCheckoutForm } from '@/features/enterprise-checkout/components/EnterpriseCheckoutForm';
import { MketyPublicShell } from '@/features/platform-content/components/public/MketyPublicShell';
import { getPublishedPublicChrome } from '@/features/platform-content/server/public-chrome';

export const metadata = {
  title: 'Enterprise Checkout | Mkety',
  description: 'Start payment for an agreed Mkety enterprise project.',
};

export default async function EnterpriseCheckoutPage() {
  const chrome = await getPublishedPublicChrome();

  return (
    <MketyPublicShell {...chrome}>
      <section className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Mkety Enterprise</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Start your agreed enterprise project</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">Use this checkout only after you have an agreed project scope or quote with Mkety. Your payment remains separate from Platform subscriptions and is verified before fulfillment.</p>
        </div>
        <EnterpriseCheckoutForm />
      </section>
    </MketyPublicShell>
  );
}

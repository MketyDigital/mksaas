import Link from 'next/link';

import { AdminEnterprisePaymentLinkForm } from '@/features/enterprise-checkout/components/AdminEnterprisePaymentLinkForm';
import { getEnabledMketyFlutterwaveCurrencies } from '@/features/payments/flutterwave-standard';
import { getMketyPaymentProviderStatuses } from '@/features/payments/provider-availability';
import { getMketyPaymentSettings } from '@/features/payments/settings';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';

interface EnterprisePaymentsPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function EnterprisePaymentsPage({ params }: EnterprisePaymentsPageProps) {
  const { tenant } = await params;
  await requirePlatformControlAccess(tenant);
  const paymentSettings = await getMketyPaymentSettings();
  const statuses = getMketyPaymentProviderStatuses({
    nowpayments: {
      apiKey: process.env.NOWPAYMENTS_API_KEY,
      ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET,
    },
    flutterwave: {
      brokerSecret: process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET,
      collectionCurrencies: getEnabledMketyFlutterwaveCurrencies(paymentSettings.flutterwave.fxRates),
      hasConfiguredCurrencyQuote: Object.keys(paymentSettings.flutterwave.fxRates).length > 0,
    },
    kora: { publicKey: process.env.KORA_PUBLIC_KEY, secretKey: process.env.KORA_SECRET_KEY },
  });
  const providers = statuses.filter(({ ready }) => ready).map(({ provider }) => provider);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/ops/${tenant}/platform-control`} className="text-sm font-medium text-primary hover:underline">
          ← Platform Control Center
        </Link>
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.25em] text-primary">Enterprise operations</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Enterprise Payments</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Create hosted payment links for agreed Enterprise quotes, deposits, milestones, and balances. The amount is
          set by Mkety administration and is not customer-editable.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {statuses.map(({ provider, ready, label }) => (
          <div key={provider} className="rounded-xl border bg-card p-4">
            <p className="font-semibold">{label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {ready ? 'Ready for hosted payment links' : 'Unavailable · runtime configuration incomplete'}
            </p>
          </div>
        ))}
      </div>

      <AdminEnterprisePaymentLinkForm tenant={tenant} providers={providers} />
    </div>
  );
}

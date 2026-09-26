import {
  MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES,
  type MketyPaymentSettings,
} from '@/features/payments/config';
import { updateMketyPaymentSettings } from '@/features/payments/server/admin-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

interface PaymentSettingsFormProps {
  tenant: string;
  settings: MketyPaymentSettings;
  readiness: {
    nowpayments: boolean;
    flutterwave: boolean;
    kora: boolean;
  };
}

export function PaymentSettingsForm({ tenant, settings, readiness }: PaymentSettingsFormProps) {
  const action = updateMketyPaymentSettings.bind(null, tenant);

  return (
    <form action={action} className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Payment provider status</CardTitle>
          <CardDescription>
            Secrets stay in the protected runtime. This screen stores business configuration only.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="font-semibold">NOWPayments</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {readiness.nowpayments ? 'Configured · primary crypto' : 'Not fully configured'}
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-semibold">Flutterwave</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {readiness.flutterwave ? 'Configured · v3 Inline' : 'Needs public key, secret key and webhook hash'}
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-semibold">Kora</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {readiness.kora ? 'Configured · embedded checkout' : 'Hidden until public + secret keys are configured'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Flutterwave collection currencies</CardTitle>
          <CardDescription>
            Mkety pricing remains USD. Enter the commercial amount of each currency charged for 1 USD.
            Leave a currency blank to keep it unavailable to customers. Flutterwave decides which payment rails
            are valid for the selected currency and merchant account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <label className="block text-sm font-medium">
            FX markup
            <div className="mt-2 flex max-w-sm items-center rounded-xl border bg-background">
              <input
                className="w-full bg-transparent px-4 py-3 outline-none"
                type="number"
                min={0}
                max={5000}
                step={1}
                name="flutterwave_fx_markup_bps"
                defaultValue={settings.flutterwave.fxMarkupBps}
              />
              <span className="pr-4 text-sm text-muted-foreground">bps</span>
            </div>
            <span className="mt-1 block text-xs text-muted-foreground">100 basis points = 1%.</span>
          </label>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES.filter((currency) => currency !== 'USD').map(
              (currency) => (
                <label key={currency} className="text-sm font-medium">
                  1 USD = {currency}
                  <input
                    className="mt-2 w-full rounded-xl border bg-background px-4 py-3 outline-none focus:border-primary"
                    name={`fx_${currency}`}
                    inputMode="decimal"
                    placeholder="Not configured"
                    defaultValue={settings.flutterwave.fxRates[currency] ?? ''}
                  />
                </label>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <button className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">
          Save payment settings
        </button>
      </div>
    </form>
  );
}

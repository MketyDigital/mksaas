import {
  MKETY_FLUTTERWAVE_COLLECTION_CURRENCIES,
  type MketyPaymentSettings,
} from '@/features/payments/config';
import {
  MKETY_FLUTTERWAVE_PAYMENT_METHOD_GROUPS,
  MKETY_FLUTTERWAVE_PAYMENT_METHODS,
} from '@/features/payments/flutterwave-payment-methods';
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
              {readiness.nowpayments ? 'Ready · primary crypto' : 'Incomplete · requires NOWPayments API and IPN credentials'}
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-semibold">Flutterwave</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {readiness.flutterwave
                ? 'Ready · v3 Inline with an operator-priced collection currency'
                : 'Incomplete · requires the central checkout broker and an operator-priced currency'}
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-semibold">Kora</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {readiness.kora ? 'Ready · embedded checkout' : 'Incomplete · requires public and secret keys'}
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

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Flutterwave payment methods</CardTitle>
          <CardDescription>
            Mkety deliberately leaves Flutterwave payment options dashboard-controlled. Enabled methods appear
            automatically when valid for the customer's selected currency, and methods currently pending Flutterwave
            review can appear as soon as Flutterwave approves them without a Mkety code change.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
            Do not add a per-transaction <code>payment_options</code> allow-list. That would suppress dashboard-enabled
            methods such as newly approved card, bank, wallet or local-payment rails.
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {MKETY_FLUTTERWAVE_PAYMENT_METHOD_GROUPS.map((group) => (
              <div key={group} className="rounded-xl border p-4">
                <p className="font-semibold">{group}</p>
                <div className="mt-3 space-y-3">
                  {MKETY_FLUTTERWAVE_PAYMENT_METHODS.filter((method) => method.group === group).map((method) => (
                    <div key={method.key}>
                      <p className="text-sm font-medium">{method.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {method.currencyHints.join(' · ')}{method.note ? ` · ${method.note}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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

interface NowPaymentsEmbeddedCheckoutProps {
  invoiceId: string;
}

export function NowPaymentsEmbeddedCheckout({ invoiceId }: NowPaymentsEmbeddedCheckoutProps) {
  const encodedInvoiceId = encodeURIComponent(invoiceId);
  const widgetUrl = `https://nowpayments.io/embeds/payment-widget?iid=${encodedInvoiceId}`;
  const hostedUrl = `https://nowpayments.io/payment/?iid=${encodedInvoiceId}`;

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border bg-card p-6 shadow-sm md:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Secure payment</p>
      <h1 className="mt-2 text-2xl font-bold">Pay with cryptocurrency</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The official NOWPayments checkout is embedded below so you can complete payment without leaving Mkety.
      </p>
      <div className="mt-6 overflow-hidden rounded-2xl border bg-background">
        <iframe
          src={widgetUrl}
          title="NOWPayments secure cryptocurrency checkout"
          className="h-[720px] w-full border-0"
          allow="clipboard-write; payment"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        If the embedded checkout is unavailable in your browser,{' '}
        <a
          href={hostedUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold text-primary underline underline-offset-4"
        >
          open the secure NOWPayments checkout
        </a>
        . Payment completion in the widget or hosted fallback does not by itself activate access. Mkety waits for a
        verified NOWPayments webhook and validates the final amount and currency before settlement.
      </p>
    </div>
  );
}

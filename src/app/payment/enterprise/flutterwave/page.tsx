import { notFound, redirect } from 'next/navigation';

import { enterpriseOrderRepository } from '@/features/enterprise-checkout/server/repository';
import { FlutterwaveInlineLauncher } from '@/features/payments/components/FlutterwaveInlineLauncher';
import { createCentralFlutterwaveCheckout } from '@/features/payments/central-flutterwave-broker';

interface PageProps {
  searchParams: Promise<{ orderId?: string }>;
}

export const metadata = {
  title: 'Enterprise Flutterwave Checkout | Mkety',
  robots: { index: false, follow: false },
};

export default async function EnterpriseFlutterwavePage({ searchParams }: PageProps) {
  const query = await searchParams;
  const orderId = String(query.orderId ?? '');
  if (!orderId) notFound();

  const order = await enterpriseOrderRepository.findById(orderId);
  if (!order || order.paymentProvider !== 'flutterwave' || !order.providerCheckoutReference) notFound();
  if (order.paymentStatus === 'confirmed') {
    redirect(`/payment/enterprise/success?orderId=${encodeURIComponent(order.id)}`);
  }

  const brokerSecret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
  if (!brokerSecret) throw new Error('Mkety Flutterwave payment broker is not configured.');

  const broker = await createCentralFlutterwaveCheckout(
    {
      source: 'enterprise',
      reference: order.providerCheckoutReference,
      canonicalAmountMinor: order.amountMinor,
      requestedPaymentCurrency: order.currency,
      email: order.email,
      customerName: order.customerName,
      orderId: order.id,
      redirectUrl: `https://mkety.com/payment/enterprise/success?orderId=${encodeURIComponent(order.id)}`,
    },
    {
      brokerSecret,
      experience: 'inline',
    },
  );

  if (broker.experience === 'hosted' && broker.checkoutUrl) redirect(broker.checkoutUrl);
  if (!broker.inline) throw new Error('Flutterwave Inline payload was not returned by the Mkety payment broker.');

  return (
    <main className="min-h-screen bg-background px-6 py-14">
      <FlutterwaveInlineLauncher payload={broker.inline} />
    </main>
  );
}

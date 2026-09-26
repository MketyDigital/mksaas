import { notFound, redirect } from 'next/navigation';

import { enterpriseOrderRepository } from '@/features/enterprise-checkout/server/repository';
import { FlutterwaveInlineLauncher } from '@/features/payments/components/FlutterwaveInlineLauncher';
import { createFlutterwaveInlinePayload } from '@/features/payments/flutterwave-standard';
import { buildMketyPaymentMetadata } from '@/features/payments/reference';

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

  const publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;
  const secretKey = process.env.FLUTTERWAVE_STANDARD_SECRET_KEY;
  const webhookHash = process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH;
  if (!publicKey || !secretKey || !webhookHash) {
    throw new Error('Flutterwave Inline is not fully configured.');
  }

  const payload = await createFlutterwaveInlinePayload({
    reference: order.providerCheckoutReference,
    amountMinor: order.amountMinor,
    currency: order.currency,
    email: order.email,
    customerName: order.customerName,
    redirectPath: `/payment/enterprise/success?orderId=${encodeURIComponent(order.id)}`,
    metadata: buildMketyPaymentMetadata({
      source: 'enterprise',
      orderId: order.id,
    }),
    publicKey,
    secretKey,
  });

  return (
    <main className="min-h-screen bg-background px-6 py-14">
      <FlutterwaveInlineLauncher payload={payload} />
    </main>
  );
}

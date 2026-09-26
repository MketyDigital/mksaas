import { notFound, redirect } from 'next/navigation';

import { enterpriseOrderRepository } from '@/features/enterprise-checkout/server/repository';
import { KoraEmbeddedLauncher } from '@/features/payments/components/KoraEmbeddedLauncher';
import { buildMketyPaymentMetadata } from '@/features/payments/reference';

interface PageProps {
  searchParams: Promise<{ orderId?: string }>;
}

export const metadata = {
  title: 'Enterprise Kora Checkout | Mkety',
  robots: { index: false, follow: false },
};

export default async function EnterpriseKoraPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const orderId = String(query.orderId ?? '');
  if (!orderId) notFound();

  const order = await enterpriseOrderRepository.findById(orderId);
  if (!order || order.paymentProvider !== 'kora' || !order.providerCheckoutReference) notFound();
  if (order.paymentStatus === 'confirmed') {
    redirect(`/payment/enterprise/success?orderId=${encodeURIComponent(order.id)}`);
  }

  const publicKey = process.env.KORA_PUBLIC_KEY;
  const secretKey = process.env.KORA_SECRET_KEY;
  if (!publicKey || !secretKey) {
    throw new Error('Kora embedded checkout is not fully configured.');
  }

  return (
    <main className="min-h-screen bg-background px-6 py-14">
      <KoraEmbeddedLauncher
        payload={{
          publicKey,
          reference: order.providerCheckoutReference,
          amount: Number(order.amountMinor) / 100,
          currency: order.currency,
          email: order.email,
          customerName: order.customerName,
          notificationUrl: 'https://mkety.com/api/payments/kora/webhook',
          redirectPath: `/payment/enterprise/success?orderId=${encodeURIComponent(order.id)}`,
          metadata: buildMketyPaymentMetadata({
            source: 'enterprise',
            orderId: order.id,
          }),
        }}
      />
    </main>
  );
}

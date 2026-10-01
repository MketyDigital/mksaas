import { notFound } from 'next/navigation';

import { readAssistKoraCheckoutToken } from '@/features/payments/assist-kora-token';
import { KoraEmbeddedLauncher } from '@/features/payments/components/KoraEmbeddedLauncher';

interface PageProps {
  searchParams: Promise<{ payload?: string; signature?: string }>;
}

export const metadata = { title: 'Kora Checkout | Mkety Assist', robots: { index: false, follow: false } };

export default async function AssistKoraPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const brokerSecret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
  const publicKey = process.env.KORA_PUBLIC_KEY;
  const secretKey = process.env.KORA_SECRET_KEY;
  if (!brokerSecret || !publicKey || !secretKey) notFound();

  const data = readAssistKoraCheckoutToken(String(query.payload || ''), String(query.signature || ''), brokerSecret);
  if (!data) notFound();

  return (
    <main className="min-h-screen bg-background px-6 py-14">
      <KoraEmbeddedLauncher
        payload={{
          publicKey,
          reference: data.reference,
          amount: data.amount,
          currency: 'USD',
          email: data.email,
          customerName: data.customerName,
          notificationUrl: 'https://mkety.com/api/payments/kora/webhook',
          redirectPath: `https://mkety-assist.mkety.app/payment/return?reference=${encodeURIComponent(data.reference)}`,
          metadata: { source: 'assist' },
        }}
      />
    </main>
  );
}

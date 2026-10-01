import { createHmac, timingSafeEqual } from 'node:crypto';
import { notFound } from 'next/navigation';

import { KoraEmbeddedLauncher } from '@/features/payments/components/KoraEmbeddedLauncher';

interface PageProps {
  searchParams: Promise<{ payload?: string; signature?: string }>;
}
export const metadata = { title: 'Kora Checkout | Mkety Assist', robots: { index: false, follow: false } };

function verify(payload: string, signature: string, secret: string) {
  const expected = Buffer.from(createHmac('sha256', secret).update(payload).digest('base64url'));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export default async function AssistKoraPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const payload = String(query.payload || '');
  const signature = String(query.signature || '');
  const brokerSecret = process.env.FLUTTERWAVE_CHECKOUT_BROKER_SECRET;
  const publicKey = process.env.KORA_PUBLIC_KEY;
  const secretKey = process.env.KORA_SECRET_KEY;
  if (!payload || !signature || !brokerSecret || !publicKey || !secretKey || !verify(payload, signature, brokerSecret)) notFound();

  let data: { reference?: string; amount?: number; currency?: string; email?: string; customerName?: string; exp?: number };
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { notFound(); }
  if (!data!.reference || !data!.amount || data!.currency !== 'USD' || !data!.email || Number(data!.exp || 0) < Math.floor(Date.now() / 1000)) notFound();

  return (
    <main className="min-h-screen bg-background px-6 py-14">
      <KoraEmbeddedLauncher
        payload={{
          publicKey,
          reference: data!.reference,
          amount: Number(data!.amount),
          currency: 'USD',
          email: data!.email,
          customerName: data!.customerName || data!.email,
          notificationUrl: 'https://mkety.com/api/payments/kora/webhook',
          redirectPath: `https://mkety-assist.mkety.app/payment/return?reference=${encodeURIComponent(data!.reference)}`,
          metadata: { source: 'assist' },
        }}
      />
    </main>
  );
}

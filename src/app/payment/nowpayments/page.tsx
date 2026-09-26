import { notFound } from 'next/navigation';

import { NowPaymentsEmbeddedCheckout } from '@/features/payments/components/NowPaymentsEmbeddedCheckout';

interface PageProps {
  searchParams: Promise<{ iid?: string }>;
}

export const metadata = {
  title: 'NOWPayments Checkout | Mkety',
  robots: { index: false, follow: false },
};

const INVOICE_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export default async function NowPaymentsCheckoutPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const invoiceId = String(query.iid ?? '').trim();
  if (!INVOICE_ID_PATTERN.test(invoiceId)) notFound();

  return (
    <main className="min-h-screen bg-background px-6 py-14">
      <NowPaymentsEmbeddedCheckout invoiceId={invoiceId} />
    </main>
  );
}

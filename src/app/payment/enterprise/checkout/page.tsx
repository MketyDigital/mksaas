import { NowPaymentsEnterprisePaypoint } from '@/features/enterprise-checkout/components/NowPaymentsEnterprisePaypoint';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Enterprise payment | Mkety', referrer: 'no-referrer' as const };

export default async function EnterprisePaymentCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;
  return <main className="min-h-screen px-4 py-16"><NowPaymentsEnterprisePaypoint token={token} /></main>;
}

import { EnterprisePaymentStatus } from '@/features/enterprise-checkout/components/EnterprisePaymentStatus';
import { MketyPublicShell } from '@/features/platform-content/components/public/MketyPublicShell';
import { getPublishedPublicChrome } from '@/features/platform-content/server/public-chrome';

export default async function EnterprisePaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const [{ orderId }, chrome] = await Promise.all([searchParams, getPublishedPublicChrome()]);
  return (
    <MketyPublicShell {...chrome}>
      <section className="px-6 py-20">
        <EnterprisePaymentStatus orderId={orderId} returnState="success" />
      </section>
    </MketyPublicShell>
  );
}

import Link from 'next/link';

import { AdminEnterprisePaymentLinkForm } from '@/features/enterprise-checkout/components/AdminEnterprisePaymentLinkForm';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';

interface EnterprisePaymentsPageProps {
  params: Promise<{ tenant: string }>;
}

export default async function EnterprisePaymentsPage({ params }: EnterprisePaymentsPageProps) {
  const { tenant } = await params;
  await requirePlatformControlAccess(tenant);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/t/${tenant}/admin/platform-control`} className="text-sm font-medium text-primary hover:underline">
          ← Platform Control Center
        </Link>
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.25em] text-primary">Enterprise operations</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Enterprise Payments</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Create hosted payment links for agreed Enterprise quotes, deposits, milestones, and balances. The amount is
          set by Mkety administration and is not customer-editable.
        </p>
      </div>

      <AdminEnterprisePaymentLinkForm tenant={tenant} />
    </div>
  );
}

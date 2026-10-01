import { DepartmentsClient } from '@/features/admin/components/DepartmentsClient';
import { requirePermission } from '@/shared/lib/permissions';
import { getDepartmentsWithDetails } from '@/shared/services/department-service';

export const dynamic = 'force-dynamic';

export default async function DepartmentsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  await requirePermission(tenant, 'admin:settings');
  const result = await getDepartmentsWithDetails(tenant);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Departments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Organize members and assign department managers.</p>
      </div>
      <DepartmentsClient tenantSlug={tenant} initialDepartments={result.data ?? []} />
    </div>
  );
}

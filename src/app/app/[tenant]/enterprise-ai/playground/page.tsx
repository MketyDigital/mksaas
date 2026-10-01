import Link from 'next/link';
import { redirect } from 'next/navigation';

import { EnterpriseAiPlaygroundClient } from '@/features/ai-runtime/components/EnterpriseAiPlaygroundClient';
import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { listEnterpriseAiSolutionInstances } from '@/features/ai-runtime/server/business-solutions';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic='force-dynamic';

export default async function EnterpriseAiPlaygroundPage({params}:{params:Promise<{tenant:string}>}){
  const {tenant:tenantSlug}=await params;
  await requirePermission(tenantSlug,'ai:agents:manage');
  const tenant=await getTenantBySlug(tenantSlug);
  if(!tenant) redirect('/select-tenant');
  if(!(await hasEnterpriseAiAccess(tenant.id))) redirect(`/app/${tenantSlug}/enterprise-ai`);
  const solutions=await listEnterpriseAiSolutionInstances(tenant.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-4">
      <div>
        <Link className="text-sm text-muted-foreground" href={`/app/${tenantSlug}/enterprise-ai`}>← Enterprise AI</Link>
        <h1 className="mt-2 text-3xl font-bold">Playground</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Test the exact solution configuration before connecting customers. Production inference must still pass the global release gate.
        </p>
      </div>
      {solutions.length
        ? <EnterpriseAiPlaygroundClient tenantSlug={tenantSlug} solutions={solutions.map((item)=>({id:item.id,name:item.name,status:item.status}))} />
        : <p className="rounded-xl border p-6 text-sm text-muted-foreground">Create an Enterprise AI solution before using the playground.</p>}
    </div>
  );
}

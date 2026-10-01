import { Activity } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { listEnterpriseAiCustomerRuns } from '@/features/ai-runtime/server/customer-runs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic='force-dynamic';

export default async function EnterpriseAiRunsPage({params}:{params:Promise<{tenant:string}>}){
  const {tenant:tenantSlug}=await params;
  await requirePermission(tenantSlug,'ai:usage:view');
  const tenant=await getTenantBySlug(tenantSlug);
  if(!tenant) redirect('/select-tenant');
  if(!(await hasEnterpriseAiAccess(tenant.id))) redirect(`/app/${tenantSlug}/enterprise-ai`);
  const runs=await listEnterpriseAiCustomerRuns(tenant.id);

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-4">
      <div>
        <Link className="text-sm text-muted-foreground" href={`/app/${tenantSlug}/enterprise-ai`}>← Enterprise AI</Link>
        <div className="mt-2 flex items-center gap-3"><Activity className="h-7 w-7 text-primary" /><h1 className="text-3xl font-bold">Runs & usage logs</h1></div>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Customer-safe execution history for Enterprise AI. Provider secrets, internal margin calculations and protected settlement metadata are not exposed here.
        </p>
      </div>
      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Recent managed AI requests</CardTitle><CardDescription>{runs.length} recent Enterprise AI run(s)</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr><th className="py-3 pr-4">Time</th><th className="pr-4">Solution</th><th className="pr-4">Model</th><th className="pr-4">Status</th><th className="pr-4">Tokens</th><th className="pr-4">Credits</th><th>Request</th></tr>
            </thead>
            <tbody>
              {runs.map((run)=>(
                <tr className="border-b last:border-0" key={run.id}>
                  <td className="py-3 pr-4 whitespace-nowrap">{run.startedAt.toLocaleString()}</td>
                  <td className="pr-4 font-medium">{run.solutionName}</td>
                  <td className="pr-4 font-mono text-xs">{run.modelAlias}</td>
                  <td className="pr-4"><span className="rounded-full border px-2 py-1 text-xs">{run.status}</span>{run.errorCode?<span className="ml-2 text-xs text-destructive">{run.errorCode}</span>:null}</td>
                  <td className="pr-4 whitespace-nowrap">{(run.inputTokens+run.outputTokens).toString()} <span className="text-xs text-muted-foreground">({run.cachedInputTokens.toString()} cached)</span></td>
                  <td className="pr-4">{(run.settledCredits??run.reservedCredits??0n).toString()}</td>
                  <td className="font-mono text-xs">{run.id.slice(0,8)}…</td>
                </tr>
              ))}
              {!runs.length?<tr><td className="py-8 text-center text-muted-foreground" colSpan={7}>No Enterprise AI requests recorded yet.</td></tr>:null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

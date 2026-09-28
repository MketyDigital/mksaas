import { CheckCircle2, ExternalLink, MessageSquareMore } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ENTERPRISE_AI_CHANNELS } from '@/features/ai-runtime/channels/registry';
import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function EnterpriseAiChannelsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantSlug } = await params;
  await requirePermission(tenantSlug, 'ai:channels:manage');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) redirect('/select-tenant');
  if (!(await hasEnterpriseAiAccess(tenant.id))) redirect(`/t/${tenantSlug}/enterprise-ai`);

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-4">
      <div>
        <Link href={`/t/${tenantSlug}/enterprise-ai`} className="text-sm text-muted-foreground">← Enterprise AI</Link>
        <div className="mt-2 flex items-center gap-3"><MessageSquareMore className="h-7 w-7 text-primary" /><h1 className="text-3xl font-bold">Channels</h1></div>
        <p className="mt-2 max-w-3xl text-muted-foreground">Connect the same approved AI solution to the places your customers and team already use. Each connection remains tenant-scoped and entitlement-controlled.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ENTERPRISE_AI_CHANNELS.map((channel) => (
          <Card className="rounded-2xl" key={channel.key}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div><CardTitle>{channel.label}</CardTitle><CardDescription className="mt-2">{channel.customerSetup.join(' → ')}</CardDescription></div>
                <span className="rounded-full border px-2.5 py-1 text-xs font-semibold">Day one</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                {channel.supportsInbound ? <span className="rounded-full bg-muted px-2.5 py-1">Inbound</span> : null}
                {channel.supportsOutbound ? <span className="rounded-full bg-muted px-2.5 py-1">Outbound</span> : null}
                {channel.supportsHumanHandoff ? <span className="rounded-full bg-muted px-2.5 py-1">Human handoff</span> : null}
              </div>
              <p className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" /> Credentials are referenced server-side; raw provider secrets are never stored in customer-visible configuration.</p>
              <p className="text-xs text-muted-foreground">Access key: {channel.entitlement}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Add another channel later</CardTitle><CardDescription>The channel layer is adapter-based. A new provider plugs into the same message, security, usage, human-handoff and audit contracts instead of requiring another AI runtime.</CardDescription></CardHeader>
        <CardContent><Link className="inline-flex items-center gap-2 font-semibold text-primary" href="https://mkety.com/enterprise">Request a custom integration <ExternalLink className="h-4 w-4" /></Link></CardContent>
      </Card>
    </div>
  );
}

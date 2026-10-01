import { desc, eq } from 'drizzle-orm';
import { Code2 } from 'lucide-react';

import { CreateMailApiKeyForm } from '@/features/mail/components/CreateMailApiKeyForm';
import { revokeMailApiKey } from '@/features/mail/server/api-key-actions';
import { mailExternalClientsEnabled } from '@/features/mail/server/external-clients';
import { requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui/page-header';
import { db } from '@/shared/db/cloudflare';
import { mailApiKeys } from '@/shared/db/schema';

export const dynamic='force-dynamic';

export default async function MailDeveloperPage({params}:{params:Promise<{tenant:string}>}){
  const {tenant}=await params;
  const access=await requireMailWorkspaceAccess(tenant);
  const smtpEnabled=mailExternalClientsEnabled();
  const keys=await db.query.mailApiKeys.findMany({where:eq(mailApiKeys.tenantId,access.tenant.id),orderBy:[desc(mailApiKeys.createdAt)]});
  const revoke=revokeMailApiKey.bind(null,tenant);
  return <div className="space-y-8">
    <PageHeader variant="hero" icon={<Code2 className="h-5 w-5"/>} title="Transactional email" description="Send receipts, OTPs, confirmations and business notifications from your applications."/>

    <Card className="rounded-2xl"><CardHeader><CardTitle>API keys</CardTitle><CardDescription>Keys are tenant-scoped, stored hashed and shown in full only once.</CardDescription></CardHeader><CardContent><CreateMailApiKeyForm tenant={tenant}/><div className="mt-6 divide-y">{keys.map((key)=><div className="flex items-center justify-between gap-4 py-3" key={key.id}><div><p className="font-medium">{key.name}</p><p className="text-xs text-muted-foreground">{key.keyPrefix}… · {key.revokedAt?'Revoked':'Active'}</p></div>{!key.revokedAt&&<form action={revoke}><input type="hidden" name="id" value={key.id}/><button className="text-sm text-muted-foreground hover:text-foreground">Revoke</button></form>}</div>)}{!keys.length&&<p className="py-5 text-sm text-muted-foreground">No API keys yet.</p>}</div></CardContent></Card>

    <Card className="rounded-2xl"><CardHeader><CardTitle>Send endpoint</CardTitle><CardDescription>Use this for transactional messages from your website or application.</CardDescription></CardHeader><CardContent><code className="block rounded-xl bg-muted p-4 text-sm">POST https://api.mkety.com/v1/mail/send</code><p className="mt-3 text-sm text-muted-foreground">Authorization: Bearer mk_mail_live_…</p></CardContent></Card>

    <Card className="rounded-2xl"><CardHeader><CardTitle>Webhooks</CardTitle><CardDescription>Receive signed delivery, bounce, failure and complaint events in your own application.</CardDescription></CardHeader><CardContent><a className="inline-flex rounded-xl border px-4 py-2.5 font-semibold" href={`/app/${tenant}/admin/integrations/webhooks`}>Manage webhooks</a><p className="mt-3 text-xs text-muted-foreground">Available Mail events include sent, delivered, deferred, bounced, failed, rejected and complained.</p></CardContent></Card>

    <Card className="rounded-2xl"><CardHeader><CardTitle>SMTP</CardTitle><CardDescription>{smtpEnabled?'Authenticated Mkety SMTP for existing applications and common frameworks.':'SMTP gateway access is not enabled yet.'}</CardDescription></CardHeader><CardContent>{smtpEnabled?<><p className="font-medium">smtp.mkety.com</p><p className="text-sm text-muted-foreground">TLS · app credentials · infrastructure credentials stay protected</p></>:<p className="text-sm text-muted-foreground">Use the transactional REST API today. SMTP will be enabled only after the dedicated gateway passes production acceptance.</p>}</CardContent></Card>
  </div>;
}

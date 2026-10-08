import { eq } from 'drizzle-orm';
import { CheckCircle2, CircleDashed, Globe2, ShieldCheck } from 'lucide-react';

import { addMailDomain } from '@/features/mail/server/domain-actions';
import { requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui/page-header';
import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailWorkspaces } from '@/shared/db/schema';

export const dynamic='force-dynamic';

export default async function MailDomainsPage({params,searchParams}:{params:Promise<{tenant:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const {tenant}=await params;
  const query=await searchParams;
  const access=await requireMailWorkspaceAccess(tenant);
  const workspace=await db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,access.tenant.id)});
  if(!workspace) return null;
  const domains=await db.query.mailDomains.findMany({where:eq(mailDomains.workspaceId,workspace.id)});
  const action=addMailDomain.bind(null,tenant);

  return <div className="space-y-8">
    <PageHeader variant="hero" icon={<Globe2 className="h-5 w-5"/>} title="Business domains" description="Connect the domain you want to use for professional email. Mkety handles the technical checks for you."/>

    <Card className="rounded-2xl">
      <CardHeader><CardTitle>Connect a domain</CardTitle><CardDescription>Enter only your domain name. If it is already managed in Mkety DNS, setup is automatic. Otherwise we’ll guide the connection.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {query.error==="domain"&&<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Enter a valid domain such as company.com.</div>}
        {query.error==="reserved-domain"&&<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">The mkety.com root is reserved for Zoho inbound mail. Use mail.mkety.com for first-party outbound sending.</div>}
        {query.error==="claimed"&&<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">This domain is already connected to another Mkety Mail workspace.</div>}
        <form action={action} className="flex flex-col gap-3 sm:flex-row">
          <input className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 outline-none focus:border-primary" name="domain" placeholder="company.com" required/>
          <button className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Connect domain</button>
        </form>
      </CardContent>
    </Card>

    <div className="space-y-4">
      {domains.map(domain=><Card className="rounded-2xl" key={domain.id}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div><CardTitle>{domain.domain}</CardTitle><CardDescription>{domain.routingEnabled?'Incoming mail routing is connected.':'Connection is waiting for domain setup.'}</CardDescription></div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{domain.routingEnabled?'Connected':'Setup needed'}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Incoming mail',domain.mxStatus],
              ['SPF',domain.spfStatus],
              ['DKIM',domain.dkimStatus],
              ['DMARC',domain.dmarcStatus],
            ].map(([label,status])=><div className="rounded-xl border p-3" key={label}>
              <div className="flex items-center gap-2">{status==='verified'?<CheckCircle2 className="h-4 w-4 text-emerald-600"/>:<CircleDashed className="h-4 w-4 text-muted-foreground"/>}<span className="font-medium">{label}</span></div>
              <p className="mt-1 text-xs text-muted-foreground">{status==='verified'?'Ready':'Mkety is checking this'}</p>
            </div>)}
          </div>
          {!domain.routingEnabled&&<div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm"><div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary"/><p>This domain is not yet inside Mkety DNS. We’ll use the guided connection flow so you do not need to paste infrastructure credentials into Mkety.</p></div></div>}
        </CardContent>
      </Card>)}
      {!domains.length&&<Card className="rounded-2xl"><CardContent className="py-8 text-sm text-muted-foreground">No domain connected yet.</CardContent></Card>}
    </div>
  </div>;
}

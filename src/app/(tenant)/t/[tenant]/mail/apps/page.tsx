import { and, desc, eq } from 'drizzle-orm';
import { Smartphone } from 'lucide-react';

import { CreateMailAppPasswordForm } from '@/features/mail/components/CreateMailAppPasswordForm';
import { revokeMailAppPassword } from '@/features/mail/server/app-password-actions';
import { mailExternalClientsEnabled } from '@/features/mail/server/external-clients';
import { requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui/page-header';
import { db } from '@/shared/db/cloudflare';
import { mailAppPasswords, mailDomains, mailMailboxes, mailMailboxMembers } from '@/shared/db/schema';

export const dynamic='force-dynamic';

export default async function MailAppsPage({params}:{params:Promise<{tenant:string}>}){
  const {tenant}=await params;
  const access=await requireMailWorkspaceAccess(tenant);
  const externalClientsEnabled=mailExternalClientsEnabled();
  const [domains,allMailboxes,memberRows,credentials]=await Promise.all([
    db.query.mailDomains.findMany({where:eq(mailDomains.tenantId,access.tenant.id)}),
    db.query.mailMailboxes.findMany({where:and(eq(mailMailboxes.tenantId,access.tenant.id),eq(mailMailboxes.status,'active'))}),
    db.query.mailMailboxMembers.findMany({where:and(eq(mailMailboxMembers.tenantId,access.tenant.id),eq(mailMailboxMembers.userId,access.actor.userId))}),
    db.query.mailAppPasswords.findMany({where:and(eq(mailAppPasswords.tenantId,access.tenant.id),eq(mailAppPasswords.userId,access.actor.userId)),orderBy:[desc(mailAppPasswords.createdAt)]}),
  ]);
  const allowedIds=new Set(memberRows.map(m=>m.mailboxId));
  const mailboxes=['admin','manager'].includes(String(access.membership.role))?allMailboxes:allMailboxes.filter(m=>allowedIds.has(m.id));
  const options=mailboxes.map(mailbox=>({id:mailbox.id,address:`${mailbox.localPart}@${domains.find(d=>d.id===mailbox.domainId)?.domain||''}`}));
  const revoke=revokeMailAppPassword.bind(null,tenant);

  return <div className="space-y-8">
    <PageHeader variant="hero" icon={<Smartphone className="h-5 w-5"/>} title="Mail apps" description={externalClientsEnabled?"Connect supported mail apps with a revocable app password.":"External IMAP/SMTP mail-app access is coming after the dedicated gateway passes production acceptance."}/>

    {externalClientsEnabled?<>
      <Card className="rounded-2xl"><CardHeader><CardTitle>Create an app password</CardTitle><CardDescription>Give each device its own revocable password.</CardDescription></CardHeader><CardContent>{options.length?<CreateMailAppPasswordForm tenant={tenant} mailboxes={options}/>:<p className="text-sm text-muted-foreground">Create a mailbox first.</p>}</CardContent></Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl"><CardHeader><CardTitle>Incoming mail</CardTitle><CardDescription>IMAP</CardDescription></CardHeader><CardContent className="space-y-1 text-sm"><p><strong>Server:</strong> imap.mkety.com</p><p><strong>Port:</strong> 993</p><p><strong>Security:</strong> SSL/TLS</p><p><strong>Username:</strong> your full business email</p></CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle>Outgoing mail</CardTitle><CardDescription>SMTP submission</CardDescription></CardHeader><CardContent className="space-y-1 text-sm"><p><strong>Server:</strong> smtp.mkety.com</p><p><strong>Port:</strong> 465</p><p><strong>Security:</strong> SSL/TLS</p><p><strong>Username:</strong> your full business email</p></CardContent></Card>
      </div>

      <Card className="rounded-2xl"><CardHeader><CardTitle>Quick setup</CardTitle><CardDescription>Most supported mail apps can discover the server settings from your email address.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{['Apple Mail','Outlook','Gmail mobile','Thunderbird'].map(name=><div className="rounded-xl border p-4 text-sm font-medium" key={name}>{name}</div>)}</CardContent></Card>
    </>:<Card className="rounded-2xl border-amber-500/30"><CardHeader><CardTitle>External mail apps are not enabled yet</CardTitle><CardDescription>Mkety Inbox, API sending, shared inboxes and customer updates remain available. IMAP/SMTP app access will be enabled only after the dedicated gateway passes TLS, app-password and mailbox/send acceptance.</CardDescription></CardHeader></Card>}

    <Card className="rounded-2xl"><CardHeader><CardTitle>App passwords</CardTitle></CardHeader><CardContent className="divide-y">{credentials.map(credential=><div className="flex items-center justify-between gap-4 py-3" key={credential.id}><div><p className="font-medium">{credential.name}</p><p className="text-xs text-muted-foreground">{credential.passwordPrefix}… · {credential.revokedAt?'Revoked':'Active'}</p></div>{!credential.revokedAt&&<form action={revoke}><input type="hidden" name="id" value={credential.id}/><button className="text-sm text-muted-foreground hover:text-destructive">Revoke</button></form>}</div>)}{!credentials.length&&<p className="py-5 text-sm text-muted-foreground">No app passwords yet.</p>}</CardContent></Card>
  </div>;
}

import { desc, eq } from 'drizzle-orm';
import { Download, FileUp, MoveRight } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { importMailEmlFiles } from '@/features/mail/server/migration-actions';
import { getMailWorkspace, requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailMailboxes, mailMessages } from '@/shared/db/schema';

export const dynamic='force-dynamic';

export default async function MailMigrationPage({
  params,
  searchParams,
}:{
  params:Promise<{tenant:string}>;
  searchParams:Promise<{imported?:string;error?:string}>;
}){
  const {tenant:tenantSlug}=await params;
  const query=await searchParams;
  const access=await requireMailWorkspaceAccess(tenantSlug);
  if(!['admin','manager'].includes(String(access.membership.role))) redirect(`/app/${tenantSlug}/mail`);
  const workspace=await getMailWorkspace(tenantSlug);
  if(!workspace) redirect(`/app/${tenantSlug}/mail`);

  const [mailboxes,domains,recentMessages]=await Promise.all([
    db.query.mailMailboxes.findMany({
      where:eq(mailMailboxes.tenantId,access.tenant.id),
      orderBy:(table,{asc})=>[asc(table.localPart)],
    }),
    db.query.mailDomains.findMany({
      where:eq(mailDomains.tenantId,access.tenant.id),
    }),
    db.query.mailMessages.findMany({
      where:eq(mailMessages.tenantId,access.tenant.id),
      orderBy:(table)=>[desc(table.createdAt)],
      limit:50,
    }),
  ]);
  const domainById=new Map(domains.map((item)=>[item.id,item.domain]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Migration & portability</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Move customer-owned data into or out of Mkety Mail using portable formats. Secrets, API keys and app passwords are never included in exports.
        </p>
      </div>

      {query.imported ? <p className="rounded-xl border bg-emerald-500/5 p-3 text-sm">Imported {query.imported} EML message(s).</p> : null}
      {query.error ? <p className="rounded-xl border bg-destructive/5 p-3 text-sm text-destructive">The migration request could not be completed safely. Check the mailbox, file type and size limits.</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <Download className="h-5 w-5 text-primary" />
            <CardTitle>Export from Mkety Mail</CardTitle>
            <CardDescription>Download reusable customer data without exporting credentials or internal settlement records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a className="flex items-center justify-between rounded-xl border p-3 text-sm font-semibold" href={`/api/mail/export/workspace?tenant=${encodeURIComponent(tenantSlug)}`}>
              Workspace manifest (JSON) <Download className="h-4 w-4" />
            </a>
            <a className="flex items-center justify-between rounded-xl border p-3 text-sm font-semibold" href={`/api/mail/contacts/export?tenant=${encodeURIComponent(tenantSlug)}`}>
              Contacts (CSV) <Download className="h-4 w-4" />
            </a>
            <p className="text-xs leading-5 text-muted-foreground">
              Individual messages can be exported as RFC822/EML below. Raw original EML is returned when available; older app-created messages are converted to a standards-compatible EML representation.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <FileUp className="h-5 w-5 text-primary" />
            <CardTitle>Import standard EML</CardTitle>
            <CardDescription>Import preserved RFC822/EML messages into an active Mkety mailbox.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={importMailEmlFiles.bind(null,tenantSlug)} className="grid gap-3">
              <label className="grid gap-2 text-sm font-medium">
                Destination mailbox
                <select className="rounded-xl border bg-background px-3 py-2.5" name="mailboxId" required>
                  <option value="">Choose mailbox</option>
                  {mailboxes.filter((item)=>item.status==='active').map((item)=>(
                    <option key={item.id} value={item.id}>{item.localPart}@{domainById.get(item.domainId)??'domain'}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                EML files
                <input accept=".eml,message/rfc822" className="rounded-xl border p-3" multiple name="files" required type="file" />
              </label>
              <p className="text-xs text-muted-foreground">Up to 20 files per batch, 10 MB per file and 25 MB total. The original EML is preserved in Mail storage.</p>
              <Button className="w-fit" type="submit">Import messages</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Recent message exports</CardTitle>
          <CardDescription>Download portable RFC822 copies for migration, backup or compliance workflows.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {recentMessages.length ? recentMessages.map((message)=>(
            <a className="flex items-center justify-between gap-4 rounded-xl border p-3 text-sm" href={`/api/mail/export/messages/${message.id}`} key={message.id}>
              <span className="min-w-0">
                <strong className="block truncate">{message.subject||'(no subject)'}</strong>
                <span className="block truncate text-xs text-muted-foreground">{message.fromAddress} · {(message.receivedAt??message.sentAt??message.createdAt).toLocaleString()}</span>
              </span>
              <Download className="h-4 w-4 shrink-0" />
            </a>
          )):<p className="text-sm text-muted-foreground">No messages to export yet.</p>}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-primary/20">
        <CardHeader><CardTitle>Full-provider migration</CardTitle><CardDescription>Large Google Workspace, Microsoft 365 and IMAP mailbox migrations should run as controlled server-side jobs rather than browser uploads.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Portable export/import is included.</span><MoveRight className="h-4 w-4" /><span>Managed bulk migration can be offered as an Enterprise/add-on service after provider-specific connector acceptance.</span>
          <Link className="font-semibold text-primary" href={`/app/${tenantSlug}/mail/apps`}>Mail app access</Link>
        </CardContent>
      </Card>
    </div>
  );
}

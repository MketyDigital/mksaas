import { asc, eq } from 'drizzle-orm';
import { ContactRound, Upload } from 'lucide-react';

import { addMailContact, archiveMailContact, importMailContactsCsv } from '@/features/mail/server/contact-actions';
import { requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui/page-header';
import { db } from '@/shared/db/cloudflare';
import { mailContacts } from '@/shared/db/schema';

export const dynamic='force-dynamic';

export default async function MailContactsPage({params,searchParams}:{params:Promise<{tenant:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const {tenant}=await params;
  const query=await searchParams;
  const access=await requireMailWorkspaceAccess(tenant);
  const contacts=await db.query.mailContacts.findMany({
    where:eq(mailContacts.tenantId,access.tenant.id),
    orderBy:[asc(mailContacts.email)],
    limit:3000,
  });
  const active=contacts.filter((c)=>c.status==='active');
  const addAction=addMailContact.bind(null,tenant);
  const importAction=importMailContactsCsv.bind(null,tenant);
  const archiveAction=archiveMailContact.bind(null,tenant);

  return <div className="space-y-8">
    <PageHeader variant="hero" icon={<ContactRound className="h-5 w-5"/>} title="Contacts" description="Keep the customers and contacts your business already communicates with in one place."/>

    {(query.added||query.imported)&&<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">{query.imported?`${query.imported} contacts imported.`:'Contact saved.'}</div>}
    {query.error&&<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">We couldn’t import those contacts. Use a CSV with an Email column, or add the contact manually.</div>}

    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-2xl"><CardHeader><CardTitle>Add a contact</CardTitle><CardDescription>Add someone your business already serves or communicates with.</CardDescription></CardHeader><CardContent><form action={addAction} className="grid gap-3">
        <label className="text-sm font-medium">Email<input className="mt-2 w-full rounded-xl border bg-background px-4 py-3" type="email" name="email" required/></label>
        <label className="text-sm font-medium">Name<input className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="name"/></label>
        <label className="text-sm font-medium">Company<input className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="company"/></label>
        <label className="text-sm font-medium">Tags<input className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="tags" placeholder="customer, premium"/></label>
        <button className="mt-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Save contact</button>
      </form></CardContent></Card>

      <Card className="rounded-2xl"><CardHeader><CardTitle>Import customers</CardTitle><CardDescription>Upload a CSV. Mkety accepts up to 3,000 rows per import and ignores invalid addresses.</CardDescription></CardHeader><CardContent><form action={importAction} className="space-y-4">
        <div className="rounded-xl border border-dashed p-6 text-center"><Upload className="mx-auto h-6 w-6 text-primary"/><input className="mt-4 block w-full text-sm" type="file" accept=".csv,text/csv" name="file" required/></div>
        <p className="text-xs text-muted-foreground">Required column: Email. Optional: Name, Company, Tags.</p>
        <button className="rounded-xl border px-5 py-3 font-semibold">Import CSV</button>
      </form></CardContent></Card>
    </div>

    <Card className="rounded-2xl"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{active.length} active contacts</CardTitle><CardDescription>Customer Updates can use these contacts after suppression and safety checks.</CardDescription></div><a className="rounded-lg border px-3 py-2 text-sm font-semibold" href={'/api/mail/contacts/export?tenant='+encodeURIComponent(tenant)}>Export CSV</a></div></CardHeader><CardContent>
      <div className="divide-y">{contacts.map((contact)=><div className="flex items-center justify-between gap-4 py-3" key={contact.id}><div className="min-w-0"><p className="truncate font-medium">{contact.name||contact.email}</p><p className="truncate text-sm text-muted-foreground">{contact.email}{contact.company?` · ${contact.company}`:''}</p></div>{contact.status==='active'?<form action={archiveAction}><input type="hidden" name="id" value={contact.id}/><button className="text-sm text-muted-foreground hover:text-foreground">Archive</button></form>:<span className="text-xs text-muted-foreground">Archived</span>}</div>)}{!contacts.length&&<p className="py-8 text-center text-sm text-muted-foreground">No contacts yet.</p>}</div>
    </CardContent></Card>
  </div>;
}

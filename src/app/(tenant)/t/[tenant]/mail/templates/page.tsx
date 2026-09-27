import { desc, eq } from 'drizzle-orm';
import { FileText } from 'lucide-react';

import { deleteMailTemplate, saveMailTemplate } from '@/features/mail/server/template-actions';
import { requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui/page-header';
import { db } from '@/shared/db/cloudflare';
import { mailTemplates } from '@/shared/db/schema';

export const dynamic='force-dynamic';

export default async function MailTemplatesPage({params,searchParams}:{params:Promise<{tenant:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 const {tenant}=await params; const query=await searchParams; const access=await requireMailWorkspaceAccess(tenant);
 const templates=await db.query.mailTemplates.findMany({where:eq(mailTemplates.tenantId,access.tenant.id),orderBy:[desc(mailTemplates.updatedAt)]});
 const save=saveMailTemplate.bind(null,tenant); const remove=deleteMailTemplate.bind(null,tenant);
 return <div className="space-y-8">
  <PageHeader variant="hero" icon={<FileText className="h-5 w-5"/>} title="Templates" description="Save the messages your business sends repeatedly."/>
  {query.saved&&<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">Template saved.</div>}
  <Card className="rounded-2xl"><CardHeader><CardTitle>New template</CardTitle><CardDescription>Create a reusable receipt, confirmation, customer update or reply.</CardDescription></CardHeader><CardContent><form action={save} className="grid gap-4">
    <label className="text-sm font-medium">Template name<input className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="name" required/></label>
    <label className="text-sm font-medium">Use for<select className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="type"><option value="transactional">Transactional email</option><option value="customer_update">Customer update</option><option value="reply">Inbox reply</option></select></label>
    <label className="text-sm font-medium">Subject<input className="mt-2 w-full rounded-xl border bg-background px-4 py-3" name="subject"/></label>
    <label className="text-sm font-medium">Message<textarea className="mt-2 min-h-40 w-full rounded-xl border bg-background px-4 py-3" name="text" required/></label>
    <button className="w-fit rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Save template</button>
  </form></CardContent></Card>
  <div className="grid gap-4 md:grid-cols-2">{templates.map(t=><Card className="rounded-2xl" key={t.id}><CardHeader><CardTitle className="text-base">{t.name}</CardTitle><CardDescription>{t.type.replace('_',' ')}</CardDescription></CardHeader><CardContent><p className="text-sm font-medium">{t.subject||'(no subject)'}</p><p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{t.text}</p><form action={remove} className="mt-4"><input type="hidden" name="id" value={t.id}/><button className="text-sm text-muted-foreground hover:text-destructive">Delete</button></form></CardContent></Card>)}{!templates.length&&<p className="text-sm text-muted-foreground">No templates yet.</p>}</div>
 </div>;
}

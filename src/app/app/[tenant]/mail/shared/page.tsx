import { and, desc, eq, inArray } from 'drizzle-orm';
import { Users } from 'lucide-react';

import { addSharedThreadNote, updateSharedThread } from '@/features/mail/server/shared-inbox-actions';
import { requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui/page-header';
import { db } from '@/shared/db/cloudflare';
import { mailMailboxes, mailThreadNotes, mailThreads, tenantMemberships, users } from '@/shared/db/schema';

export const dynamic='force-dynamic';

export default async function SharedInboxPage({params}:{params:Promise<{tenant:string}>}){
 const {tenant}=await params; const access=await requireMailWorkspaceAccess(tenant);
 const mailboxes=await db.query.mailMailboxes.findMany({where:and(eq(mailMailboxes.tenantId,access.tenant.id),eq(mailMailboxes.type,'shared'))});
 const mailboxIds=mailboxes.map((m)=>m.id);
 const threads=mailboxIds.length?await db.query.mailThreads.findMany({where:and(eq(mailThreads.tenantId,access.tenant.id),inArray(mailThreads.mailboxId,mailboxIds)),orderBy:[desc(mailThreads.lastMessageAt)],limit:100}):[];
 const memberships=await db.query.tenantMemberships.findMany({where:eq(tenantMemberships.tenantId,access.tenant.id)});
 const userIds=memberships.map((m)=>m.userId);
 const team=userIds.length?await db.query.users.findMany({where:inArray(users.id,userIds)}):[];
 const notes=threads.length?await db.query.mailThreadNotes.findMany({where:inArray(mailThreadNotes.threadId,threads.map((t)=>t.id)),orderBy:[desc(mailThreadNotes.createdAt)]}):[];
 const update=updateSharedThread.bind(null,tenant); const addNote=addSharedThreadNote.bind(null,tenant);

 return <div className="space-y-8">
  <PageHeader variant="hero" icon={<Users className="h-5 w-5"/>} title="Shared Business Inbox" description="Keep support, sales and order conversations owned and organized across your team."/>
  {!mailboxes.length?<Card className="rounded-2xl"><CardContent className="py-8"><p className="text-sm text-muted-foreground">Create a shared mailbox such as support@ or sales@ first.</p><a className="mt-4 inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" href={`/app/${tenant}/mail/mailboxes`}>Create shared inbox</a></CardContent></Card>:
  <div className="space-y-4">{threads.map(thread=>{const mailbox=mailboxes.find(m=>m.id===thread.mailboxId);const threadNotes=notes.filter(n=>n.threadId===thread.id);return <Card className="rounded-2xl" key={thread.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-4"><div><CardTitle className="text-base">{thread.subject||'(no subject)'}</CardTitle><CardDescription>{mailbox?.localPart} · {thread.status}</CardDescription></div><form action={update} className="flex flex-wrap gap-2"><input type="hidden" name="threadId" value={thread.id}/><select className="rounded-lg border bg-background px-3 py-2 text-sm" name="assignedUserId" defaultValue={thread.assignedUserId||''}><option value="">Unassigned</option>{team.map(user=><option key={user.id} value={user.id}>{user.name||user.email||user.id}</option>)}</select><select className="rounded-lg border bg-background px-3 py-2 text-sm" name="status" defaultValue={thread.status}><option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option></select><button className="rounded-lg border px-3 py-2 text-sm font-medium">Save</button></form></div></CardHeader><CardContent><form action={addNote} className="flex gap-2"><input type="hidden" name="threadId" value={thread.id}/><input className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" name="body" placeholder="Add an internal note…"/><button className="rounded-lg border px-3 py-2 text-sm font-medium">Add note</button></form>{threadNotes.length>0&&<div className="mt-4 space-y-2">{threadNotes.slice(0,5).map(note=><div className="rounded-lg bg-muted/50 p-3 text-sm" key={note.id}>{note.body}</div>)}</div>}</CardContent></Card>})}{!threads.length&&<Card className="rounded-2xl"><CardContent className="py-8 text-center text-sm text-muted-foreground">No shared-inbox conversations yet.</CardContent></Card>}</div>}
 </div>;
}

import { eq } from 'drizzle-orm';
import { Mail } from 'lucide-react';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db/cloudflare';
import { tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

export const dynamic='force-dynamic';

export default async function MailWorkspaceChooser(){
  const session=await auth();
  if(!session?.user?.id) redirect('/login');
  const memberships=await db.query.tenantMemberships.findMany({
    where:eq(tenantMemberships.userId,session.user.id),
    with:{tenant:{columns:{slug:true,name:true}}},
    orderBy:(table,{asc})=>[asc(table.createdAt)],
  });
  if(memberships.length===1) redirect(`/t/${memberships[0].tenant.slug}/mail`);

  return <main className="mx-auto max-w-3xl px-6 py-16">
    <div className="mb-8 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Mail className="h-5 w-5"/></div><div><h1 className="text-2xl font-bold">Mkety Mail</h1><p className="text-sm text-muted-foreground">Choose the business workspace you want to open.</p></div></div>
    <div className="grid gap-3">{memberships.map(m=><a key={m.id} href={`/t/${m.tenant.slug}/mail`} className="rounded-2xl border bg-card p-5 transition hover:border-primary/40"><p className="font-semibold">{m.tenant.name}</p><p className="mt-1 text-sm text-muted-foreground">Open business email workspace →</p></a>)}</div>
  </main>;
}

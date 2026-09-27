import { desc, eq } from 'drizzle-orm';
import { BarChart3, ShieldCheck } from 'lucide-react';

import { addMailSuppression, removeManualMailSuppression } from '@/features/mail/server/suppression-actions';
import { requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui/page-header';
import { db } from '@/shared/db/cloudflare';
import { mailCustomerUpdates, mailDeliveryEvents, mailSuppressions } from '@/shared/db/schema';

export const dynamic='force-dynamic';

export default async function MailAnalyticsPage({params}:{params:Promise<{tenant:string}>}){
  const {tenant}=await params; const access=await requireMailWorkspaceAccess(tenant);
  const [events,suppressions,updates]=await Promise.all([
    db.query.mailDeliveryEvents.findMany({where:eq(mailDeliveryEvents.tenantId,access.tenant.id),orderBy:[desc(mailDeliveryEvents.occurredAt)],limit:5000}),
    db.query.mailSuppressions.findMany({where:eq(mailSuppressions.tenantId,access.tenant.id),orderBy:[desc(mailSuppressions.createdAt)],limit:1000}),
    db.query.mailCustomerUpdates.findMany({where:eq(mailCustomerUpdates.tenantId,access.tenant.id),orderBy:[desc(mailCustomerUpdates.createdAt)],limit:100}),
  ]);
  const count=(type:string)=>events.filter((event)=>event.eventType===type).length;
  const delivered=count('delivered'); const sent=count('sent'); const bounced=count('bounced'); const failed=count('failed'); const complained=count('complained');
  const deliveryBase=Math.max(1,delivered+bounced+failed);
  const add=addMailSuppression.bind(null,tenant); const remove=removeManualMailSuppression.bind(null,tenant);
  return <div className="space-y-8">
    <PageHeader variant="hero" icon={<BarChart3 className="h-5 w-5"/>} title="Mail analytics" description="Simple delivery health and recipient protection for your business email."/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[['Sent',sent],['Delivered',delivered],['Bounced',bounced],['Failed',failed],['Complaints',complained]].map(([label,value])=><Card className="rounded-2xl" key={String(label)}><CardContent className="py-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></CardContent></Card>)}</div>
    <Card className="rounded-2xl"><CardHeader><CardTitle>Delivery health</CardTitle><CardDescription>{((delivered/deliveryBase)*100).toFixed(1)}% delivered across recorded final delivery events. Mkety automatically protects sending when bounce or complaint signals become unsafe.</CardDescription></CardHeader></Card>
    <Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/>Do not email</CardTitle><CardDescription>Hard bounces, complaints and manual opt-outs stay out of Customer Updates and transactional sending.</CardDescription></CardHeader><CardContent>
      <form action={add} className="flex flex-col gap-3 sm:flex-row"><input className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3" type="email" name="email" placeholder="customer@example.com" required/><button className="rounded-xl border px-5 py-3 font-semibold">Add suppression</button></form>
      <div className="mt-5 divide-y">{suppressions.map(item=><div className="flex items-center justify-between gap-4 py-3" key={item.id}><div><p className="font-medium">{item.email}</p><p className="text-xs text-muted-foreground">{item.reason.replace('_',' ')} · {item.source}</p></div>{['manual','opt_out'].includes(item.reason)&&<form action={remove}><input type="hidden" name="id" value={item.id}/><button className="text-sm text-muted-foreground">Remove</button></form>}</div>)}{!suppressions.length&&<p className="py-5 text-sm text-muted-foreground">No suppressed recipients.</p>}</div>
    </CardContent></Card>
    <Card className="rounded-2xl"><CardHeader><CardTitle>Recent customer updates</CardTitle></CardHeader><CardContent className="divide-y">{updates.slice(0,10).map(u=><div className="py-3" key={u.id}><div className="flex justify-between gap-4"><p className="font-medium">{u.name}</p><span className="text-xs text-muted-foreground">{u.status}</span></div><p className="mt-1 text-xs text-muted-foreground">{u.recipientCount} recipients · {u.deliveredCount} delivered · {u.bouncedCount} bounced · {u.complainedCount} complaints</p></div>)}{!updates.length&&<p className="py-5 text-sm text-muted-foreground">No customer updates yet.</p>}</CardContent></Card>
  </div>;
}

import { Mail, Send, Users, Globe2, Code2, Inbox, Smartphone, Megaphone } from 'lucide-react';

import { enableMketyMail } from '@/features/mail/server/actions';
import { getMailWorkspace, requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui/page-header';

export const dynamic='force-dynamic';

export default async function MailHome({params}:{params:Promise<{tenant:string}>}){
  const {tenant}=await params;
  await requireMailWorkspaceAccess(tenant);
  const workspace=await getMailWorkspace(tenant);

  if(!workspace){
    const action=enableMketyMail.bind(null,tenant);
    return <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        variant="hero"
        icon={<Mail className="h-5 w-5" aria-hidden />}
        title="Mkety Mail"
        description="Professional business email, shared inboxes, customer updates and transactional email — without the technical setup."
      />
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Enable Mkety Mail</CardTitle>
          <CardDescription>Your existing Mkety workspace, team and sign-in are reused automatically. No second account or API setup is required.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Professional email','Create hello@, sales@ and support@ on your domain.'],
              ['Shared inboxes','Let your team handle support, sales and orders together.'],
              ['Customer Updates','Send safe operational updates to existing customers.'],
              ['Transactional email','Receipts, OTPs, confirmations, alerts and API/SMTP.'],
            ].map(([title,description])=><div className="rounded-xl border p-4" key={title}><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>)}
          </div>
          <form action={action}><button className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Enable Mkety Mail</button></form>
          <p className="text-sm text-muted-foreground">Marketing newsletters and promotions will appear later as Marketing — Coming Soon.</p>
        </CardContent>
      </Card>
    </div>;
  }

  const items=[
    {title:'Professional Email',description:'Connect your business domain and create mailboxes.',icon:Globe2,status:workspace.onboardingStep==='domain'?'Start here':'Ready'},
    {title:'Inbox',description:'Receive, read, reply, forward, archive and search.',icon:Inbox,status:'Included'},
    {title:'Shared Business Inbox',description:'Support, sales and order inboxes with team assignment.',icon:Users,status:'Included'},
    {title:'Customer Updates',description:'Send service and business updates to your existing customers.',icon:Send,status:'Included'},
    {title:'Transactional Email',description:'API, SMTP, templates, webhooks and delivery logs.',icon:Code2,status:'Included'},
    {title:'Mail Apps',description:'Apple Mail, Outlook, Gmail mobile and Thunderbird through Mkety.',icon:Smartphone,status:'Included'},
    {title:'Marketing',description:'Newsletters, promotions and campaign automation.',icon:Megaphone,status:'Coming Soon'},
  ];

  return <div className="space-y-8">
    <PageHeader
      variant="hero"
      icon={<Mail className="h-5 w-5" aria-hidden />}
      title="Mkety Mail"
      description="Your business email and customer communication workspace."
    />

    {workspace.onboardingStep==='domain'&&<Card className="rounded-2xl border-primary/30">
      <CardHeader><CardTitle>Connect your business domain</CardTitle><CardDescription>Start with the domain you want to use for addresses such as hello@company.com. Mkety will guide the mail records and verification for you.</CardDescription></CardHeader>
      <CardContent><a className="inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" href={`/t/${tenant}/mail/domains`}>Connect domain</a></CardContent>
    </Card>}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map(({title,description,icon:Icon,status})=><Card key={title} className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5"/></div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{status}</span>
          </div>
          <CardTitle className="pt-2">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>)}
    </div>
  </div>;
}

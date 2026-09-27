import { ArrowRight, Inbox, Mail, Send, Users } from 'lucide-react';
import Link from 'next/link';

export const metadata={
  title:'Mkety Mail — Business email made simple',
  description:'Professional business email, shared inboxes, customer updates and transactional email without technical setup.',
};

export default function MketyMailPublicPage(){
  return <main className="mx-auto max-w-6xl px-6 py-20">
    <div className="mx-auto max-w-3xl text-center">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Mail className="h-7 w-7"/></div>
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Business email made simple.</h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">Professional email, shared inboxes, customer updates and automated business messages — without learning DNS, SMTP or email infrastructure.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href="https://mail.mkety.com" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Open Mkety Mail <ArrowRight className="h-4 w-4"/></a>
        <Link href="/pricing" className="inline-flex rounded-xl border px-5 py-3 font-semibold">View plans</Link>
      </div>
    </div>
    <div className="mt-16 grid gap-4 md:grid-cols-3">
      {[['Professional inbox',Inbox,'Create hello@, sales@ and support@ on your business domain.'],['Team inboxes',Users,'Handle support, sales and orders together without forwarding chains.'],['Customer communication',Send,'Transactional email and safe customer updates in one business workspace.']].map(([title,Icon,description]:any)=><div className="rounded-2xl border bg-card p-6" key={title}><Icon className="h-6 w-6 text-primary"/><h2 className="mt-4 text-lg font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>)}
    </div>
    <div className="mt-12 rounded-2xl border bg-muted/30 p-6"><p className="font-semibold">Marketing — Coming Soon</p><p className="mt-1 text-sm text-muted-foreground">Newsletters, promotions and campaign automation will be added through a dedicated marketing engine. Core business email and customer communication remain separate and protected.</p></div>
  </main>;
}

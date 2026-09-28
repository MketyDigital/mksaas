import { ArrowRight, Inbox, Mail, Send, Users } from 'lucide-react';
import Link from 'next/link';

import { MAIL_COMMERCIAL_PLANS, MAIL_PREPAID_ADDONS } from '@/features/mail/commercial/plans';

export const metadata={
  title:'Mkety Mail — Business email made simple',
  description:'Professional business email, shared inboxes, customer updates and transactional email with clear plans and usage limits.',
};

function usd(amountMinor: bigint) {
  return `$${(Number(amountMinor) / 100).toFixed(2)}`;
}

export default function MketyMailPublicPage(){
  const plans=Object.values(MAIL_COMMERCIAL_PLANS);

  return <main className="mx-auto max-w-6xl px-6 py-20">
    <div className="mx-auto max-w-3xl text-center">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Mail className="h-7 w-7"/></div>
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Business email made simple.</h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">Professional email, shared inboxes, customer updates and automated business messages — with one Mkety account, clear limits and no surprise postpaid overage.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href="#mail-plans" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Choose a Mail plan <ArrowRight className="h-4 w-4"/></a>
        <a href="https://mail.mkety.com" className="inline-flex rounded-xl border px-5 py-3 font-semibold">Already subscribed? Open Mail</a>
        <Link href="/login?plan=mail-starter" className="inline-flex rounded-xl border px-5 py-3 font-semibold">Sign in</Link>
      </div>
    </div>

    <div className="mt-16 grid gap-4 md:grid-cols-3">
      {([
        {title:'Professional inbox',Icon:Inbox,description:'Create hello@, sales@ and support@ on your business domain, with aliases, forwarding and catch-all support.'},
        {title:'Team inboxes',Icon:Users,description:'Handle support, sales and orders together with shared inboxes, assignments, notes, status and team access.'},
        {title:'Customer communication',Icon:Send,description:'Transactional email, API/SMTP, webhooks, templates and safe Customer Updates to existing customers.'},
      ]).map(({title,Icon,description})=><div className="rounded-2xl border bg-card p-6" key={title}><Icon className="h-6 w-6 text-primary"/><h2 className="mt-4 text-lg font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>)}
    </div>

    <section className="mt-20" id="mail-plans">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Mkety Mail plans</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">Subscribe as a Mail workspace or add it to an existing Mkety tenant.</h2>
        <p className="mt-4 text-muted-foreground">Mail is separately entitled from the normal Mkety Platform plans. Monthly, 3-month, 6-month and 12-month prepaid terms use the standard Mkety discount ladder: 0%, 5%, 10% and 15%.</p>
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {plans.map((plan)=>{
          const limits=plan.limits;
          return <div className="flex flex-col rounded-2xl border bg-card p-6 shadow-sm" key={plan.key}>
            <h3 className="text-xl font-semibold">{plan.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
            <div className="mt-5"><span className="text-4xl font-bold">{usd(plan.amountMinor)}</span><span className="text-muted-foreground"> / month</span></div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>{limits.domains} domain{limits.domains===1?'':'s'}</li>
              <li>{limits.mailboxes} mailboxes</li>
              <li>{limits.teamSeats} team seats</li>
              <li>{limits.sharedInboxes} shared inbox{limits.sharedInboxes===1?'':'es'}</li>
              <li>{limits.storageGb} GB Mail storage</li>
              <li>{limits.outboundMessagesPerMonth.toLocaleString()} outbound messages / month</li>
              <li>{limits.customerUpdateDeliveriesPerMonth.toLocaleString()} Customer Update deliveries / month</li>
              <li>Up to {limits.maxRecipientsPerCustomerUpdate.toLocaleString()} recipients per Customer Update</li>
              <li>Inbox, aliases, forwarding, templates, API/SMTP, webhooks and analytics</li>
            </ul>
            <div className="mt-8 grid gap-2">
              <Link className="inline-flex justify-center rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" href={`/signup?plan=${plan.key}`}>Create account · {plan.name}</Link>
              <Link className="inline-flex justify-center rounded-xl border px-5 py-3 text-sm font-semibold" href={`/login?plan=${plan.key}`}>Sign in & add to existing workspace</Link>
            </div>
          </div>;
        })}
      </div>
      <div className="mt-6 rounded-2xl border bg-muted/30 p-6">
        <p className="font-semibold">Need more capacity without changing plan?</p>
        <p className="mt-2 text-sm text-muted-foreground">Self-service overage is prepaid and hard-capped. Available packs include {Object.values(MAIL_PREPAID_ADDONS).map((item)=>`${item.label} (${usd(item.amountMinor)})`).join(', ')}. No unlimited sending and no surprise postpaid bill.</p>
      </div>
      <div className="mt-6 rounded-2xl border p-6">
        <p className="font-semibold">Enterprise Mail</p>
        <p className="mt-2 text-sm text-muted-foreground">Organizations needing custom sending/storage limits, additional domains or seats, migration, retention requirements, dedicated sending isolation, private integrations or contractual service levels can use Mkety Enterprise under custom terms.</p>
        <Link className="mt-4 inline-flex font-semibold text-primary" href="/enterprise">Discuss Enterprise Mail →</Link>
      </div>
    </section>

    <div className="mt-12 rounded-2xl border bg-muted/30 p-6"><p className="font-semibold">Marketing — Coming Soon</p><p className="mt-1 text-sm text-muted-foreground">Newsletters, promotions and campaign automation will be added through a dedicated marketing engine. Core business email and customer communication remain separate and protected.</p></div>
  </main>;
}

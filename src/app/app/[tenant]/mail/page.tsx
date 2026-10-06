import { Code2, Globe2, Inbox, Mail, Megaphone, Send, Smartphone, Users } from 'lucide-react';

import { enableMketyMail } from '@/features/mail/server/actions';
import { mailExternalClientsEnabled } from '@/features/mail/server/external-clients';
import { getCustomerMailUsageSummary } from '@/features/mail/server/usage';
import { getMailWorkspace, requireMailWorkspaceAccess } from '@/features/mail/server/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { PageHeader } from '@/shared/components/ui/page-header';

export const dynamic = 'force-dynamic';

export default async function MailHome({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  await requireMailWorkspaceAccess(tenant);
  const workspace = await getMailWorkspace(tenant);
  const externalClientsEnabled = mailExternalClientsEnabled();
  const usage = workspace ? await getCustomerMailUsageSummary(tenant) : null;

  if (!workspace) {
    const action = enableMketyMail.bind(null, tenant);
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
              ['Professional email', 'Create hello@, sales@ and support@ on your domain.'],
              ['Shared inboxes', 'Let your team handle support, sales and orders together.'],
              ['Customer Updates', 'Send safe operational updates to existing customers.'],
              ['Transactional email', 'Receipts, OTPs, confirmations, alerts and API/SMTP.'],
            ].map(([title, description]) => <div className="rounded-xl border p-4" key={title}><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>)}
          </div>
          <form action={action}><button className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Enable Mkety Mail</button></form>
          <p className="text-sm text-muted-foreground">Marketing newsletters and promotions will appear later as Marketing — Coming Soon.</p>
        </CardContent>
      </Card>
    </div>;
  }

  const items = [
    { title: 'Professional Email', description: 'Connect your business domain, verify mail DNS and then create mailboxes.', icon: Globe2, status: workspace.onboardingStep === 'domain' ? 'Start here' : 'Ready', href: workspace.onboardingStep === 'domain' ? `/app/${tenant}/mail/domains` : `/app/${tenant}/mail/mailboxes` },
    { title: 'Inbox', description: 'Receive, read, reply, forward, archive and search.', icon: Inbox, status: 'Included', href: `/app/${tenant}/mail/inbox` },
    { title: 'Shared Business Inbox', description: 'Support, sales and order inboxes with team assignment.', icon: Users, status: 'Included', href: `/app/${tenant}/mail/shared` },
    { title: 'Customer Updates', description: 'Send service and business updates to your existing customers.', icon: Send, status: 'Included', href: `/app/${tenant}/mail/customer-updates` },
    { title: 'Transactional Email', description: externalClientsEnabled ? 'API, SMTP, templates, webhooks and delivery logs.' : 'API, templates, webhooks and delivery logs. SMTP is pending gateway acceptance.', icon: Code2, status: 'Included', href: `/app/${tenant}/mail/developer` },
    { title: 'Mail Apps', description: externalClientsEnabled ? 'Apple Mail, Outlook, Gmail mobile and Thunderbird setup with secure app passwords.' : 'IMAP/SMTP external-client access is pending gateway acceptance.', icon: Smartphone, status: externalClientsEnabled ? 'Setup ready' : 'Coming Soon', href: `/app/${tenant}/mail/apps` },
    { title: 'Marketing', description: 'Newsletters, promotions and campaign automation.', icon: Megaphone, status: 'Coming Soon', href: '' },
  ];

  return <div className="space-y-8">
    <PageHeader
      variant="hero"
      icon={<Mail className="h-5 w-5" aria-hidden />}
      title="Mkety Mail"
      description="Your business email and customer communication workspace."
    />

    {workspace.onboardingStep === 'domain' && <Card className="rounded-2xl border-primary/30">
      <CardHeader><CardTitle>Connect your business domain</CardTitle><CardDescription>Start with the domain you want to use for addresses such as hello@company.com. Mkety will guide the mail records and verification for you.</CardDescription></CardHeader>
      <CardContent><a className="inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" href={`/app/${tenant}/mail/domains`}>Connect domain</a></CardContent>
    </Card>}

    {usage && <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Usage & Billing</CardTitle>
            <CardDescription>
              {usage.priceMinor === null
                ? 'Internal Custom · no monthly charge; platform safety limits still apply'
                : `${usage.planName} · $${(Number(usage.priceMinor) / 100).toFixed(2)} / month before prepaid-term discounts`}
            </CardDescription>
          </div>
          {usage.priceMinor !== null && <a className="text-sm font-semibold text-primary" href={`/app/${tenant}/billing/checkout?plan=${usage.planKey}`}>Manage plan →</a>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Outbound this month', usage.usage.outboundMessages, usage.limits?.outboundMessagesPerMonth ?? null],
            ['Customer Updates', usage.usage.customerUpdateDeliveries, usage.limits?.customerUpdateDeliveriesPerMonth ?? null],
            ['Mailboxes', usage.usage.mailboxes, usage.limits?.mailboxes ?? null],
            ['Domains', usage.usage.domains, usage.limits?.domains ?? null],
          ].map(([label, used, limit]) => <div className="rounded-xl border p-4" key={String(label)}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-xl font-semibold">{Number(used).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">/ {limit === null ? 'Uncapped' : Number(limit).toLocaleString()}</span></p>
          </div>)}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {usage.priceMinor === null
            ? 'Monthly commercial quotas are not applied to this internal workspace. Daily platform caps, domain warmup, recipient validation and suppression checks remain active. Each Customer Update is capped at 3,000 recipients.'
            : 'This view shows only your commercial Mail allowance and usage. Provider cost, global capacity and operations-only reputation telemetry are not customer-visible.'}
        </p>
      </CardContent>
    </Card>}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map(({ title, description, icon: Icon, status, href }) => <Card key={title} className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{status}</span>
          </div>
          <CardTitle className="pt-2">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {href && <CardContent><a className="text-sm font-semibold text-primary" href={href}>Open →</a></CardContent>}
      </Card>)}
    </div>
  </div>;
}

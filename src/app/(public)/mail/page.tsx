import {
  Activity,
  ArrowRight,
  AtSign,
  CheckCircle2,
  Code2,
  ContactRound,
  Database,
  Globe2,
  Inbox,
  KeyRound,
  LockKeyhole,
  Mail,
  MessagesSquare,
  ServerCog,
  ShieldCheck,
  Smartphone,
  Users,
  Webhook,
} from 'lucide-react';
import Link from 'next/link';

import { getActiveSelfServicePlans } from '@/features/billing/server/active-catalog';
import { MAIL_COMMERCIAL_PLANS, MAIL_PLAN_KEYS, type MailPlanKey } from '@/features/mail/commercial/plans';
import { mailExternalClientsEnabled } from '@/features/mail/server/external-clients';

export const metadata = {
  title: 'Mkety Mail — Professional business email, shared inboxes and transactional email',
  description:
    'Mkety Mail combines professional business email, team inboxes, customer updates, transactional API, delivery analytics, domain verification and Enterprise controls in one Mkety product.',
};

function usd(amountMinor: bigint) {
  return `$${(Number(amountMinor) / 100).toFixed(2)}`;
}

const productFeatures = [
  {
    title: 'Professional business email',
    Icon: AtSign,
    items: [
      'Use your own business domain for branded addresses such as hello@, sales@ and support@.',
      'Create mailboxes, aliases and forwarding addresses under your verified domains.',
      'Catch-all routing can be configured for approved domains where required.',
      'Receive, read, reply, forward, archive and search from the Mkety inbox.',
    ],
  },
  {
    title: 'Shared team inboxes',
    Icon: Users,
    items: [
      'Run support, sales, orders and operations inboxes with multiple team members.',
      'Assign conversations to teammates and keep shared ownership visible.',
      'Use status, internal notes and tags to organize team communication.',
      'Team access remains scoped to the Mkety tenant and product permissions.',
    ],
  },
  {
    title: 'Contacts, templates & customer updates',
    Icon: ContactRound,
    items: [
      'Maintain customer/contact records for business communication.',
      'Use reusable templates for frequently sent messages.',
      'Send Customer Updates to existing customers within plan and safety limits.',
      'Recipient, quota, bounce, complaint and suppression controls continue to apply to bulk sends.',
    ],
  },
  {
    title: 'Transactional email for apps',
    Icon: Code2,
    items: [
      'Send application and website email through the Mkety Mail developer API.',
      'Use the transactional REST API today; SMTP is available only after the dedicated gateway is production-certified.',
      'Create scoped Mkety Mail API credentials without exposing underlying infrastructure credentials.',
      'Receive signed delivery, deferred, bounce, failure, rejection and complaint events through webhooks.',
    ],
  },
  {
    title: 'Mail apps & device setup',
    Icon: Smartphone,
    items: [
      'External IMAP/SMTP mail-client access is available only after the dedicated gateway passes production acceptance.',
      'Autoconfiguration and autodiscover remain disabled until external-client gateway acceptance.',
      'Mkety publishes IMAP/SMTP connection details only after the gateway is production-certified.',
      'App credentials can be revoked independently without changing your main Mkety login.',
    ],
  },
  {
    title: 'Delivery visibility & protection',
    Icon: Activity,
    items: [
      'Track message state through sent, delivered, deferred, bounced, failed, rejected and complained events.',
      'Use suppression controls to stop repeatedly sending to unsafe or invalid recipients.',
      'Per-tenant quotas, sender verification and throttling protect the shared service.',
      'Domain warm-up, bounce-rate and complaint-rate controls can reduce or suspend risky sending even when quota remains.',
    ],
  },
];

const trustFeatures = [
  {
    title: 'One Mkety identity',
    Icon: KeyRound,
    description:
      'Mail reuses Mkety identity, tenant membership and permissions. A production Mkety session is shared only across approved Mkety-owned product hosts under mkety.com so users do not need a separate Mail account.',
  },
  {
    title: 'Domain verification',
    Icon: Globe2,
    description:
      'Mail onboarding tracks domain ownership and DNS readiness, including MX, SPF, DKIM and DMARC state before protected sending/routing capabilities are enabled.',
  },
  {
    title: 'Tenant-scoped access',
    Icon: LockKeyhole,
    description:
      'Mail workspaces, domains, mailboxes, credentials, message metadata and operational controls stay scoped to the customer tenant. Server-side authorization is required for protected actions.',
  },
  {
    title: 'Protected infrastructure',
    Icon: ServerCog,
    description:
      'Customers use Mkety controls while edge routing, queues, object storage and delivery components stay behind Mkety-managed service boundaries.',
  },
  {
    title: 'Secure secrets & credentials',
    Icon: ShieldCheck,
    description:
      'Provider credentials stay server-side. API keys and app passwords are designed for scoped use and independent revocation, while webhook delivery uses signed events.',
  },
  {
    title: 'Auditable commercial controls',
    Icon: Database,
    description:
      'Mail access comes from verified Mkety Billing settlement and the workspace.mail entitlement. Browser return pages never grant access by themselves, and important operations are auditable.',
  },
];

export default async function MketyMailPublicPage() {
  const externalClientsEnabled=mailExternalClientsEnabled();
  const activePlans = await getActiveSelfServicePlans(MAIL_PLAN_KEYS);
  const plans = activePlans.map((active) => ({
    ...MAIL_COMMERCIAL_PLANS[active.key as MailPlanKey],
    name: active.name,
    description: active.description,
    amountMinor: active.amountMinor,
  }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <section className="mx-auto max-w-4xl text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Mail className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Mkety Mail</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
          Professional business email, team communication and application email in one Mkety product.
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
          Run branded business inboxes on your own domain, shared support and sales inboxes, customer updates,
          transactional application email, delivery analytics and domain controls with one Mkety account and clear commercial limits.
          External mail-client access will be enabled only after the dedicated gateway is production-certified.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="#mail-plans" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">
            Choose a Mail plan <ArrowRight className="h-4 w-4" />
          </a>
          <a href="https://mail.mkety.com" className="inline-flex rounded-xl border px-5 py-3 font-semibold">
            Open Mkety Mail
          </a>
          <Link href="/login?returnTo=%2Fmail%2Fapp" className="inline-flex rounded-xl border px-5 py-3 font-semibold">
            Sign in
          </Link>
        </div>
      </section>

      <section className="mt-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Everything in one Mail workspace</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">More than an inbox.</h2>
          <p className="mt-4 text-muted-foreground">
            Mkety Mail is designed for daily business communication, team operations and product/application messaging.
            Core features share the same tenant, identity, billing and security boundaries.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {productFeatures.map(({ title, Icon, items }) => (
            <article className="rounded-2xl border bg-card p-6" key={title}>
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {items.map((item) => (
                  <li className="flex gap-2" key={item}>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-20 rounded-3xl border bg-muted/20 p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Business communication</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Inbox, shared inbox, customer updates and transactional sending are separate workflows.</h2>
            <p className="mt-4 text-muted-foreground">
              That separation keeps normal human email, team operations, bulk customer communication and application-generated
              messages easier to govern. Sending limits and safety controls apply per product mode instead of treating every
              message as the same kind of traffic.
            </p>
          </div>
          <div className="grid gap-3">
            {[
              ['Inbox', 'Day-to-day person-to-person business email.'],
              ['Shared inbox', 'Team-owned conversations for support, sales, orders and operations.'],
              ['Customer Updates', 'Service and business updates to existing customers within approved recipient and quota limits.'],
              ['Transactional', 'Application-generated messages through API/SMTP, templates and signed webhooks.'],
            ].map(([title, description]) => (
              <div className="rounded-xl border bg-background p-4" key={title}>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Trust & security</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">Mkety controls the product boundary. Infrastructure credentials stay behind it.</h2>
          <p className="mt-4 text-muted-foreground">
            Mkety Mail uses managed edge, routing, queueing, storage and delivery infrastructure behind Mkety-owned controls.
            Customers interact with Mkety domains, credentials, dashboards and APIs rather than provider consoles or provider secrets.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {trustFeatures.map(({ title, Icon, description }) => (
            <article className="rounded-2xl border p-6" key={title}>
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-20" id="mail-plans">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Mkety Mail plans</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">Subscribe to Mail on a Mkety workspace.</h2>
          <p className="mt-4 text-muted-foreground">
            Mail is separately entitled from the normal Mkety Platform plans. Use an existing Mkety tenant or create a new one.
            Monthly, 3-month, 6-month and 12-month prepaid terms use the standard Mkety discount ladder: 0%, 5%, 10% and 15%.
          </p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => {
            const limits = plan.limits;
            return (
              <article className="flex flex-col rounded-2xl border bg-card p-6 shadow-sm" key={plan.key}>
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-5">
                  <span className="text-4xl font-bold">{usd(plan.amountMinor)}</span>
                  <span className="text-muted-foreground"> / month</span>
                </div>
                <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                  <li>{limits.domains} domain{limits.domains === 1 ? '' : 's'}</li>
                  <li>{limits.mailboxes} mailboxes</li>
                  <li>{limits.teamSeats} team seats</li>
                  <li>{limits.sharedInboxes} shared inbox{limits.sharedInboxes === 1 ? '' : 'es'}</li>
                  <li>{limits.storageGb} GB Mail storage</li>
                  <li>{limits.outboundMessagesPerMonth.toLocaleString()} outbound messages / month</li>
                  <li>{limits.customerUpdateDeliveriesPerMonth.toLocaleString()} Customer Update deliveries / month</li>
                  <li>Up to {limits.maxRecipientsPerCustomerUpdate.toLocaleString()} recipients per Customer Update</li>
                  <li>Inbox, aliases, forwarding, templates, API access, webhooks and analytics</li>
                  <li>{externalClientsEnabled?'Secure app-password and mail-client setup':'Mail-client access after gateway certification'}</li>
                </ul>
                <div className="mt-8 grid gap-2">
                  <Link className="inline-flex justify-center rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" href={`/signup?plan=${plan.key}`}>
                    Create account · {plan.name}
                  </Link>
                  <Link className="inline-flex justify-center rounded-xl border px-5 py-3 text-sm font-semibold" href={`/login?plan=${plan.key}`}>
                    Sign in & add to existing workspace
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border bg-muted/30 p-6">
            <p className="font-semibold">Clear limits instead of surprise overage</p>
            <p className="mt-2 text-sm text-muted-foreground">
              When a self-service commercial limit is reached, protected operations fail closed. Upgrade to a higher Mail plan or
              discuss Enterprise Mail for more capacity. Safety, reputation and provider limits may remain stricter than commercial quota.
            </p>
          </div>
          <div className="rounded-2xl border p-6">
            <p className="font-semibold">Enterprise Mail</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Scope custom domains, sending/storage capacity, additional users/mailboxes, migration, retention, isolated sending
              arrangements, private integrations, data-location requirements and contractual support/service levels where agreed.
            </p>
            <Link className="mt-4 inline-flex font-semibold text-primary" href="/enterprise">
              Discuss Enterprise Mail →
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-20 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border p-6">
          <MessagesSquare className="h-6 w-6 text-primary" />
          <h2 className="mt-4 text-xl font-semibold">Marketing — coming soon</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Newsletters, promotions, audience segmentation, campaign automation and marketing-specific reporting will ship through a
            dedicated Mkety marketing engine. They are intentionally separated from core inbox and transactional sending so marketing
            permissions, consent, unsubscribe and reputation controls can be handled correctly.
          </p>
        </div>
        <div className="rounded-2xl border p-6">
          <Webhook className="h-6 w-6 text-primary" />
          <h2 className="mt-4 text-xl font-semibold">Built to connect</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Mkety Mail is designed to work with websites, applications, automations and external mail clients through Mkety APIs,
            signed webhooks, product integrations and SMTP/IMAP only after that dedicated gateway is production-certified, while preserving tenant and credential boundaries.
          </p>
        </div>
      </section>

      <section className="mt-20 rounded-3xl border bg-primary/5 p-8 text-center sm:p-12">
        <Inbox className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-4 text-3xl font-bold tracking-tight">Ready to use business email under your own domain?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Start with a self-service Mail plan, add Mail to an existing Mkety workspace, or discuss Enterprise Mail for specialized requirements.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="#mail-plans" className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Choose a plan</a>
          <a href="https://mail.mkety.com" className="rounded-xl border bg-background px-5 py-3 font-semibold">Open Mail</a>
        </div>
      </section>
    </main>
  );
}

import { Activity, ArrowRight, BellRing, Code2, CreditCard, FlaskConical, Globe2, Headphones, MessageSquareMore, Palette, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getTenantSettings } from '@/features/admin/services/settings-service';
import { ENTERPRISE_AI_CHANNELS } from '@/features/ai-runtime/channels/registry';
import { hasEnterpriseAiAccess, hasEnterpriseAiWhiteLabelAccess } from '@/features/ai-runtime/server/access';
import {
  listEnterpriseAiSolutionInstances,
  listEnterpriseAiSolutionTemplates,
  listTenantProjectChoices,
} from '@/features/ai-runtime/server/business-solutions';
import { getEnterpriseAiCustomerSummary } from '@/features/ai-runtime/server/customer-summary';
import { getEnterpriseAiContractBillingState } from '@/features/ai-runtime/server/enterprise-contracts';
import { resolveEnterpriseAiBrand } from '@/features/ai-runtime/server/white-label';
import { getCreditBalance } from '@/features/usage-credits/server/service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { withRequestDatabase } from '@/shared/db/request';
import { requireTenantMembership } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

async function renderEnterpriseAiConsolePage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  await requireTenantMembership(tenantSlug);
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) redirect('/select-tenant');

  if (!(await hasEnterpriseAiAccess(tenant.id))) {
    const contractState = await getEnterpriseAiContractBillingState(tenant.id);
    const contract = contractState.contract;
    const paymentPending = contractState.subscription?.status === 'pending_payment';
    const partialFunding = contract?.commercialPolicy.fundingMode === 'prepaid_partial';
    const fundedMinor = contractState.fundedMinor ?? 0n;
    const remainingMinor = contract ? (contract.amountMinor > fundedMinor ? contract.amountMinor - fundedMinor : 0n) : 0n;
    const minimumFundingMinor = contract
      ? (remainingMinor < contract.commercialPolicy.minimumFundingMinor ? remainingMinor : contract.commercialPolicy.minimumFundingMinor)
      : 0n;
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-8">
        <Card className="rounded-3xl">
          <CardHeader>
            <Sparkles className="h-8 w-8 text-primary" />
            <CardTitle className="mt-3 text-2xl">{contract ? 'Your Enterprise AI agreement is ready' : 'Enterprise AI is not active for this workspace'}</CardTitle>
            <CardDescription>
              {contract
                ? (partialFunding
                  ? 'Fund your Enterprise AI account with the negotiated minimum or more. Access activates only after verified Mkety Billing settlement.'
                  : 'Complete the verified subscription payment below. Access activates from Mkety Billing after settlement; no browser action can grant the entitlement by itself.')
                : 'Enterprise Mkety AI is a separate business solution from the normal AI Workspace. Access only becomes active from Mkety-owned billing and entitlements.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {contract ? (
              <>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="font-semibold">{contract.planName}</p>
                  <p className="mt-1 text-3xl font-bold">{contract.currency} {(Number(contract.amountMinor) / 100).toFixed(2)}<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
                  <p className="mt-2 text-sm text-muted-foreground">{contract.planDescription}</p>
                  <p className="mt-3 text-xs text-muted-foreground">{contract.includedCredits.toString()} included credits per billing period · {contract.entitlements.length} included capabilities</p>
                </div>
                {paymentPending ? (
                  <p className="rounded-xl border bg-amber-500/5 p-3 text-sm">
                    A payment is already awaiting confirmation. Complete that checkout or allow it to reach a terminal state before starting another.
                  </p>
                ) : (
                  <form action={`/api/tenants/${encodeURIComponent(tenantSlug)}/enterprise-ai/checkout`} className="grid gap-3 sm:grid-cols-2" method="post">
                    {partialFunding ? (
                      <label className="text-sm font-medium sm:col-span-2">
                        Funding amount (USD)
                        <input
                          className="mt-1 w-full rounded-xl border bg-background px-3 py-3"
                          defaultValue={(Number(minimumFundingMinor) / 100).toFixed(2)}
                          inputMode="decimal"
                          min={(Number(minimumFundingMinor) / 100).toFixed(2)}
                          max={(Number(remainingMinor) / 100).toFixed(2)}
                          name="fundingAmountUsd"
                          required
                          step="0.01"
                        />
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Minimum ${ (Number(minimumFundingMinor) / 100).toFixed(2) } · remaining monthly commitment ${ (Number(remainingMinor) / 100).toFixed(2) }
                        </span>
                      </label>
                    ) : null}
                    <select className="rounded-xl border bg-background px-3 py-3 text-sm" defaultValue="nowpayments" name="provider">
                      <option value="nowpayments">Crypto / NOWPayments</option>
                      <option value="flutterwave">Card / bank · Flutterwave</option>
                      <option value="kora">Card / bank · Kora</option>
                    </select>
                    <button className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
                      {partialFunding ? 'Fund & activate Enterprise AI' : 'Pay & activate Enterprise AI'}
                    </button>
                  </form>
                )}
                <p className="text-xs text-muted-foreground">If payment is later overdue, Enterprise AI follows the contract period and configured grace window, then stops inference while preserving your setup.</p>
              </>
            ) : (
              <div className="flex flex-wrap gap-3">
                <a className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" href="https://mkety.com/contact#enterprise">Request Enterprise AI access</a>
                <Link className="rounded-xl border px-5 py-3 text-sm font-semibold" href={`/app/${tenantSlug}`}>Back to workspace</Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [templates, instances, projects, balance, commercial, tenantSettings, canWhiteLabel, contractState] = await Promise.all([
    listEnterpriseAiSolutionTemplates(),
    listEnterpriseAiSolutionInstances(tenant.id),
    listTenantProjectChoices(tenant.id),
    getCreditBalance(tenant.id),
    getEnterpriseAiCustomerSummary(tenant.id),
    getTenantSettings(tenantSlug),
    hasEnterpriseAiWhiteLabelAccess(tenant.id),
    getEnterpriseAiContractBillingState(tenant.id),
  ]);
  const fundedMinor = contractState.fundedMinor ?? 0n;
  const brand = resolveEnterpriseAiBrand(tenantSettings, tenant.name);
  const displayBrand = canWhiteLabel && brand.enabled ? brand : { ...brand, brandName: tenant.name, productName: 'Mkety AI', hideMketyBranding: false };

  return (
    <div className="mx-auto max-w-7xl space-y-8 py-4">
      {commercial.billing?.subscription.status === 'past_due' ? (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Enterprise AI renewal is due</p>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Your workspace is currently inside its billing grace window. Renew now to avoid customer AI stopping when that grace period ends. Pricing is resolved server-side from your current Enterprise agreement.
              </p>
            </div>
            <form action={`/api/tenants/${encodeURIComponent(tenantSlug)}/enterprise-ai/checkout`} className="flex flex-wrap gap-2" method="post">
              <select className="rounded-xl border bg-background px-3 py-2 text-sm" defaultValue="nowpayments" name="provider">
                <option value="nowpayments">NOWPayments</option>
                <option value="flutterwave">Flutterwave</option>
                <option value="kora">Kora</option>
              </select>
              <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" type="submit">
                Renew Enterprise AI
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border bg-primary/[0.04] p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-primary">{displayBrand.productName} for {displayBrand.brandName}</p>
        <h1 className="mt-2 max-w-4xl text-3xl font-bold tracking-tight sm:text-5xl">What do you want AI to help your business do?</h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground sm:text-lg">
          Start with the result you want. Model choice, routing, permissions, budgets and technical setup stay behind simple business controls.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full border bg-background px-4 py-2">Private to your workspace</span>
          <span className="rounded-full border bg-background px-4 py-2">Prepaid usage protection</span>
          <span className="rounded-full border bg-background px-4 py-2">{projects.length} {projects.length === 1 ? 'project' : 'projects'}</span>
          <span className="rounded-full border bg-background px-4 py-2">{balance ? `${balance.availableCredits.toString()} credits available` : 'Credits not provisioned'}</span>
        </div>
      </section>

      {contractState.contract?.commercialPolicy.fundingMode === 'prepaid_partial' ? (
        <section className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Enterprise AI funding</p>
              <h2 className="mt-1 text-xl font-bold">
                ${(Number(fundedMinor) / 100).toFixed(2)} funded of ${(Number(contractState.contract.amountMinor) / 100).toFixed(2)} this period
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add prepaid capacity at any time. Your Mkety usage rates already include the platform and AI service; upstream provider economics are not itemized.
              </p>
            </div>
            {fundedMinor < contractState.contract.amountMinor ? (
              <form action={`/api/tenants/${encodeURIComponent(tenantSlug)}/enterprise-ai/checkout`} className="grid min-w-[260px] gap-2" method="post">
                {(() => {
                  const remaining = contractState.contract.amountMinor - fundedMinor;
                  const minimum = remaining < contractState.contract.commercialPolicy.minimumFundingMinor
                    ? remaining
                    : contractState.contract.commercialPolicy.minimumFundingMinor;
                  return (
                    <>
                      <input
                        className="rounded-xl border bg-background px-3 py-2 text-sm"
                        defaultValue={(Number(minimum) / 100).toFixed(2)}
                        inputMode="decimal"
                        max={(Number(remaining) / 100).toFixed(2)}
                        min={(Number(minimum) / 100).toFixed(2)}
                        name="fundingAmountUsd"
                        required
                        step="0.01"
                      />
                      <select className="rounded-xl border bg-background px-3 py-2 text-sm" defaultValue="nowpayments" name="provider">
                        <option value="nowpayments">Crypto / NOWPayments</option>
                        <option value="flutterwave">Card / bank · Flutterwave</option>
                        <option value="kora">Card / bank · Kora</option>
                      </select>
                      <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Add funds</button>
                    </>
                  );
                })()}
              </form>
            ) : (
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">Monthly commitment funded</span>
            )}
          </div>
        </section>
      ) : null}

      {contractState.contract?.commercialPolicy.fundingMode === 'full_period'
        && ['active', 'trialing', 'cancel_at_period_end'].includes(contractState.subscription?.status ?? '') ? (
        <section className="rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Extra Enterprise AI credits</p>
              <h2 className="mt-1 text-xl font-bold">Top up beyond your included monthly credits</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Your base monthly commitment is already active. Add verified prepaid usage capacity without changing the contract or the current paid period.
              </p>
            </div>
            <form action={`/api/tenants/${encodeURIComponent(tenantSlug)}/enterprise-ai/checkout`} className="grid min-w-[260px] gap-2" method="post">
              <input
                className="rounded-xl border bg-background px-3 py-2 text-sm"
                defaultValue="10.00"
                inputMode="decimal"
                min="1.00"
                name="fundingAmountUsd"
                required
                step="0.01"
              />
              <select className="rounded-xl border bg-background px-3 py-2 text-sm" defaultValue="nowpayments" name="provider">
                <option value="nowpayments">Crypto / NOWPayments</option>
                <option value="flutterwave">Card / bank · Flutterwave</option>
                <option value="kora">Card / bank · Kora</option>
              </select>
              <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Buy extra credits
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {instances.length ? (
        <section>
          <h2 className="text-2xl font-bold">Your AI solutions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Continue a setup you already started.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {instances.slice(0, 6).map((instance) => (
              <Link className="rounded-2xl border bg-card p-5 transition hover:border-primary/40" href={`/app/${tenantSlug}/enterprise-ai/solutions/${instance.id}`} key={instance.id}>
                <p className="font-semibold">{instance.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{instance.status === 'draft' ? 'Setup in progress' : instance.status}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-2xl font-bold">Choose a solution</h2>
        <p className="mt-1 text-sm text-muted-foreground">Start with one clear business job. You can expand it later.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((solution) => (
            <Card className="group rounded-2xl transition hover:border-primary/40 hover:shadow-md" key={solution.key}>
              <CardHeader>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div>
                <CardTitle className="mt-3 text-lg">{solution.title}</CardTitle>
                <CardDescription className="leading-6">{solution.shortDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {solution.outcomes.slice(0, 3).map((outcome) => <li className="flex gap-2" key={outcome}><span className="text-primary">✓</span>{outcome}</li>)}
                </ul>
                <Link className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary" href={`/app/${tenantSlug}/enterprise-ai/setup?solution=${encodeURIComponent(solution.key)}`}>
                  Start simple setup <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Connect where your customers already are</h2>
            <p className="mt-1 text-sm text-muted-foreground">Day-one channels share one Enterprise AI runtime, permissions and usage policy.</p>
          </div>
          <Link className="rounded-xl border px-4 py-2 text-sm font-semibold" href={`/app/${tenantSlug}/enterprise-ai/channels`}><MessageSquareMore className="mr-2 inline h-4 w-4" /> Manage channels</Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ENTERPRISE_AI_CHANNELS.map((channel) => (
            <Card className="rounded-2xl" key={channel.key}>
              <CardHeader className="pb-3"><CardTitle className="text-base">{channel.label}</CardTitle><CardDescription>{channel.supportsHumanHandoff ? 'AI + human handoff ready' : 'Flexible integration channel'}</CardDescription></CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl">
          <CardHeader><FlaskConical className="h-5 w-5 text-primary" /><CardTitle>Playground</CardTitle><CardDescription>Test the selected solution with its real instructions, knowledge, model, credits and commercial safeguards before customer use.</CardDescription></CardHeader>
          <CardContent><Link className="font-semibold text-primary" href={`/app/${tenantSlug}/enterprise-ai/playground`}>Test solution <ArrowRight className="ml-1 inline h-4 w-4" /></Link></CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><Activity className="h-5 w-5 text-primary" /><CardTitle>Runs & logs</CardTitle><CardDescription>Inspect customer-safe request status, token usage, model and credits without exposing provider secrets or internal margins.</CardDescription></CardHeader>
          <CardContent><Link className="font-semibold text-primary" href={`/app/${tenantSlug}/enterprise-ai/runs`}>Open runs <ArrowRight className="ml-1 inline h-4 w-4" /></Link></CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><Headphones className="h-5 w-5 text-primary" /><CardTitle>Conversations & handoff</CardTitle><CardDescription>Review customer chats, take over one conversation, reply as an operator, and resume AI when ready.</CardDescription></CardHeader>
          <CardContent><Link className="font-semibold text-primary" href={`/app/${tenantSlug}/enterprise-ai/conversations`}>Open operator inbox <ArrowRight className="ml-1 inline h-4 w-4" /></Link></CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><BellRing className="h-5 w-5 text-primary" /><CardTitle>Commitment reminders</CardTitle><CardDescription>Review reminders created from explicit customer promises, cancel pending ones, and inspect any delivery that requires reconciliation.</CardDescription></CardHeader>
          <CardContent><Link className="font-semibold text-primary" href={`/app/${tenantSlug}/enterprise-ai/reminders`}>Manage reminders <ArrowRight className="ml-1 inline h-4 w-4" /></Link></CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><Palette className="h-5 w-5 text-primary" /><CardTitle>Brand & white-label</CardTitle><CardDescription>{canWhiteLabel ? 'Use your own name, logo, colors, support and legal links.' : 'Available with Enterprise AI white-label access.'}</CardDescription></CardHeader>
          <CardContent><Link className="font-semibold text-primary" href={`/app/${tenantSlug}/enterprise-ai/branding`}>Open branding <ArrowRight className="ml-1 inline h-4 w-4" /></Link></CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader><Globe2 className="h-5 w-5 text-primary" /><CardTitle>Your domain</CardTitle><CardDescription>Use {tenant.slug}.mkety.app or connect a customer hostname through Mkety Domains.</CardDescription></CardHeader>
          <CardContent><Link className="font-semibold text-primary" href={`/app/${tenantSlug}/enterprise-ai/branding`}>Manage domain <ArrowRight className="ml-1 inline h-4 w-4" /></Link></CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-2xl font-bold">Plan, usage & cost</h2>
        <p className="mt-1 text-sm text-muted-foreground">A simple view of what your business has, what it has used this month, and what remains.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl">
            <CardHeader className="pb-2"><CardDescription>Current plan</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">{commercial.billing?.plan.name ?? 'Enterprise agreement'}</p><p className="mt-1 text-xs text-muted-foreground">{commercial.billing?.subscription.status ?? 'Entitled'}</p></CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader className="pb-2"><CardDescription>Credits available</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">{commercial.credits?.availableCredits.toString() ?? '0'}</p><p className="mt-1 text-xs text-muted-foreground">Prepaid usage protection</p></CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader className="pb-2"><CardDescription>AI requests this month</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">{commercial.usage.requests.toString()}</p><p className="mt-1 text-xs text-muted-foreground">{commercial.usage.settledCredits.toString()} credits used</p></CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader className="pb-2"><CardDescription>Current subscription</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold">{commercial.billing ? `${commercial.billing.currentPeriod.currency} ${(Number(commercial.billing.currentPeriod.amountDueMinor) / 100).toFixed(2)}` : 'Custom'}</p><p className="mt-1 text-xs text-muted-foreground">{commercial.billing?.subscription.renewalMode ?? 'Contract terms'}</p></CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle>Usage stays under control</CardTitle>
            <CardDescription>Mkety checks prepaid credits and every applicable hard budget before managed AI work can start.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link className="rounded-xl border px-4 py-2 text-sm font-semibold" href={`/app/${tenantSlug}/wallet`}><CreditCard className="mr-2 inline h-4 w-4" /> Usage & credits</Link>
            <Link className="rounded-xl border px-4 py-2 text-sm font-semibold" href={`/app/${tenantSlug}/billing`}>Billing</Link>
          </CardContent>
        </Card>

        <details className="rounded-2xl border bg-card p-5">
          <summary className="cursor-pointer font-semibold">Advanced / Developer</summary>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Open APIs, project-scoped keys, models, tools and custom integrations only when your team needs them.</p>
          <div className="mt-4 grid gap-2">
            <a className="rounded-lg border px-3 py-2 text-sm font-medium" href="https://mkety.com/docs"><Code2 className="mr-2 inline h-4 w-4" /> Developer docs</a>
            <Link className="rounded-lg border px-3 py-2 text-sm font-medium" href={`/app/${tenantSlug}/projects`}>Projects</Link>
            <Link className="rounded-lg border px-3 py-2 text-sm font-medium" href={`/app/${tenantSlug}/enterprise-ai/providers`}>Providers / BYOK</Link>
          </div>
        </details>
      </section>
    </div>
  );
}

export default async function EnterpriseAiConsolePage(props: { params: Promise<{ tenant: string }> }) {
  return withRequestDatabase(() => renderEnterpriseAiConsolePage(props));
}

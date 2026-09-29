import { notFound } from 'next/navigation';

import { AiCommercialControlPanel } from '@/features/ai-runtime/components/AiCommercialControlPanel';
import { getAiCommercialControlOverview } from '@/features/ai-runtime/server/commercial-admin-queries';
import {
  createEnterpriseAiContractVersion,
  ENTERPRISE_AI_CONTRACT_ENTITLEMENTS,
  listEnterpriseAiContracts,
} from '@/features/ai-runtime/server/enterprise-contracts';
import { DeploymentApprovalQueue } from '@/features/deploy/components/DeploymentApprovalQueue';
import { DomainResellerControlPanel } from '@/features/domains/components/DomainResellerControlPanel';
import { getDomainResellerConnections } from '@/features/domains/server/reseller-admin-actions';
import { PaymentSettingsForm } from '@/features/payments/components/PaymentSettingsForm';
import { getMketyPaymentSettings } from '@/features/payments/settings';
import { getMailOperationsOverview } from '@/features/mail/server/admin-queries';
import { listMediaTenantLinks, saveMediaTenantLink } from '@/features/media/server/links';
import { createMailPlanVersion, reconcileMailCatalog, updateMailDomainOperations, updateMailWorkspaceOperations } from '@/features/mail/server/admin-actions';
import { getDeploymentApprovalQueue } from '@/features/deploy/server/request-queries';

import { defaultAppExperience } from '@/features/platform-app-experience/defaults';
import { getPublishedControlCenterModule } from '@/features/platform-app-experience/server/queries';
import { PlatformContentDraftForm } from '@/features/platform-content/components/admin/PlatformContentDraftForm';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

interface PlatformControlModulePageProps {
  params: Promise<{ tenant: string; module: string }>;
}

const protectedActionsByModule: Record<string, string[]> = {
  'public-site-docs': ['Edit public pages', 'Publish docs articles', 'Manage navigation', 'Update pricing display'],
  'app-experience': ['Edit dashboard copy', 'Manage workspace cards', 'Control onboarding text', 'Update quick links'],
  'plans-entitlements': ['Manage plan presentation', 'Review entitlement mappings', 'Control feature visibility', 'Set usage display rules'],
  'billing-ledger': ['View ledger history', 'Create controlled adjustments', 'Review refunds', 'Audit credit grants'],
  'ai-operations': ['Review cost protection', 'Manage safe limits', 'Create future rate versions', 'Emergency-disable inference'],
  'mail-operations': ['Reconcile Mail plans', 'Operate tenant Mail state', 'Manage domain sending/routing', 'Review Mail readiness'],
  'media-connector': ['Link verified Media workspaces', 'Suspend or disconnect links', 'Review external workspace references', 'Preserve standalone Media billing'],
  'deployments-domains': ['Review pending candidate requests', 'Approve one execution', 'Reject unsafe requests', 'Inspect deployment history'],
  'domains-routing': [
    'Monitor mkety.com public website routing',
    'Monitor app.mkety.com platform routing',
    'Monitor api.mkety.com API routing',
    'Confirm origin.mkety.com infrastructure-only routing',
    'Review *.mkety.app customer deployment hostnames',
    'Approve custom hostname verification flows',
  ],
  'auth-gateway': ['View JWKS status', 'Review product audiences', 'Inspect access issuance outcomes', 'Prepare key rotation actions'],
  'security-audit': ['View audit events', 'Review role changes', 'Inspect session/security activity', 'Monitor sensitive operations'],
};

async function withAdminTimeout<T>(promise: Promise<T>, fallback: T, ms = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function PlatformControlModulePage({ params }: PlatformControlModulePageProps) {
  const { tenant, module: routeModuleKey } = await params;
  await requirePlatformControlAccess(tenant);

  const moduleAliases: Record<string, string> = {
    plans: 'plans-entitlements',
    billing: 'billing-ledger',
    security: 'security-audit',
    mail: 'mail-operations',
    media: 'media-connector',
  };
  const moduleKey = moduleAliases[routeModuleKey] ?? routeModuleKey;
  const controlModule = await getPublishedControlCenterModule(moduleKey);

  if (!controlModule) {
    notFound();
  }

  const actions = protectedActionsByModule[controlModule.key] ?? ['Review configuration', 'Manage approved settings'];
  const isAppExperience = controlModule.key === 'app-experience';
  const isDeployments = controlModule.key === 'deployments-domains';
  const isPayments = controlModule.key === 'payments';
  const isMailOperations = controlModule.key === 'mail-operations';
  const isAiOperations = controlModule.key === 'ai-operations';
  const isMediaConnector = controlModule.key === 'media-connector';
  const isDomainsRouting = controlModule.key === 'domains-routing';
  let deploymentApprovalRows = null;
  let paymentSettings = null;
  let mailOperations = null;
  let aiCommercialOverview = null;
  let enterpriseAiContracts = null;
  let mediaLinks = null;
  let domainResellerConnections = null;

  if (isDeployments) {
    await requirePermission(tenant, 'platform:deployments');
    const tenantRecord = await getTenantBySlug(tenant);
    if (!tenantRecord) notFound();
    deploymentApprovalRows = await withAdminTimeout(getDeploymentApprovalQueue(tenantRecord.id), []);
  }

  if (isPayments) {
    await requirePermission(tenant, 'platform:billing');
    paymentSettings = await withAdminTimeout(getMketyPaymentSettings(), null);
  }

  if (isMailOperations) {
    await requirePermission(tenant, 'platform:plans');
    mailOperations = await withAdminTimeout(getMailOperationsOverview(), null);
  }

  if (isAiOperations) {
    await requirePermission(tenant, 'platform:plans');
    [aiCommercialOverview, enterpriseAiContracts] = await Promise.all([
      withAdminTimeout(getAiCommercialControlOverview(), null),
      withAdminTimeout(listEnterpriseAiContracts(), []),
    ]);
  }

  if (isMediaConnector) {
    await requirePermission(tenant, 'platform:plans');
    mediaLinks = await withAdminTimeout(listMediaTenantLinks(), []);
  }

  if (isDomainsRouting) {
    await requirePermission(tenant, 'platform:deployments');
    domainResellerConnections = await withAdminTimeout(getDomainResellerConnections(), []);
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Platform Control Center</p>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{controlModule.status}</span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{controlModule.domain}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{controlModule.label}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{controlModule.description}</p>
      </div>

      {isAppExperience && (
        <PlatformContentDraftForm
          tenant={tenant}
          area="app-experience"
          entityType="app_experience"
          entityKey="production"
          title="App experience draft"
          description="Validate dashboard, workspace, and Platform Control Center configuration through the server-side Mkety app-experience boundary."
          defaultPayload={defaultAppExperience}
        />
      )}

      {isDeployments && deploymentApprovalRows ? (
        <DeploymentApprovalQueue rows={deploymentApprovalRows} tenantSlug={tenant} />
      ) : null}

      {isPayments && paymentSettings ? (
        <PaymentSettingsForm
          tenant={tenant}
          settings={paymentSettings}
          readiness={{
            nowpayments: Boolean(process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET),
            flutterwave: Boolean(
              process.env.FLUTTERWAVE_PUBLIC_KEY &&
              process.env.FLUTTERWAVE_STANDARD_SECRET_KEY &&
              process.env.FLUTTERWAVE_STANDARD_WEBHOOK_HASH
            ),
            kora: Boolean(process.env.KORA_PUBLIC_KEY && process.env.KORA_SECRET_KEY),
          }}
        />
      ) : null}


      {isAiOperations && aiCommercialOverview ? (
        <div className="space-y-6">
          <AiCommercialControlPanel tenant={tenant} overview={aiCommercialOverview} />
          <Card className="rounded-2xl border-primary/20">
            <CardHeader>
              <CardTitle>Enterprise AI customer contracts</CardTitle>
              <CardDescription>
                Create a tenant-specific recurring contract. Saving a change creates a new immutable billing version; verified payment activates the subscription entitlement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form action={createEnterpriseAiContractVersion.bind(null, tenant)} className="grid gap-4 rounded-xl border p-4 lg:grid-cols-2">
                <label className="text-sm font-medium">
                  Customer workspace slug
                  <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" name="targetTenantSlug" placeholder="customer-workspace" required />
                </label>
                <label className="text-sm font-medium">
                  Contract name
                  <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" name="name" placeholder="Customer Enterprise AI" />
                </label>
                <label className="text-sm font-medium">
                  Monthly price (USD)
                  <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" inputMode="decimal" name="monthlyPriceUsd" pattern="\d{1,7}(?:\.\d{1,2})?" placeholder="100.00" required />
                </label>
                <label className="text-sm font-medium">
                  Included credits per billing period
                  <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" inputMode="numeric" name="includedCredits" pattern="\d+" placeholder="0" />
                </label>
                <label className="text-sm font-medium lg:col-span-2">
                  Description
                  <textarea className="mt-1 w-full rounded-lg border bg-background px-3 py-2" maxLength={2000} name="description" rows={3} />
                </label>
                <div className="lg:col-span-2">
                  <p className="text-sm font-medium">Included capabilities</p>
                  <p className="mt-1 text-xs text-muted-foreground">Enterprise AI base access is always included. Add only capabilities covered by the customer contract.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {ENTERPRISE_AI_CONTRACT_ENTITLEMENTS.map((entitlement) => (
                      <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" key={entitlement}>
                        <input defaultChecked={entitlement === 'workspace.ai.enterprise'} disabled={entitlement === 'workspace.ai.enterprise'} name={entitlement === 'workspace.ai.enterprise' ? undefined : 'entitlements'} type="checkbox" value={entitlement} />
                        <span className="font-mono">{entitlement}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button className="w-fit rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground lg:col-span-2">
                  Create contract version
                </button>
              </form>

              <div className="grid gap-3 lg:grid-cols-2">
                {(enterpriseAiContracts ?? []).length ? (enterpriseAiContracts ?? []).map((contract) => (
                  <div className="rounded-xl border p-4" key={contract.versionId}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{contract.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{contract.tenant?.slug ?? 'Unknown tenant'} · version {contract.version}</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        {contract.currency} {(Number(contract.amountMinor) / 100).toFixed(2)}/mo
                      </span>
                    </div>
                    {contract.description ? <p className="mt-3 text-sm text-muted-foreground">{contract.description}</p> : null}
                  </div>
                )) : <p className="text-sm text-muted-foreground">No Enterprise AI customer contracts configured yet.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isMediaConnector && mediaLinks ? (
        <div className="space-y-6">
          <Card className="rounded-2xl border-primary/20">
            <CardHeader>
              <CardTitle>Mkety Media tenant links</CardTitle>
              <CardDescription>
                Link an Mkety workspace to an existing standalone Media workspace. This stores only a non-secret reference; Media billing, invoices, credentials and runtime remain authoritative in Media.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form action={saveMediaTenantLink.bind(null, tenant)} className="grid gap-4 rounded-xl border p-4 lg:grid-cols-2">
                <label className="text-sm font-medium">
                  Mkety workspace slug
                  <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" name="targetTenantSlug" placeholder="customer-workspace" required />
                </label>
                <label className="text-sm font-medium">
                  Existing Media workspace reference
                  <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" maxLength={255} name="externalWorkspaceRef" placeholder="Media workspace ID or canonical reference" required />
                </label>
                <label className="text-sm font-medium">
                  Link status
                  <select className="mt-1 w-full rounded-lg border bg-background px-3 py-2" defaultValue="linked" name="status">
                    <option value="linked">Linked</option>
                    <option value="suspended">Suspended</option>
                    <option value="disconnected">Disconnected</option>
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Verification note
                  <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" maxLength={1000} name="note" placeholder="How the Media workspace ownership/link was verified" />
                </label>
                <button className="w-fit rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground lg:col-span-2">
                  Save Media link
                </button>
              </form>

              <div className="grid gap-3 lg:grid-cols-2">
                {mediaLinks.length ? mediaLinks.map((link) => (
                  <div className="rounded-xl border p-4" key={link.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{link.tenantName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{link.tenantSlug}</p>
                      </div>
                      <span className="rounded-full border px-2.5 py-1 text-xs font-semibold">{link.status}</span>
                    </div>
                    <p className="mt-3 font-mono text-xs">{link.externalWorkspaceRef}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Updated {link.updatedAt.toLocaleString()}</p>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No Mkety tenant is linked to Media yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isDomainsRouting && domainResellerConnections ? (
        <DomainResellerControlPanel tenant={tenant} connections={domainResellerConnections} />
      ) : null}

      {isMailOperations && mailOperations ? (
        <div className="space-y-6">
          <Card className="rounded-2xl border-primary/20">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Mail commercial catalog</CardTitle>
                  <CardDescription>
                    Canonical prices stay versioned in Billing. Reconcile creates missing plan/version/entitlement records but never rewrites billing history.
                  </CardDescription>
                </div>
                <form action={reconcileMailCatalog.bind(null, tenant)}>
                  <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                    Reconcile catalog
                  </button>
                </form>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              {mailOperations.catalog.map((plan) => (
                <form
                  action={createMailPlanVersion.bind(null, tenant)}
                  key={plan.key}
                  className="rounded-xl border bg-muted/20 p-4"
                >
                  <input type="hidden" name="planKey" value={plan.key} />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{plan.name}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{plan.key} · v{plan.version}</p>
                    </div>
                    <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      Active
                    </span>
                  </div>
                  <label className="mt-4 block text-xs font-medium">
                    Plan name
                    <input
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                      defaultValue={plan.name}
                      maxLength={255}
                      name="name"
                      required
                    />
                  </label>
                  <label className="mt-3 block text-xs font-medium">
                    Description
                    <textarea
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                      defaultValue={plan.description ?? ''}
                      maxLength={2000}
                      name="description"
                      required
                      rows={3}
                    />
                  </label>
                  <label className="mt-3 block text-xs font-medium">
                    Monthly price (USD)
                    <input
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
                      defaultValue={(Number(plan.amountMinor) / 100).toFixed(2)}
                      inputMode="decimal"
                      name="monthlyPriceUsd"
                      pattern="\\d{1,6}(?:\\.\\d{1,2})?"
                      required
                    />
                  </label>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Saving creates a new billing version. Existing subscriptions and historical settlements keep their original version and price.
                  </p>
                  <button className="mt-4 rounded-lg border px-3 py-2 text-sm font-semibold">
                    Create new price version
                  </button>
                </form>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {mailOperations.workspaces.length ? mailOperations.workspaces.map((workspace) => (
              <Card className="rounded-2xl" key={workspace.workspaceId}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <CardTitle>{workspace.tenantName}</CardTitle>
                      <CardDescription>
                        {workspace.tenantSlug} · paid plan {workspace.paidPlanKey} · {workspace.domains.length} domain{workspace.domains.length === 1 ? '' : 's'}
                      </CardDescription>
                    </div>
                    <a className="text-sm font-semibold text-primary" href={'/t/' + workspace.tenantSlug + '/mail'}>
                      Open tenant Mail →
                    </a>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <form action={updateMailWorkspaceOperations.bind(null, tenant)} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                    <input type="hidden" name="workspaceId" value={workspace.workspaceId} />
                    <input type="hidden" name="targetTenantId" value={workspace.tenantId} />
                    <label className="text-sm font-medium">
                      Workspace status
                      <select name="status" defaultValue={workspace.status} className="mt-2 w-full rounded-lg border bg-background px-3 py-2">
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      Onboarding
                      <select name="onboardingStep" defaultValue={workspace.onboardingStep} className="mt-2 w-full rounded-lg border bg-background px-3 py-2">
                        <option value="domain">Domain setup</option>
                        <option value="ready">Ready</option>
                      </select>
                    </label>
                    <button className="rounded-lg border px-4 py-2 text-sm font-semibold">Save workspace</button>
                  </form>

                  <div className="space-y-3">
                    {workspace.domains.length ? workspace.domains.map((domain) => (
                      <form action={updateMailDomainOperations.bind(null, tenant)} key={domain.id} className="rounded-xl border bg-muted/15 p-4">
                        <input type="hidden" name="domainId" value={domain.id} />
                        <input type="hidden" name="targetTenantId" value={workspace.tenantId} />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{domain.domain}</p>
                            <p className="text-xs text-muted-foreground">
                              Routing {domain.routingEnabled ? 'on' : 'off'} · Sending {domain.sendingEnabled ? 'on' : 'off'}
                            </p>
                          </div>
                          <button className="rounded-lg border px-3 py-2 text-sm font-semibold">Save domain</button>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-5">
                          {[
                            ['status', 'Domain', domain.status],
                            ['spfStatus', 'SPF', domain.spfStatus],
                            ['dkimStatus', 'DKIM', domain.dkimStatus],
                            ['dmarcStatus', 'DMARC', domain.dmarcStatus],
                            ['mxStatus', 'MX', domain.mxStatus],
                          ].map(([name, label, value]) => (
                            <label className="text-xs font-medium" key={String(name)}>
                              {label}
                              <select name={String(name)} defaultValue={String(value)} className="mt-1 w-full rounded-lg border bg-background px-2 py-2 text-sm">
                                <option value="pending">Pending</option>
                                <option value="verified">Verified</option>
                                <option value="failed">Failed</option>
                                <option value="disabled">Disabled</option>
                              </select>
                            </label>
                          ))}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-5 text-sm">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="routingEnabled" defaultChecked={domain.routingEnabled} />
                            Routing enabled
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="sendingEnabled" defaultChecked={domain.sendingEnabled} />
                            Sending enabled
                          </label>
                        </div>
                      </form>
                    )) : (
                      <p className="text-sm text-muted-foreground">No Mail domains connected yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )) : (
              <Card className="rounded-2xl">
                <CardContent className="p-6 text-sm text-muted-foreground">No Mail workspaces have been provisioned yet.</CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : null}

      {!isPayments && !isMailOperations && !isAiOperations && !isMediaConnector && !isDomainsRouting ? <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Controlled module surface</CardTitle>
            <CardDescription>{controlModule.implementationNotes}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {actions.map((action) => (
                <div key={action} className="rounded-xl border bg-muted/30 p-4 text-sm font-medium">
                  {action}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-primary/20">
          <CardHeader>
            <CardTitle>Safety boundary</CardTitle>
            <CardDescription>
              Required permission: <span className="font-mono">{controlModule.requiredPermission}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-muted-foreground">
            <div>
              <p className="mb-2 font-medium text-foreground">Editable here</p>
              <ul className="list-disc space-y-1 pl-4">
                {controlModule.editableScope.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 font-medium text-foreground">Protected from admin editing</p>
              <ul className="list-disc space-y-1 pl-4">
                {controlModule.protectedScope.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <p>Domain routing must follow the approved Mkety map: mkety.com, app.mkety.com, api.mkety.com, origin.mkety.com, and *.mkety.app.</p>
          </CardContent>
        </Card>
      </div> : null}
    </div>
  );
}

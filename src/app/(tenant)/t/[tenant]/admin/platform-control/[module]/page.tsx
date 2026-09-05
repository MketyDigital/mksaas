import { notFound } from 'next/navigation';

import { defaultAppExperience } from '@/features/platform-app-experience/defaults';
import { getPublishedControlCenterModule } from '@/features/platform-app-experience/server/queries';
import { PlatformContentDraftForm } from '@/features/platform-content/components/admin/PlatformContentDraftForm';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

interface PlatformControlModulePageProps {
  params: Promise<{ tenant: string; module: string }>;
}

const protectedActionsByModule: Record<string, string[]> = {
  'public-site-docs': ['Edit public pages', 'Publish docs articles', 'Manage navigation', 'Update pricing display'],
  'app-experience': ['Edit dashboard copy', 'Manage workspace cards', 'Control onboarding text', 'Update quick links'],
  'plans-entitlements': ['Manage plan presentation', 'Review entitlement mappings', 'Control feature visibility', 'Set usage display rules'],
  'billing-ledger': ['View ledger history', 'Create controlled adjustments', 'Review refunds', 'Audit credit grants'],
  'deployments-domains': ['Review deployment history', 'Approve domains', 'Retry failed jobs', 'Trigger safe rollback flows'],
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

export default async function PlatformControlModulePage({ params }: PlatformControlModulePageProps) {
  const { tenant, module: moduleKey } = await params;
  await requirePlatformControlAccess(tenant);

  const controlModule = await getPublishedControlCenterModule(moduleKey);

  if (!controlModule) {
    notFound();
  }

  const actions = protectedActionsByModule[controlModule.key] ?? ['Review configuration', 'Manage approved settings'];
  const isAppExperience = controlModule.key === 'app-experience';

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

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
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
      </div>
    </div>
  );
}

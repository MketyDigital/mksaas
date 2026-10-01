import Link from 'next/link';

import { listByokProviderConnections } from '@/features/ai-runtime/server/provider-connections';
import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { requireProjectAccess } from '@/features/projects/server/access';
import {
  disableWorkspaceByokProvider,
  saveWorkspaceByokProvider,
} from '@/features/projects/workspaces/ai/provider-actions';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

export const dynamic = 'force-dynamic';

const PROVIDERS = [
  ['openai', 'OpenAI'],
  ['azure-openai', 'Azure OpenAI'],
  ['gemini', 'Google Gemini'],
  ['vertex', 'Google Vertex AI'],
  ['cloudflare-ai', 'Cloudflare AI'],
  ['bedrock', 'AWS Bedrock'],
  ['openai-compatible', 'OpenAI-compatible / self-hosted'],
] as const;

export default async function AiWorkspaceProvidersPage({
  params,
}: {
  params: Promise<{ tenant: string; project: string }>;
}) {
  const { tenant: tenantSlug, project: projectSlug } = await params;
  const access = await requireProjectAccess({ tenantSlug, projectSlug });
  if (access.status !== 'ok') return <div className="p-8">{access.reason}</div>;

  const canByok = await hasEntitlement({ tenantId: access.tenant.id, entitlement: 'ai.byok' });
  const connections = canByok
    ? await listByokProviderConnections({ tenantId: access.tenant.id, projectId: access.project.id })
    : [];

  return (
    <WorkspaceShell
      projectName={access.project.name}
      projectSlug={access.project.slug}
      tenantSlug={access.tenant.slug}
      workspace={getProjectWorkspaceByKey('ai')}
    >
      <section className="rounded-2xl border bg-card p-5 md:p-6">
        <Link className="text-sm font-semibold text-primary" href={`/t/${tenantSlug}/projects/${projectSlug}/ai`}>
          ← AI Workspace
        </Link>
        <h2 className="mt-3 text-2xl font-semibold">Providers & BYOK</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Connect this project to your own provider account. Credentials are encrypted, never returned to the browser, and can be rotated without rebuilding or redeploying Mkety.
        </p>
      </section>

      {!canByok ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>BYOK is not enabled</CardTitle>
            <CardDescription>Your current plan does not include customer-owned AI provider connections.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {connections.map((connection) => (
              <Card className="rounded-2xl" key={connection.id}>
                <CardHeader>
                  <CardTitle className="capitalize">{connection.providerKey.replaceAll('-', ' ')}</CardTitle>
                  <CardDescription>{connection.status} · project-scoped · secrets hidden</CardDescription>
                </CardHeader>
                <CardContent>
                  {access.canManage && connection.status === 'active' ? (
                    <form action={disableWorkspaceByokProvider.bind(null, tenantSlug, projectSlug, connection.id)}>
                      <button className="text-sm font-semibold text-destructive">Disable</button>
                    </form>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </section>

          {access.canManage ? (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Add or rotate a project provider</CardTitle>
                <CardDescription>
                  Saving the same provider replaces its encrypted project credential immediately.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={saveWorkspaceByokProvider.bind(null, tenantSlug, projectSlug)} className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium">Provider
                    <select className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="provider" required>
                      {PROVIDERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium">API key
                    <input autoComplete="new-password" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="apiKey" type="password" />
                  </label>
                  <label className="text-sm font-medium">API token
                    <input autoComplete="new-password" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="apiToken" type="password" />
                  </label>
                  <label className="text-sm font-medium">Access token
                    <input autoComplete="new-password" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="accessToken" type="password" />
                  </label>
                  <label className="text-sm font-medium">Endpoint
                    <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="endpoint" />
                  </label>
                  <label className="text-sm font-medium">Azure deployment
                    <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="deployment" />
                  </label>
                  <label className="text-sm font-medium">Google project ID
                    <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="vertexProjectId" />
                  </label>
                  <label className="text-sm font-medium">Google location
                    <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue="global" name="location" />
                  </label>
                  <label className="text-sm font-medium">Cloudflare account ID
                    <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="accountId" />
                  </label>
                  <label className="text-sm font-medium">AWS access key ID
                    <input autoComplete="new-password" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="accessKeyId" type="password" />
                  </label>
                  <label className="text-sm font-medium">AWS secret access key
                    <input autoComplete="new-password" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="secretAccessKey" type="password" />
                  </label>
                  <label className="text-sm font-medium">AWS session token
                    <input autoComplete="new-password" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="sessionToken" type="password" />
                  </label>
                  <label className="text-sm font-medium">AWS region
                    <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue="us-east-1" name="region" />
                  </label>
                  <div className="md:col-span-2">
                    <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                      Save encrypted provider
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </WorkspaceShell>
  );
}

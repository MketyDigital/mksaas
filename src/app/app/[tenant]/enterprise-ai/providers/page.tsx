import { KeyRound, PlugZap, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  disableEnterpriseAiByokProvider,
  saveEnterpriseAiByokProvider,
  testEnterpriseAiByokProvider,
} from '@/features/ai-runtime/server/provider-connection-actions';
import { listByokProviderConnections } from '@/features/ai-runtime/server/provider-connections';
import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';
import { requireTenantMembership } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

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

export default async function EnterpriseAiProvidersPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  await requireTenantMembership(tenantSlug);
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) redirect('/select-tenant');

  const canByok = await hasEntitlement({ tenantId: tenant.id, entitlement: 'ai.byok' });
  const connections = canByok ? await listByokProviderConnections({ tenantId: tenant.id }) : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-4">
      <div>
        <Link className="text-sm font-medium text-primary" href={`/app/${tenantSlug}/enterprise-ai`}>
          ← Enterprise AI
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">AI providers & BYOK</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Use Mkety managed models or connect your own approved provider account. Customer keys stay encrypted and are never shown again after submission.
        </p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle>Shared Mkety AI runtime, isolated credentials</CardTitle>
          <CardDescription>
            Public AI, Workspace AI and Enterprise AI share the central provider transport. Tenant BYOK connections remain tenant/project scoped and never silently fall back to Mkety-paid credentials.
          </CardDescription>
        </CardHeader>
      </Card>

      {!canByok ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>BYOK is not enabled</CardTitle>
            <CardDescription>Your Enterprise agreement does not currently include customer-owned provider credentials.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-2">
            {connections.map((connection) => (
              <Card className="rounded-2xl" key={connection.id}>
                <CardHeader>
                  <PlugZap className="h-5 w-5 text-primary" />
                  <CardTitle className="capitalize">{connection.providerKey.replaceAll('-', ' ')}</CardTitle>
                  <CardDescription>
                    {connection.status === 'active' ? 'Active BYOK connection' : 'Disabled connection'} · secrets hidden
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {connection.status === 'active' ? (
                    <form action={testEnterpriseAiByokProvider.bind(null, tenantSlug, connection.id)} className="flex gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
                        name="model"
                        placeholder="Optional model override"
                      />
                      <button className="rounded-lg border px-3 py-2 text-sm font-semibold" type="submit">Test</button>
                    </form>
                  ) : null}
                  <form action={disableEnterpriseAiByokProvider.bind(null, tenantSlug, connection.id)}>
                    <button className="text-sm font-semibold text-destructive" type="submit">Disable connection</button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card className="rounded-2xl">
            <CardHeader>
              <KeyRound className="h-5 w-5 text-primary" />
              <CardTitle>Add or replace a BYOK provider</CardTitle>
              <CardDescription>
                Choose a provider and fill only the fields that apply. Saving the same provider replaces its encrypted tenant-level connection.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={saveEnterpriseAiByokProvider.bind(null, tenantSlug)} className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">
                  Provider
                  <select className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="provider" required>
                    {PROVIDERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium">
                  API key
                  <input autoComplete="off" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="apiKey" type="password" />
                </label>
                <label className="text-sm font-medium">
                  API token
                  <input autoComplete="off" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="apiToken" type="password" />
                </label>
                <label className="text-sm font-medium">
                  Access token
                  <input autoComplete="off" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="accessToken" type="password" />
                </label>
                <label className="text-sm font-medium">
                  Endpoint
                  <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="endpoint" placeholder="Azure or OpenAI-compatible HTTPS endpoint" />
                </label>
                <label className="text-sm font-medium">
                  Deployment
                  <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="deployment" placeholder="Azure deployment name" />
                </label>
                <label className="text-sm font-medium">
                  Google project ID
                  <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="vertexProjectId" />
                </label>
                <label className="text-sm font-medium">
                  Google location
                  <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue="global" name="location" />
                </label>
                <label className="text-sm font-medium">
                  Cloudflare account ID
                  <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="accountId" />
                </label>
                <label className="text-sm font-medium">
                  AWS access key ID
                  <input autoComplete="off" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="accessKeyId" type="password" />
                </label>
                <label className="text-sm font-medium">
                  AWS secret access key
                  <input autoComplete="off" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="secretAccessKey" type="password" />
                </label>
                <label className="text-sm font-medium">
                  AWS session token
                  <input autoComplete="off" className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="sessionToken" type="password" />
                </label>
                <label className="text-sm font-medium">
                  AWS region
                  <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue="us-east-1" name="region" />
                </label>
                <div className="md:col-span-2">
                  <button className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" type="submit">
                    Save encrypted provider connection
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

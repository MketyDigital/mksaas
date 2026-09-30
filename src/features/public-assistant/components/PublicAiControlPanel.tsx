import type { CentralAiProviderId } from '@/features/ai-runtime/providers/external-types';
import { getDefaultPublicAIModel, type PublicAIProviderId } from '@/features/public-assistant/models';
import {
  disablePublicAiProviderConnection,
  savePublicAiProviderConnection,
  updatePublicAiRouting,
} from '@/features/public-assistant/server/admin-actions';
import type { getPublicAiControlOverview } from '@/features/public-assistant/server/dynamic-config';
import { ConfirmSubmitButton } from '@/shared/components/ConfirmSubmitButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

type Overview = Awaited<ReturnType<typeof getPublicAiControlOverview>>;

const PROVIDERS: Array<[PublicAIProviderId, string]> = [
  ['workers-ai', 'Mkety managed AI'],
  ['openai', 'OpenAI'],
  ['azure-openai', 'Azure OpenAI'],
  ['gemini', 'Google Gemini'],
  ['vertex', 'Google Vertex AI'],
  ['cloudflare-ai', 'Cloudflare AI'],
  ['bedrock', 'AWS Bedrock'],
];

const CREDENTIAL_PROVIDERS = PROVIDERS.filter(([provider]) => provider !== 'workers-ai');

export function PublicAiControlPanel({
  tenant,
  overview,
}: {
  tenant: string;
  overview: Overview;
}) {
  const activeProviders = overview.connections.filter((item) => item.status === 'active');

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-primary/20">
        <CardHeader>
          <CardTitle>Public Mkety AI runtime</CardTitle>
          <CardDescription>
            Public AI uses the shared Mkety AI provider layer with its own isolated system credentials. Routing, models and credential rotation are database-backed and apply without a build or redeploy.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase text-muted-foreground">Runtime</p>
            <p className="mt-2 font-semibold">{overview.config.enabled ? 'Enabled' : 'Disabled'}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase text-muted-foreground">Primary</p>
            <p className="mt-2 font-semibold">{overview.config.primaryProvider}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs uppercase text-muted-foreground">Active credentials</p>
            <p className="mt-2 font-semibold">{activeProviders.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Public AI routing & models</CardTitle>
          <CardDescription>
            These are non-secret runtime settings. Changes are immediate and revision-audited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updatePublicAiRouting.bind(null, tenant)} className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
              <input defaultChecked={overview.config.enabled} name="enabled" type="checkbox" />
              Enable Public Mkety AI
            </label>
            <label className="text-sm font-medium">
              Primary provider
              <select className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={overview.config.primaryProvider} name="primaryProvider">
                {PROVIDERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">
              Fallback providers
              <input
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2"
                defaultValue={overview.config.fallbackProviders.join(',')}
                name="fallbackProviders"
                placeholder="gemini,vertex"
              />
            </label>
            {PROVIDERS.map(([provider, label]) => (
              <label className="text-sm font-medium" key={provider}>
                {label} model
                <input
                  className="mt-2 w-full rounded-lg border bg-background px-3 py-2"
                  defaultValue={overview.config.models[provider] ?? getDefaultPublicAIModel(provider)}
                  name={`model_${provider}`}
                />
              </label>
            ))}
            <div className="md:col-span-2">
              <ConfirmSubmitButton
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                confirmMessage="Apply this Public AI routing change now? This can immediately change which provider/model serves public visitors."
              >
                Save Public AI routing
              </ConfirmSubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Public AI provider credentials</CardTitle>
          <CardDescription>
            Credentials are encrypted before persistence and are never rendered back to the browser. Saving the same provider rotates it immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overview.connections.map((connection) => (
              <div className="rounded-xl border p-4" key={connection.id}>
                <p className="font-semibold">{connection.providerKey}</p>
                <p className="mt-1 text-xs text-muted-foreground">{connection.status} · updated {connection.updatedAt.toLocaleString()}</p>
                {connection.status === 'active' ? (
                  <form className="mt-3" action={disablePublicAiProviderConnection.bind(null, tenant, connection.providerKey as CentralAiProviderId)}>
                    <button className="text-sm font-semibold text-destructive">Disable</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>

          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-semibold">Add or rotate provider credential</summary>
            <form action={savePublicAiProviderConnection.bind(null, tenant)} className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium">
                Provider
                <select className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="provider" required>
                  {CREDENTIAL_PROVIDERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
                <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="endpoint" placeholder="https://resource.services.ai.azure.com" />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">For Azure OpenAI / Foundry, use the resource host root only. Do not include /api/projects/...; Mkety appends the Responses API path.</span>
              </label>
              <label className="text-sm font-medium">Azure deployment
                <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="deployment" placeholder="gpt-5.6-sol-1" />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">This is the Azure deployment name, which may differ from the underlying model family name.</span>
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
                <ConfirmSubmitButton
                  className="rounded-xl border px-4 py-2 text-sm font-semibold"
                  confirmMessage="Save or rotate this provider credential? The previous secret will no longer be used for this Public AI provider connection."
                >
                  Save encrypted provider credential
                </ConfirmSubmitButton>
              </div>
            </form>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

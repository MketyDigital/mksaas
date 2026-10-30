import type { CloudflareDispatchTransport } from './cloudflare-dispatch';
import type { CustomerDeploymentArtifact } from './customer-deployment-artifact';

interface CloudflareEnvelope<T> {
  success?: boolean;
  result?: T;
}

function encodePath(value: string) {
  return encodeURIComponent(value);
}

export class CloudflareDispatchApiTransport implements CloudflareDispatchTransport {
  private readonly apiBase = 'https://api.cloudflare.com/client/v4';

  constructor(private readonly input: {
    accountId: string;
    apiToken: string;
    namespace: string;
    fetcher?: typeof fetch;
  }) {
    if (!/^[a-f0-9]{32}$/i.test(input.accountId.trim())) throw new Error('Cloudflare account id is invalid.');
    if (!input.apiToken.trim()) throw new Error('Cloudflare API token is required.');
    if (!/^[a-z0-9][a-z0-9_-]{1,62}$/i.test(input.namespace.trim())) throw new Error('Dispatch namespace is invalid.');
  }

  private get fetcher() {
    return this.input.fetcher ?? fetch;
  }

  private path(suffix = '') {
    return `/accounts/${encodePath(this.input.accountId)}/workers/dispatch/namespaces/${encodePath(this.input.namespace)}${suffix}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.input.apiToken}`);
    headers.set('Accept', 'application/json');
    const response = await this.fetcher(`${this.apiBase}${path}`, { ...init, headers });
    const payload = await response.json().catch(() => null) as CloudflareEnvelope<T> | null;
    if (!response.ok || payload?.success !== true || payload.result === undefined) {
      throw new Error('Cloudflare Workers for Platforms request failed.');
    }
    return payload.result;
  }

  async verifyNamespace() {
    const result = await this.request<{ namespace_name?: string }>(this.path());
    if (result.namespace_name !== this.input.namespace) {
      throw new Error('Configured Workers for Platforms namespace is unavailable.');
    }
  }

  async uploadWorker(input: { scriptName: string; artifact: CustomerDeploymentArtifact }) {
    if (!/^mkety-app-[a-z0-9-]{10,54}$/.test(input.scriptName)) throw new Error('Customer Worker name is invalid.');
    const form = new FormData();
    form.set('metadata', new Blob([JSON.stringify({
      main_module: input.artifact.mainModule,
      compatibility_date: input.artifact.compatibilityDate,
      bindings: [],
    })], { type: 'application/json' }), 'metadata.json');
    for (const artifactModule of input.artifact.modules) {
      form.set(artifactModule.name, new Blob([artifactModule.source], { type: artifactModule.contentType }), artifactModule.name);
    }
    await this.request<{ id?: string }>(this.path(`/scripts/${encodePath(input.scriptName)}`), {
      method: 'PUT',
      body: form,
    });
  }

  async deleteWorker(scriptName: string) {
    if (!/^mkety-app-[a-z0-9-]{10,54}$/.test(scriptName)) return;
    await this.request<unknown>(this.path(`/scripts/${encodePath(scriptName)}`), { method: 'DELETE' });
  }
}

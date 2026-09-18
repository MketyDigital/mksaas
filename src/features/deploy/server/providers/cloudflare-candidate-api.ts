import type {
  CloudflareCandidateArtifact,
  CloudflareCandidateTransport,
} from './cloudflare-candidate';

type Fetcher = typeof fetch;

interface CloudflareEnvelope<T> {
  success?: boolean;
  result?: T;
}

function encodePath(value: string) {
  return encodeURIComponent(value);
}

export class CloudflareCandidateApiTransport implements CloudflareCandidateTransport {
  private readonly apiBase = 'https://api.cloudflare.com/client/v4';

  constructor(
    private readonly input: {
      accountId: string;
      apiToken: string;
      fetcher?: Fetcher;
    },
  ) {
    if (!input.accountId.trim()) throw new Error('Cloudflare account id is required.');
    if (!input.apiToken.trim()) throw new Error('Cloudflare API token is required.');
  }

  private get fetcher(): Fetcher {
    return this.input.fetcher ?? fetch;
  }

  private headers(extra?: HeadersInit): Headers {
    const headers = new Headers(extra);
    headers.set('Authorization', `Bearer ${this.input.apiToken}`);
    headers.set('Accept', 'application/json');
    return headers;
  }

  private async requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetcher(`${this.apiBase}${path}`, {
      ...init,
      headers: this.headers(init.headers),
    });

    let payload: CloudflareEnvelope<T> | null = null;
    try {
      payload = (await response.json()) as CloudflareEnvelope<T>;
    } catch {
      payload = null;
    }

    if (!response.ok || payload?.success !== true || payload.result === undefined) {
      throw new Error('Cloudflare candidate API request failed.');
    }

    return payload.result;
  }

  async uploadWorker(input: {
    scriptName: string;
    artifact: CloudflareCandidateArtifact;
  }): Promise<void> {
    const form = new FormData();
    form.set(
      'metadata',
      new Blob(
        [
          JSON.stringify({
            main_module: input.artifact.mainModule,
            compatibility_date: input.artifact.compatibilityDate,
            bindings: [],
            annotations: {
              'workers/message': 'Mkety isolated Deploy candidate',
            },
          }),
        ],
        { type: 'application/json' },
      ),
      'metadata.json',
    );

    for (const candidateModule of input.artifact.modules) {
      form.set(
        candidateModule.name,
        new Blob([candidateModule.source], {
          type: candidateModule.contentType ?? 'application/javascript+module',
        }),
        candidateModule.name,
      );
    }

    await this.requestJson<{ id?: string }>(
      `/accounts/${encodePath(this.input.accountId)}/workers/scripts/${encodePath(input.scriptName)}`,
      {
        method: 'PUT',
        body: form,
      },
    );
  }

  async enableWorkersDev(scriptName: string): Promise<void> {
    const result = await this.requestJson<{ enabled?: boolean; previews_enabled?: boolean }>(
      `/accounts/${encodePath(this.input.accountId)}/workers/scripts/${encodePath(scriptName)}/subdomain`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, previews_enabled: false }),
      },
    );

    if (result.enabled !== true || result.previews_enabled === true) {
      throw new Error('Cloudflare candidate workers.dev isolation was not applied.');
    }
  }

  async getWorkersDevUrl(scriptName: string): Promise<string> {
    const result = await this.requestJson<{ subdomain?: string }>(
      `/accounts/${encodePath(this.input.accountId)}/workers/subdomain`,
    );

    const subdomain = result.subdomain?.trim();
    if (!subdomain || !/^[a-z0-9-]+$/i.test(subdomain)) {
      throw new Error('Cloudflare account workers.dev subdomain is unavailable.');
    }

    return `https://${scriptName}.${subdomain}.workers.dev`;
  }

  async deleteWorker(scriptName: string): Promise<void> {
    await this.requestJson<unknown>(
      `/accounts/${encodePath(this.input.accountId)}/workers/scripts/${encodePath(scriptName)}`,
      { method: 'DELETE' },
    );
  }
}

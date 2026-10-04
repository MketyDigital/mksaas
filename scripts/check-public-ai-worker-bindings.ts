import { summarizePublicAiWorkerBindings } from '../src/features/public-assistant/server/public-ai-worker-bindings-diagnostic';

function isSuccessfulCloudflareResponse(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { success?: unknown }).success === true
  );
}

async function getCloudflareJson(url: string, token: string): Promise<unknown> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Cloudflare metadata request failed');

  const payload: unknown = await response.json();
  if (!isSuccessfulCloudflareResponse(payload)) {
    throw new Error('Cloudflare metadata response was unsuccessful');
  }
  return payload;
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) throw new Error('Cloudflare credentials are unavailable');

  const scriptUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/scripts/mkety-platform`;
  const [settingsPayload, secretsPayload] = await Promise.all([
    getCloudflareJson(`${scriptUrl}/settings`, token),
    getCloudflareJson(`${scriptUrl}/secrets`, token),
  ]);
  const summary = summarizePublicAiWorkerBindings(settingsPayload, secretsPayload);

  console.log(`PRODUCTION_WORKER_BINDING_DIAGNOSTIC ${JSON.stringify(summary)}`);
}

main().catch(() => {
  console.error('Production Worker binding metadata inspection failed; response details were suppressed.');
  process.exitCode = 1;
});

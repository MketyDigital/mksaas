import { appendFile } from 'node:fs/promises';

import {
  createCloudflareCandidateAdapter,
  deriveCloudflareCandidateWorkerName,
} from '../src/features/deploy/server/providers/cloudflare-candidate';
import { CloudflareCandidateApiTransport } from '../src/features/deploy/server/providers/cloudflare-candidate-api';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

const accountId = required('CLOUDFLARE_ACCOUNT_ID');
const apiToken = required('CLOUDFLARE_API_TOKEN');
const runId = process.env.GITHUB_RUN_ID?.trim() || 'manual';
const sha = (process.env.GITHUB_SHA?.trim() || 'local').slice(0, 12);
const deploymentId = `${sha}-${runId}`;
const scriptName = deriveCloudflareCandidateWorkerName(deploymentId);
const marker = `mkety-deploy-provider-${sha}-${runId}`;
const compatibilityDate =
  process.env.CLOUDFLARE_COMPATIBILITY_DATE?.trim() ||
  new Date().toISOString().slice(0, 10);

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `candidate_name=${scriptName}\n`);
}

const transport = new CloudflareCandidateApiTransport({
  accountId,
  apiToken,
});

const adapter = createCloudflareCandidateAdapter({
  transport,
  artifactSource: {
    async load() {
      const payload = JSON.stringify({ ok: true, marker });
      return {
        mainModule: 'index.js',
        compatibilityDate,
        modules: [
          {
            name: 'index.js',
            source: `export default { async fetch() { return new Response(${JSON.stringify(
              payload,
            )}, { headers: { "content-type": "application/json" } }); } };`,
          },
        ],
      };
    },
  },
});

let deployed = false;
try {
  const result = await adapter.deploy({
    deploymentId,
    tenantId: 'external-verification',
    projectId: 'external-verification',
    application: {
      id: 'external-verification',
      name: 'Mkety Deploy Provider Verification',
      slug: 'provider-verification',
      kind: 'service',
    },
    environment: {
      id: 'external-verification',
      name: 'External Verification',
      slug: 'external-verification',
      kind: 'preview',
      protected: false,
    },
    releaseRef: sha,
    sourceRef: process.env.GITHUB_REF_NAME ?? 'manual',
    requestedByUserId: 'github-actions',
  });
  deployed = true;

  if (result.providerDeploymentRef !== scriptName) {
    throw new Error('Cloudflare candidate adapter returned an unexpected provider reference.');
  }

  const url = await transport.getWorkersDevUrl(scriptName);
  let verified = false;

  for (let attempt = 1; attempt <= 15; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        const body = (await response.json()) as { ok?: boolean; marker?: string };
        if (body.ok === true && body.marker === marker) {
          verified = true;
          console.log(
            `Verified isolated Cloudflare Deploy candidate at workers.dev (attempt ${attempt}).`,
          );
          break;
        }
      }
    } catch {
      // Cloudflare edge propagation may take a few seconds after upload.
    }

    if (attempt < 15) await sleep(2_000);
  }

  if (!verified) throw new Error('Isolated Cloudflare Deploy candidate did not pass external smoke.');
} finally {
  if (deployed) {
    try {
      await transport.deleteWorker(scriptName);
      console.log('Deleted isolated Cloudflare Deploy candidate after verification.');
    } catch {
      console.error('Candidate cleanup must be retried by the workflow cleanup step.');
    }
  }
}

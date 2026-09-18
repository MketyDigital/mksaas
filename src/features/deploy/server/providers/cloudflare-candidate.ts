import type {
  DeploymentExecutionContext,
  DeploymentProviderAdapter,
  DeploymentProviderResult,
} from '@/features/deploy/server/execution/types';

export const CLOUDFLARE_CANDIDATE_PREFIX = 'mkety-deploy-candidate-';
const MAX_WORKER_NAME_LENGTH = 63;
const MAX_MODULE_COUNT = 20;
const MAX_TOTAL_SOURCE_BYTES = 1_048_576;

export interface CloudflareCandidateModule {
  name: string;
  source: string;
  contentType?: 'application/javascript+module' | 'text/javascript+module';
}

export interface CloudflareCandidateArtifact {
  mainModule: string;
  modules: CloudflareCandidateModule[];
  compatibilityDate: string;
}

export interface CloudflareCandidateArtifactSource {
  load(
    context: DeploymentExecutionContext & { deploymentId: string },
  ): Promise<CloudflareCandidateArtifact>;
}

export interface CloudflareCandidateTransport {
  uploadWorker(input: {
    scriptName: string;
    artifact: CloudflareCandidateArtifact;
  }): Promise<void>;
  enableWorkersDev(scriptName: string): Promise<void>;
  getWorkersDevUrl(scriptName: string): Promise<string>;
  deleteWorker(scriptName: string): Promise<void>;
}

function assertCandidateContext(
  context: DeploymentExecutionContext & { deploymentId: string },
) {
  if (context.environment.protected || context.environment.kind === 'production') {
    throw new Error('Cloudflare candidate adapter cannot deploy protected or production environments.');
  }
}

export function deriveCloudflareCandidateWorkerName(deploymentId: string): string {
  const suffix = deploymentId
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!suffix) throw new Error('Deployment id cannot produce a valid Cloudflare candidate Worker name.');

  const name = `${CLOUDFLARE_CANDIDATE_PREFIX}${suffix}`.slice(0, MAX_WORKER_NAME_LENGTH).replace(/-+$/g, '');
  if (
    !name.startsWith(CLOUDFLARE_CANDIDATE_PREFIX) ||
    name.length > MAX_WORKER_NAME_LENGTH ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name)
  ) {
    throw new Error('Cloudflare candidate Worker name is invalid.');
  }

  return name;
}

export function validateCloudflareCandidateArtifact(artifact: CloudflareCandidateArtifact) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(artifact.compatibilityDate)) {
    throw new Error('Cloudflare candidate compatibility date must use YYYY-MM-DD.');
  }
  if (artifact.modules.length < 1 || artifact.modules.length > MAX_MODULE_COUNT) {
    throw new Error('Cloudflare candidate artifact has an invalid module count.');
  }

  const names = new Set<string>();
  let totalBytes = 0;
  for (const module of artifact.modules) {
    if (
      !module.name ||
      module.name.startsWith('/') ||
      module.name.includes('..') ||
      !/^[A-Za-z0-9._/-]+$/.test(module.name)
    ) {
      throw new Error('Cloudflare candidate artifact contains an invalid module name.');
    }
    if (names.has(module.name)) throw new Error('Cloudflare candidate artifact contains duplicate module names.');
    names.add(module.name);
    totalBytes += new TextEncoder().encode(module.source).byteLength;
  }

  if (!names.has(artifact.mainModule)) {
    throw new Error('Cloudflare candidate main module is missing from the artifact.');
  }
  if (totalBytes > MAX_TOTAL_SOURCE_BYTES) {
    throw new Error('Cloudflare candidate artifact exceeds the first-slice source-size limit.');
  }
}

export function createCloudflareCandidateAdapter(input: {
  artifactSource: CloudflareCandidateArtifactSource;
  transport: CloudflareCandidateTransport;
}): DeploymentProviderAdapter {
  return {
    id: 'cloudflare',
    async deploy(context): Promise<DeploymentProviderResult> {
      assertCandidateContext(context);
      const scriptName = deriveCloudflareCandidateWorkerName(context.deploymentId);
      const artifact = await input.artifactSource.load(context);
      validateCloudflareCandidateArtifact(artifact);

      let uploaded = false;
      try {
        await input.transport.uploadWorker({ scriptName, artifact });
        uploaded = true;
        await input.transport.enableWorkersDev(scriptName);
        await input.transport.getWorkersDevUrl(scriptName);
        return { providerDeploymentRef: scriptName };
      } catch {
        if (uploaded) {
          try {
            await input.transport.deleteWorker(scriptName);
          } catch {
            // Cleanup is best-effort; the execution kernel returns a sanitized failure.
          }
        }
        throw new Error('Cloudflare candidate deployment failed.');
      }
    },
  };
}

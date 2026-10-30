import type { DeploymentExecutionContext, DeploymentProviderAdapter } from '../execution/types';
import { loadCustomerDeploymentArtifact } from './customer-deployment-artifacts-store';
import type { CustomerDeploymentArtifact } from './customer-deployment-artifact';

export interface CustomerDeploymentArtifactSource {
  load(context: DeploymentExecutionContext & { deploymentId: string }): Promise<CustomerDeploymentArtifact>;
}

export interface CloudflareDispatchTransport {
  verifyNamespace(): Promise<void>;
  uploadWorker(input: { scriptName: string; artifact: CustomerDeploymentArtifact }): Promise<void>;
  deleteWorker(scriptName: string): Promise<void>;
}

export function deriveMketyAppScriptName(deploymentId: string) {
  const suffix = deploymentId.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (suffix.length < 10) throw new Error('Deployment identifier is invalid.');
  const name = `mkety-app-${suffix}`.slice(0, 63).replace(/-+$/g, '');
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name)) throw new Error('Customer Worker name is invalid.');
  return name;
}

export function createCloudflareDispatchAdapter(input: {
  artifactSource: CustomerDeploymentArtifactSource;
  transport: CloudflareDispatchTransport;
}): DeploymentProviderAdapter {
  return {
    id: 'cloudflare',
    async deploy(context) {
      if (context.environment.protected || context.environment.kind === 'production') {
        throw new Error('Customer app preview deployments cannot target protected environments.');
      }
      if (!context.artifactKey || !context.artifactSha256 || !context.deploymentRequestId) {
        throw new Error('Customer app deployment requires an approved immutable artifact.');
      }
      const scriptName = deriveMketyAppScriptName(context.deploymentId);
      const artifact = await input.artifactSource.load(context);
      let uploaded = false;
      try {
        await input.transport.verifyNamespace();
        await input.transport.uploadWorker({ scriptName, artifact });
        uploaded = true;
        return { providerDeploymentRef: scriptName };
      } catch {
        if (uploaded) await input.transport.deleteWorker(scriptName).catch(() => undefined);
        throw new Error('Customer preview deployment could not be completed.');
      }
    },
  };
}

export const storedCustomerDeploymentArtifactSource: CustomerDeploymentArtifactSource = {
  async load(context) {
    if (!context.artifactKey || !context.artifactSha256 || !context.deploymentRequestId) {
      throw new Error('Customer deployment artifact is not attached to this request.');
    }
    return loadCustomerDeploymentArtifact({
      tenantId: context.tenantId,
      projectId: context.projectId,
      requestId: context.deploymentRequestId,
      artifactKey: context.artifactKey,
      artifactSha256: context.artifactSha256,
    });
  },
};

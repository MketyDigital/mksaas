import { createCloudflareDispatchAdapter, storedCustomerDeploymentArtifactSource } from './cloudflare-dispatch';
import { CloudflareDispatchApiTransport } from './cloudflare-dispatch-api';

export interface CustomerDeploymentRuntimeEnvironment {
  MKETY_DEPLOY_CLOUDFLARE_ACCOUNT_ID?: string;
  MKETY_DEPLOY_CLOUDFLARE_API_TOKEN?: string;
  MKETY_DEPLOY_CLOUDFLARE_DISPATCH_NAMESPACE?: string;
}

export function readCustomerDeploymentRuntimeConfig(environment: CustomerDeploymentRuntimeEnvironment) {
  const accountId = environment.MKETY_DEPLOY_CLOUDFLARE_ACCOUNT_ID?.trim() ?? '';
  const apiToken = environment.MKETY_DEPLOY_CLOUDFLARE_API_TOKEN?.trim() ?? '';
  const namespace = environment.MKETY_DEPLOY_CLOUDFLARE_DISPATCH_NAMESPACE?.trim() ?? '';
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !apiToken || !/^[a-z0-9][a-z0-9_-]{1,62}$/i.test(namespace)) {
    throw new Error('Mkety customer app dispatch is not configured.');
  }
  return { accountId, apiToken, namespace };
}

export function createCustomerDeploymentProvider(environment: CustomerDeploymentRuntimeEnvironment) {
  const config = readCustomerDeploymentRuntimeConfig(environment);
  return createCloudflareDispatchAdapter({
    artifactSource: storedCustomerDeploymentArtifactSource,
    transport: new CloudflareDispatchApiTransport(config),
  });
}

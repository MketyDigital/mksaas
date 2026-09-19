import { CloudflareCandidateApiTransport } from './cloudflare-candidate-api';
import { createCloudflareCandidateAdapter } from './cloudflare-candidate';
import { customerCandidateProofArtifactSource } from './customer-candidate-artifact';

export interface CustomerCandidateRuntimeEnvironment {
  MKETY_DEPLOY_CLOUDFLARE_ACCOUNT_ID?: string;
  MKETY_DEPLOY_CLOUDFLARE_API_TOKEN?: string;
}

export function readCustomerCandidateRuntimeConfig(
  environment: CustomerCandidateRuntimeEnvironment,
) {
  const accountId = environment.MKETY_DEPLOY_CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = environment.MKETY_DEPLOY_CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    throw new Error('Mkety Deploy candidate provider is not configured.');
  }

  return { accountId, apiToken };
}

export function createCustomerCandidateProvider(
  environment: CustomerCandidateRuntimeEnvironment,
) {
  const config = readCustomerCandidateRuntimeConfig(environment);
  return createCloudflareCandidateAdapter({
    artifactSource: customerCandidateProofArtifactSource,
    transport: new CloudflareCandidateApiTransport(config),
  });
}

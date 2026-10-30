import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

import { getTenantS3Client } from '@/shared/services/s3-service';
import { parseCustomerDeploymentArtifact } from './customer-deployment-artifact';
import type { CustomerDeploymentArtifact } from './customer-deployment-artifact';

export function customerDeploymentArtifactKey(tenantId: string, projectId: string, requestId: string) {
  if (![tenantId, projectId, requestId].every((value) => /^[0-9a-f-]{16,64}$/i.test(value))) {
    throw new Error('Customer deployment artifact identity is invalid.');
  }
  return `mkety-deploy-artifacts/${tenantId}/${projectId}/${requestId}/artifact.json`;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function storeCustomerDeploymentArtifact(input: {
  tenantId: string;
  projectId: string;
  requestId: string;
  artifact: CustomerDeploymentArtifact;
}): Promise<{ key: string; sha256: string }> {
  const key = customerDeploymentArtifactKey(input.tenantId, input.projectId, input.requestId);
  const storage = await getTenantS3Client(input.tenantId);
  const body = JSON.stringify(input.artifact);
  const sha256 = await sha256Hex(body);
  try {
    await storage.client.send(new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
      Metadata: { 'mkety-project-id': input.projectId, 'mkety-request-id': input.requestId, 'sha256': sha256 },
    }));
  } catch {
    throw new Error('Customer application artifact storage is unavailable.');
  }
  return { key, sha256 };
}

export async function loadCustomerDeploymentArtifact(input: {
  tenantId: string;
  projectId: string;
  requestId: string;
  artifactKey: string;
  artifactSha256: string;
}): Promise<CustomerDeploymentArtifact> {
  const expectedKey = customerDeploymentArtifactKey(input.tenantId, input.projectId, input.requestId);
  if (input.artifactKey !== expectedKey || !/^[a-f0-9]{64}$/.test(input.artifactSha256)) {
    throw new Error('Customer deployment artifact scope is invalid.');
  }
  const storage = await getTenantS3Client(input.tenantId);
  const response = await storage.client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: expectedKey }));
  const text = await response.Body?.transformToString();
  if (!text || new TextEncoder().encode(text).byteLength > 1_100_000) {
    throw new Error('Customer deployment artifact is missing or exceeds the storage limit.');
  }
  if (await sha256Hex(text) !== input.artifactSha256) throw new Error('Customer deployment artifact integrity check failed.');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('Customer deployment artifact is malformed.');
  }
  return parseCustomerDeploymentArtifact(value);
}

export async function deleteCustomerDeploymentArtifact(input: {
  tenantId: string;
  projectId: string;
  requestId: string;
}): Promise<void> {
  const key = customerDeploymentArtifactKey(input.tenantId, input.projectId, input.requestId);
  const storage = await getTenantS3Client(input.tenantId);
  await storage.client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }));
}

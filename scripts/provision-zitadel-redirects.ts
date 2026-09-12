import { appendFileSync } from 'node:fs';

import { ensureZitadelOidcApplication } from '../src/shared/lib/auth/providers/zitadel-management';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function writeGithubOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT?.trim();
  if (!outputFile) return;
  appendFileSync(outputFile, `${name}=${value}\n`, 'utf8');
}

async function main() {
  const result = await ensureZitadelOidcApplication(
    {
      issuer: requireEnv('MKETY_AUTH_ISSUER'),
      accessToken: requireEnv('ZITADEL_MANAGEMENT_TOKEN'),
      projectId: requireEnv('ZITADEL_PROJECT_ID'),
      applicationId: optionalEnv('ZITADEL_APPLICATION_ID'),
    },
    {
      applicationName: optionalEnv('ZITADEL_APPLICATION_NAME') ?? 'Mkety Platform',
      redirectUri: requireEnv('MKETY_AUTH_REDIRECT_URI'),
      postLogoutRedirectUri: requireEnv('MKETY_AUTH_POST_LOGOUT_REDIRECT_URI'),
    },
  );

  if (result.clientSecret) {
    // Mask before the secret is made available to any later workflow step.
    process.stdout.write(`::add-mask::${result.clientSecret}\n`);
    writeGithubOutput('client_secret', result.clientSecret);
  }

  writeGithubOutput('application_id', result.applicationId);
  writeGithubOutput('project_id', result.projectId);
  if (result.clientId) writeGithubOutput('client_id', result.clientId);
  writeGithubOutput('created', String(result.created));
  writeGithubOutput('changed', String(result.changed));

  console.log(
    JSON.stringify({
      applicationId: result.applicationId,
      projectId: result.projectId,
      clientId: result.clientId,
      created: result.created,
      changed: result.changed,
      redirectUriCount: result.redirectUris.length,
      postLogoutRedirectUriCount: result.postLogoutRedirectUris.length,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Unknown ZITADEL provisioning failure');
  process.exit(1);
});

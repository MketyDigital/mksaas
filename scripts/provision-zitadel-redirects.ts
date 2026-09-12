import { ensureZitadelRedirectUris } from '../src/shared/lib/auth/providers/zitadel-management';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const result = await ensureZitadelRedirectUris(
    {
      issuer: requireEnv('MKETY_AUTH_ISSUER'),
      accessToken: requireEnv('ZITADEL_MANAGEMENT_TOKEN'),
      projectId: requireEnv('ZITADEL_PROJECT_ID'),
      applicationId: requireEnv('ZITADEL_APPLICATION_ID'),
    },
    {
      redirectUri: requireEnv('MKETY_AUTH_REDIRECT_URI'),
      postLogoutRedirectUri: requireEnv('MKETY_AUTH_POST_LOGOUT_REDIRECT_URI'),
    },
  );

  console.log(
    JSON.stringify({
      applicationId: result.applicationId,
      projectId: result.projectId,
      clientId: result.clientId,
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

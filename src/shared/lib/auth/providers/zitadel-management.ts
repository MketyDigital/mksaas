type ZitadelOidcConfiguration = {
  clientId?: string;
  redirectUris?: string[];
  postLogoutRedirectUris?: string[];
};

type ZitadelApplication = {
  applicationId: string;
  projectId: string;
  name?: string;
  oidcConfiguration?: ZitadelOidcConfiguration;
};

type ZitadelGetApplicationResponse = {
  application?: ZitadelApplication;
};

export type ZitadelManagementConfig = {
  issuer: string;
  accessToken: string;
  projectId: string;
  applicationId: string;
};

export type ZitadelRedirectProvisioning = {
  redirectUri: string;
  postLogoutRedirectUri: string;
};

export type ZitadelRedirectProvisioningResult = {
  applicationId: string;
  projectId: string;
  clientId: string | null;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  changed: boolean;
};

function normalizeIssuer(issuer: string): string {
  return issuer.replace(/\/+$/, '');
}

function mergeExactUri(existing: string[] | undefined, required: string): string[] {
  const merged = new Set(existing ?? []);
  merged.add(required);
  return [...merged];
}

function arraysEqual(left: string[] | undefined, right: string[]): boolean {
  const actual = left ?? [];
  return actual.length === right.length && actual.every((value, index) => value === right[index]);
}

async function callZitadel<T>(
  config: ZitadelManagementConfig,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    `${normalizeIssuer(config.issuer)}/zitadel.application.v2.ApplicationService/${method}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Connect-Protocol-Version': '1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`ZITADEL ${method} failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  return (await response.json()) as T;
}

export async function ensureZitadelRedirectUris(
  config: ZitadelManagementConfig,
  required: ZitadelRedirectProvisioning,
): Promise<ZitadelRedirectProvisioningResult> {
  const current = await callZitadel<ZitadelGetApplicationResponse>(config, 'GetApplication', {
    applicationId: config.applicationId,
  });
  const application = current.application;

  if (!application) {
    throw new Error('ZITADEL GetApplication response did not include an application');
  }
  if (application.projectId !== config.projectId) {
    throw new Error(
      `ZITADEL application project mismatch: expected ${config.projectId}, received ${application.projectId}`,
    );
  }
  if (!application.oidcConfiguration) {
    throw new Error('Configured ZITADEL application is not an OIDC application');
  }

  const redirectUris = mergeExactUri(application.oidcConfiguration.redirectUris, required.redirectUri);
  const postLogoutRedirectUris = mergeExactUri(
    application.oidcConfiguration.postLogoutRedirectUris,
    required.postLogoutRedirectUri,
  );
  const changed =
    !arraysEqual(application.oidcConfiguration.redirectUris, redirectUris) ||
    !arraysEqual(application.oidcConfiguration.postLogoutRedirectUris, postLogoutRedirectUris);

  if (changed) {
    await callZitadel(config, 'UpdateApplication', {
      applicationId: config.applicationId,
      projectId: config.projectId,
      oidcConfiguration: {
        redirectUris,
        postLogoutRedirectUris,
      },
    });
  }

  return {
    applicationId: application.applicationId,
    projectId: application.projectId,
    clientId: application.oidcConfiguration.clientId ?? null,
    redirectUris,
    postLogoutRedirectUris,
    changed,
  };
}

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

type ZitadelListApplicationsResponse = {
  applications?: ZitadelApplication[];
};

type ZitadelCreateApplicationResponse = {
  applicationId?: string;
  oidcConfiguration?: {
    clientId?: string;
    clientSecret?: string;
  };
};

export type ZitadelManagementConfig = {
  issuer: string;
  accessToken: string;
  projectId: string;
  applicationId?: string;
};

export type ZitadelRedirectProvisioning = {
  redirectUri: string;
  postLogoutRedirectUri: string;
};

export type ZitadelOidcApplicationProvisioning = ZitadelRedirectProvisioning & {
  applicationName: string;
};

export type ZitadelRedirectProvisioningResult = {
  applicationId: string;
  projectId: string;
  clientId: string | null;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  changed: boolean;
};

export type ZitadelOidcApplicationProvisioningResult = ZitadelRedirectProvisioningResult & {
  created: boolean;
  clientSecret: string | null;
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

async function getApplication(
  config: ZitadelManagementConfig,
  applicationId: string,
): Promise<ZitadelApplication> {
  const current = await callZitadel<ZitadelGetApplicationResponse>(config, 'GetApplication', {
    applicationId,
  });
  const application = current.application;
  if (!application) {
    throw new Error('ZITADEL GetApplication response did not include an application');
  }
  return application;
}

function assertApplicationProject(application: ZitadelApplication, projectId: string): void {
  if (application.projectId !== projectId) {
    throw new Error(
      `ZITADEL application project mismatch: expected ${projectId}, received ${application.projectId}`,
    );
  }
}

function assertOidcApplication(application: ZitadelApplication): void {
  if (!application.oidcConfiguration) {
    throw new Error('Configured ZITADEL application is not an OIDC application');
  }
}

export async function ensureZitadelRedirectUris(
  config: ZitadelManagementConfig,
  required: ZitadelRedirectProvisioning,
): Promise<ZitadelRedirectProvisioningResult> {
  const applicationId = config.applicationId?.trim();
  if (!applicationId) throw new Error('ZITADEL application id is required');

  const application = await getApplication(config, applicationId);
  assertApplicationProject(application, config.projectId);
  assertOidcApplication(application);

  const redirectUris = mergeExactUri(application.oidcConfiguration?.redirectUris, required.redirectUri);
  const postLogoutRedirectUris = mergeExactUri(
    application.oidcConfiguration?.postLogoutRedirectUris,
    required.postLogoutRedirectUri,
  );
  const changed =
    !arraysEqual(application.oidcConfiguration?.redirectUris, redirectUris) ||
    !arraysEqual(application.oidcConfiguration?.postLogoutRedirectUris, postLogoutRedirectUris);

  if (changed) {
    await callZitadel(config, 'UpdateApplication', {
      applicationId,
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
    clientId: application.oidcConfiguration?.clientId ?? null,
    redirectUris,
    postLogoutRedirectUris,
    changed,
  };
}

async function findExistingApplication(
  config: ZitadelManagementConfig,
  applicationName: string,
): Promise<ZitadelApplication | null> {
  if (config.applicationId?.trim()) {
    const application = await getApplication(config, config.applicationId.trim());
    assertApplicationProject(application, config.projectId);
    assertOidcApplication(application);
    return application;
  }

  const listed = await callZitadel<ZitadelListApplicationsResponse>(config, 'ListApplications', {});
  const matches = (listed.applications ?? []).filter(
    (application) => application.projectId === config.projectId && application.name === applicationName,
  );

  if (matches.length > 1) {
    throw new Error(`Multiple ZITADEL applications named ${applicationName} exist in project ${config.projectId}`);
  }

  const application = matches[0];
  if (!application) return null;
  assertOidcApplication(application);
  return application;
}

export async function ensureZitadelOidcApplication(
  config: ZitadelManagementConfig,
  required: ZitadelOidcApplicationProvisioning,
): Promise<ZitadelOidcApplicationProvisioningResult> {
  const existing = await findExistingApplication(config, required.applicationName);

  if (existing) {
    const reconciled = await ensureZitadelRedirectUris(
      { ...config, applicationId: existing.applicationId },
      required,
    );
    return {
      ...reconciled,
      created: false,
      clientSecret: null,
    };
  }

  const created = await callZitadel<ZitadelCreateApplicationResponse>(config, 'CreateApplication', {
    projectId: config.projectId,
    name: required.applicationName,
    oidcConfiguration: {
      redirectUris: [required.redirectUri],
      responseTypes: ['OIDC_RESPONSE_TYPE_CODE'],
      grantTypes: ['OIDC_GRANT_TYPE_AUTHORIZATION_CODE'],
      applicationType: 'OIDC_APP_TYPE_WEB',
      authMethodType: 'OIDC_AUTH_METHOD_TYPE_BASIC',
      postLogoutRedirectUris: [required.postLogoutRedirectUri],
      version: 'OIDC_VERSION_1_0',
      developmentMode: false,
      accessTokenType: 'OIDC_TOKEN_TYPE_BEARER',
    },
  });

  const applicationId = created.applicationId?.trim();
  const clientId = created.oidcConfiguration?.clientId?.trim();
  const clientSecret = created.oidcConfiguration?.clientSecret?.trim();

  if (!applicationId) throw new Error('ZITADEL CreateApplication response did not include an application id');
  if (!clientId) throw new Error('ZITADEL CreateApplication response did not include an OIDC client id');
  if (!clientSecret) {
    throw new Error('ZITADEL CreateApplication response did not include the confidential client secret');
  }

  return {
    applicationId,
    projectId: config.projectId,
    clientId,
    clientSecret,
    redirectUris: [required.redirectUri],
    postLogoutRedirectUris: [required.postLogoutRedirectUri],
    created: true,
    changed: true,
  };
}

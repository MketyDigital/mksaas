import {
  ensureZitadelOidcApplication,
  ensureZitadelRedirectUris,
} from '../zitadel-management';

const config = {
  issuer: 'https://example.zitadel.cloud/',
  accessToken: 'management-token',
  projectId: 'project-1',
  applicationId: 'app-1',
};

const preview = {
  redirectUri: 'https://mkety-platform-preview.example.workers.dev/api/auth/callback',
  postLogoutRedirectUri: 'https://mkety-platform-preview.example.workers.dev/login',
};

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('ZITADEL redirect provisioning', () => {
  it('preserves existing URIs and adds the exact preview callback and logout URIs', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          application: {
            applicationId: 'app-1',
            projectId: 'project-1',
            oidcConfiguration: {
              clientId: 'client-1',
              redirectUris: ['https://app.mkety.com/api/auth/callback'],
              postLogoutRedirectUris: ['https://app.mkety.com/login'],
            },
          },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ changeDate: '2026-09-12T00:00:00Z' }),
      } as unknown as Response);

    const result = await ensureZitadelRedirectUris(config, preview);

    expect(result.changed).toBe(true);
    expect(result.clientId).toBe('client-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://example.zitadel.cloud/zitadel.application.v2.ApplicationService/GetApplication',
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer management-token',
      'Connect-Protocol-Version': '1',
    });

    const updateBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(updateBody).toEqual({
      applicationId: 'app-1',
      projectId: 'project-1',
      oidcConfiguration: {
        redirectUris: ['https://app.mkety.com/api/auth/callback', preview.redirectUri],
        postLogoutRedirectUris: ['https://app.mkety.com/login', preview.postLogoutRedirectUri],
      },
    });
  });

  it('is a no-op when both exact URIs are already registered', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        application: {
          applicationId: 'app-1',
          projectId: 'project-1',
          oidcConfiguration: {
            clientId: 'client-1',
            redirectUris: [preview.redirectUri],
            postLogoutRedirectUris: [preview.postLogoutRedirectUri],
          },
        },
      }),
    } as unknown as Response);

    const result = await ensureZitadelRedirectUris(config, preview);

    expect(result.changed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses to update an application from a different project', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        application: {
          applicationId: 'app-1',
          projectId: 'another-project',
          oidcConfiguration: {},
        },
      }),
    } as unknown as Response);

    await expect(ensureZitadelRedirectUris(config, preview)).rejects.toThrow(
      'ZITADEL application project mismatch',
    );
  });
});

describe('ZITADEL OIDC application bootstrap', () => {
  it('reuses an existing Mkety Platform OIDC application and preserves its existing redirects', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          applications: [
            {
              applicationId: 'app-existing',
              projectId: 'project-1',
              name: 'Mkety Platform',
              oidcConfiguration: { clientId: 'client-existing' },
            },
          ],
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          application: {
            applicationId: 'app-existing',
            projectId: 'project-1',
            name: 'Mkety Platform',
            oidcConfiguration: {
              clientId: 'client-existing',
              redirectUris: ['https://app.mkety.com/api/auth/callback'],
              postLogoutRedirectUris: ['https://app.mkety.com/login'],
            },
          },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ changeDate: '2026-09-12T00:00:00Z' }),
      } as unknown as Response);

    const result = await ensureZitadelOidcApplication(
      {
        issuer: 'https://example.zitadel.cloud/',
        accessToken: 'management-token',
        projectId: 'project-1',
      },
      { applicationName: 'Mkety Platform', ...preview },
    );

    expect(result.created).toBe(false);
    expect(result.clientSecret).toBeNull();
    expect(result.applicationId).toBe('app-existing');
    expect(result.clientId).toBe('client-existing');
    expect(result.redirectUris).toEqual([
      'https://app.mkety.com/api/auth/callback',
      preview.redirectUri,
    ]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://example.zitadel.cloud/zitadel.application.v2.ApplicationService/ListApplications',
    );
  });

  it('creates the first Mkety Platform application with the exact production-grade OIDC shape', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ applications: [] }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          applicationId: 'app-created',
          creationDate: '2026-09-12T00:00:00Z',
          oidcConfiguration: {
            clientId: 'client-created',
            clientSecret: 'secret-created',
          },
        }),
      } as unknown as Response);

    const result = await ensureZitadelOidcApplication(
      {
        issuer: 'https://example.zitadel.cloud',
        accessToken: 'management-token',
        projectId: 'project-1',
      },
      { applicationName: 'Mkety Platform', ...preview },
    );

    expect(result).toMatchObject({
      created: true,
      changed: true,
      applicationId: 'app-created',
      projectId: 'project-1',
      clientId: 'client-created',
      clientSecret: 'secret-created',
      redirectUris: [preview.redirectUri],
      postLogoutRedirectUris: [preview.postLogoutRedirectUri],
    });

    const createBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(createBody).toEqual({
      projectId: 'project-1',
      name: 'Mkety Platform',
      oidcConfiguration: {
        redirectUris: [preview.redirectUri],
        responseTypes: ['OIDC_RESPONSE_TYPE_CODE'],
        grantTypes: ['OIDC_GRANT_TYPE_AUTHORIZATION_CODE'],
        applicationType: 'OIDC_APP_TYPE_WEB',
        authMethodType: 'OIDC_AUTH_METHOD_TYPE_BASIC',
        postLogoutRedirectUris: [preview.postLogoutRedirectUri],
        version: 'OIDC_VERSION_1_0',
        developmentMode: false,
        accessTokenType: 'OIDC_TOKEN_TYPE_BEARER',
      },
    });
  });

  it('uses an explicitly configured application id without listing applications', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        application: {
          applicationId: 'app-explicit',
          projectId: 'project-1',
          name: 'Mkety Platform',
          oidcConfiguration: {
            clientId: 'client-explicit',
            redirectUris: [preview.redirectUri],
            postLogoutRedirectUris: [preview.postLogoutRedirectUri],
          },
        },
      }),
    } as unknown as Response);

    const result = await ensureZitadelOidcApplication(
      {
        issuer: 'https://example.zitadel.cloud',
        accessToken: 'management-token',
        projectId: 'project-1',
        applicationId: 'app-explicit',
      },
      { applicationName: 'Mkety Platform', ...preview },
    );

    expect(result.applicationId).toBe('app-explicit');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/GetApplication');
  });

  it('refuses an ambiguous duplicate Mkety Platform application name in one project', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        applications: [
          {
            applicationId: 'app-1',
            projectId: 'project-1',
            name: 'Mkety Platform',
            oidcConfiguration: { clientId: 'client-1' },
          },
          {
            applicationId: 'app-2',
            projectId: 'project-1',
            name: 'Mkety Platform',
            oidcConfiguration: { clientId: 'client-2' },
          },
        ],
      }),
    } as unknown as Response);

    await expect(
      ensureZitadelOidcApplication(
        {
          issuer: 'https://example.zitadel.cloud',
          accessToken: 'management-token',
          projectId: 'project-1',
        },
        { applicationName: 'Mkety Platform', ...preview },
      ),
    ).rejects.toThrow('Multiple ZITADEL applications named Mkety Platform');
  });
});

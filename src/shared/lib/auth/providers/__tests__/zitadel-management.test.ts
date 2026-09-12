import { ensureZitadelRedirectUris } from '../zitadel-management';

const config = {
  issuer: 'https://example.zitadel.cloud/',
  accessToken: 'management-token',
  projectId: 'project-1',
  applicationId: 'app-1',
};

describe('ZITADEL redirect provisioning', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

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

    const result = await ensureZitadelRedirectUris(config, {
      redirectUri: 'https://mkety-platform-preview.example.workers.dev/api/auth/callback',
      postLogoutRedirectUri: 'https://mkety-platform-preview.example.workers.dev/login',
    });

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
        redirectUris: [
          'https://app.mkety.com/api/auth/callback',
          'https://mkety-platform-preview.example.workers.dev/api/auth/callback',
        ],
        postLogoutRedirectUris: [
          'https://app.mkety.com/login',
          'https://mkety-platform-preview.example.workers.dev/login',
        ],
      },
    });
  });

  it('is a no-op when both exact URIs are already registered', async () => {
    const redirectUri = 'https://preview.example.workers.dev/api/auth/callback';
    const postLogoutRedirectUri = 'https://preview.example.workers.dev/login';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        application: {
          applicationId: 'app-1',
          projectId: 'project-1',
          oidcConfiguration: {
            clientId: 'client-1',
            redirectUris: [redirectUri],
            postLogoutRedirectUris: [postLogoutRedirectUri],
          },
        },
      }),
    } as unknown as Response);

    const result = await ensureZitadelRedirectUris(config, { redirectUri, postLogoutRedirectUri });

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

    await expect(
      ensureZitadelRedirectUris(config, {
        redirectUri: 'https://preview.example.workers.dev/api/auth/callback',
        postLogoutRedirectUri: 'https://preview.example.workers.dev/login',
      }),
    ).rejects.toThrow('ZITADEL application project mismatch');
  });
});

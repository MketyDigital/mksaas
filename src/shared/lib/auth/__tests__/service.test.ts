jest.mock('@/shared/lib/env', () => ({
  env: {
    MKETY_AUTH_PROVIDER: 'zitadel',
    MKETY_AUTH_REDIRECT_URI: 'https://preview.example.workers.dev/api/auth/callback',
    MKETY_AUTH_POST_LOGOUT_REDIRECT_URI: 'https://preview.example.workers.dev/login',
  },
}));

jest.mock('../providers', () => ({ getIdentityProvider: jest.fn() }));
jest.mock('../repository', () => ({
  consumeLoginTransaction: jest.fn(),
  createExternalIdentity: jest.fn(),
  createLoginTransaction: jest.fn(),
  createSession: jest.fn(),
  createUser: jest.fn(),
  findUserByEmail: jest.fn(),
  findUserByExternalIdentity: jest.fn(),
  getSessionByToken: jest.fn(),
  revokeSession: jest.fn(),
}));

import { getIdentityProvider } from '../providers';
import {
  consumeLoginTransaction,
  createExternalIdentity,
  createLoginTransaction,
  createSession,
  createUser,
  findUserByEmail,
  findUserByExternalIdentity,
} from '../repository';
import { beginLogin, completeLogin } from '../service';

const mockProvider = {
  createAuthorizationUrl: jest.fn(),
  exchangeCode: jest.fn(),
  getLogoutUrl: jest.fn(),
};

describe('Mkety Auth service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getIdentityProvider as jest.Mock).mockReturnValue(mockProvider);
  });

  it('creates a one-time login transaction before redirecting to the provider', async () => {
    mockProvider.createAuthorizationUrl.mockResolvedValue('https://example.zitadel.cloud/oauth/v2/authorize?...');

    const result = await beginLogin('/select-tenant');

    expect(createLoginTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'zitadel', returnTo: '/select-tenant' }),
    );
    expect(mockProvider.createAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.any(String),
        nonce: expect.any(String),
        codeChallenge: expect.any(String),
      }),
    );
    expect(result).toContain('https://example.zitadel.cloud/');
  });

  it('maps a verified external identity to a Mkety user and creates a session', async () => {
    (consumeLoginTransaction as jest.Mock).mockResolvedValue({
      state: 'state-1',
      provider: 'zitadel',
      verifier: 'verifier',
      nonce: 'nonce',
      returnTo: '/select-tenant',
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockProvider.exchangeCode.mockResolvedValue({
      provider: 'zitadel',
      subject: 'subject-1',
      email: 'user@example.com',
      emailVerified: true,
      name: 'Example User',
      image: null,
    });
    (findUserByExternalIdentity as jest.Mock).mockResolvedValue(null);
    (findUserByEmail as jest.Mock).mockResolvedValue(null);
    (createUser as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Example User',
      image: null,
    });
    (createExternalIdentity as jest.Mock).mockResolvedValue({ id: 'identity-1' });
    (createSession as jest.Mock).mockResolvedValue({
      token: 'session-token',
      expiresAt: new Date('2026-10-01T00:00:00Z'),
    });

    const result = await completeLogin('code-1', 'state-1');

    expect(createUser).toHaveBeenCalledWith({ email: 'user@example.com', name: 'Example User', image: null });
    expect(createExternalIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', provider: 'zitadel', subject: 'subject-1' }),
    );
    expect(createSession).toHaveBeenCalledWith('user-1', expect.any(Date));
    expect(result).toEqual({
      token: 'session-token',
      expiresAt: new Date('2026-10-01T00:00:00Z'),
      redirectTo: '/select-tenant',
    });
  });
});

import { db } from '@/shared/db';

jest.mock('@/shared/db', () => ({
  db: {
    query: {
      externalIdentities: { findFirst: jest.fn() },
      authSessions: { findFirst: jest.fn() },
      authLoginTransactions: { findFirst: jest.fn() },
    },
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

import {
  consumeLoginTransaction,
  createExternalIdentity,
  createLoginTransaction,
  createSession,
  getSessionByToken,
  revokeSession,
} from '../repository';

const mockDb = db as unknown as {
  query: {
    externalIdentities: { findFirst: jest.Mock };
    authSessions: { findFirst: jest.Mock };
    authLoginTransactions: { findFirst: jest.Mock };
  };
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

describe('Mkety Auth repository', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists an external identity through the provider-neutral mapping', async () => {
    const returning = jest.fn().mockResolvedValue([{ id: 'identity-1', provider: 'zitadel', subject: 'subject-1' }]);
    const onConflictDoNothing = jest.fn().mockReturnValue({ returning });
    mockDb.insert.mockReturnValue({ values: jest.fn().mockReturnValue({ onConflictDoNothing }) });

    const result = await createExternalIdentity({
      provider: 'zitadel',
      subject: 'subject-1',
      userId: 'user-1',
      email: 'user@example.com',
      name: 'Example User',
      image: null,
    });

    expect(result.id).toBe('identity-1');
    expect(onConflictDoNothing).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('creates and consumes a login transaction once', async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    mockDb.insert.mockReturnValue({ values });
    await createLoginTransaction({
      state: 'state-1',
      provider: 'zitadel',
      verifier: 'verifier',
      nonce: 'nonce',
      returnTo: '/select-tenant',
      expiresAt: new Date(Date.now() + 300_000),
    });

    const transaction = { state: 'state-1', provider: 'zitadel', verifier: 'verifier', nonce: 'nonce', returnTo: '/select-tenant' };
    const returning = jest.fn().mockResolvedValue([transaction]);
    const where = jest.fn().mockReturnValue({ returning });
    mockDb.delete.mockReturnValue({ where });

    await expect(consumeLoginTransaction('state-1')).resolves.toEqual(transaction);
    expect(mockDb.delete).toHaveBeenCalled();
    expect(returning).toHaveBeenCalled();
  });

  it('stores only a hash of a newly generated session token', async () => {
    const returning = jest.fn().mockResolvedValue([{ id: 'session-1', expiresAt: new Date('2026-10-01T00:00:00Z') }]);
    const values = jest.fn().mockReturnValue({ returning });
    mockDb.insert.mockReturnValue({ values });

    const result = await createSession('user-1', new Date('2026-10-01T00:00:00Z'));
    const inserted = values.mock.calls[0][0] as { tokenHash: string; userId: string };

    expect(result.token).toHaveLength(43);
    expect(inserted.userId).toBe('user-1');
    expect(inserted.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(inserted.tokenHash).not.toBe(result.token);
  });

  it('rejects expired or revoked sessions', async () => {
    mockDb.query.authSessions.findFirst.mockResolvedValue(null);

    await expect(getSessionByToken('expired-token')).resolves.toBeNull();
  });

  it('revokes a session by updating its server-side record', async () => {
    const where = jest.fn().mockResolvedValue(undefined);
    mockDb.update.mockReturnValue({ set: jest.fn().mockReturnValue({ where }) });

    await revokeSession('session-token');

    expect(mockDb.update).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });
});

/** @jest-environment node */

import { POST } from './route';

jest.mock('@/features/mail/server/runtime-config', () => ({
  getMailInternalSecret: () => 'internal-secret',
  getFirstPartyMailTenantId: () => 'reserved-tenant',
}));
jest.mock('@/shared/db/cloudflare', () => ({
  db: {
    query: {
      mailDomains: { findFirst: jest.fn() },
      mailMailboxes: { findFirst: jest.fn() },
      mailMailboxIngressAliases: { findFirst: jest.fn() },
    },
  },
}));
jest.mock('@/shared/db/request', () => ({ withRequestDatabase: (callback: () => Promise<unknown>) => callback() }));

const mockQuery = jest.requireMock('@/shared/db/cloudflare').db.query as {
  mailDomains: { findFirst: jest.Mock };
  mailMailboxes: { findFirst: jest.Mock };
  mailMailboxIngressAliases: { findFirst: jest.Mock };
};

describe('internal Mail recipient resolution', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves the Cloudflare forwarding address to the canonical root mailbox', async () => {
    mockQuery.mailDomains.findFirst
      .mockResolvedValueOnce({
        id: 'ingress-domain',
        tenantId: 'reserved-tenant',
        domain: 'mail.mkety.com',
        routingEnabled: true,
      })
      .mockResolvedValueOnce({ id: 'root-domain', tenantId: 'reserved-tenant', domain: 'mkety.com' });
    mockQuery.mailMailboxes.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'root-support',
        tenantId: 'reserved-tenant',
        domainId: 'root-domain',
        localPart: 'support',
        forwardingAddress: null,
        status: 'active',
      });
    mockQuery.mailMailboxIngressAliases.findFirst.mockResolvedValueOnce({
      id: 'alias-1',
      tenantId: 'reserved-tenant',
      mailboxId: 'root-support',
      domainId: 'ingress-domain',
      localPart: 'support',
      status: 'active',
    });

    const response = await POST(
      new Request('https://app.mkety.com/api/internal/mail/resolve-recipient', {
        method: 'POST',
        headers: { authorization: 'Bearer internal-secret', 'content-type': 'application/json' },
        body: JSON.stringify({ recipient: 'support@mail.mkety.com' }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      accepted: true,
      tenantId: 'reserved-tenant',
      mailboxId: 'root-support',
      mailboxAddress: 'support@mkety.com',
    });
  });

  it('does not run database resolution before the internal secret check', async () => {
    const response = await POST(
      new Request('https://app.mkety.com/api/internal/mail/resolve-recipient', {
        method: 'POST',
        headers: { authorization: 'Bearer wrong-secret', 'content-type': 'application/json' },
        body: JSON.stringify({ recipient: 'support@mail.mkety.com' }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mockQuery.mailDomains.findFirst).not.toHaveBeenCalled();
  });

  it('rejects unconfigured reserved subdomain recipients instead of using catch-all', async () => {
    mockQuery.mailDomains.findFirst.mockResolvedValueOnce({
      id: 'ingress-domain',
      tenantId: 'reserved-tenant',
      domain: 'mail.mkety.com',
      routingEnabled: true,
    });
    mockQuery.mailMailboxes.findFirst.mockResolvedValueOnce(null);
    mockQuery.mailMailboxIngressAliases.findFirst.mockResolvedValueOnce(null);

    const response = await POST(
      new Request('https://app.mkety.com/api/internal/mail/resolve-recipient', {
        method: 'POST',
        headers: { authorization: 'Bearer internal-secret', 'content-type': 'application/json' },
        body: JSON.stringify({ recipient: 'hello@mail.mkety.com' }),
      }),
    );

    expect(response.status).toBe(404);
    expect(mockQuery.mailMailboxes.findFirst).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown root addresses even if a first-party catch-all mailbox exists', async () => {
    mockQuery.mailDomains.findFirst.mockResolvedValueOnce({
      id: 'root-domain',
      tenantId: 'reserved-tenant',
      domain: 'mkety.com',
      routingEnabled: true,
    });
    mockQuery.mailMailboxes.findFirst.mockResolvedValueOnce(null);
    mockQuery.mailMailboxIngressAliases.findFirst.mockResolvedValueOnce(null);

    const response = await POST(
      new Request('https://app.mkety.com/api/internal/mail/resolve-recipient', {
        method: 'POST',
        headers: { authorization: 'Bearer internal-secret', 'content-type': 'application/json' },
        body: JSON.stringify({ recipient: 'unknown@mkety.com' }),
      }),
    );

    expect(response.status).toBe(404);
    expect(mockQuery.mailMailboxes.findFirst).toHaveBeenCalledTimes(1);
  });
});

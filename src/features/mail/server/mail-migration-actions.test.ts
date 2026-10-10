jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/navigation', () => ({ redirect: jest.fn((url: string) => { throw new Error(`redirect:${url}`); }) }));
jest.mock('drizzle-orm', () => ({
  and: jest.fn((...values) => values),
  eq: jest.fn((...values) => values),
  inArray: jest.fn((...values) => values),
  isNotNull: jest.fn((value) => value),
}));
jest.mock('@/shared/db/cloudflare', () => ({
  db: {
    query: {
      mailMailboxes: { findFirst: jest.fn() },
      mailDomains: { findFirst: jest.fn() },
      mailMigrationRuns: { findFirst: jest.fn() },
    },
    insert: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock('@/shared/db/schema', () => ({
  mailDomains: { id: 'domains.id', tenantId: 'domains.tenantId' },
  mailMailboxes: { id: 'mailboxes.id', tenantId: 'mailboxes.tenantId', status: 'mailboxes.status', domainId: 'mailboxes.domainId' },
  mailMigrationRuns: {
    id: 'runs.id',
    tenantId: 'runs.tenantId',
    status: 'runs.status',
    destinationMailboxId: 'runs.destinationMailboxId',
    sourceType: 'runs.sourceType',
    sourceMailboxAddress: 'runs.sourceMailboxAddress',
    sourceHost: 'runs.sourceHost',
    completedAt: 'runs.completedAt',
    encryptedCredential: 'runs.encryptedCredential',
  },
}));
jest.mock('./cloudflare', () => ({ pushMailMigrationQueue: jest.fn() }));
jest.mock('./migration-credentials', () => ({
  encryptImapCredential: jest.fn(async () => 'encrypted-source-credential'),
  normalizeImapEndpoint: jest.fn((host: string, port: number) => {
    if (port !== 993) throw new Error('imap_endpoint_invalid');
    return host.trim().toLowerCase();
  }),
}));
jest.mock('./workspace', () => ({
  getMailWorkspace: jest.fn(),
  requireMailWorkspaceAccess: jest.fn(),
}));

import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailMailboxes, mailMigrationRuns } from '@/shared/db/schema';

import { pushMailMigrationQueue } from './cloudflare';
import { startImapMailMigration } from './mail-migration-actions';
import { encryptImapCredential, normalizeImapEndpoint } from './migration-credentials';
import { getMailWorkspace, requireMailWorkspaceAccess } from './workspace';

const mockedDb = db as unknown as {
  query: {
    mailMailboxes: { findFirst: jest.Mock };
    mailDomains: { findFirst: jest.Mock };
    mailMigrationRuns: { findFirst: jest.Mock };
  };
  insert: jest.Mock;
};

function makeForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    mailboxId: 'mailbox-hello',
    sourceMailboxAddress: 'hello@mkety.com',
    mode: 'initial',
    host: 'imap.zoho.com',
    username: 'hello@mkety.com',
    password: 'source-app-password',
    ...overrides,
  })) form.set(key, value);
  return form;
}

describe('IMAP Mail migration actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireMailWorkspaceAccess as jest.Mock).mockResolvedValue({
      tenant: { id: 'tenant-1' },
      actor: { userId: 'operator-1' },
      membership: { role: 'manager' },
    });
    (getMailWorkspace as jest.Mock).mockResolvedValue({ id: 'workspace-1' });
    mockedDb.query.mailMailboxes.findFirst.mockResolvedValue({
      id: 'mailbox-hello',
      tenantId: 'tenant-1',
      domainId: 'domain-1',
      localPart: 'hello',
      status: 'active',
    });
    mockedDb.query.mailDomains.findFirst.mockResolvedValue({ id: 'domain-1', tenantId: 'tenant-1', domain: 'mkety.com' });
    mockedDb.query.mailMigrationRuns.findFirst.mockResolvedValue(null);
    mockedDb.insert.mockReturnValue({
      values: jest.fn(() => ({
        returning: jest.fn(async () => [{ id: '00000000-0000-4000-8000-000000000001' }]),
      })),
    });
  });

  it('scopes the destination mailbox to the current tenant before creating a run', async () => {
    mockedDb.query.mailMailboxes.findFirst.mockResolvedValue(null);
    await expect(startImapMailMigration('mkety-ops', makeForm())).rejects.toThrow('redirect:/app/mkety-ops/mail/migration?error=mailbox');
    expect(mockedDb.query.mailMailboxes.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.anything(),
    }));
    expect(mockedDb.insert).not.toHaveBeenCalled();
  });

  it('encrypts the source credential and sends only the run ID to the queue', async () => {
    await expect(startImapMailMigration('mkety-ops', makeForm())).rejects.toThrow(
      'redirect:/app/mkety-ops/mail/migration?started=00000000-0000-4000-8000-000000000001',
    );
    expect(normalizeImapEndpoint).toHaveBeenCalledWith('imap.zoho.com', 993);
    expect(encryptImapCredential).toHaveBeenCalledWith('hello@mkety.com', 'source-app-password');
    expect(mockedDb.insert).toHaveBeenCalledWith(mailMigrationRuns);
    expect(mockedDb.query.mailDomains.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.anything() }));
    const insertValues = mockedDb.insert.mock.results[0]?.value.values.mock.calls[0]?.[0];
    expect(insertValues).toEqual(expect.objectContaining({
      sourceMailboxAddress: 'hello@mkety.com',
      destinationMailboxId: 'mailbox-hello',
      sourceHost: 'imap.zoho.com',
      encryptedCredential: 'encrypted-source-credential',
    }));
    expect(insertValues).not.toHaveProperty('password');
    expect(pushMailMigrationQueue).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001');
    expect(pushMailMigrationQueue).not.toHaveBeenCalledWith(expect.objectContaining({ password: expect.any(String) }));
    expect(mailDomains).toBeDefined();
    expect(mailMailboxes).toBeDefined();
  });
});

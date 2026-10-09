/** @jest-environment node */

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/navigation', () => ({ redirect: jest.fn((url: string) => { throw new Error(`redirect:${url}`); }) }));
jest.mock('drizzle-orm', () => ({
  and: jest.fn((...values) => values),
  eq: jest.fn((...values) => values),
}));
jest.mock('@/shared/db/cloudflare', () => ({
  db: {
    query: {
      mailMailboxes: { findFirst: jest.fn() },
      mailDomains: { findFirst: jest.fn() },
    },
    insert: jest.fn(),
    update: jest.fn(),
  },
}));
jest.mock('@/shared/db/schema', () => ({
  mailDomains: { id: 'domains.id' },
  mailMailboxes: {
    id: 'mailboxes.id',
    tenantId: 'mailboxes.tenantId',
    status: 'mailboxes.status',
    domainId: 'mailboxes.domainId',
  },
  mailMigrationRuns: {
    id: 'runs.id',
    tenantId: 'runs.tenantId',
    status: 'runs.status',
  },
}));
jest.mock('./migration-import-store', () => ({ importMessageOnce: jest.fn() }));
jest.mock('./workspace', () => ({
  getMailWorkspace: jest.fn(),
  requireMailWorkspaceAccess: jest.fn(),
}));

import { revalidatePath } from 'next/cache';

import { db } from '@/shared/db/cloudflare';

import { importMailEmlFiles } from './migration-actions';
import { importMessageOnce } from './migration-import-store';
import { getMailWorkspace, requireMailWorkspaceAccess } from './workspace';

const mockedDb = db as unknown as {
  query: {
    mailMailboxes: { findFirst: jest.Mock };
    mailDomains: { findFirst: jest.Mock };
  };
  insert: jest.Mock;
  update: jest.Mock;
};

describe('legacy Mail archive import action', () => {
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
    mockedDb.query.mailDomains.findFirst.mockResolvedValue({ id: 'domain-1', domain: 'mkety.com' });
    mockedDb.insert.mockReturnValue({
      values: jest.fn(() => ({
        returning: jest.fn(async () => [{ id: 'run-1' }]),
      })),
    });
    mockedDb.update.mockReturnValue({
      set: jest.fn(() => ({ where: jest.fn(async () => undefined) })),
    });
    (importMessageOnce as jest.Mock).mockResolvedValue({ imported: true, messageId: 'message-1' });
  });

  it('keeps the existing EML upload path and records its import result', async () => {
    const form = new FormData();
    form.set('mailboxId', 'mailbox-hello');
    form.append('files', new File(['From: Sender <sender@example.com>\r\nSubject: hello\r\n\r\nBody'], 'hello.eml', { type: 'message/rfc822' }));
    expect(form.getAll('files')).toHaveLength(1);
    expect((form.getAll('files')[0] as File).name).toBe('hello.eml');
    expect(form.getAll('files')[0]).toBeInstanceOf(File);

    await expect(importMailEmlFiles('mkety-ops', form)).rejects.toThrow(
      'redirect:/app/mkety-ops/mail/migration?imported=1&run=run-1',
    );
    expect(importMessageOnce).toHaveBeenCalled();

    expect(mockedDb.insert).toHaveBeenCalled();
    expect(importMessageOnce).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      mailboxId: 'mailbox-hello',
      runId: 'run-1',
      parsed: expect.objectContaining({ folderPath: 'hello.eml', subject: 'hello' }),
    }));
    expect(mockedDb.update).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/app/mkety-ops/mail/inbox');
  });

  it('keeps the established upload-count and file-size limits', async () => {
    const form = new FormData();
    form.set('mailboxId', 'mailbox-hello');
    form.append('files', new File(['Subject: hello\r\n\r\nBody'], 'hello.txt'));

    await expect(importMailEmlFiles('mkety-ops', form)).rejects.toThrow(
      'redirect:/app/mkety-ops/mail/migration?error=type',
    );
    expect(mockedDb.insert).not.toHaveBeenCalled();
  });
});

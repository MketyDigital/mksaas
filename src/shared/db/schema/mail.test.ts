import { getTableConfig } from 'drizzle-orm/pg-core';

import { mailAppPasswords, mailMessages } from './mail';

describe('Mail app-password protocol-scope schema', () => {
  it('stores a non-null protocol scope defaulting existing credentials to all protocols', () => {
    const column = getTableConfig(mailAppPasswords).columns.find((item) => item.name === 'protocol_scope');

    expect(column).toBeDefined();
    expect(column?.notNull).toBe(true);
    expect(column?.default).toBe('all');
  });
});

describe('Platform transactional mail idempotency schema', () => {
  it('stores a nullable per-tenant idempotency key with a unique index', () => {
    const table = getTableConfig(mailMessages);
    const column = table.columns.find((item) => item.name === 'platform_idempotency_key');
    const index = table.indexes.find((item) => item.config.name === 'mail_messages_tenant_platform_idempotency_uidx');

    expect(column).toBeDefined();
    expect(column?.notNull).toBe(false);
    expect(index).toBeDefined();
  });
});

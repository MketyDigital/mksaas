import { getTableConfig } from 'drizzle-orm/pg-core';

import {
  mailDomainCutoverChecks,
  mailDomainCutovers,
  mailMigrationMessages,
  mailMigrationRuns,
} from './mail-migrations';

describe('Mail migration schema', () => {
  it('keeps IMAP runs tenant-scoped and credentials private to the active run', () => {
    const table = getTableConfig(mailMigrationRuns);
    const tenantId = table.columns.find((column) => column.name === 'tenant_id');
    const credential = table.columns.find((column) => column.name === 'encrypted_credential');
    const status = table.columns.find((column) => column.name === 'status');

    expect(tenantId?.notNull).toBe(true);
    expect(credential?.notNull).toBe(false);
    expect(status?.notNull).toBe(true);
    expect(table.indexes.some((index) => index.config.name === 'mail_migration_runs_tenant_created_idx')).toBe(true);
  });

  it('prevents source UID or fingerprint duplicates across initial and delta runs', () => {
    const table = getTableConfig(mailMigrationMessages);

    expect(table.columns.find((column) => column.name === 'source_key')?.notNull).toBe(true);
    expect(table.indexes.some((index) => index.config.name === 'mail_migration_messages_source_uid_uidx')).toBe(true);
    expect(table.indexes.some((index) => index.config.name === 'mail_migration_messages_source_fingerprint_uidx')).toBe(
      true,
    );
  });

  it('stores cutover evidence separately from the single first-party domain state', () => {
    const cutovers = getTableConfig(mailDomainCutovers);
    const checks = getTableConfig(mailDomainCutoverChecks);

    expect(cutovers.indexes.some((index) => index.config.name === 'mail_domain_cutovers_tenant_domain_uidx')).toBe(
      true,
    );
    expect(checks.columns.find((column) => column.name === 'evidence_ref')?.notNull).toBe(false);
    expect(checks.indexes.some((index) => index.config.name === 'mail_domain_cutover_checks_name_uidx')).toBe(true);
  });
});

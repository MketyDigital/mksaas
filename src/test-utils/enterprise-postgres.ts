import { PGlite } from '@electric-sql/pglite';
import { SQL } from 'drizzle-orm';
import { getTableConfig, PgDialect, type PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Database } from '@/shared/db';
import * as schema from '@/shared/db/schema';

// Exercise real PostgreSQL queries/transactions and real Drizzle mappings.
// Parent foreign keys are omitted so these focused fixtures need no unrelated
// identity/project data. Columns, defaults, primary keys and unique indexes use
// the production table definitions; migration consistency has a separate gate.
export async function enterprisePostgres() {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (databaseUrl) {
    const target = new URL(databaseUrl);
    if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.pathname !== '/mkety_enterprise_test') {
      throw new Error('Enterprise regression database must be the local disposable test database.');
    }
  }
  const transport = databaseUrl ? postgres(databaseUrl, { max: 4, prepare: false }) : null;
  const embedded = transport ? null : new PGlite();
  const client = {
    exec: (query: string) => (transport ? transport.unsafe(query) : embedded!.exec(query)),
    close: () => (transport ? transport.end() : embedded!.close()),
  };
  const dialect = new PgDialect();
  const tables: PgTable[] = [
    schema.billingPlans,
    schema.billingPlanVersions,
    schema.billingSubscriptions,
    schema.billingPeriods,
    schema.billingCheckouts,
    schema.billingSettlements,
    schema.billingLedgerEntries,
    schema.billingPlanVersionCreditAllowances,
    schema.billingPlanVersionEntitlements,
    schema.aiScheduledActions,
    schema.aiEnterpriseCommercialPolicies,
    schema.aiRequests,
    schema.tenantCreditAccounts,
    schema.creditLedgerEntries,
    schema.usageEvents,
  ];
  await client.exec(
    'DROP SCHEMA IF EXISTS saas_template CASCADE; CREATE SCHEMA saas_template; SET search_path = saas_template, public',
  );
  await client.exec(
    `CREATE TYPE credit_ledger_entry_type AS ENUM (${schema.creditLedgerEntryTypeEnum.enumValues.map((value) => `'${value}'`).join(',')})`,
  );
  for (const table of tables) {
    const config = getTableConfig(table);
    const columns = config.columns.map((column) => {
      const value = column.default;
      const defaultSql =
        value instanceof SQL
          ? dialect.sqlToQuery(value).sql
          : typeof value === 'string'
            ? `'${value.replace(/'/g, "''")}'`
            : value === undefined
              ? undefined
              : typeof value === 'object'
                ? `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`
                : String(value);
      return `"${column.name}" ${column.getSQLType() === 'credit_ledger_entry_type' ? '"saas_template"."credit_ledger_entry_type"' : column.getSQLType()}${column.notNull ? ' NOT NULL' : ''}${column.primary ? ' PRIMARY KEY' : ''}${defaultSql === undefined ? '' : ` DEFAULT ${defaultSql}`}`;
    });
    await client.exec(`CREATE TABLE "saas_template"."${config.name}" (${columns.join(',')})`);
    for (const index of config.indexes.filter((entry) => entry.config.unique)) {
      await client.exec(
        `CREATE UNIQUE INDEX "${index.config.name}" ON "saas_template"."${config.name}" (${index.config.columns.map((column) => `"${'name' in column ? column.name : ''}"`).join(',')})`,
      );
    }
  }
  return {
    client,
    database: (transport
      ? drizzlePostgres(transport, { schema })
      : drizzle(embedded!, { schema })) as unknown as Database,
  };
}

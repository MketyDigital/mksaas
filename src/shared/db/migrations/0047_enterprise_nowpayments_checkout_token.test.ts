/** @jest-environment node */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const migration = resolve(process.cwd(), 'src/shared/db/migrations/0047_enterprise_nowpayments_checkout_token.sql');

describe('Enterprise NOWPayments capability migration', () => {
  it('adds nullable, indexed checkout capability fields while preserving existing orders', async () => {
    const database = new PGlite();
    try {
      await database.exec(`CREATE SCHEMA saas_template;
        CREATE TABLE saas_template.platform_enterprise_orders (id text PRIMARY KEY, checkout_status text NOT NULL);
        INSERT INTO saas_template.platform_enterprise_orders VALUES ('MKETY-ENT-existing', 'redirected');`);
      await database.exec(readFileSync(migration, 'utf8'));
      const result = await database.query('SELECT id, checkout_status, checkout_token_hash, checkout_token_expires_at, provider_pay_currency FROM saas_template.platform_enterprise_orders');
      expect(result.rows).toEqual([{ id: 'MKETY-ENT-existing', checkout_status: 'redirected', checkout_token_hash: null, checkout_token_expires_at: null, provider_pay_currency: null }]);
      const indexes = await database.query(`SELECT indexname FROM pg_indexes WHERE schemaname='saas_template' AND tablename='platform_enterprise_orders'`);
      expect(indexes.rows).toContainEqual({ indexname: 'platform_enterprise_orders_checkout_token_hash_idx' });
    } finally {
      await database.close();
    }
  });
});

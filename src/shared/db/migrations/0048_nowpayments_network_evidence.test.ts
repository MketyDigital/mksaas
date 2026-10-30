/** @jest-environment node */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const migration = resolve(process.cwd(), 'src/shared/db/migrations/0048_nowpayments_network_evidence.sql');

describe('NOWPayments network evidence migration', () => {
  it('adds optional selected and observed tickers without rewriting checkout or settlement rows', async () => {
    const database = new PGlite();
    try {
      await database.exec(`CREATE SCHEMA saas_template;
        CREATE TABLE saas_template.billing_checkouts (id text PRIMARY KEY, status text NOT NULL);
        CREATE TABLE saas_template.billing_settlements (id text PRIMARY KEY, status text NOT NULL);
        INSERT INTO saas_template.billing_checkouts VALUES ('checkout-1', 'completed');
        INSERT INTO saas_template.billing_settlements VALUES ('settlement-1', 'applied');`);
      await database.exec(readFileSync(migration, 'utf8'));
      const checkouts = await database.query('SELECT id, status, provider_pay_currency FROM saas_template.billing_checkouts');
      const settlements = await database.query('SELECT id, status, provider_pay_currency FROM saas_template.billing_settlements');
      expect(checkouts.rows).toEqual([{ id: 'checkout-1', status: 'completed', provider_pay_currency: null }]);
      expect(settlements.rows).toEqual([{ id: 'settlement-1', status: 'applied', provider_pay_currency: null }]);
    } finally {
      await database.close();
    }
  });
});

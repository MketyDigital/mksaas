/** @jest-environment node */
import { and, eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { platformEditorialDrafts } from '@/shared/db/schema/platform-content';

import { readEditorialDraft, removeEditorialDraft, stageEditorialDraft } from './editorial-drafts';

describe('concurrent editorial draft publication', () => {
  const postgresTest = process.env.TEST_DATABASE_URL ? it : it.skip;

  postgresTest(
    'keeps a newer save staged when publication consumes an older version',
    async () => {
      const databaseUrl = process.env.TEST_DATABASE_URL;
      if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for the concurrent PostgreSQL regression.');
      const target = new URL(databaseUrl);
      if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.pathname !== '/mkety_enterprise_test') {
        throw new Error('Editorial concurrency regression requires the local disposable PostgreSQL database.');
      }

      const pg = postgres(databaseUrl, { max: 3, prepare: false });
      const database = drizzlePostgres(pg, { schema: { platformEditorialDrafts } });
      await pg.unsafe(`
      CREATE SCHEMA IF NOT EXISTS saas_template;
      CREATE TABLE IF NOT EXISTS saas_template.platform_editorial_drafts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        area varchar(40) NOT NULL,
        entity_type varchar(40) NOT NULL,
        entity_key varchar(180) NOT NULL,
        payload_json jsonb NOT NULL,
        updated_by text,
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (area, entity_type, entity_key)
      );
    `);

      const key = {
        area: 'public-site' as const,
        entityType: 'page' as const,
        entityKey: `race-test-${crypto.randomUUID()}`,
      };
      const older = { pages: [{ slug: 'platform', title: 'Older copy' }] };
      const newer = { pages: [{ slug: 'platform', title: 'Newer copy' }] };
      await stageEditorialDraft(key, older, 'operator-a', database as never);

      let didReadDraft!: () => void;
      const draftRead = new Promise<void>((resolve) => {
        didReadDraft = resolve;
      });
      let resumePublication!: () => void;
      const publicationGate = new Promise<void>((resolve) => {
        resumePublication = resolve;
      });

      const publication = database.transaction(async (tx) => {
        await expect(readEditorialDraft(key, tx as never)).resolves.toEqual(older);
        didReadDraft();
        await publicationGate;
        await removeEditorialDraft(key, tx as never);
      });

      await draftRead;
      let saveCompleted = false;
      let didStartSave!: () => void;
      const saveStarted = new Promise<void>((resolve) => {
        didStartSave = resolve;
      });
      const concurrentSave = database
        .transaction(async (tx) => {
          didStartSave();
          await stageEditorialDraft(key, newer, 'operator-b', tx as never);
        })
        .then(() => {
          saveCompleted = true;
        });

      await saveStarted;
      const saveResult = await Promise.race([
        concurrentSave.then(() => 'completed' as const),
        new Promise<'waiting'>((resolve) => setTimeout(() => resolve('waiting'), 100)),
      ]);
      const saveWasBlockedByPublication = saveResult === 'waiting' && !saveCompleted;
      resumePublication();

      try {
        await Promise.all([publication, concurrentSave]);
        expect(saveWasBlockedByPublication).toBe(true);
        await expect(readEditorialDraft(key, database as never)).resolves.toEqual(newer);
      } finally {
        await database
          .delete(platformEditorialDrafts)
          .where(
            and(
              eq(platformEditorialDrafts.area, key.area),
              eq(platformEditorialDrafts.entityType, key.entityType),
              eq(platformEditorialDrafts.entityKey, key.entityKey),
            ),
          );
        await pg.end();
      }
    },
    30_000,
  );
});

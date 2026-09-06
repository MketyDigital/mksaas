/**
 * Mkety Platform Content Migration Runner
 *
 * The repository's Drizzle config writes generated migrations to src/shared/db/migrations.
 * The Mkety public CMS bootstrap SQL is intentionally kept in root migrations/ while
 * the schema settles, so this runner applies those SQL files explicitly against a
 * real PostgreSQL database.
 *
 * Run before seeding and smoke checks:
 *
 *   pnpm db:migrate
 *   pnpm db:migrate:mkety-content
 *   pnpm db:seed:mkety-content
 *   pnpm db:smoke:mkety-content
 */

import 'dotenv/config';

import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const scriptFile = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptFile);
const rootDir = path.resolve(scriptDir, '..');

const MIGRATION_FILES = [
  'migrations/0000_platform_content.sql',
  'migrations/0001_platform_app_experience.sql',
] as const;

const queryClient = postgres(DATABASE_URL, {
  idle_timeout: 20,
  max: 1,
});

async function runMigrationFile(relativePath: (typeof MIGRATION_FILES)[number]) {
  const absolutePath = path.join(rootDir, relativePath);
  const sqlText = await readFile(absolutePath, 'utf-8');

  if (!sqlText.trim()) {
    throw new Error(`Migration file is empty: ${relativePath}`);
  }

  console.log(`→ Applying ${relativePath}`);

  await queryClient.begin(async (transaction) => {
    await transaction.unsafe(sqlText);
  });

  console.log(`✓ Applied ${relativePath}`);
}

async function main() {
  console.log('🧱 Applying Mkety platform content migrations...');

  for (const migrationFile of MIGRATION_FILES) {
    await runMigrationFile(migrationFile);
  }

  console.log('✅ Mkety platform content migrations applied.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queryClient.end();
  });

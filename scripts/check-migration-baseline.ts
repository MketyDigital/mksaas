import fs from 'node:fs';
import path from 'node:path';

type NamespaceResult = {
  label: string;
  files: string[];
};

const root = process.cwd();

function listSqlMigrations(relativeDir: string): string[] {
  const dir = path.join(root, relativeDir);
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function validateNamespace(label: string, relativeDir: string): NamespaceResult {
  const files = listSqlMigrations(relativeDir);
  const invalid = files.filter((name) => !/^\d{4}_.+\.sql$/.test(name));

  if (invalid.length > 0) {
    throw new Error(`${label}: invalid migration names: ${invalid.join(', ')}`);
  }

  const prefixes = files.map((name) => Number.parseInt(name.slice(0, 4), 10));
  const duplicates = prefixes.filter((value, index) => prefixes.indexOf(value) !== index);

  if (duplicates.length > 0) {
    throw new Error(`${label}: duplicate migration prefixes: ${[...new Set(duplicates)].join(', ')}`);
  }

  const expected = prefixes.map((_, index) => index);
  const hasGap = prefixes.some((value, index) => value !== expected[index]);

  if (hasGap) {
    throw new Error(`${label}: migration prefixes must be contiguous from 0000; found ${prefixes.join(', ')}`);
  }

  return { label, files };
}

function validateDrizzleMetadata(sqlFiles: string[]): void {
  const journalPath = path.join(root, 'src/shared/db/migrations/meta/_journal.json');
  if (!fs.existsSync(journalPath)) {
    throw new Error('Drizzle journal is missing: src/shared/db/migrations/meta/_journal.json');
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
    entries?: Array<{ tag?: string }>;
  };
  const tags = (journal.entries ?? []).map((entry) => entry.tag).filter(Boolean) as string[];
  const tagSet = new Set(tags);
  const sqlTags = sqlFiles.map((name) => name.replace(/\.sql$/, ''));
  const journalWithoutSql = tags.filter((tag) => !sqlTags.includes(tag));
  const sqlWithoutJournal = sqlTags.filter((tag) => !tagSet.has(tag));

  if (journalWithoutSql.length > 0) {
    throw new Error(`Drizzle journal references missing SQL migrations: ${journalWithoutSql.join(', ')}`);
  }

  if (sqlWithoutJournal.length > 0) {
    throw new Error(`Drizzle journal is missing SQL migrations: ${sqlWithoutJournal.join(', ')}`);
  }

  if (tags.length !== sqlTags.length || tags.some((tag, index) => tag !== sqlTags[index])) {
    throw new Error(
      `Drizzle journal order must exactly match SQL migration order. SQL: ${sqlTags.join(', ')}; journal: ${tags.join(', ')}`,
    );
  }

  const latestIndex = String(sqlTags.length - 1).padStart(4, '0');
  const latestSnapshotPath = path.join(root, `src/shared/db/migrations/meta/${latestIndex}_snapshot.json`);
  if (!fs.existsSync(latestSnapshotPath)) {
    throw new Error(`Drizzle latest snapshot is missing: src/shared/db/migrations/meta/${latestIndex}_snapshot.json`);
  }
}

const drizzle = validateNamespace('Drizzle SQL', 'src/shared/db/migrations');
const content = validateNamespace('Mkety content bootstrap', 'migrations');
validateDrizzleMetadata(drizzle.files);

console.log(`[migration-baseline] ${drizzle.label}: ${drizzle.files.join(' -> ')}`);
console.log(`[migration-baseline] ${content.label}: ${content.files.join(' -> ')}`);
console.log('[migration-baseline] OK: SQL order, Drizzle journal, and latest snapshot are aligned.');

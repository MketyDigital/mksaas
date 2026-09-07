import fs from 'node:fs';
import path from 'node:path';

function readMigrationNames(relativeDir: string): string[] {
  const dir = path.join(process.cwd(), relativeDir);
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

function prefixes(names: string[]): number[] {
  return names.map((name) => Number.parseInt(name.slice(0, 4), 10));
}

function expectUniqueContiguous(names: string[]): void {
  const values = prefixes(names);
  expect(new Set(values).size).toBe(values.length);
  expect(values).toEqual(values.map((_, index) => index));
}

describe('migration baseline', () => {
  it('exposes a durable migration baseline check command', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['db:check:migrations']).toBe('tsx scripts/check-migration-baseline.ts');
  });

  it('keeps Drizzle SQL migration prefixes unique and contiguous', () => {
    expectUniqueContiguous(readMigrationNames('src/shared/db/migrations'));
  });

  it('keeps Mkety content bootstrap prefixes unique and contiguous in their independent namespace', () => {
    expectUniqueContiguous(readMigrationNames('migrations'));
  });

  it('keeps the Drizzle journal aligned with SQL order and a current latest snapshot', () => {
    const migrations = readMigrationNames('src/shared/db/migrations');
    const expectedTags = migrations.map((name) => name.replace(/\.sql$/, ''));
    const journal = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'src/shared/db/migrations/meta/_journal.json'), 'utf8'),
    ) as { entries?: Array<{ tag?: string }> };
    const journalTags = (journal.entries ?? []).map((entry) => entry.tag).filter(Boolean);

    expect(journalTags).toEqual(expectedTags);

    const latestIndex = String(migrations.length - 1).padStart(4, '0');
    expect(fs.existsSync(path.join(process.cwd(), `src/shared/db/migrations/meta/${latestIndex}_snapshot.json`))).toBe(
      true,
    );
  });
});

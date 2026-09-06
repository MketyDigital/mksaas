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
});

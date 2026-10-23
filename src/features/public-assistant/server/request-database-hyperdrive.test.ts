import fs from 'node:fs';
import path from 'node:path';

describe('Public AI request database Hyperdrive options', () => {
  it('uses the shared request database helper configured for Hyperdrive', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/features/public-assistant/server/request-database.ts'),
      'utf8',
    );
    const sharedRequest = fs.readFileSync(
      path.join(process.cwd(), 'src/shared/db/request.ts'),
      'utf8',
    );

    expect(source).toContain("from '@/shared/db/request'");
    expect(source).toContain('return withRequestDatabase(work)');
    expect(sharedRequest).toContain('postgres(connectionString, { max: 1, prepare: false })');
  });

  it('keeps the production Hyperdrive diagnostic probe aligned with the runtime helper', () => {
    const workflow = fs.readFileSync(
      path.join(process.cwd(), '.github/workflows/mkety-prod-hyperdrive-deep-diagnostic.yml'),
      'utf8',
    );

    expect(workflow).toContain("postgres(env.MKETY_DB.connectionString, { max: 1, prepare: false })");
  });
});

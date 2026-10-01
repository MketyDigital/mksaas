/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (file: string) => readFile(path.resolve(process.cwd(), file), 'utf8');

describe('Mkety Assist standalone repository boundary', () => {
  it('keeps platform quality gates from traversing the standalone Assist application', async () => {
    const [tsconfig, eslint, mega, jest] = await Promise.all([
      read('tsconfig.json'),
      read('eslint.config.mjs'),
      read('.mega-linter.yml'),
      read('jest.config.cjs'),
    ]);

    expect(tsconfig).toContain('"customer-apps/assist/**/*"');
    expect(eslint).toContain("'customer-apps/assist/'");
    expect(mega).toContain('customer-apps/assist/');
    expect(jest).toContain("roots: ['<rootDir>/src/']");
  });

  it('keeps Assist verification and deployment scoped to its own directory', async () => {
    const [ci, deploy] = await Promise.all([
      read('.github/workflows/mkety-assist-ci.yml'),
      read('.github/workflows/mkety-assist-deploy.yml'),
    ]);

    for (const workflow of [ci, deploy]) {
      expect(workflow).toContain("'customer-apps/assist/**'");
      expect(workflow).toContain('working-directory: customer-apps/assist');
    }
  });
});

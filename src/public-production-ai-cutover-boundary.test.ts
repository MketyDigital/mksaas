/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (file: string) => readFile(path.resolve(process.cwd(), file), 'utf8');

describe('public production AI cutover boundary', () => {
  it('keeps exact commercial grounding in candidate certification and live production smoke deterministic', async () => {
    const [candidate, production] = await Promise.all([
      read('.github/workflows/mkety-public-candidate-deploy.yml'),
      read('.github/workflows/mkety-public-production-cutover.yml'),
    ]);

    expect(candidate).toContain(
      "const required=[/Starter/i,/\\$5\\.99/,/AI Workspace/i,/\\$16\\.99/,/Automation Workspace/i,/Deploy Workspace/i,/\\$9\\.99/,/Mkety One/i,/\\$49/,/Enterprise/i,/academy\\.mkety\\.com/i]",
    );
    expect(production).toContain('Public AI live response was empty or missing conversation state.');
    expect(production).toContain('Public AI live response missed the Academy or Trading/Enterprise routing boundary.');
    expect(production).not.toContain("const required = [/Starter/i, /\\$5\\.99/");
    expect(production).toContain('Public AI exposed internal engineering/source information.');
    expect(production).toContain('Public AI exposed a removed plan.');
  });
});

/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const read = (file: string) => readFile(path.resolve(process.cwd(), file), 'utf8');

describe('Azure Foundry public AI workflow wiring', () => {
  it.each([
    '.github/workflows/mkety-public-candidate-deploy.yml',
    '.github/workflows/mkety-public-production-cutover.yml',
  ])('%s maps the Foundry secret names and prefers Azure', async (file) => {
    const workflow = await read(file);
    expect(workflow).toContain('secrets.MKETY_PUBLIC_AZURE_OPEN_AI_API_KEY || secrets.MKETY_PUBLIC_AZURE_OPENAI_API_KEY');
    expect(workflow).toContain('secrets.MKETY_PUBLIC_AZURE_OPEN_AI_MODEL || secrets.MKETY_PUBLIC_AZURE_OPENAI_MODEL');
    const azure = workflow.indexOf('providers+=(azure-openai)');
    const openai = workflow.indexOf('providers+=(openai)');
    expect(azure).toBeGreaterThan(-1);
    expect(openai).toBeGreaterThan(azure);
  });
});

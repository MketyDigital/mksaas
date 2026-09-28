import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('managed-model benchmark workflow safety', () => {
  const workflow = readFileSync(
    resolve(process.cwd(), '.github/workflows/mkety-ai-model-benchmark.yml'),
    'utf8',
  );

  it('is manual only and never runs on push or pull requests', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toMatch(/\n\s+push:/);
    expect(workflow).not.toMatch(/\n\s+pull_request:/);
  });

  it('requires an explicit paid-inference confirmation phrase', () => {
    expect(workflow).toContain('RUN_SMALL_PAID_BENCHMARK');
    expect(workflow).toContain('Paid inference benchmark was not explicitly authorized.');
  });

  it('forces the benchmark gateway to standard Workers AI billing', () => {
    expect(workflow).toContain('workers_ai_billing_mode: "postpaid"');
    expect(workflow).toContain('never Unified Billing');
  });

  it('does not enable customer model routes or deploy production AI', () => {
    expect(workflow).not.toContain('wrangler deploy');
    expect(workflow).not.toContain('ai_routes');
    expect(workflow).not.toContain('UPDATE "saas_template"."ai_models"');
  });
});

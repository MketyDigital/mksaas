import { readFile } from 'node:fs/promises';

import { conservativeInputTokenUpperBound } from './commercial-estimation';

describe('AI commercial admission route safety', () => {
  it('uses a conservative request-byte reservation bound', () => {
    expect(conservativeInputTokenUpperBound(1)).toBe(4_098n);
    expect(conservativeInputTokenUpperBound(1_000_000)).toBe(2_004_096n);
    expect(() => conservativeInputTokenUpperBound(0)).toThrow();
  });

  it('requires commercial admission before any future provider execution point', async () => {
    const route = await readFile(
      'src/app/api/v1/ai/chat/completions/route.ts',
      'utf8',
    );

    expect(route).toContain('admitAiCommercialRequest');
    expect(route).toContain('releaseAiCommercialRequest');
    expect(route).toContain("status: 'admitting'");
    expect(route).toContain("errorCode: 'provider_unavailable'");
    expect(route).not.toContain('.run(');
    expect(route).not.toContain('env.AI');
    expect(route).not.toContain('WorkersAi');
  });

  it('snapshots the exact commercial rate and reservation amount on each request', async () => {
    const [route, schema] = await Promise.all([
      readFile('src/app/api/v1/ai/chat/completions/route.ts', 'utf8'),
      readFile('src/shared/db/schema/ai-runtime.ts', 'utf8'),
    ]);

    expect(route).toContain('rateCardId: rate.id');
    expect(route).toContain('rateCardVersion: rate.version');
    expect(route).toContain('reservedCredits');
    expect(schema).toContain("rateCardId: uuid('rate_card_id')");
    expect(schema).toContain("settledCredits: bigint('settled_credits'");
  });
});

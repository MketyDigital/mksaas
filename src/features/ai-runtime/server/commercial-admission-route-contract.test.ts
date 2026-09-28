import { readFile } from 'node:fs/promises';

import { conservativeInputTokenUpperBound } from './commercial-estimation';

describe('AI commercial admission route safety', () => {
  it('uses a conservative request-byte reservation bound', () => {
    expect(conservativeInputTokenUpperBound(1)).toBe(4_098n);
    expect(conservativeInputTokenUpperBound(1_000_000)).toBe(2_004_096n);
    expect(() => conservativeInputTokenUpperBound(0)).toThrow();
  });

  it('requires commercial admission and verified provider cost before managed execution', async () => {
    const route = await readFile(
      'src/app/api/v1/ai/chat/completions/route.ts',
      'utf8',
    );

    const admission = route.indexOf('admitAiCommercialRequest');
    const providerCost = route.indexOf('getManagedAiCostRate');
    const providerExecution = route.indexOf('getManagedWorkersAiProvider');
    const settlement = route.indexOf('settleAiCommercialRequest');

    expect(admission).toBeGreaterThan(-1);
    expect(providerCost).toBeGreaterThan(admission);
    expect(providerExecution).toBeGreaterThan(providerCost);
    expect(settlement).toBeGreaterThan(providerExecution);
    expect(route).toContain("status: 'reconciliation_required'");
    expect(route).toContain('The request will not be sent upstream again.');
    expect(route).toContain("providerOutcome: 'unknown_after_dispatch'");
    expect(route).toContain('It will not be sent upstream again.');
  });

  it('snapshots exact commercial rate, usage, provider cost and settlement state', async () => {
    const [route, schema] = await Promise.all([
      readFile('src/app/api/v1/ai/chat/completions/route.ts', 'utf8'),
      readFile('src/shared/db/schema/ai-runtime.ts', 'utf8'),
    ]);

    expect(route).toContain('rateCardId: rate.id');
    expect(route).toContain('rateCardVersion: rate.version');
    expect(route).toContain('reservedCredits');
    expect(route).toContain('settledCredits: actualCredits');
    expect(route).toContain('providerCostUsdMicros');
    expect(route).toContain('providerCostVerifiedAt');
    expect(schema).toContain("rateCardId: uuid('rate_card_id')");
    expect(schema).toContain("settledCredits: bigint('settled_credits'");
  });

  it('keeps tools and structured output explicit in the provider-neutral contract', async () => {
    const route = await readFile('src/app/api/v1/ai/chat/completions/route.ts', 'utf8');
    expect(route).toContain("type: z.literal('function')");
    expect(route).toContain("type: z.literal('json_schema')");
    expect(route).toContain('inputSchema: tool.function.parameters');
    expect(route).toContain('tool_calls: result.toolCalls.map');
  });
});

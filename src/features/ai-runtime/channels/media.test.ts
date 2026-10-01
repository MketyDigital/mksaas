import { calculateWorkersAiVisionCostUsdMicros } from './media';

describe('Workers AI vision commercial accounting', () => {
  it('prices Gemma vision from returned token usage', () => {
    expect(calculateWorkersAiVisionCostUsdMicros({
      response: 'ok',
      usage: {
        prompt_tokens: 1_000,
        completion_tokens: 500,
        total_tokens: 1_500,
      },
    })).toBe(250n);
  });

  it('supports nested Workers AI result envelopes', () => {
    expect(calculateWorkersAiVisionCostUsdMicros({
      result: {
        response: 'ok',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20,
        },
      },
    })).toBe(4n);
  });

  it('uses a conservative fallback when usage is unavailable', () => {
    expect(calculateWorkersAiVisionCostUsdMicros({ response: 'ok' })).toBe(2_500n);
  });
});

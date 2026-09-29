import { mkdir, writeFile } from 'node:fs/promises';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
const gatewayId = process.env.MKETY_AI_BENCHMARK_GATEWAY_ID?.trim() || 'mkety-ai-benchmark';

if (!accountId || !token) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.');
}

const models = [
  {
    key: 'gemma-4',
    nativeModel: '@cf/google/gemma-4-26b-a4b-it',
    price: { input: 0.10, output: 0.30 },
  },
  {
    key: 'glm-5.3-flash',
    nativeModel: '@cf/zai-org/glm-5.3-flash',
    price: { input: 0.15, output: 0.50, cachedInput: 0.03 },
    reasoningEffort: 'low',
  },
  {
    key: 'qwen-3.8-27b',
    nativeModel: '@cf/qwen/qwen3.8-27b',
    price: { input: 0.45, output: 3.20, cachedInput: 0.05 },
    reasoningEffort: 'low',
  },
] as const;

type JsonObject = Record<string, unknown>;

type BenchmarkCase = {
  id: string;
  category: string;
  body: JsonObject;
  check: (response: JsonObject) => { passed: boolean; detail?: string };
};

const longCorpus = Array.from({ length: 80 }, (_, index) => {
  if (index === 47) return 'Record 48: Project CALYPSO has launch code VIOLET-731 and owner Mira.';
  return `Record ${index + 1}: Project ITEM-${index + 1} has no launch code and is a distractor.`;
}).join('\n');

const redPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKElEQVR4nO3NMQEAAAjDMMC/ZzDBvlRA01vZJvwHAAAAAAAAAAAAbx2jxAE/i2AjOgAAAABJRU5ErkJggg==';

function firstMessage(response: JsonObject) {
  const choices = Array.isArray(response.choices) ? response.choices : [];
  const first = choices[0] as JsonObject | undefined;
  const message = first?.message;
  return message && typeof message === 'object' ? message as JsonObject : {};
}

function textContent(response: JsonObject) {
  const content = firstMessage(response).content;
  return typeof content === 'string' ? content : '';
}

const cases: BenchmarkCase[] = [
  {
    id: 'chat-instruction-following',
    category: 'chat',
    body: {
      messages: [{
        role: 'user',
        content: 'Reply in exactly three lines. Line 1 must be "STATUS: READY". Line 2 must be "REGION: AFRICA". Line 3 must be "MODE: ENTERPRISE". Do not add anything else.',
      }],
      max_completion_tokens: 256,
    },
    check(response) {
      return { passed: textContent(response).trim() === 'STATUS: READY\nREGION: AFRICA\nMODE: ENTERPRISE' };
    },
  },
  {
    id: 'rag-long-context-grounding',
    category: 'long_context_rag',
    body: {
      messages: [{
        role: 'user',
        content: `Use only the corpus below. What is Project CALYPSO's launch code and owner? Answer exactly "CODE | OWNER".\n\n${longCorpus}`,
      }],
      max_completion_tokens: 256,
    },
    check(response) {
      const text = textContent(response).trim();
      return { passed: text.includes('VIOLET-731') && /Mira/i.test(text) };
    },
  },
  {
    id: 'tool-selection-and-arguments',
    category: 'tool_calls',
    body: {
      messages: [{ role: 'user', content: 'Find customer CUST-42. You must use the lookup_customer tool.' }],
      tools: [{
        type: 'function',
        function: {
          name: 'lookup_customer',
          description: 'Lookup a customer by id',
          parameters: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: 'required',
      max_completion_tokens: 384,
    },
    check(response) {
      const toolCalls = firstMessage(response).tool_calls;
      const calls = Array.isArray(toolCalls) ? toolCalls as JsonObject[] : [];
      const call = calls[0];
      const fn = call?.function as JsonObject | undefined;
      const args = typeof fn?.arguments === 'string' ? fn.arguments : '';
      return { passed: fn?.name === 'lookup_customer' && args.includes('CUST-42') };
    },
  },
  {
    id: 'strict-json-schema',
    category: 'structured_output',
    body: {
      messages: [{ role: 'user', content: 'Return the health state for Mkety runtime. It is healthy with score 97.' }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'runtime_health',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              healthy: { type: 'boolean' },
              score: { type: 'integer' },
            },
            required: ['healthy', 'score'],
            additionalProperties: false,
          },
        },
      },
      max_completion_tokens: 384,
    },
    check(response) {
      try {
        const parsed = JSON.parse(textContent(response)) as JsonObject;
        return { passed: parsed.healthy === true && parsed.score === 97 };
      } catch {
        return { passed: false, detail: 'invalid_json' };
      }
    },
  },
  {
    id: 'coding-debug-and-patch',
    category: 'coding',
    body: {
      messages: [{
        role: 'user',
        content: 'Fix this TypeScript function with the smallest correct patch. Return only the corrected function.\nfunction total(values:number[]){ values.reduce((a,b)=>a+b,0); }',
      }],
      max_completion_tokens: 512,
    },
    check(response) {
      const text = textContent(response);
      return { passed: /return\s+values\.reduce/.test(text) && /a\s*\+\s*b/.test(text) };
    },
  },
  {
    id: 'reasoning-constrained',
    category: 'reasoning',
    body: {
      messages: [{
        role: 'user',
        content: 'A job has tasks A=4 min, B=7 min, C=3 min. B can start only after A. C can run in parallel with A. With two workers, what is the minimum completion time? Answer only the integer number of minutes.',
      }],
      max_completion_tokens: 256,
    },
    check(response) {
      return { passed: textContent(response).trim() === '11' };
    },
  },
  {
    id: 'vision-red-square',
    category: 'vision',
    body: {
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'What is the dominant color in this image? Answer only one lowercase color word.' },
          { type: 'image_url', image_url: { url: redPixel } },
        ],
      }],
      max_completion_tokens: 256,
    },
    check(response) {
      return { passed: textContent(response).trim().toLowerCase() === 'red' };
    },
  },
  {
    id: 'latency-short-chat',
    category: 'latency',
    body: {
      messages: [{ role: 'user', content: 'Reply only: pong' }],
      max_completion_tokens: 128,
    },
    check(response) {
      return { passed: textContent(response).trim().toLowerCase() === 'pong' };
    },
  },
];

function usageFrom(response: JsonObject) {
  const usage = response.usage && typeof response.usage === 'object' ? response.usage as JsonObject : {};
  const details = usage.prompt_tokens_details && typeof usage.prompt_tokens_details === 'object'
    ? usage.prompt_tokens_details as JsonObject
    : {};
  return {
    inputTokens: Number(usage.prompt_tokens ?? usage.input_tokens ?? 0),
    cachedInputTokens: Number(details.cached_tokens ?? usage.cached_input_tokens ?? 0),
    outputTokens: Number(usage.completion_tokens ?? usage.output_tokens ?? 0),
  };
}

function cost(model: typeof models[number], usage: ReturnType<typeof usageFrom>) {
  const cached = Math.max(0, usage.cachedInputTokens);
  const normal = Math.max(0, usage.inputTokens - cached);
  const cachedPrice = 'cachedInput' in model.price ? model.price.cachedInput : model.price.input;
  return normal / 1_000_000 * model.price.input
    + cached / 1_000_000 * cachedPrice
    + Math.max(0, usage.outputTokens) / 1_000_000 * model.price.output;
}

async function runCase(model: typeof models[number], testCase: BenchmarkCase, repetition = 1) {
  const started = performance.now();
  let status = 0;
  let response: JsonObject = {};
  let error: string | null = null;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'cf-aig-gateway-id': gatewayId,
        },
        body: JSON.stringify({
          model: model.nativeModel,
          ...testCase.body,
          ...('reasoningEffort' in model ? { reasoning_effort: model.reasoningEffort } : {}),
          options: { rejectIfBusy: true },
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );
    status = res.status;
    response = await res.json() as JsonObject;
    if (!res.ok) error = `HTTP_${res.status}`;
  } catch (cause) {
    error = cause instanceof Error ? cause.name : 'request_error';
  }

  const latencyMs = Math.round(performance.now() - started);
  const check = error ? { passed: false, detail: error } : testCase.check(response);
  const usage = usageFrom(response);

  return {
    modelKey: model.key,
    nativeModel: model.nativeModel,
    caseId: testCase.id,
    category: testCase.category,
    repetition,
    status,
    latencyMs,
    passed: check.passed,
    detail: check.detail ?? null,
    usage,
    estimatedRawProviderCostUsd: cost(model, usage),
    response,
  };
}

const results: Awaited<ReturnType<typeof runCase>>[] = [];
for (const model of models) {
  for (const testCase of cases) {
    results.push(await runCase(model, testCase));
    if (testCase.category === 'latency') {
      results.push(await runCase(model, testCase, 2));
      results.push(await runCase(model, testCase, 3));
    }
  }
}

const summary = models.map((model) => {
  const rows = results.filter((row) => row.modelKey === model.key);
  const latency = rows.filter((row) => row.category === 'latency').map((row) => row.latencyMs);
  return {
    modelKey: model.key,
    passed: rows.filter((row) => row.passed).length,
    attempted: rows.length,
    providerErrors: rows.filter((row) => row.status >= 400 || row.status === 0).length,
    averageLatencyMs: latency.length
      ? Math.round(latency.reduce((sum, value) => sum + value, 0) / latency.length)
      : null,
    estimatedRawProviderCostUsd: rows.reduce((sum, row) => sum + row.estimatedRawProviderCostUsd, 0),
  };
});

await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/mkety-ai-model-benchmark.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  gatewayId,
  billingModeExpected: 'postpaid',
  models,
  summary,
  results,
}, null, 2));

console.log(JSON.stringify({ gatewayId, summary }, null, 2));

type QueueMessage<T> = {
  body: T;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
};

type QueueBatch<T> = {
  messages: Array<QueueMessage<T>>;
};

type DeliveryJob = {
  actionId: string;
  tenantId: string;
};

type Env = {
  MKETY_AI_DELIVERY_INTERNAL_SECRET: string;
  MKETY_AI_DELIVERY_CALLBACK_BASE_URL: string;
};

function baseUrl(env: Env) {
  const value = env.MKETY_AI_DELIVERY_CALLBACK_BASE_URL.trim().replace(/\/$/, '');
  if (!value.startsWith('https://')) throw new Error('AI delivery callback base URL must use HTTPS.');
  return value;
}

async function post(env: Env, path: string, body?: unknown) {
  const response = await fetch(baseUrl(env) + path, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.MKETY_AI_DELIVERY_INTERNAL_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) throw new Error(`Mkety AI delivery callback failed with HTTP ${response.status}.`);
}

export default {
  async fetch(): Promise<Response> {
    return new Response('Mkety Enterprise AI delivery scheduler', { status: 200 });
  },

  async queue(batch: QueueBatch<DeliveryJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        if (!message.body?.actionId || !message.body?.tenantId) {
          message.ack();
          continue;
        }
        await post(env, '/api/internal/ai/scheduled-actions/deliver', message.body);
        message.ack();
      } catch {
        message.retry({ delaySeconds: 30 });
      }
    }
  },

  async scheduled(_controller: unknown, env: Env): Promise<void> {
    await post(env, '/api/internal/ai/scheduled-actions/dispatch-due');
  },
};

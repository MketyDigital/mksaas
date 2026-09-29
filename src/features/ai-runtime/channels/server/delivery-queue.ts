import { env } from 'cloudflare:workers';

type EnterpriseAiDeliveryQueue = {
  send(
    body: { actionId: string; tenantId: string },
    options?: { delaySeconds?: number },
  ): Promise<void>;
};

export async function enqueueEnterpriseAiScheduledAction(input: {
  actionId: string;
  tenantId: string;
  delaySeconds?: number;
}) {
  const queue = env.MKETY_AI_DELIVERY_QUEUE as EnterpriseAiDeliveryQueue | undefined;
  if (!queue?.send) return { queued: false as const, reason: 'not_configured' as const };

  const delaySeconds = Math.max(0, Math.min(86_400, Math.trunc(input.delaySeconds ?? 0)));
  await queue.send(
    { actionId: input.actionId, tenantId: input.tenantId },
    delaySeconds > 0 ? { delaySeconds } : undefined,
  );
  return { queued: true as const };
}

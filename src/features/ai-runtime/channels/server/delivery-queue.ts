const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';

function cloudflareQueueEnv() {
  return {
    token:
      process.env.MKETY_DEPLOY_CLOUDFLARE_API_TOKEN ??
      process.env.CLOUDFLARE_API_TOKEN ??
      '',
    accountId:
      process.env.MKETY_DEPLOY_CLOUDFLARE_ACCOUNT_ID ??
      process.env.CLOUDFLARE_ACCOUNT_ID ??
      '',
    queueId: process.env.MKETY_AI_DELIVERY_QUEUE_ID ?? '',
  };
}

export async function enqueueEnterpriseAiScheduledAction(input: {
  actionId: string;
  tenantId: string;
  delaySeconds?: number;
}) {
  const { token, accountId, queueId } = cloudflareQueueEnv();
  if (!token || !accountId || !queueId) return { queued: false as const, reason: 'not_configured' as const };

  const delaySeconds = Math.max(0, Math.min(86_400, Math.trunc(input.delaySeconds ?? 0)));
  const response = await fetch(
    `${CLOUDFLARE_API}/accounts/${encodeURIComponent(accountId)}/queues/${encodeURIComponent(queueId)}/messages/batch`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{
          body: { actionId: input.actionId, tenantId: input.tenantId },
          content_type: 'json',
          delay_seconds: delaySeconds,
        }],
      }),
    },
  );
  const payload = await response.json().catch(() => null) as {
    success?: boolean;
    errors?: Array<{ message?: string }>;
  } | null;
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.errors?.[0]?.message ?? 'Enterprise AI delivery queue rejected the message.');
  }
  return { queued: true as const };
}

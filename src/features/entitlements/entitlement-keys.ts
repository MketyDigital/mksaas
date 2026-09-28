export const ENTITLEMENT_KEYS = [
  'workspace.ai',
  'workspace.automation',
  'workspace.deploy',
  'workspace.agents',
  'workspace.workflows',
  'workspace.knowledge',
  'workspace.integrations',
  'workspace.trading.enterprise',
  'workspace.mail',
  'workspace.ai.enterprise',
  'ai.api',
  'ai.byok',
  'ai.private_model',
  'ai.channel.website',
  'ai.channel.telegram',
  'ai.channel.whatsapp',
  'ai.channel.instagram',
  'ai.channel.facebook_messenger',
  'ai.channel.slack',
  'ai.channel.microsoft_teams',
  'ai.channel.custom_webhook',
  'ai.whitelabel',
  'ai.domain.purchase',
  'ai.provider.gemini',
  'ai.provider.anthropic',
] as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

const ENTITLEMENT_KEY_SET = new Set<string>(ENTITLEMENT_KEYS);

export function isEntitlementKey(value: string): value is EntitlementKey {
  return ENTITLEMENT_KEY_SET.has(value);
}

import type { EntitlementKey } from '@/features/entitlements/entitlement-keys';

export const ENTERPRISE_AI_CONTRACT_ENTITLEMENTS = [
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
  'ai.channel.discord',
  'ai.channel.linkedin_page',
  'ai.channel.microsoft_teams',
  'ai.channel.custom_webhook',
  'ai.whitelabel',
  'ai.domain.purchase',
  'ai.provider.gemini',
  'ai.provider.anthropic',
] as const satisfies readonly EntitlementKey[];

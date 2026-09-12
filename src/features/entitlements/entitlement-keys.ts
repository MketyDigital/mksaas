export const ENTITLEMENT_KEYS = [
  'workspace.agents',
  'workspace.workflows',
  'workspace.knowledge',
  'workspace.integrations',
  'workspace.trading.enterprise',
  'ai.provider.gemini',
  'ai.provider.anthropic',
] as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

const ENTITLEMENT_KEY_SET = new Set<string>(ENTITLEMENT_KEYS);

export function isEntitlementKey(value: string): value is EntitlementKey {
  return ENTITLEMENT_KEY_SET.has(value);
}

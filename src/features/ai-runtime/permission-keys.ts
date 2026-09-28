export const AI_PERMISSION_KEYS = [
  'ai:workspace:view',
  'ai:agents:manage',
  'ai:knowledge:manage',
  'ai:api_keys:manage',
  'ai:models:manage',
  'ai:routes:manage',
  'ai:channels:manage',
  'ai:billing:view',
  'ai:billing:manage',
  'ai:usage:view',
  'ai:enterprise:admin',
] as const;

export type AiPermissionKey = (typeof AI_PERMISSION_KEYS)[number];

export function isAiPermissionKey(value: string): value is AiPermissionKey {
  return (AI_PERMISSION_KEYS as readonly string[]).includes(value);
}

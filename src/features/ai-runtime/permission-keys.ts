export const AI_PERMISSION_KEYS = [
  'ai:read',
  'ai:agents:manage',
  'ai:keys:manage',
  'ai:models:read',
  'ai:models:manage',
  'ai:knowledge:manage',
  'ai:channels:manage',
  'ai:usage:read',
  'ai:billing:manage',
  'ai:security:manage',
] as const;

export type AiPermissionKey = (typeof AI_PERMISSION_KEYS)[number];

export function isAiPermissionKey(value: string): value is AiPermissionKey {
  return (AI_PERMISSION_KEYS as readonly string[]).includes(value);
}

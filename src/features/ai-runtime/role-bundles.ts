import type { AiPermissionKey } from './permission-keys';

export const AI_ROLE_BUNDLES = {
  builder: [
    'ai:read',
    'ai:agents:manage',
    'ai:knowledge:manage',
    'ai:usage:read',
  ],
  developer: [
    'ai:read',
    'ai:keys:manage',
    'ai:models:read',
    'ai:usage:read',
  ],
  knowledge_manager: [
    'ai:read',
    'ai:knowledge:manage',
  ],
  channel_manager: [
    'ai:read',
    'ai:channels:manage',
    'ai:usage:read',
  ],
  billing_admin: [
    'ai:read',
    'ai:usage:read',
    'ai:billing:manage',
  ],
  security_admin: [
    'ai:read',
    'ai:models:read',
    'ai:security:manage',
  ],
  analyst: [
    'ai:read',
    'ai:models:read',
    'ai:usage:read',
  ],
} as const satisfies Record<string, readonly AiPermissionKey[]>;

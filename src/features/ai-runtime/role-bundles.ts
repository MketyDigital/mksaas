import type { AiPermissionKey } from './permission-keys';

export const AI_ROLE_BUNDLES = {
  builder: ['ai:workspace:view', 'ai:agents:manage', 'ai:knowledge:manage', 'ai:usage:view'],
  developer: ['ai:workspace:view', 'ai:api_keys:manage', 'ai:usage:view'],
  knowledge_manager: ['ai:workspace:view', 'ai:knowledge:manage'],
  channel_manager: ['ai:workspace:view', 'ai:channels:manage', 'ai:usage:view'],
  billing_admin: ['ai:workspace:view', 'ai:billing:view', 'ai:billing:manage', 'ai:usage:view'],
  analyst: ['ai:workspace:view', 'ai:billing:view', 'ai:usage:view'],
  enterprise_admin: [
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
  ],
} as const satisfies Record<string, readonly AiPermissionKey[]>;

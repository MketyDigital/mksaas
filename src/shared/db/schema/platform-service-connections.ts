import { index, jsonb, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { appSchema } from './schema';

export const platformServiceConnections = appSchema.table(
  'platform_service_connections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    serviceKey: varchar('service_key', { length: 80 }).notNull(),
    providerKey: varchar('provider_key', { length: 80 }).notNull(),
    mode: varchar('mode', { length: 32 }).notNull().default('production'),
    secretRef: text('secret_ref'),
    endpointUrl: text('endpoint_url'),
    status: varchar('status', { length: 32 }).notNull().default('disabled'),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    updatedByUserId: text('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('platform_service_connections_service_provider_mode_uidx')
      .on(table.serviceKey, table.providerKey, table.mode),
    index('platform_service_connections_service_status_idx')
      .on(table.serviceKey, table.status),
  ],
);

export type PlatformServiceConnection = typeof platformServiceConnections.$inferSelect;

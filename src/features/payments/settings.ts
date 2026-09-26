import { eq } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { platformAppControlCenterModules } from '@/shared/db/schema/platform-app-experience';

import {
  DEFAULT_MKETY_PAYMENT_SETTINGS,
  normalizeMketyPaymentSettings,
  type MketyPaymentSettings,
} from './config';

export async function getMketyPaymentSettings(): Promise<MketyPaymentSettings> {
  try {
    const row = await db.query.platformAppControlCenterModules.findFirst({
      where: eq(platformAppControlCenterModules.moduleKey, 'payments'),
    });
    if (!row) return DEFAULT_MKETY_PAYMENT_SETTINGS;

    const metadata =
      row.metadataJson && typeof row.metadataJson === 'object' && !Array.isArray(row.metadataJson)
        ? (row.metadataJson as Record<string, unknown>)
        : {};

    return normalizeMketyPaymentSettings(metadata.paymentConfig);
  } catch {
    return DEFAULT_MKETY_PAYMENT_SETTINGS;
  }
}

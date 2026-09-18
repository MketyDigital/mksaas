import type { TenantBillingSummary } from '@/features/billing/server/queries';
import type { CreditBalance } from '@/features/usage-credits/types';

export interface WalletReadSource {
  getBillingSummary(tenantId: string): Promise<TenantBillingSummary | null>;
  getProductCreditBalance(tenantId: string): Promise<CreditBalance | null>;
}

export interface TenantWalletSummary {
  billing: TenantBillingSummary | null;
  productCredits: CreditBalance | null;
}

export async function readTenantWalletSummary(
  source: WalletReadSource,
  tenantId: string,
): Promise<TenantWalletSummary> {
  const [billing, productCredits] = await Promise.all([
    source.getBillingSummary(tenantId),
    source.getProductCreditBalance(tenantId),
  ]);

  return { billing, productCredits };
}

let defaultSourcePromise: Promise<WalletReadSource> | null = null;

async function getDefaultSource(): Promise<WalletReadSource> {
  defaultSourcePromise ??= import('./drizzle-source').then(({ drizzleWalletReadSource }) => drizzleWalletReadSource);
  return defaultSourcePromise;
}

export async function getTenantWalletSummary(tenantId: string): Promise<TenantWalletSummary> {
  return readTenantWalletSummary(await getDefaultSource(), tenantId);
}

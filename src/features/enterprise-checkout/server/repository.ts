import { eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import { platformEnterpriseOrders } from '@/shared/db/schema';
import type { NewPlatformEnterpriseOrder, PlatformEnterpriseOrder } from '@/shared/db/schema/platform-enterprise-orders';

export interface EnterpriseOrderRepository {
  findByIdempotencyKey(idempotencyKey: string): Promise<PlatformEnterpriseOrder | null>;
  createOrder(input: NewPlatformEnterpriseOrder): Promise<PlatformEnterpriseOrder>;
  updateCheckout(input: {
    orderId: string;
    checkoutStatus: string;
    providerCheckoutReference?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  findById(orderId: string): Promise<PlatformEnterpriseOrder | null>;
}

export const enterpriseOrderRepository: EnterpriseOrderRepository = {
  async findByIdempotencyKey(idempotencyKey) {
    return (await db.query.platformEnterpriseOrders.findFirst({
      where: eq(platformEnterpriseOrders.idempotencyKey, idempotencyKey),
    })) ?? null;
  },

  async createOrder(input) {
    const [order] = await db.insert(platformEnterpriseOrders).values(input).returning();
    if (!order) throw new Error('Enterprise order creation failed.');
    return order;
  },

  async updateCheckout(input) {
    const existing = await this.findById(input.orderId);
    if (!existing) throw new Error('Enterprise order not found.');

    await db
      .update(platformEnterpriseOrders)
      .set({
        checkoutStatus: input.checkoutStatus,
        providerCheckoutReference: input.providerCheckoutReference ?? existing.providerCheckoutReference,
        metadata: { ...(existing.metadata ?? {}), ...(input.metadata ?? {}) },
        updatedAt: new Date(),
      })
      .where(eq(platformEnterpriseOrders.id, input.orderId));
  },

  async findById(orderId) {
    return (await db.query.platformEnterpriseOrders.findFirst({
      where: eq(platformEnterpriseOrders.id, orderId),
    })) ?? null;
  },
};

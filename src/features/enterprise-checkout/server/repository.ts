import { eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import { platformEnterpriseOrders } from '@/shared/db/schema';
import type {
  NewPlatformEnterpriseOrder,
  PlatformEnterpriseOrder,
} from '@/shared/db/schema/platform-enterprise-orders';

export interface EnterpriseOrderRepository {
  findByIdempotencyKey(idempotencyKey: string): Promise<PlatformEnterpriseOrder | null>;
  createOrder(input: NewPlatformEnterpriseOrder): Promise<PlatformEnterpriseOrder>;
  updateCheckout(input: {
    orderId: string;
    checkoutStatus: string;
    providerCheckoutReference?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  applyPaymentState(input: {
    orderId: string;
    paymentStatus: 'pending' | 'confirmed' | 'failed';
    checkoutStatus: 'awaiting_confirmation' | 'completed' | 'failed';
    providerPaymentReference?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PlatformEnterpriseOrder>;
  findById(orderId: string): Promise<PlatformEnterpriseOrder | null>;
}

export const enterpriseOrderRepository: EnterpriseOrderRepository = {
  async findByIdempotencyKey(idempotencyKey) {
    return (
      (await db.query.platformEnterpriseOrders.findFirst({
        where: eq(platformEnterpriseOrders.idempotencyKey, idempotencyKey),
      })) ?? null
    );
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

  async applyPaymentState(input) {
    const existing = await this.findById(input.orderId);
    if (!existing) throw new Error('Enterprise order not found.');

    if (existing.paymentStatus === 'confirmed') return existing;

    const [updated] = await db
      .update(platformEnterpriseOrders)
      .set({
        paymentStatus: input.paymentStatus,
        checkoutStatus: input.checkoutStatus,
        providerPaymentReference: input.providerPaymentReference ?? existing.providerPaymentReference,
        metadata: { ...(existing.metadata ?? {}), ...(input.metadata ?? {}) },
        confirmedAt: input.paymentStatus === 'confirmed' ? new Date() : existing.confirmedAt,
        updatedAt: new Date(),
      })
      .where(eq(platformEnterpriseOrders.id, input.orderId))
      .returning();

    if (!updated) throw new Error('Enterprise payment update failed.');
    return updated;
  },

  async findById(orderId) {
    return (
      (await db.query.platformEnterpriseOrders.findFirst({
        where: eq(platformEnterpriseOrders.id, orderId),
      })) ?? null
    );
  },
};

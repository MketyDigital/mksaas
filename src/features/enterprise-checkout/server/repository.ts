import { eq } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { mailEnterpriseOffers, mailWorkspaces, platformEnterpriseOrders, tenantEntitlementOverrides, tenants } from '@/shared/db/schema';
import type {
  NewPlatformEnterpriseOrder,
  PlatformEnterpriseOrder,
} from '@/shared/db/schema/platform-enterprise-orders';
import { MAIL_ENTERPRISE_CUSTOM_PROFILE_KEY } from '@/features/mail/server/commercial';
import { prepareMailEnterpriseOfferActivation } from '@/features/mail/server/enterprise-offer-settlement-core';
import { sendPlatformMail } from '@/features/mail/server/platform-sender';

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
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(platformEnterpriseOrders)
        .where(eq(platformEnterpriseOrders.id, input.orderId))
        .for('update')
        .limit(1);
      if (!existing) throw new Error('Enterprise order not found.');
      if (existing.paymentStatus === 'confirmed') return existing;

      const [updated] = await tx
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

      const offerId = updated.metadata?.mailEnterpriseOfferId;
      if (updated.paymentStatus === 'confirmed' && typeof offerId === 'string') {
        const [offer] = await tx
          .select()
          .from(mailEnterpriseOffers)
          .where(eq(mailEnterpriseOffers.id, offerId))
          .for('update')
          .limit(1);
        if (!offer) throw new Error('Paid Mail Enterprise offer was not found.');
        const activation = prepareMailEnterpriseOfferActivation(offer, updated, updated.confirmedAt ?? new Date());
        if (activation) {
          await tx.update(mailEnterpriseOffers).set({
            status: 'active',
            paidAt: activation.paidAt,
            startsAt: activation.startsAt,
            endsAt: activation.endsAt,
            updatedAt: new Date(),
          }).where(eq(mailEnterpriseOffers.id, offer.id));

          await tx.insert(tenantEntitlementOverrides).values({
            tenantId: offer.tenantId,
            entitlementKey: 'workspace.mail',
            effect: 'grant',
            reason: `Paid Mail Enterprise offer ${offer.name}; order ${updated.id}.`,
            source: `mail-enterprise-offer:${offer.id}`,
            expiresAt: activation.endsAt,
            actorUserId: offer.createdByUserId,
          });

          const [workspace] = await tx
            .select({ id: mailWorkspaces.id, status: mailWorkspaces.status })
            .from(mailWorkspaces)
            .where(eq(mailWorkspaces.tenantId, offer.tenantId))
            .for('update')
            .limit(1);
          if (workspace && workspace.status !== 'suspended') {
            await tx.update(mailWorkspaces).set({ planKey: MAIL_ENTERPRISE_CUSTOM_PROFILE_KEY, updatedAt: new Date() })
              .where(eq(mailWorkspaces.id, workspace.id));
          } else if (!workspace) {
            await tx.insert(mailWorkspaces).values({
              tenantId: offer.tenantId,
              status: 'active',
              planKey: MAIL_ENTERPRISE_CUSTOM_PROFILE_KEY,
              onboardingStep: 'domain',
              enabledByUserId: offer.createdByUserId,
            });
          }
        }
      }
      return updated;
    });

    const offerId = updated.metadata?.mailEnterpriseOfferId;
    if (updated.paymentStatus === 'confirmed' && typeof offerId === 'string') {
      const [offer, tenant] = await Promise.all([
        db.query.mailEnterpriseOffers.findFirst({ where: eq(mailEnterpriseOffers.id, offerId) }),
        db.query.tenants.findFirst({ where: eq(tenants.id, String(updated.metadata?.mailEnterpriseTenantId ?? '')) }),
      ]);
      if (offer?.status === 'active' && tenant) {
        await sendPlatformMail({
          category: 'payment',
          to: updated.email,
          subject: 'Your Mkety Mail Enterprise access is ready',
          text: [
            `Payment for ${offer.name} is confirmed.`,
            `Your Mkety Mail access is available at https://app.mkety.com/app/${tenant.slug}/mail.`,
            'Sign in with the verified workspace account used for this offer.',
          ].join('\n\n'),
          idempotencyKey: `mail-enterprise-payment:${offer.id}:${updated.id}`,
        }).catch(() => undefined);
      }
    }
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

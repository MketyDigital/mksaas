import type { MailEnterpriseOffer } from '@/shared/db/schema/mail-enterprise-offers';
import type { PlatformEnterpriseOrder } from '@/shared/db/schema/platform-enterprise-orders';

export function prepareMailEnterpriseOfferActivation(
  offer: MailEnterpriseOffer,
  order: PlatformEnterpriseOrder,
  paidAt = new Date(),
) {
  if (!['flutterwave', 'kora'].includes(order.paymentProvider)) {
    throw new Error('Mail Enterprise offers require a verified Flutterwave or Kora settlement.');
  }
  if (order.metadata?.mailEnterpriseOfferId !== offer.id || offer.orderId !== order.id) {
    throw new Error('Mail Enterprise offer payment does not match the issued order.');
  }
  if (offer.tenantId !== order.metadata?.mailEnterpriseTenantId) {
    throw new Error('Mail Enterprise offer payment tenant does not match the order.');
  }
  if (order.amountMinor !== offer.amountMinor || order.currency !== offer.currency) {
    throw new Error('Mail Enterprise offer amount does not match the issued order.');
  }
  if (offer.status === 'active') return null;
  if (offer.status !== 'awaiting_payment') throw new Error('Mail Enterprise offer is not payable.');

  const endsAt = offer.termDays === null ? null : new Date(paidAt.getTime() + offer.termDays * 86_400_000);
  return { startsAt: paidAt, paidAt, endsAt };
}

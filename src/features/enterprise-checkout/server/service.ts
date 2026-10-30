import { enterpriseOrderRepository } from './repository';
import type { EnterpriseOrderRepository } from './repository';
import { parseEnterpriseCheckoutInput } from '../domain';
import type { EnterpriseCheckoutResult, EnterprisePaymentProvider } from '../domain';
import { getEnterprisePaymentProvider } from '../providers/registry';
import type { EnterpriseCheckoutProviderAdapter } from '../providers/types';
import { createEnterprisePaymentCapability, hashEnterprisePaymentToken, isEnterprisePaymentCapabilityActive } from './payment-capability';

interface EnterpriseCheckoutRequestContext {
  idempotencyKey: string;
  mailEnterpriseOfferId?: string;
  mailEnterpriseTenantId?: string;
  onOrderCreated?: (orderId: string) => Promise<void>;
  onCheckoutFailed?: (orderId: string) => Promise<void>;
  deferNowPaymentsInvoice?: boolean;
}

interface EnterpriseCheckoutServiceDependencies {
  repository?: EnterpriseOrderRepository;
  getProvider?: (provider: EnterprisePaymentProvider) => EnterpriseCheckoutProviderAdapter;
  createOrderId?: () => string;
}

function createRequestFingerprint(
  input: ReturnType<typeof parseEnterpriseCheckoutInput>,
  mailEnterpriseOfferId?: string,
  mailEnterpriseTenantId?: string,
): string {
  return JSON.stringify({
    customer: input.customer,
    project: input.project,
    amountMinor: input.amountMinor.toString(),
    currency: input.currency,
    provider: input.provider,
    mailEnterpriseOfferId: mailEnterpriseOfferId ?? null,
    mailEnterpriseTenantId: mailEnterpriseTenantId ?? null,
  });
}

function replayResult(
  order: Awaited<ReturnType<EnterpriseOrderRepository['findByIdempotencyKey']>>,
): EnterpriseCheckoutResult {
  if (!order) throw new Error('Enterprise order not found.');
  const redirectUrl = typeof order.metadata?.redirectUrl === 'string' ? order.metadata.redirectUrl : null;
  if (!redirectUrl) throw new Error('Existing enterprise checkout cannot be resumed safely.');

  return {
    orderId: order.id,
    provider: order.paymentProvider as EnterprisePaymentProvider,
    redirectUrl,
    status: order.checkoutStatus === 'awaiting_confirmation' ? 'awaiting_confirmation' : 'checkout_created',
  };
}

export function createEnterpriseCheckoutService(dependencies: EnterpriseCheckoutServiceDependencies = {}) {
  const repository = dependencies.repository ?? enterpriseOrderRepository;
  const getProvider = dependencies.getProvider ?? getEnterprisePaymentProvider;
  const createOrderId = dependencies.createOrderId ?? (() => `MKETY-ENT-${crypto.randomUUID()}`);

  return {
    async createEnterpriseCheckout(
      rawInput: unknown,
      context: EnterpriseCheckoutRequestContext,
    ): Promise<EnterpriseCheckoutResult> {
      if (!context.idempotencyKey || context.idempotencyKey.length < 8 || context.idempotencyKey.length > 200) {
        throw new Error('A valid idempotency key is required.');
      }

      const input = parseEnterpriseCheckoutInput(rawInput);
      const requestFingerprint = createRequestFingerprint(
        input,
        context.mailEnterpriseOfferId,
        context.mailEnterpriseTenantId,
      );
      const existing = await repository.findByIdempotencyKey(context.idempotencyKey);

      if (existing) {
        const existingFingerprint = existing.metadata?.requestFingerprint;
        if (typeof existingFingerprint === 'string' && existingFingerprint !== requestFingerprint) {
          throw new Error('Idempotency key conflicts with a different checkout request.');
        }
        return replayResult(existing);
      }

      const orderId = createOrderId();
      const capability = context.deferNowPaymentsInvoice && input.provider === 'nowpayments'
        ? await createEnterprisePaymentCapability()
        : null;
      const redirectUrl = capability
        ? `https://mkety.com/payment/enterprise/checkout?token=${capability.token}`
        : null;
      await repository.createOrder({
        id: orderId,
        customerName: input.customer.fullName,
        companyName: input.customer.companyName,
        email: input.customer.email,
        phone: input.customer.phone,
        country: input.customer.country,
        scopeId: input.project.scopeId,
        projectName: input.project.name,
        projectDescription: input.project.description,
        amountMinor: input.amountMinor,
        currency: input.currency,
        paymentProvider: input.provider,
        checkoutStatus: capability ? 'awaiting_payment_selection' : 'created',
        paymentStatus: 'pending',
        idempotencyKey: context.idempotencyKey,
        checkoutTokenHash: capability?.tokenHash ?? null,
        checkoutTokenExpiresAt: capability?.expiresAt ?? null,
        metadata: {
          requestFingerprint,
          ...(redirectUrl ? { redirectUrl, paymentFlow: 'deferred_nowpayments_invoice' } : {}),
          ...(context.mailEnterpriseOfferId ? { mailEnterpriseOfferId: context.mailEnterpriseOfferId } : {}),
          ...(context.mailEnterpriseTenantId ? { mailEnterpriseTenantId: context.mailEnterpriseTenantId } : {}),
        },
      });

      if (capability && redirectUrl) {
        return { orderId, provider: input.provider, redirectUrl, status: 'checkout_created' };
      }

      try {
        if (context.onOrderCreated) await context.onOrderCreated(orderId);
        const provider = getProvider(input.provider);
        const providerResult = await provider.createCheckout({ ...input, orderId });
        await repository.updateCheckout({
          orderId,
          checkoutStatus: providerResult.status === 'awaiting_confirmation' ? 'awaiting_confirmation' : 'redirected',
          providerCheckoutReference: providerResult.providerCheckoutReference,
          metadata: { redirectUrl: providerResult.redirectUrl },
        });

        return {
          orderId,
          provider: input.provider,
          redirectUrl: providerResult.redirectUrl,
          status: providerResult.status,
        };
      } catch {
        await repository
          .updateCheckout({
            orderId,
            checkoutStatus: 'failed',
            metadata: { providerInitiationFailed: true },
          })
          .catch(() => undefined);
        let cleanupFailed = false;
        try {
          await context.onCheckoutFailed?.(orderId);
        } catch {
          cleanupFailed = true;
        }
        if (cleanupFailed) {
          throw new Error('Enterprise checkout failed and requires operator review.');
        }
        throw new Error('Enterprise checkout is temporarily unavailable.');
      }
    },

    async startNowPaymentsInvoice(input: { token: string; payCurrency: string }) {
      const tokenHash = await hashEnterprisePaymentToken(input.token);
      const order = await repository.findByCheckoutTokenHash(tokenHash);
      if (!order || !isEnterprisePaymentCapabilityActive({ tokenHash: order.checkoutTokenHash, expiresAt: order.checkoutTokenExpiresAt })) {
        throw new Error('Enterprise payment link is invalid or expired.');
      }
      if (order.paymentProvider !== 'nowpayments') throw new Error('Payment link is invalid.');

      const savedInvoice = typeof order.metadata?.invoiceRedirectUrl === 'string' ? order.metadata.invoiceRedirectUrl : null;
      if (savedInvoice) return { redirectUrl: savedInvoice, status: 'ready' as const };
      if (order.checkoutStatus !== 'awaiting_payment_selection') {
        throw new Error('Payment checkout is already being prepared or requires operator review.');
      }

      const payCurrency = input.payCurrency.trim().toUpperCase();
      if (!/^[A-Z0-9]{2,24}$/.test(payCurrency)) throw new Error('Payment currency is invalid.');
      const claimed = await repository.beginInvoiceCreation(order.id, payCurrency);
      if (!claimed) throw new Error('Payment checkout is already being prepared or requires operator review.');

      try {
        const provider = getProvider('nowpayments');
        const providerResult = await provider.createCheckout({
          orderId: order.id,
          customer: { fullName: order.customerName, companyName: order.companyName, email: order.email,
            ...(order.phone ? { phone: order.phone } : {}), ...(order.country ? { country: order.country } : {}) },
          project: { scopeId: order.scopeId ?? undefined, name: order.projectName,
            ...(order.projectDescription ? { description: order.projectDescription } : {}) },
          amountMinor: order.amountMinor,
          currency: 'USD',
          provider: 'nowpayments',
          payCurrency,
        });
        await repository.updateCheckout({
          orderId: order.id,
          checkoutStatus: 'redirected',
          providerCheckoutReference: providerResult.providerCheckoutReference,
          metadata: { invoiceRedirectUrl: providerResult.redirectUrl, invoiceCreatedAt: new Date().toISOString() },
        });
        return { redirectUrl: providerResult.redirectUrl, status: 'ready' as const };
      } catch {
        await repository.updateCheckout({
          orderId: order.id,
          checkoutStatus: 'invoice_creation_unknown',
          metadata: { invoiceCreationRequiresOperatorReview: true },
        }).catch(() => undefined);
        throw new Error('Payment checkout could not be confirmed. Contact Mkety support before retrying.');
      }
    },
  };
}

export const enterpriseCheckoutService = createEnterpriseCheckoutService();

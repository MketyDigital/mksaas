import { parseEnterpriseCheckoutInput } from '../domain';
import type { EnterpriseCheckoutResult, EnterprisePaymentProvider } from '../domain';
import { getEnterprisePaymentProvider } from '../providers/registry';
import type { EnterpriseCheckoutProviderAdapter } from '../providers/types';
import { enterpriseOrderRepository } from './repository';
import type { EnterpriseOrderRepository } from './repository';

interface EnterpriseCheckoutRequestContext {
  idempotencyKey: string;
}

interface EnterpriseCheckoutServiceDependencies {
  repository?: EnterpriseOrderRepository;
  getProvider?: (provider: EnterprisePaymentProvider) => EnterpriseCheckoutProviderAdapter;
  createOrderId?: () => string;
}

function createRequestFingerprint(input: ReturnType<typeof parseEnterpriseCheckoutInput>): string {
  return JSON.stringify({
    customer: input.customer,
    project: input.project,
    amountMinor: input.amountMinor.toString(),
    currency: input.currency,
    provider: input.provider,
  });
}

function replayResult(order: Awaited<ReturnType<EnterpriseOrderRepository['findByIdempotencyKey']>>): EnterpriseCheckoutResult {
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
    async createEnterpriseCheckout(rawInput: unknown, context: EnterpriseCheckoutRequestContext): Promise<EnterpriseCheckoutResult> {
      if (!context.idempotencyKey || context.idempotencyKey.length < 8 || context.idempotencyKey.length > 200) {
        throw new Error('A valid idempotency key is required.');
      }

      const input = parseEnterpriseCheckoutInput(rawInput);
      const requestFingerprint = createRequestFingerprint(input);
      const existing = await repository.findByIdempotencyKey(context.idempotencyKey);

      if (existing) {
        const existingFingerprint = existing.metadata?.requestFingerprint;
        if (typeof existingFingerprint === 'string' && existingFingerprint !== requestFingerprint) {
          throw new Error('Idempotency key conflicts with a different checkout request.');
        }
        return replayResult(existing);
      }

      const orderId = createOrderId();
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
        checkoutStatus: 'created',
        paymentStatus: 'pending',
        idempotencyKey: context.idempotencyKey,
        metadata: { requestFingerprint },
      });

      try {
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
        await repository.updateCheckout({
          orderId,
          checkoutStatus: 'failed',
          metadata: { providerInitiationFailed: true },
        }).catch(() => undefined);
        throw new Error('Enterprise checkout is temporarily unavailable.');
      }
    },
  };
}

export const enterpriseCheckoutService = createEnterpriseCheckoutService();

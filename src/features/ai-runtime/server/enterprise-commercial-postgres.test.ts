/** @jest-environment node */
import { eq } from 'drizzle-orm';
import * as conversations from '@/features/ai-runtime/channels/server/conversations';
import type { BillingGatewayAdapter } from '@/features/billing/gateways/types';
import { drizzleBillingCreditAllowanceSource } from '@/features/usage-credits/server/drizzle-source';
import * as schema from '@/shared/db/schema';
import { enterprisePostgres } from '@/test-utils/enterprise-postgres';
import { createEnterpriseAiContractCheckout, getEnterpriseAiContractBillingState } from './enterprise-contracts';
import { assertEnterpriseAiManagedCostEnvelope, getEnterpriseAiCostEnvelopeState } from './enterprise-cost-envelope';
import { applyEnterpriseAiFundingSettlement } from './enterprise-funding-settlement';

let mockDatabase: Awaited<ReturnType<typeof enterprisePostgres>>['database'];
jest.mock('@/shared/db', () => ({
  get db() {
    return mockDatabase;
  },
}));
jest.mock('@/shared/db/cloudflare', () => ({
  get db() {
    return mockDatabase;
  },
}));

let fixture: Awaited<ReturnType<typeof enterprisePostgres>>;
const tenant = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const start = new Date('2026-09-01T00:00:00Z');
const end = new Date('2050-10-01T00:00:00Z');
const now = new Date('2026-09-30T00:00:00Z');

async function customer(tenantId = tenant) {
  const [plan] = await mockDatabase
    .insert(schema.billingPlans)
    .values({ key: `enterprise-ai-contract-${tenantId}`, name: 'Enterprise', description: '' })
    .returning();
  const [version] = await mockDatabase
    .insert(schema.billingPlanVersions)
    .values({
      planId: plan.id,
      version: 1,
      effectiveFrom: start,
      amountMinor: 7000n,
      currency: 'USD',
      billingInterval: 'monthly',
    })
    .returning();
  await mockDatabase
    .insert(schema.aiEnterpriseCommercialPolicies)
    .values({
      planVersionId: version.id,
      minimumFundingMinor: 2500n,
      fundingMode: 'prepaid_partial',
      managedCostShareBps: 1500,
    });
  const [subscription] = await mockDatabase
    .insert(schema.billingSubscriptions)
    .values({
      tenantId,
      planVersionId: version.id,
      status: 'pending_payment',
      currentPeriodStart: start,
      currentPeriodEnd: end,
    })
    .returning();
  const [period] = await mockDatabase
    .insert(schema.billingPeriods)
    .values({
      tenantId,
      subscriptionId: subscription.id,
      periodStart: start,
      periodEnd: end,
      amountDueMinor: 7000n,
      currency: 'USD',
      dueAt: start,
    })
    .returning();
  const [checkout] = await mockDatabase
    .insert(schema.billingCheckouts)
    .values({
      tenantId,
      subscriptionId: subscription.id,
      billingPeriodId: period.id,
      provider: 'nowpayments',
      purpose: 'enterprise_ai_funding',
      amountExpectedMinor: 2500n,
      currency: 'USD',
    })
    .returning();
  await mockDatabase
    .insert(schema.billingPlanVersionCreditAllowances)
    .values({ planVersionId: version.id, creditAmount: 7000n, grantInterval: 'billing_period' });
  return { plan, version, subscription, period, checkout };
}
function settlement(checkoutId: string, identity = 'one') {
  return applyEnterpriseAiFundingSettlement({
    checkoutId,
    provider: 'nowpayments',
    providerPaymentId: `payment-${identity}`,
    providerEventId: `event-${identity}`,
    providerAmountPaidMinor: 2500n,
    providerCurrencyPaid: 'USD',
    rawReference: identity,
    occurredAt: now,
  });
}

beforeAll(async () => {
  fixture = await enterprisePostgres();
  mockDatabase = fixture.database;
});
beforeEach(async () => {
  await fixture.client.exec(
    'TRUNCATE saas_template.ai_scheduled_actions, saas_template.billing_plan_version_entitlements, saas_template.billing_plans, saas_template.billing_plan_versions, saas_template.billing_subscriptions, saas_template.billing_periods, saas_template.billing_checkouts, saas_template.billing_settlements, saas_template.billing_ledger_entries, saas_template.billing_plan_version_credit_allowances, saas_template.ai_enterprise_commercial_policies, saas_template.ai_requests, saas_template.tenant_credit_accounts, saas_template.credit_ledger_entries',
  );
});
afterAll(async () => {
  await fixture?.client.close();
});

it('grants proportional credits once on verified funding and identical replay', async () => {
  const c = await customer();
  await settlement(c.checkout.id);
  await settlement(c.checkout.id);
  const balance = await mockDatabase.query.tenantCreditAccounts.findFirst();
  expect(balance?.availableCredits).toBe(2500n);
  expect(await mockDatabase.select().from(schema.billingSettlements)).toHaveLength(1);
});
it('rejects a provider identity replay against another customer checkout', async () => {
  const a = await customer();
  const b = await customer(other);
  await settlement(a.checkout.id);
  await expect(settlement(b.checkout.id)).rejects.toThrow(/mismatch|conflict/i);
  const balance = await mockDatabase.query.tenantCreditAccounts.findFirst({
    where: eq(schema.tenantCreditAccounts.tenantId, other),
  });
  expect(balance).toBeUndefined();
});
it('does not reactivate a cancelled subscription on late verified funding', async () => {
  const c = await customer();
  await mockDatabase
    .update(schema.billingSubscriptions)
    .set({ status: 'cancelled' })
    .where(eq(schema.billingSubscriptions.id, c.subscription.id));
  await settlement(c.checkout.id);
  expect((await mockDatabase.query.billingSubscriptions.findFirst())?.status).toBe('cancelled');
});
it('does not move a subscription backwards when an old period receives funding', async () => {
  const c = await customer();
  const nextEnd = new Date('2050-11-01T00:00:00Z');
  await mockDatabase
    .update(schema.billingSubscriptions)
    .set({ status: 'active', currentPeriodStart: end, currentPeriodEnd: nextEnd })
    .where(eq(schema.billingSubscriptions.id, c.subscription.id));
  await settlement(c.checkout.id);
  expect((await mockDatabase.query.billingSubscriptions.findFirst())?.currentPeriodEnd).toEqual(nextEnd);
});
it('does not grant the ordinary monthly allowance on a prepaid-funded period', async () => {
  const c = await customer();
  await settlement(c.checkout.id);
  await mockDatabase
    .update(schema.billingPeriods)
    .set({ collectionStatus: 'paid' })
    .where(eq(schema.billingPeriods.id, c.period.id));
  await expect(drizzleBillingCreditAllowanceSource.getCurrentBillingCreditAllowance(tenant)).resolves.toBeNull();
});
it('keeps the Enterprise cost envelope when another active product is more recently updated', async () => {
  const c = await customer();
  await settlement(c.checkout.id);
  await mockDatabase
    .insert(schema.billingSubscriptions)
    .values({
      tenantId: tenant,
      planVersionId: crypto.randomUUID(),
      status: 'active',
      currentPeriodStart: start,
      currentPeriodEnd: end,
      updatedAt: new Date('2040-01-01'),
    });
  await expect(
    assertEnterpriseAiManagedCostEnvelope({ tenantId: tenant, estimatedAdditionalCostUsdMicros: 3750001n, now }),
  ).rejects.toThrow('exhausted');
});
it('includes the start instant and excludes the end instant of an Enterprise period', async () => {
  const c = await customer();
  await settlement(c.checkout.id);
  expect((await getEnterpriseAiCostEnvelopeState(tenant, start)).applicable).toBe(true);
  expect((await getEnterpriseAiCostEnvelopeState(tenant, end)).applicable).toBe(false);
});
it('fails closed when a live Enterprise subscription has no matching billing period', async () => {
  const c = await customer();
  await settlement(c.checkout.id);
  await mockDatabase.delete(schema.billingPeriods);
  await expect(
    assertEnterpriseAiManagedCostEnvelope({ tenantId: tenant, estimatedAdditionalCostUsdMicros: 1n, now }),
  ).rejects.toThrow(/period|unavailable/i);
});

async function request() {
  const requestId = crypto.randomUUID();
  await mockDatabase
    .insert(schema.aiRequests)
    .values({
      id: requestId,
      tenantId: tenant,
      idempotencyKey: requestId,
      modelAlias: 'mkety-economy',
      status: 'admitting',
      startedAt: now,
    });
  return { requestId };
}
it('reserves managed cost atomically so two parallel requests cannot spend the same capacity', async () => {
  const c = await customer();
  await settlement(c.checkout.id);
  const a = await request();
  const b = await request();
  const outcomes = await Promise.allSettled([
    assertEnterpriseAiManagedCostEnvelope({ tenantId: tenant, estimatedAdditionalCostUsdMicros: 2000000n, now, ...a }),
    assertEnterpriseAiManagedCostEnvelope({ tenantId: tenant, estimatedAdditionalCostUsdMicros: 2000000n, now, ...b }),
  ]);
  expect(outcomes.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.filter((value) => value.status === 'rejected')).toHaveLength(1);
});
it('keeps ambiguous provider spend reserved until reconciliation', async () => {
  const c = await customer();
  await settlement(c.checkout.id);
  const a = await request();
  await assertEnterpriseAiManagedCostEnvelope({
    tenantId: tenant,
    estimatedAdditionalCostUsdMicros: 2000000n,
    now,
    ...a,
  });
  await mockDatabase
    .update(schema.aiRequests)
    .set({ status: 'reconciliation_required' })
    .where(eq(schema.aiRequests.id, a.requestId));
  await expect(
    assertEnterpriseAiManagedCostEnvelope({
      tenantId: tenant,
      estimatedAdditionalCostUsdMicros: 2000000n,
      now,
      ...(await request()),
    }),
  ).rejects.toThrow('exhausted');
});
it('returns capacity for explicit no-dispatch failures and uses actual settled cost', async () => {
  const c = await customer();
  await settlement(c.checkout.id);
  const a = await request();
  await assertEnterpriseAiManagedCostEnvelope({
    tenantId: tenant,
    estimatedAdditionalCostUsdMicros: 2000000n,
    now,
    ...a,
  });
  await mockDatabase
    .update(schema.aiRequests)
    .set({ status: 'provider_unavailable' })
    .where(eq(schema.aiRequests.id, a.requestId));
  const b = await request();
  await assertEnterpriseAiManagedCostEnvelope({
    tenantId: tenant,
    estimatedAdditionalCostUsdMicros: 2000000n,
    now,
    ...b,
  });
  await mockDatabase
    .update(schema.aiRequests)
    .set({ status: 'completed', providerCostMetadata: { providerCostUsdMicros: '500000' } })
    .where(eq(schema.aiRequests.id, b.requestId));
  await expect(
    assertEnterpriseAiManagedCostEnvelope({
      tenantId: tenant,
      estimatedAdditionalCostUsdMicros: 3250000n,
      now,
      ...(await request()),
    }),
  ).resolves.toMatchObject({ applicable: true });
});

it('returns an arithmetic-safe funded amount to the customer dashboard', async () => {
  const c = await customer();
  await settlement(c.checkout.id);
  const state = await getEnterpriseAiContractBillingState(tenant);
  expect(state.fundedMinor).toBe(2500n);
  expect(state.contract!.amountMinor - state.fundedMinor!).toBe(4500n);
});
it('creates the remaining prepaid top-up checkout without bigint mixing', async () => {
  const c = await customer();
  await settlement(c.checkout.id);
  const adapter: BillingGatewayAdapter = {
    capabilities: {
      supportsRecurring: false,
      supportsAutoCharge: false,
      supportsHostedSubscription: false,
      supportsRecurringInvoice: false,
      supportsWebhookVerification: true,
      supportsRefunds: false,
      supportsPartialPayment: true,
      supportsMultipleCurrencies: false,
    },
    verifyIncomingEvent: async () => {
      throw new Error('not used by checkout test');
    },
    normalizeSettlement: () => {
      throw new Error('not used by checkout test');
    },
    provider: 'nowpayments',
    createCheckout: async () => ({
      provider: 'nowpayments',
      providerCheckoutId: 'topup',
      checkoutUrl: 'https://payments.example.com/topup',
    }),
  };
  await expect(
    createEnterpriseAiContractCheckout({
      tenantId: tenant,
      adapter,
      returnUrl: 'https://app.example.com',
      cancelUrl: 'https://app.example.com',
      fundingAmountMinor: 4500n,
      now,
    }),
  ).resolves.toMatchObject({ amountExpectedMinor: 4500n });
});
it('does not let a stale claimant overwrite the newer attempt or cancellation', async () => {
  const id = crypto.randomUUID();
  await mockDatabase
    .insert(schema.aiScheduledActions)
    .values({
      id,
      tenantId: tenant,
      connectionId: crypto.randomUUID(),
      kind: 'inbound_retry',
      idempotencyKey: id,
      status: 'claimed',
      attempts: 2,
      claimUntil: new Date(now.getTime() + 60000),
      dueAt: now,
    });
  const begin = (
    conversations as unknown as {
      beginEnterpriseAiScheduledActionDispatch: (
        id: string,
        tenantId: string,
        attempts: number,
        now: Date,
      ) => Promise<boolean>;
    }
  ).beginEnterpriseAiScheduledActionDispatch;
  expect(await begin(id, tenant, 1, now)).toBe(false);
  expect((await mockDatabase.query.aiScheduledActions.findFirst())?.status).toBe('claimed');
  await mockDatabase
    .update(schema.aiScheduledActions)
    .set({ status: 'cancelled' })
    .where(eq(schema.aiScheduledActions.id, id));
  expect(await begin(id, tenant, 2, now)).toBe(false);
  expect((await mockDatabase.query.aiScheduledActions.findFirst())?.status).toBe('cancelled');
});
it('only allows one dispatch transition for the active queue claim', async () => {
  const id = crypto.randomUUID();
  await mockDatabase
    .insert(schema.aiScheduledActions)
    .values({
      id,
      tenantId: tenant,
      connectionId: crypto.randomUUID(),
      kind: 'inbound_retry',
      idempotencyKey: id,
      status: 'claimed',
      attempts: 1,
      claimUntil: new Date(now.getTime() + 60000),
      dueAt: now,
    });
  const begin = (
    conversations as unknown as {
      beginEnterpriseAiScheduledActionDispatch: (
        id: string,
        tenantId: string,
        attempts: number,
        now: Date,
      ) => Promise<boolean>;
    }
  ).beginEnterpriseAiScheduledActionDispatch;
  const result = await Promise.all([begin(id, tenant, 1, now), begin(id, tenant, 1, now)]);
  expect(result.filter(Boolean)).toHaveLength(1);
});

it('fails closed when a customer contract loses its managed commercial policy', async () => {
  const c = await customer();
  await settlement(c.checkout.id);
  await mockDatabase.delete(schema.aiEnterpriseCommercialPolicies);
  await expect(
    assertEnterpriseAiManagedCostEnvelope({ tenantId: tenant, estimatedAdditionalCostUsdMicros: 1n, now }),
  ).rejects.toThrow(/policy|unavailable/i);
});

it('combines independently verified parallel top-ups without losing collection status or credits', async () => {
  const c = await customer();
  const [second] = await mockDatabase
    .insert(schema.billingCheckouts)
    .values({
      tenantId: tenant,
      subscriptionId: c.subscription.id,
      billingPeriodId: c.period.id,
      provider: 'nowpayments',
      purpose: 'enterprise_ai_funding',
      amountExpectedMinor: 4500n,
      currency: 'USD',
    })
    .returning();
  await Promise.all([
    settlement(c.checkout.id),
    applyEnterpriseAiFundingSettlement({
      checkoutId: second.id,
      provider: 'nowpayments',
      providerPaymentId: 'payment-two',
      providerEventId: 'event-two',
      providerAmountPaidMinor: 4500n,
      providerCurrencyPaid: 'USD',
      rawReference: 'two',
      occurredAt: now,
    }),
  ]);
  expect((await mockDatabase.query.billingPeriods.findFirst())?.collectionStatus).toBe('paid');
  expect((await mockDatabase.query.tenantCreditAccounts.findFirst())?.availableCredits).toBe(7000n);
});
it('does not cancel previously funded access when a later top-up provider fails', async () => {
  const c = await customer();
  await settlement(c.checkout.id);
  const adapter = {
    provider: 'nowpayments',
    createCheckout: async () => {
      throw new Error('provider_checkout_failed');
    },
  } as unknown as BillingGatewayAdapter;
  await expect(
    createEnterpriseAiContractCheckout({
      tenantId: tenant,
      adapter,
      returnUrl: 'https://app.example.com',
      cancelUrl: 'https://app.example.com',
      fundingAmountMinor: 4500n,
      now,
    }),
  ).rejects.toThrow('provider_checkout_failed');
  expect((await mockDatabase.query.billingSubscriptions.findFirst())?.status).toBe('active');
  expect((await mockDatabase.query.tenantCreditAccounts.findFirst())?.availableCredits).toBe(2500n);
});

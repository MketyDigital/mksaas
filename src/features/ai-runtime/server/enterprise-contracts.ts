'use server';

import { addMonths } from 'date-fns';
import { and, desc, eq, isNull, like, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import type { BillingGatewayAdapter } from '@/features/billing/gateways/types';
import { ENTERPRISE_AI_CONTRACT_ENTITLEMENTS } from '@/features/ai-runtime/server/enterprise-contract-entitlements';
import { type EntitlementKey, isEntitlementKey } from '@/features/entitlements/entitlement-keys';
import { db } from '@/shared/db';
import {
  billingCheckouts,
  billingLedgerEntries,
  billingPeriods,
  billingPlans,
  billingPlanVersionCreditAllowances,
  billingPlanVersionEntitlements,
  billingPlanVersions,
  billingSettlements,
  billingSubscriptions,
  tenants,
} from '@/shared/db/schema';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

const CONTRACT_PREFIX = 'enterprise-ai-contract-';


function contractPlanKey(tenantId: string) {
  return `${CONTRACT_PREFIX}${tenantId}`;
}

function parseUsdMinor(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim();
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error('Enter a valid monthly USD amount.');
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const amount = BigInt(match[1]) * 100n + BigInt(fraction || '0');
  if (amount <= 0n) throw new Error('Monthly price must be greater than zero.');
  return amount;
}

function parseCredits(value: FormDataEntryValue | null) {
  const text = String(value ?? '0').trim();
  if (!/^\d{1,15}$/.test(text)) throw new Error('Included credits must be a whole number.');
  return BigInt(text);
}

function parseIncludedEntitlements(formData: FormData) {
  const requested = new Set(formData.getAll('entitlements').map((value) => String(value)));
  requested.add('workspace.ai.enterprise');
  return [...requested].filter((key): key is EntitlementKey =>
    isEntitlementKey(key) && (ENTERPRISE_AI_CONTRACT_ENTITLEMENTS as readonly string[]).includes(key),
  );
}

export async function createEnterpriseAiContractVersion(
  opsTenantSlug: string,
  formData: FormData,
) {
  await requirePermission(opsTenantSlug, 'platform:plans');
  const targetTenantSlug = String(formData.get('targetTenantSlug') ?? '').trim();
  const target = await getTenantBySlug(targetTenantSlug);
  if (!target) throw new Error('Target customer workspace was not found.');

  const amountMinor = parseUsdMinor(formData.get('monthlyPriceUsd'));
  const includedCredits = parseCredits(formData.get('includedCredits'));
  const entitlements = parseIncludedEntitlements(formData);
  const name = String(formData.get('name') ?? '').trim().slice(0, 255)
    || `${target.name} Enterprise AI`;
  const description = String(formData.get('description') ?? '').trim().slice(0, 2000)
    || 'Tenant-specific recurring Enterprise AI agreement.';

  await db.transaction(async (tx) => {
    const key = contractPlanKey(target.id);
    let plan = await tx.query.billingPlans.findFirst({ where: eq(billingPlans.key, key) });
    if (!plan) {
      const [created] = await tx.insert(billingPlans).values({
        key,
        name,
        description,
        status: 'active',
      }).returning();
      if (!created) throw new Error('Enterprise AI contract plan could not be created.');
      plan = created;
    } else {
      await tx.update(billingPlans).set({
        name,
        description,
        status: 'active',
        updatedAt: new Date(),
      }).where(eq(billingPlans.id, plan.id));
    }

    const [latest] = await tx
      .select({ id: billingPlanVersions.id, version: billingPlanVersions.version })
      .from(billingPlanVersions)
      .where(eq(billingPlanVersions.planId, plan.id))
      .orderBy(desc(billingPlanVersions.version))
      .limit(1);

    const now = new Date();
    await tx.update(billingPlanVersions).set({ effectiveTo: now }).where(and(
      eq(billingPlanVersions.planId, plan.id),
      isNull(billingPlanVersions.effectiveTo),
    ));

    const [version] = await tx.insert(billingPlanVersions).values({
      planId: plan.id,
      version: (latest?.version ?? 0) + 1,
      amountMinor,
      currency: 'USD',
      billingInterval: 'monthly',
      isPublic: false,
      metadataReference: `enterprise-ai-contract:${target.id}`,
      effectiveFrom: now,
    }).returning({ id: billingPlanVersions.id });
    if (!version) throw new Error('Enterprise AI contract version could not be created.');

    await tx.insert(billingPlanVersionEntitlements).values(
      entitlements.map((entitlementKey) => ({
        planVersionId: version.id,
        entitlementKey,
        enabled: true,
      })),
    );

    if (includedCredits > 0n) {
      await tx.insert(billingPlanVersionCreditAllowances).values({
        planVersionId: version.id,
        creditAmount: includedCredits,
        grantInterval: 'billing_period',
      });
    }
  });

  revalidatePath(`/t/${opsTenantSlug}/admin/platform-control/ai-operations`);
  revalidatePath(`/t/${target.slug}/enterprise-ai`);
}

export async function getActiveEnterpriseAiContract(tenantId: string) {
  const [row] = await db
    .select({
      planId: billingPlans.id,
      planKey: billingPlans.key,
      planName: billingPlans.name,
      planDescription: billingPlans.description,
      planVersionId: billingPlanVersions.id,
      version: billingPlanVersions.version,
      amountMinor: billingPlanVersions.amountMinor,
      currency: billingPlanVersions.currency,
      billingInterval: billingPlanVersions.billingInterval,
      effectiveFrom: billingPlanVersions.effectiveFrom,
    })
    .from(billingPlans)
    .innerJoin(billingPlanVersions, eq(billingPlanVersions.planId, billingPlans.id))
    .where(and(
      eq(billingPlans.key, contractPlanKey(tenantId)),
      eq(billingPlans.status, 'active'),
      isNull(billingPlanVersions.effectiveTo),
    ))
    .orderBy(desc(billingPlanVersions.version))
    .limit(1);

  if (!row) return null;

  const [entitlements, allowance] = await Promise.all([
    db.select({ key: billingPlanVersionEntitlements.entitlementKey })
      .from(billingPlanVersionEntitlements)
      .where(and(
        eq(billingPlanVersionEntitlements.planVersionId, row.planVersionId),
        eq(billingPlanVersionEntitlements.enabled, true),
      )),
    db.query.billingPlanVersionCreditAllowances.findFirst({
      where: and(
        eq(billingPlanVersionCreditAllowances.planVersionId, row.planVersionId),
        eq(billingPlanVersionCreditAllowances.grantInterval, 'billing_period'),
      ),
    }),
  ]);

  return {
    ...row,
    entitlements: entitlements.map((item) => item.key),
    includedCredits: allowance?.creditAmount ?? 0n,
  };
}

export async function listEnterpriseAiContracts() {
  const rows = await db
    .select({
      planId: billingPlans.id,
      planKey: billingPlans.key,
      name: billingPlans.name,
      description: billingPlans.description,
      versionId: billingPlanVersions.id,
      version: billingPlanVersions.version,
      amountMinor: billingPlanVersions.amountMinor,
      currency: billingPlanVersions.currency,
      effectiveFrom: billingPlanVersions.effectiveFrom,
    })
    .from(billingPlans)
    .innerJoin(billingPlanVersions, eq(billingPlanVersions.planId, billingPlans.id))
    .where(and(
      like(billingPlans.key, `${CONTRACT_PREFIX}%`),
      isNull(billingPlanVersions.effectiveTo),
    ))
    .orderBy(desc(billingPlanVersions.effectiveFrom));

  const tenantRows = await db.select({ id: tenants.id, slug: tenants.slug, name: tenants.name }).from(tenants);
  const tenantById = new Map(tenantRows.map((item) => [item.id, item]));
  return rows.map((row) => {
    const tenantId = row.planKey.slice(CONTRACT_PREFIX.length);
    return { ...row, tenant: tenantById.get(tenantId) ?? null };
  });
}

export async function getEnterpriseAiContractBillingState(tenantId: string) {
  const contract = await getActiveEnterpriseAiContract(tenantId);
  if (!contract) return { contract: null, subscription: null, period: null };

  const [subscription] = await db
    .select({
      id: billingSubscriptions.id,
      status: billingSubscriptions.status,
      renewalMode: billingSubscriptions.renewalMode,
      autoRenew: billingSubscriptions.autoRenew,
      currentPeriodStart: billingSubscriptions.currentPeriodStart,
      currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
      gracePeriodEnd: billingSubscriptions.gracePeriodEnd,
      updatedAt: billingSubscriptions.updatedAt,
    })
    .from(billingSubscriptions)
    .innerJoin(billingPlanVersions, eq(billingPlanVersions.id, billingSubscriptions.planVersionId))
    .where(and(
      eq(billingSubscriptions.tenantId, tenantId),
      eq(billingPlanVersions.planId, contract.planId),
    ))
    .orderBy(desc(billingSubscriptions.updatedAt))
    .limit(1);

  const period = subscription
    ? await db.query.billingPeriods.findFirst({
        where: and(
          eq(billingPeriods.tenantId, tenantId),
          eq(billingPeriods.subscriptionId, subscription.id),
        ),
        orderBy: (table, { desc: orderDesc }) => [orderDesc(table.periodEnd)],
      })
    : null;

  return { contract, subscription: subscription ?? null, period: period ?? null };
}

export async function createEnterpriseAiContractCheckout(input: {
  tenantId: string;
  adapter: BillingGatewayAdapter;
  returnUrl: string;
  cancelUrl: string;
  customer?: { email: string; name?: string };
  collectionCurrency?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const contract = await getActiveEnterpriseAiContract(input.tenantId);
  if (!contract) throw new Error('Enterprise AI contract is not configured.');
  if (contract.currency !== 'USD' || contract.billingInterval !== 'monthly') {
    throw new Error('Enterprise AI contract billing configuration is invalid.');
  }

  const prepared = await db.transaction(async (tx) => {
    const currentRows = await tx
      .select({
        id: billingSubscriptions.id,
        status: billingSubscriptions.status,
        currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
      })
      .from(billingSubscriptions)
      .innerJoin(billingPlanVersions, eq(billingPlanVersions.id, billingSubscriptions.planVersionId))
      .where(and(
        eq(billingSubscriptions.tenantId, input.tenantId),
        eq(billingPlanVersions.planId, contract.planId),
      ))
      .orderBy(desc(billingSubscriptions.updatedAt));

    const pending = currentRows.find((item) => item.status === 'pending_payment');
    if (pending) {
      throw new Error('This workspace already has an Enterprise AI payment awaiting completion.');
    }

    const paidThroughFuture = currentRows.find((item) =>
      ['trialing', 'active', 'cancel_at_period_end'].includes(item.status)
      && item.currentPeriodEnd
      && item.currentPeriodEnd.getTime() > now.getTime()
    );
    if (paidThroughFuture) {
      throw new Error(
        `Enterprise AI is already paid through ${paidThroughFuture.currentPeriodEnd!.toISOString()}.`,
      );
    }

    const periodStart = now;
    const periodEnd = addMonths(periodStart, 1);
    const [subscription] = await tx.insert(billingSubscriptions).values({
      tenantId: input.tenantId,
      planVersionId: contract.planVersionId,
      status: 'pending_payment',
      renewalMode: 'invoice_required',
      autoRenew: true,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      gatewayProvider: input.adapter.provider,
    }).returning({ id: billingSubscriptions.id });
    if (!subscription) throw new Error('Enterprise AI subscription could not be prepared.');

    const [period] = await tx.insert(billingPeriods).values({
      tenantId: input.tenantId,
      subscriptionId: subscription.id,
      periodStart,
      periodEnd,
      amountDueMinor: contract.amountMinor,
      currency: contract.currency,
      collectionStatus: 'open',
      dueAt: now,
    }).returning({ id: billingPeriods.id });
    if (!period) throw new Error('Enterprise AI billing period could not be prepared.');

    const [checkout] = await tx.insert(billingCheckouts).values({
      tenantId: input.tenantId,
      subscriptionId: subscription.id,
      billingPeriodId: period.id,
      provider: input.adapter.provider,
      amountExpectedMinor: contract.amountMinor,
      currency: contract.currency,
      status: 'created',
    }).returning({ id: billingCheckouts.id });
    if (!checkout) throw new Error('Enterprise AI checkout could not be prepared.');

    return {
      checkoutId: checkout.id,
      subscriptionId: subscription.id,
      billingPeriodId: period.id,
    };
  });

  try {
    const gateway = await input.adapter.createCheckout({
      checkoutId: prepared.checkoutId,
      tenantId: input.tenantId,
      subscriptionId: prepared.subscriptionId,
      billingPeriodId: prepared.billingPeriodId,
      amountExpectedMinor: contract.amountMinor,
      currency: contract.currency,
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
      collectionCurrency: input.collectionCurrency,
      customer: input.customer,
    });

    await db.update(billingCheckouts).set({
      providerCheckoutId: gateway.providerCheckoutId ?? null,
      checkoutUrl: gateway.checkoutUrl,
      providerAmountExpectedMinor: gateway.providerAmountExpectedMinor ?? null,
      providerCurrency: gateway.providerCurrency ?? null,
      expiresAt: gateway.expiresAt ?? null,
      status: 'redirected',
      updatedAt: now,
    }).where(eq(billingCheckouts.id, prepared.checkoutId));

    return {
      checkoutId: prepared.checkoutId,
      subscriptionId: prepared.subscriptionId,
      checkoutUrl: gateway.checkoutUrl,
      provider: gateway.provider,
    };
  } catch (error) {
    await db.transaction(async (tx) => {
      await tx.update(billingCheckouts).set({ status: 'failed', updatedAt: now })
        .where(eq(billingCheckouts.id, prepared.checkoutId));
      await tx.update(billingSubscriptions).set({
        status: 'cancelled',
        cancelledAt: now,
        cancellationReason: 'checkout_provider_failure',
        updatedAt: now,
      }).where(eq(billingSubscriptions.id, prepared.subscriptionId));
    });
    throw error;
  }
}


export async function getEnterpriseAiContractBillingSummary(tenantId: string) {
  const [subscription] = await db
    .select({
      id: billingSubscriptions.id,
      planKey: billingPlans.key,
      planName: billingPlans.name,
      planVersion: billingPlanVersions.version,
      status: billingSubscriptions.status,
      renewalMode: billingSubscriptions.renewalMode,
      autoRenew: billingSubscriptions.autoRenew,
      currentPeriodStart: billingSubscriptions.currentPeriodStart,
      currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
      gracePeriodEnd: billingSubscriptions.gracePeriodEnd,
    })
    .from(billingSubscriptions)
    .innerJoin(billingPlanVersions, eq(billingPlanVersions.id, billingSubscriptions.planVersionId))
    .innerJoin(billingPlans, eq(billingPlans.id, billingPlanVersions.planId))
    .where(and(
      eq(billingSubscriptions.tenantId, tenantId),
      eq(billingPlans.key, contractPlanKey(tenantId)),
      ne(billingSubscriptions.status, 'cancelled'),
    ))
    .orderBy(desc(billingSubscriptions.updatedAt))
    .limit(1);

  if (!subscription) return null;

  const [[period], ledger, settlements] = await Promise.all([
    db.select({
      amountDueMinor: billingPeriods.amountDueMinor,
      currency: billingPeriods.currency,
      periodStart: billingPeriods.periodStart,
      periodEnd: billingPeriods.periodEnd,
    })
      .from(billingPeriods)
      .where(and(
        eq(billingPeriods.tenantId, tenantId),
        eq(billingPeriods.subscriptionId, subscription.id),
      ))
      .orderBy(desc(billingPeriods.periodEnd))
      .limit(1),
    db.select({
      id: billingLedgerEntries.id,
      entryType: billingLedgerEntries.entryType,
      amountMinor: billingLedgerEntries.amountMinor,
      currency: billingLedgerEntries.currency,
      createdAt: billingLedgerEntries.createdAt,
    })
      .from(billingLedgerEntries)
      .where(and(
        eq(billingLedgerEntries.tenantId, tenantId),
        eq(billingLedgerEntries.subscriptionId, subscription.id),
      ))
      .orderBy(desc(billingLedgerEntries.createdAt))
      .limit(10),
    db.select({
      id: billingSettlements.id,
      provider: billingSettlements.provider,
      amountPaidMinor: billingSettlements.amountPaidMinor,
      currencyPaid: billingSettlements.currencyPaid,
      status: billingSettlements.status,
      occurredAt: billingSettlements.occurredAt,
    })
      .from(billingSettlements)
      .where(and(
        eq(billingSettlements.tenantId, tenantId),
        eq(billingSettlements.subscriptionId, subscription.id),
      ))
      .orderBy(desc(billingSettlements.occurredAt))
      .limit(10),
  ]);

  if (!period) return null;

  return {
    plan: {
      key: subscription.planKey,
      name: subscription.planName,
      version: subscription.planVersion,
    },
    subscription: {
      status: subscription.status,
      renewalMode: subscription.renewalMode,
      autoRenew: subscription.autoRenew,
      gracePeriodEnd: subscription.gracePeriodEnd,
    },
    currentPeriod: {
      start: subscription.currentPeriodStart ?? period.periodStart,
      end: subscription.currentPeriodEnd ?? period.periodEnd,
      amountDueMinor: period.amountDueMinor,
      currency: period.currency,
    },
    recentLedger: ledger,
    recentSettlements: settlements,
  };
}

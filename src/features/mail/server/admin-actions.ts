'use server';

import { and, desc, eq, gt, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';

import { seedSelfServiceBillingCatalog } from '@/features/billing/server/catalog-seed';
import { enterpriseCheckoutService } from '@/features/enterprise-checkout/server/service';
import { formatUsdMinorUnits, parseUsdAmountToMinorUnits } from '@/features/enterprise-checkout/domain';
import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { createFirstPartySmtpCredentialRecord } from '@/features/mail/server/first-party-smtp-credential';
import { sendPlatformMail } from '@/features/mail/server/platform-sender';
import {
  findCloudflareZone,
  getCloudflareEmailSending,
  getCloudflareEmailSendingDns,
  getPublicCloudflareSendingDns,
} from './cloudflare';
import { areCloudflareEmailAuthRecordsPublished, isFirstPartyMailDomain } from './domain-provisioning-policy';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { withServerActionDatabase } from '@/shared/db/server-action';
import { revalidatePath } from 'next/cache';
import { db } from '@/shared/db';
import { runPlatformControlMutation } from '@/shared/db/platform-control-mutation';
import {
  billingPlans,
  billingPlanVersionEntitlements,
  billingPlanVersions,
  mailAppPasswords,
  mailDomains,
  mailEnterpriseOffers,
  mailMailboxes,
  mailWorkspaces,
  tenantEntitlementOverrides,
  tenantMemberships,
  tenants,
  users,
} from '@/shared/db/schema';
import { requirePermission } from '@/shared/lib/permissions';
import { logAuditEvent } from '@/shared/services/audit-service';

import { MAIL_INTERNAL_CUSTOM_PROFILE_KEY, resolveTenantMailPlanKey } from './commercial';
import { getFirstPartyMailTenantId } from './runtime-config';
import { isMailPlanKey } from '../commercial/plans';
import { parseMailEnterpriseOfferInput } from '../commercial/enterprise-offers';

async function requireMailOps(opsTenantSlug: string) {
  const actor = await requirePlatformControlAccess(opsTenantSlug);
  await requirePermission(opsTenantSlug, 'platform:plans');
  return actor;
}

async function bootstrapFirstPartyMailWorkspaceImpl(opsTenantSlug: string) {
  const actor = await requireMailOps(opsTenantSlug);
  const configuredTenantId = getFirstPartyMailTenantId().trim();
  if (!configuredTenantId) throw new Error('First-party Mail tenant is not configured.');

  const result = await db.transaction(async (tx) => {
    let changed = false;
    const [tenant] = await tx
      .select({ id: tenants.id, slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, configuredTenantId))
      .for('update')
      .limit(1);
    if (!tenant || tenant.slug !== 'mkety-ops') {
      throw new Error('The configured first-party Mail tenant must be the reserved /mkety-ops tenant.');
    }

    const now = new Date();
    const activeOverride = or(
      isNull(tenantEntitlementOverrides.expiresAt),
      gt(tenantEntitlementOverrides.expiresAt, now),
    );
    const [deny] = await tx
      .select({ id: tenantEntitlementOverrides.id })
      .from(tenantEntitlementOverrides)
      .where(and(
        eq(tenantEntitlementOverrides.tenantId, tenant.id),
        eq(tenantEntitlementOverrides.entitlementKey, 'workspace.mail'),
        eq(tenantEntitlementOverrides.effect, 'deny'),
        activeOverride,
      ))
      .limit(1);
    if (deny) throw new Error('Mail is explicitly denied for the reserved tenant; remove that deny before provisioning.');

    const [grant] = await tx
      .select({ id: tenantEntitlementOverrides.id })
      .from(tenantEntitlementOverrides)
      .where(and(
        eq(tenantEntitlementOverrides.tenantId, tenant.id),
        eq(tenantEntitlementOverrides.entitlementKey, 'workspace.mail'),
        eq(tenantEntitlementOverrides.effect, 'grant'),
        activeOverride,
      ))
      .limit(1);
    if (!grant) {
      await tx.insert(tenantEntitlementOverrides).values({
        tenantId: tenant.id,
        entitlementKey: 'workspace.mail',
        effect: 'grant',
        reason: 'First-party Mkety Mail internal custom workspace profile.',
        source: 'mail:first-party-internal',
        expiresAt: null,
        actorUserId: actor.userId,
      });
      changed = true;
    }

    const [existing] = await tx
      .select()
      .from(mailWorkspaces)
      .where(eq(mailWorkspaces.tenantId, tenant.id))
      .for('update')
      .limit(1);
    if (existing?.status === 'suspended') {
      throw new Error('The reserved tenant Mail workspace is suspended; review it before provisioning.');
    }

    let workspace;
    if (existing?.planKey === MAIL_INTERNAL_CUSTOM_PROFILE_KEY) {
      workspace = existing;
    } else if (existing) {
      [workspace] = await tx
        .update(mailWorkspaces)
        .set({ planKey: MAIL_INTERNAL_CUSTOM_PROFILE_KEY, updatedAt: now })
        .where(eq(mailWorkspaces.id, existing.id))
        .returning();
      changed = true;
    } else {
      [workspace] = await tx
        .insert(mailWorkspaces)
        .values({
          tenantId: tenant.id,
          status: 'active',
          planKey: MAIL_INTERNAL_CUSTOM_PROFILE_KEY,
          onboardingStep: 'domain',
          enabledByUserId: actor.userId,
        })
        .returning();
      changed = true;
    }

    if (!workspace) throw new Error('Could not provision the first-party Mail workspace.');
    return { workspace, changed };
  });

  if (result.changed) {
    await logAuditEvent({
      actorId: actor.userId,
      action: 'mail.first_party_workspace.bootstrapped',
      entityType: 'mail_workspace',
      entityId: result.workspace.id,
      changes: { profile: MAIL_INTERNAL_CUSTOM_PROFILE_KEY },
      metadata: { tenantId: configuredTenantId, tenantSlug: 'mkety-ops' },
    });
  }
}

function bool(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true' || value === '1';
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function hashAppPassword(secret: string) {
  const salt = randomBytes(16);
  const encoded = new TextEncoder().encode(secret);
  const input = new Uint8Array(encoded.length + salt.length);
  input.set(encoded);
  input.set(salt, encoded.length);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  const result = new Uint8Array(digest.length + salt.length);
  result.set(digest);
  result.set(salt, digest.length);
  let binary = '';
  for (const byte of result) binary += String.fromCharCode(byte);
  return `{SSHA256}${btoa(binary)}`;
}

export async function createFirstPartySmtpCredential(
  opsTenantSlug: string,
  _state: { secret?: string; error?: string },
  _formData: FormData,
): Promise<{ secret?: string; error?: string }> {
  const actor = await requireMailOps(opsTenantSlug);
  const configuredTenantId = getFirstPartyMailTenantId();
  if (!configuredTenantId) return { error: 'First-party Mail tenant is not configured.' };

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, configuredTenantId) });
  if (!tenant) return { error: 'Configured first-party Mail tenant was not found.' };
  const workspace = await db.query.mailWorkspaces.findFirst({ where: eq(mailWorkspaces.tenantId, configuredTenantId) });
  if (!workspace || workspace.status !== 'active') {
    return { error: 'The first-party Mail workspace is not active and entitled.' };
  }
  const entitled = await hasEntitlement({ tenantId: configuredTenantId, entitlement: 'workspace.mail' });
  const mailboxRows = await db
    .select({ mailbox: mailMailboxes, domain: mailDomains })
    .from(mailMailboxes)
    .innerJoin(mailDomains, eq(mailMailboxes.domainId, mailDomains.id))
    .where(and(
      eq(mailMailboxes.tenantId, configuredTenantId),
      eq(mailMailboxes.workspaceId, workspace.id),
      eq(mailMailboxes.localPart, 'info'),
      eq(mailDomains.domain, 'mail.mkety.com'),
    ))
    .limit(1);
  const { mailbox, domain } = mailboxRows[0] ?? { mailbox: null, domain: null };
  if (
    !domain || domain.status !== 'sending_ready' ||
    !domain.sendingEnabled ||
    domain.spfStatus !== 'verified' ||
    domain.dkimStatus !== 'verified' ||
    domain.dmarcStatus !== 'verified'
  ) {
    return { error: 'The info@mail.mkety.com sending domain is not fully verified and enabled.' };
  }

  const secret = `mkmail-${hex(randomBytes(12))}`;
  const passwordHash = await hashAppPassword(secret);
  const credential = await createFirstPartySmtpCredentialRecord({
    configuredTenantId,
    requestedTenantId: configuredTenantId,
    actorUserId: actor.userId,
    workspace: workspace ? { tenantId: workspace.tenantId, status: workspace.status, hasMailEntitlement: entitled } : null,
    mailbox: mailbox ? { id: mailbox.id, tenantId: mailbox.tenantId, address: 'info@mail.mkety.com', status: mailbox.status } : null,
    secret,
    passwordHash,
  }, {
    replace: async (record) => {
      return db.transaction(async (tx) => {
        await tx.update(mailAppPasswords).set({ revokedAt: new Date() }).where(and(
          eq(mailAppPasswords.tenantId, record.tenantId),
          eq(mailAppPasswords.mailboxId, record.mailboxId),
          eq(mailAppPasswords.name, 'Mkety platform SMTP'),
          eq(mailAppPasswords.protocolScope, 'smtp'),
          isNull(mailAppPasswords.revokedAt),
        ));
        const [created] = await tx.insert(mailAppPasswords).values(record).returning({ id: mailAppPasswords.id });
        if (!created) throw new Error('Credential insert failed.');
        return created;
      });
    },
  });
  try {
    await logAuditEvent({ actorId: actor.userId, action: 'mail.first_party_smtp_credential.created', entityType: 'mail_app_password', entityId: credential.id, metadata: { tenantId: configuredTenantId, mailboxId: mailbox?.id, protocolScope: 'smtp' } });
    return { secret: credential.secret };
  } catch {
    await db.update(mailAppPasswords).set({ revokedAt: new Date() }).where(eq(mailAppPasswords.id, credential.id));
    return { error: 'Could not create the first-party SMTP credential. Check workspace readiness and try again.' };
  }
}

export interface MailEnterpriseOfferPaymentLink {
  offerId: string;
  orderId: string;
  provider: 'flutterwave' | 'kora';
  redirectUrl: string;
  status: 'checkout_created' | 'awaiting_confirmation';
  notificationQueued: boolean;
}

async function createMailEnterpriseOfferPaymentLinkImpl(
  opsTenantSlug: string,
  formData: FormData,
): Promise<MailEnterpriseOfferPaymentLink> {
  const actor = await requireMailOps(opsTenantSlug);
  const targetTenantId = String(formData.get('targetTenantId') ?? '').trim();
  const name = String(formData.get('offerName') ?? '').trim();
  const amountMinor = parseUsdAmountToMinorUnits(String(formData.get('amountUsd') ?? ''));
  const termValue = String(formData.get('termDays') ?? '').trim();
  const termDays = termValue === 'unlimited' ? null : Number(termValue);
  const provider = String(formData.get('provider') ?? '');
  if (provider !== 'flutterwave' && provider !== 'kora') {
    throw new Error('Mail Enterprise checkout supports Flutterwave or Kora only.');
  }
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, targetTenantId),
    columns: { id: true, slug: true, name: true },
  });
  if (!tenant || tenant.id === getFirstPartyMailTenantId() || tenant.slug === 'mkety-ops') {
    throw new Error('Select an eligible customer workspace for the Mail offer.');
  }

  const limits = {
    domains: Number(formData.get('domains')),
    mailboxes: Number(formData.get('mailboxes')),
    teamSeats: Number(formData.get('teamSeats')),
    sharedInboxes: Number(formData.get('sharedInboxes')),
    storageGb: Number(formData.get('storageGb')),
    outboundMessagesPerMonth: Number(formData.get('outboundMessagesPerMonth')),
    customerUpdateDeliveriesPerMonth: Number(formData.get('customerUpdateDeliveriesPerMonth')),
    maxRecipientsPerCustomerUpdate: Number(formData.get('maxRecipientsPerCustomerUpdate')),
  };
  const offerInput = parseMailEnterpriseOfferInput({
    tenantId: tenant.id,
    name,
    description: String(formData.get('description') ?? ''),
    amountMinor,
    termDays,
    limits,
  });
  const fullName = String(formData.get('customerName') ?? '').trim();
  const email = String(formData.get('customerEmail') ?? '').trim().toLowerCase();
  const companyName = String(formData.get('companyName') ?? '').trim() || tenant.name;
  if (fullName.length < 2 || fullName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter the customer billing contact name and a valid email address.');
  }
  const [customerMember] = await db.select({ userId: users.id })
    .from(tenantMemberships)
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(and(
      eq(tenantMemberships.tenantId, tenant.id),
      sql`lower(${users.email}) = ${email}`,
      isNotNull(users.emailVerified),
    ))
    .limit(1);
  if (!customerMember) {
    throw new Error('The billing contact must have a verified account in this workspace. Invite them first, then issue the payment link.');
  }

  const now = new Date();
  const offer = await db.transaction(async (tx) => {
    const [lockedTenant] = await tx.select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, tenant.id))
      .for('update')
      .limit(1);
    if (!lockedTenant) throw new Error('Select an eligible customer workspace for the Mail offer.');

    await tx.update(mailEnterpriseOffers).set({ status: 'expired', updatedAt: now }).where(and(
      eq(mailEnterpriseOffers.tenantId, tenant.id),
      eq(mailEnterpriseOffers.status, 'active'),
      isNotNull(mailEnterpriseOffers.endsAt),
      lte(mailEnterpriseOffers.endsAt, now),
    ));

    const [existingOffer] = await tx.select({ id: mailEnterpriseOffers.id })
      .from(mailEnterpriseOffers)
      .where(and(
        eq(mailEnterpriseOffers.tenantId, tenant.id),
        or(
          eq(mailEnterpriseOffers.status, 'draft'),
          eq(mailEnterpriseOffers.status, 'awaiting_payment'),
          eq(mailEnterpriseOffers.status, 'active'),
        ),
      ))
      .limit(1);
    if (existingOffer) {
      throw new Error('This workspace already has an active Mail Enterprise offer or a payment awaiting settlement.');
    }

    const [workspace] = await tx.select({ status: mailWorkspaces.status })
      .from(mailWorkspaces)
      .where(eq(mailWorkspaces.tenantId, tenant.id))
      .limit(1);
    if (workspace?.status === 'suspended') throw new Error('A suspended Mail workspace cannot receive a new offer.');

    const [created] = await tx.insert(mailEnterpriseOffers).values({
      tenantId: tenant.id,
      name: offerInput.name,
      description: offerInput.description,
      amountMinor: offerInput.amountMinor,
      currency: 'USD',
      termDays: offerInput.termDays,
      limits: offerInput.limits,
      status: 'draft',
      createdByUserId: actor.userId,
    }).returning({ id: mailEnterpriseOffers.id });
    if (!created) throw new Error('Mail Enterprise offer could not be created.');
    return created;
  });

  try {
    const checkout = await enterpriseCheckoutService.createEnterpriseCheckout({
      fullName,
      companyName,
      email,
      scopeId: 'mail',
      projectName: offerInput.name,
      projectDescription: offerInput.description ?? `Mkety Mail Enterprise offer for ${tenant.name}.`,
      amount: formatUsdMinorUnits(offerInput.amountMinor),
      currency: 'USD',
      provider,
    }, {
      idempotencyKey: `mail-offer-${offer.id}`,
      mailEnterpriseOfferId: offer.id,
      mailEnterpriseTenantId: tenant.id,
      onOrderCreated: async (orderId) => {
        const [associated] = await db.update(mailEnterpriseOffers).set({
          orderId,
          status: 'awaiting_payment',
          updatedAt: new Date(),
        }).where(and(
          eq(mailEnterpriseOffers.id, offer.id),
          eq(mailEnterpriseOffers.status, 'draft'),
          isNull(mailEnterpriseOffers.orderId),
        )).returning({ id: mailEnterpriseOffers.id });
        if (!associated) throw new Error('Mail Enterprise offer could not be linked to its payment order.');
      },
      onCheckoutFailed: async (orderId) => {
        const [cancelled] = await db.update(mailEnterpriseOffers).set({
          status: 'cancelled',
          updatedAt: new Date(),
        }).where(and(
          eq(mailEnterpriseOffers.id, offer.id),
          eq(mailEnterpriseOffers.status, 'awaiting_payment'),
          eq(mailEnterpriseOffers.orderId, orderId),
        )).returning({ id: mailEnterpriseOffers.id });
        if (!cancelled) throw new Error('Failed Mail Enterprise offer could not be cancelled for retry.');
      },
    });
    await logAuditEvent({
      actorId: actor.userId,
      action: 'mail.enterprise_offer.payment_link_created',
      entityType: 'mail_enterprise_offer',
      entityId: offer.id,
      changes: { status: 'awaiting_payment', amountMinor: offerInput.amountMinor.toString(), currency: 'USD', termDays: offerInput.termDays },
      metadata: { targetTenantId: tenant.id, orderId: checkout.orderId, provider },
    });
    const notification = await sendPlatformMail({
      category: 'billing',
      to: email,
      subject: `Your ${offerInput.name} payment link is ready`,
      text: [
        `Review the agreed Mkety Mail Enterprise offer: ${offerInput.name}.`,
        `Amount: USD ${formatUsdMinorUnits(offerInput.amountMinor)}.`,
        `Payment provider: ${provider}.`,
        `Complete payment securely here: ${checkout.redirectUrl}`,
        'Mail access and included limits activate after verified payment settles.',
      ].join('\n\n'),
      idempotencyKey: `mail-enterprise-offer-payment-link:${offer.id}`,
    }).catch(() => ({ ok: false as const }));
    revalidatePath(`/ops/${opsTenantSlug}/platform-control/mail-operations`);
    return {
      offerId: offer.id,
      orderId: checkout.orderId,
      provider,
      redirectUrl: checkout.redirectUrl,
      status: checkout.status,
      notificationQueued: notification.ok,
    };
  } catch (error) {
    await db.update(mailEnterpriseOffers).set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(
        eq(mailEnterpriseOffers.id, offer.id),
        eq(mailEnterpriseOffers.status, 'draft'),
        isNull(mailEnterpriseOffers.orderId),
      ));
    revalidatePath(`/ops/${opsTenantSlug}/platform-control/mail-operations`);
    throw error;
  }
}

export async function createMailEnterpriseOfferPaymentLink(
  opsTenantSlug: string,
  formData: FormData,
): Promise<MailEnterpriseOfferPaymentLink> {
  return withServerActionDatabase(() => createMailEnterpriseOfferPaymentLinkImpl(opsTenantSlug, formData));
}


function parseUsdMinor(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Enter a valid monthly USD price with at most two decimal places.');
  }
  const [whole, fraction = ''] = normalized.split('.');
  return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
}

async function createMailPlanVersionImpl(opsTenantSlug: string, formData: FormData) {
  const actor = await requireMailOps(opsTenantSlug);
  const planKey = String(formData.get('planKey') || '');
  if (!isMailPlanKey(planKey)) throw new Error('Unknown Mkety Mail plan.');

  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const amountMinor = parseUsdMinor(formData.get('monthlyPriceUsd'));
  if (!name || name.length > 255 || !description || description.length > 2_000) {
    throw new Error('Mail plan name or description is invalid.');
  }
  if (amountMinor < 100n) throw new Error('Mail plan price must be at least $1.00 per month.');

  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [plan] = await tx
      .select()
      .from(billingPlans)
      .where(eq(billingPlans.key, planKey))
      .limit(1);
    if (!plan) throw new Error('Reconcile the Mail catalog before creating a new plan version.');

    const [active] = await tx
      .select()
      .from(billingPlanVersions)
      .where(and(eq(billingPlanVersions.planId, plan.id), isNull(billingPlanVersions.effectiveTo)))
      .orderBy(desc(billingPlanVersions.version))
      .limit(1);
    if (!active) throw new Error('The Mail plan has no active billing version.');

    const entitlements = await tx
      .select({
        entitlementKey: billingPlanVersionEntitlements.entitlementKey,
        enabled: billingPlanVersionEntitlements.enabled,
      })
      .from(billingPlanVersionEntitlements)
      .where(eq(billingPlanVersionEntitlements.planVersionId, active.id));

    const [latest] = await tx
      .select({ version: billingPlanVersions.version })
      .from(billingPlanVersions)
      .where(eq(billingPlanVersions.planId, plan.id))
      .orderBy(desc(billingPlanVersions.version))
      .limit(1);

    await tx
      .update(billingPlanVersions)
      .set({ effectiveTo: now })
      .where(and(eq(billingPlanVersions.id, active.id), isNull(billingPlanVersions.effectiveTo)));

    const [next] = await tx
      .insert(billingPlanVersions)
      .values({
        planId: plan.id,
        version: (latest?.version ?? active.version) + 1,
        amountMinor,
        currency: 'USD',
        billingInterval: 'monthly',
        isPublic: true,
        metadataReference: `platform-control:mail:${planKey}`,
        effectiveFrom: now,
      })
      .returning();

    if (entitlements.length) {
      await tx.insert(billingPlanVersionEntitlements).values(
        entitlements.map((item) => ({
          planVersionId: next.id,
          entitlementKey: item.entitlementKey,
          enabled: item.enabled,
        })),
      );
    }

    await tx
      .update(billingPlans)
      .set({ name, description, status: 'active', updatedAt: now })
      .where(eq(billingPlans.id, plan.id));

    return { previousVersion: active.version, version: next.version, amountMinor };
  });

  await logAuditEvent({
    actorId: actor.userId,
    action: 'mail.catalog.version_created',
    entityType: 'billing_plan',
    entityId: planKey,
    changes: {
      name,
      description,
      monthlyAmountMinor: result.amountMinor.toString(),
      previousVersion: result.previousVersion,
      version: result.version,
    },
  });
}

async function reconcileMailCatalogImpl(opsTenantSlug: string) {
  const actor = await requireMailOps(opsTenantSlug);
  const result = await seedSelfServiceBillingCatalog();
  await logAuditEvent({
    actorId: actor.userId,
    action: 'mail.catalog.reconciled',
    entityType: 'mail_catalog',
    metadata: { ...result },
  });
}

async function updateMailWorkspaceOperationsImpl(opsTenantSlug: string, formData: FormData) {
  const actor = await requireMailOps(opsTenantSlug);
  const workspaceId = String(formData.get('workspaceId') || '');
  const targetTenantId = String(formData.get('targetTenantId') || '');
  const status = String(formData.get('status') || '');
  const onboardingStep = String(formData.get('onboardingStep') || '');
  if (!workspaceId || !targetTenantId || !['active','suspended'].includes(status) || !['domain','ready'].includes(onboardingStep)) {
    throw new Error('Invalid Mail workspace operations update.');
  }

  const [tenant, workspace] = await Promise.all([
    db.query.tenants.findFirst({
      where: eq(tenants.id, targetTenantId),
      columns: { slug: true },
    }),
    db.query.mailWorkspaces.findFirst({
      where: and(eq(mailWorkspaces.id, workspaceId), eq(mailWorkspaces.tenantId, targetTenantId)),
      columns: { planKey: true },
    }),
  ]);
  if (!tenant || !workspace) throw new Error('Mail workspace not found.');
  const planKey = await resolveTenantMailPlanKey(targetTenantId, workspace.planKey, tenant.slug);
  await db
    .update(mailWorkspaces)
    .set({ status, onboardingStep, planKey, updatedAt: new Date() })
    .where(and(eq(mailWorkspaces.id, workspaceId), eq(mailWorkspaces.tenantId, targetTenantId)));

  await logAuditEvent({
    actorId: actor.userId,
    action: 'mail.workspace.operations_updated',
    entityType: 'mail_workspace',
    entityId: workspaceId,
    changes: { status, onboardingStep, planKey },
    metadata: { targetTenantId },
  });
}

async function updateMailDomainOperationsImpl(opsTenantSlug: string, formData: FormData) {
  const actor = await requireMailOps(opsTenantSlug);
  const domainId = String(formData.get('domainId') || '');
  const targetTenantId = String(formData.get('targetTenantId') || '');
  const status = String(formData.get('status') || '');
  const spfStatus = String(formData.get('spfStatus') || '');
  const dkimStatus = String(formData.get('dkimStatus') || '');
  const dmarcStatus = String(formData.get('dmarcStatus') || '');
  const mxStatus = String(formData.get('mxStatus') || '');
  const readiness = ['pending','verified','failed','disabled'];
  const domainReadiness = [...readiness, 'sending_ready'];
  if (
    !domainId ||
    !targetTenantId ||
    !domainReadiness.includes(status) ||
    !readiness.includes(spfStatus) ||
    !readiness.includes(dkimStatus) ||
    !readiness.includes(dmarcStatus) ||
    !readiness.includes(mxStatus)
  ) {
    throw new Error('Invalid Mail domain operations update.');
  }

  const sendingEnabled = bool(formData.get('sendingEnabled'));
  const routingEnabled = bool(formData.get('routingEnabled'));
  const [domain] = await db
    .select({ domain: mailDomains.domain, tenantId: mailDomains.tenantId })
    .from(mailDomains)
    .where(and(eq(mailDomains.id, domainId), eq(mailDomains.tenantId, targetTenantId)))
    .limit(1);
  if (!domain) throw new Error('Mail domain not found.');

  const firstPartyDomain = isFirstPartyMailDomain(domain.domain, domain.tenantId, getFirstPartyMailTenantId());
  if (firstPartyDomain && status === 'verified') {
    throw new Error('First-party outbound Mail must use sending_ready after live DNS verification.');
  }
  if (firstPartyDomain && status === 'sending_ready') {
    if (!sendingEnabled || spfStatus !== 'verified' || dkimStatus !== 'verified' || dmarcStatus !== 'verified') {
      throw new Error('First-party sending readiness requires verified SPF, DKIM, and DMARC.');
    }
    const zone = await findCloudflareZone(domain.domain);
    const sending = zone ? await getCloudflareEmailSending(zone.id, domain.domain) : null;
    const expectedRecords = zone && typeof sending?.tag === 'string'
      ? await getCloudflareEmailSendingDns(zone.id, sending.tag)
      : [];
    const publicRecords = await getPublicCloudflareSendingDns(expectedRecords);
    if (!areCloudflareEmailAuthRecordsPublished(domain.domain, Boolean(sending?.enabled), expectedRecords, publicRecords)) {
      throw new Error('Public SPF, DKIM, and DMARC records do not match Cloudflare Email Sending.');
    }
  }

  const verified = (status === 'verified' && spfStatus === 'verified' && dkimStatus === 'verified' && dmarcStatus === 'verified' && mxStatus === 'verified') || (status === 'sending_ready' && sendingEnabled && spfStatus === 'verified' && dkimStatus === 'verified' && dmarcStatus === 'verified');

  await db
    .update(mailDomains)
    .set({
      status,
      spfStatus,
      dkimStatus,
      dmarcStatus,
      mxStatus,
      sendingEnabled,
      routingEnabled,
      verifiedAt: verified ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(mailDomains.id, domainId), eq(mailDomains.tenantId, targetTenantId)));

  await logAuditEvent({
    actorId: actor.userId,
    action: 'mail.domain.operations_updated',
    entityType: 'mail_domain',
    entityId: domainId,
    changes: { status, spfStatus, dkimStatus, dmarcStatus, mxStatus, sendingEnabled, routingEnabled },
    metadata: { targetTenantId },
  });
}

export async function bootstrapFirstPartyMailWorkspace(opsTenantSlug: string) {
  return runPlatformControlMutation({
    path: `/ops/${opsTenantSlug}/platform-control/mail-operations`,
    action: 'bootstrapFirstPartyMailWorkspace',
    work: () => bootstrapFirstPartyMailWorkspaceImpl(opsTenantSlug),
  });
}

export async function createMailPlanVersion(...args: Parameters<typeof createMailPlanVersionImpl>) {
  const tenantSlug = args[0];
  return runPlatformControlMutation({
    path: `/ops/${tenantSlug}/platform-control/mail-operations`,
    action: 'createMailPlanVersion',
    work: () => createMailPlanVersionImpl(...args),
  });
}

export async function reconcileMailCatalog(...args: Parameters<typeof reconcileMailCatalogImpl>) {
  const tenantSlug = args[0];
  return runPlatformControlMutation({
    path: `/ops/${tenantSlug}/platform-control/mail-operations`,
    action: 'reconcileMailCatalog',
    work: () => reconcileMailCatalogImpl(...args),
  });
}

export async function updateMailWorkspaceOperations(...args: Parameters<typeof updateMailWorkspaceOperationsImpl>) {
  const tenantSlug = args[0];
  return runPlatformControlMutation({
    path: `/ops/${tenantSlug}/platform-control/mail-operations`,
    action: 'updateMailWorkspaceOperations',
    work: () => updateMailWorkspaceOperationsImpl(...args),
  });
}

export async function updateMailDomainOperations(...args: Parameters<typeof updateMailDomainOperationsImpl>) {
  const tenantSlug = args[0];
  return runPlatformControlMutation({
    path: `/ops/${tenantSlug}/platform-control/mail-operations`,
    action: 'updateMailDomainOperations',
    work: () => updateMailDomainOperationsImpl(...args),
  });
}

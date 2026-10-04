'use server';

import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';

import { seedSelfServiceBillingCatalog } from '@/features/billing/server/catalog-seed';
import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { createFirstPartySmtpCredentialRecord } from '@/features/mail/server/first-party-smtp-credential';
import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { db } from '@/shared/db';
import { runPlatformControlMutation } from '@/shared/db/platform-control-mutation';
import {
  billingPlans,
  billingPlanVersionEntitlements,
  billingPlanVersions,
  mailAppPasswords,
  mailDomains,
  mailMailboxes,
  mailWorkspaces,
  tenantEntitlementOverrides,
  tenants,
} from '@/shared/db/schema';
import { requirePermission } from '@/shared/lib/permissions';
import { logAuditEvent } from '@/shared/services/audit-service';

import { MAIL_INTERNAL_CUSTOM_PROFILE_KEY, resolveTenantMailPlanKey } from './commercial';
import { isMailPlanKey } from '../commercial/plans';

async function requireMailOps(opsTenantSlug: string) {
  const actor = await requirePlatformControlAccess(opsTenantSlug);
  await requirePermission(opsTenantSlug, 'platform:plans');
  return actor;
}

async function bootstrapFirstPartyMailWorkspaceImpl(opsTenantSlug: string) {
  const actor = await requireMailOps(opsTenantSlug);
  const configuredTenantId = process.env.MKETY_FIRST_PARTY_MAIL_TENANT_ID?.trim() ?? '';
  if (!configuredTenantId) throw new Error('First-party Mail tenant is not configured.');

  const workspace = await db.transaction(async (tx) => {
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

    const [created] = existing
      ? await tx
          .update(mailWorkspaces)
          .set({ planKey: MAIL_INTERNAL_CUSTOM_PROFILE_KEY, updatedAt: now })
          .where(eq(mailWorkspaces.id, existing.id))
          .returning()
      : await tx
          .insert(mailWorkspaces)
          .values({
            tenantId: tenant.id,
            status: 'active',
            planKey: MAIL_INTERNAL_CUSTOM_PROFILE_KEY,
            onboardingStep: 'domain',
            enabledByUserId: actor.userId,
          })
          .returning();

    if (!created) throw new Error('Could not provision the first-party Mail workspace.');
    return created;
  });

  await logAuditEvent({
    actorId: actor.userId,
    action: 'mail.first_party_workspace.bootstrapped',
    entityType: 'mail_workspace',
    entityId: workspace.id,
    changes: { profile: MAIL_INTERNAL_CUSTOM_PROFILE_KEY },
    metadata: { tenantId: configuredTenantId, tenantSlug: 'mkety-ops' },
  });
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
  const configuredTenantId = process.env.MKETY_FIRST_PARTY_MAIL_TENANT_ID ?? '';
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
      eq(mailDomains.domain, 'mkety.com'),
    ))
    .limit(1);
  const { mailbox, domain } = mailboxRows[0] ?? { mailbox: null, domain: null };
  if (
    domain?.status !== 'verified' ||
    !domain.sendingEnabled ||
    domain.spfStatus !== 'verified' ||
    domain.dkimStatus !== 'verified' ||
    domain.dmarcStatus !== 'verified' ||
    domain.mxStatus !== 'verified'
  ) {
    return { error: 'The info@mkety.com sending domain is not fully verified and enabled.' };
  }

  const secret = `mkmail-${hex(randomBytes(12))}`;
  const passwordHash = await hashAppPassword(secret);
  const credential = await createFirstPartySmtpCredentialRecord({
    configuredTenantId,
    requestedTenantId: configuredTenantId,
    actorUserId: actor.userId,
    workspace: workspace ? { tenantId: workspace.tenantId, status: workspace.status, hasMailEntitlement: entitled } : null,
    mailbox: mailbox ? { id: mailbox.id, tenantId: mailbox.tenantId, address: 'info@mkety.com', status: mailbox.status } : null,
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

  const planKey = await resolveTenantMailPlanKey(targetTenantId);
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
  if (
    !domainId ||
    !targetTenantId ||
    !readiness.includes(status) ||
    !readiness.includes(spfStatus) ||
    !readiness.includes(dkimStatus) ||
    !readiness.includes(dmarcStatus) ||
    !readiness.includes(mxStatus)
  ) {
    throw new Error('Invalid Mail domain operations update.');
  }

  const sendingEnabled = bool(formData.get('sendingEnabled'));
  const routingEnabled = bool(formData.get('routingEnabled'));
  const verified = status === 'verified' && spfStatus === 'verified' && dkimStatus === 'verified' && dmarcStatus === 'verified' && mxStatus === 'verified';

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

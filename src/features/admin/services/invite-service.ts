'use server';

/**
 * Tenant Invite Service
 *
 * Server actions for managing tenant invitations.
 */

import { randomBytes } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db } from '@/shared/db';
import * as schema from '@/shared/db/schema';
import type { TenantRole } from '@/shared/db/schema/auth';
import { logger } from '@/shared/lib/logger';
import { requireTenantAdmin } from '@/shared/lib/rbac';

import type { AdminActionResult, PaginatedResult } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface CreateInviteInput {
  email: string;
  role?: TenantRole;
  /** Role ID from tenant roles (initial role when accepting). Defaults to tenant "member" role if not provided. */
  roleId?: string;
  firstName?: string;
  lastName?: string;
  message?: string;
  expiresInDays?: number;
}

export interface InviteWithDetails {
  id: string;
  email: string;
  token: string;
  role: TenantRole;
  roleId?: string | null;
  roleName?: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  firstName: string | null;
  lastName: string | null;
  message: string | null;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  inviteUrl: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a secure random token
 */
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Build the invite URL from the Mkety application origin.
 */
function buildInviteUrl(tenantSlug: string, token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl.replace(/\/$/, '')}/t/${tenantSlug}/invite/${token}`;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Create a new invitation
 */
export async function createInvite(
  tenantSlug: string,
  input: CreateInviteInput,
): Promise<AdminActionResult<InviteWithDetails>> {
  const session = await requireTenantAdmin(tenantSlug);
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, tenantSlug),
    });

    if (!tenant) {
      return { success: false, error: 'Tenant not found' };
    }

    // Check if there's already a pending invite for this email
    const existingInvite = await db.query.tenantInvitations.findFirst({
      where: and(
        eq(schema.tenantInvitations.tenantId, tenant.id),
        eq(schema.tenantInvitations.email, input.email.toLowerCase()),
        eq(schema.tenantInvitations.status, 'pending'),
      ),
    });

    if (existingInvite) {
      return { success: false, error: 'An invitation for this email already exists' };
    }

    // Check if user is already a member
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.email, input.email.toLowerCase()),
    });

    if (existingUser) {
      const existingMembership = await db.query.tenantMemberships.findFirst({
        where: and(
          eq(schema.tenantMemberships.tenantId, tenant.id),
          eq(schema.tenantMemberships.userId, existingUser.id),
        ),
      });

      if (existingMembership) {
        return { success: false, error: 'This user is already a member of this organization' };
      }
    }

    // Resolve initial role ID: provided roleId, or tenant's "member" role
    let initialRoleId = input.roleId;
    if (!initialRoleId) {
      const memberRole = await db.query.roles.findFirst({
        where: and(eq(schema.roles.tenantId, tenant.id), eq(schema.roles.name, 'member')),
        columns: { id: true },
      });
      initialRoleId = memberRole?.id;
    }

    const token = generateToken();
    const expiresInDays = input.expiresInDays ?? 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const [invite] = await db
      .insert(schema.tenantInvitations)
      .values({
        tenantId: tenant.id,
        email: input.email.toLowerCase(),
        token,
        role: input.role ?? 'member',
        roleId: initialRoleId,
        firstName: input.firstName,
        lastName: input.lastName,
        message: input.message,
        invitedById: session.userId,
        expiresAt,
      })
      .returning();

    // Get inviter details
    const inviter = await db.query.users.findFirst({
      where: eq(schema.users.id, session.userId),
      columns: { id: true, name: true, email: true },
    });

    const inviteWithDetails: InviteWithDetails = {
      ...invite,
      roleId: invite.roleId ?? null,
      roleName: null,
      invitedBy: inviter ?? null,
      inviteUrl: buildInviteUrl(tenantSlug, token),
    };

    logger.info({ tenantSlug, inviteId: invite.id, email: input.email }, 'Tenant invite created');

    revalidatePath(`/t/${tenantSlug}/admin/invites`);

    return { success: true, data: inviteWithDetails };
  } catch (error) {
    logger.error({ tenantSlug, error }, 'Failed to create tenant invite');
    return { success: false, error: 'Failed to create invitation' };
  }
}

/**
 * List invitations for a tenant
 */
export async function listInvites(
  tenantSlug: string,
  page = 1,
  pageSize = 20,
): Promise<AdminActionResult<PaginatedResult<InviteWithDetails>>> {
  const session = await requireTenantAdmin(tenantSlug);
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, tenantSlug),
    });

    if (!tenant) {
      return { success: false, error: 'Tenant not found' };
    }

    const offset = (page - 1) * pageSize;

    const [invites, countResult] = await Promise.all([
      db.query.tenantInvitations.findMany({
        where: eq(schema.tenantInvitations.tenantId, tenant.id),
        orderBy: [desc(schema.tenantInvitations.createdAt)],
        limit: pageSize,
        offset,
        with: {
          invitedBy: {
            columns: { id: true, name: true, email: true },
          },
          roleRef: {
            columns: { id: true, name: true },
          },
        },
      }),
      db.$count(schema.tenantInvitations, eq(schema.tenantInvitations.tenantId, tenant.id)),
    ]);

    const data: InviteWithDetails[] = invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      token: invite.token,
      role: invite.role,
      roleId: invite.roleId ?? null,
      roleName: invite.roleRef?.name ?? null,
      status: invite.status,
      firstName: invite.firstName,
      lastName: invite.lastName,
      message: invite.message,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      invitedBy: invite.invitedBy,
      inviteUrl: buildInviteUrl(tenantSlug, invite.token),
    }));

    return {
      success: true,
      data: {
        items: data,
        pagination: {
          page,
          pageSize,
          total: countResult,
          totalPages: Math.ceil(countResult / pageSize),
        },
      },
    };
  } catch (error) {
    logger.error({ tenantSlug, error }, 'Failed to list tenant invites');
    return { success: false, error: 'Failed to list invitations' };
  }
}

/**
 * Get a single invitation
 */
export async function getInvite(tenantSlug: string, inviteId: string): Promise<AdminActionResult<InviteWithDetails>> {
  const session = await requireTenantAdmin(tenantSlug);
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, tenantSlug),
    });

    if (!tenant) {
      return { success: false, error: 'Tenant not found' };
    }

    const invite = await db.query.tenantInvitations.findFirst({
      where: and(eq(schema.tenantInvitations.id, inviteId), eq(schema.tenantInvitations.tenantId, tenant.id)),
      with: {
        invitedBy: {
          columns: { id: true, name: true, email: true },
        },
        roleRef: {
          columns: { id: true, name: true },
        },
      },
    });

    if (!invite) {
      return { success: false, error: 'Invitation not found' };
    }

    return {
      success: true,
      data: {
        id: invite.id,
        email: invite.email,
        token: invite.token,
        role: invite.role,
        roleId: invite.roleId ?? null,
        roleName: invite.roleRef?.name ?? null,
        status: invite.status,
        firstName: invite.firstName,
        lastName: invite.lastName,
        message: invite.message,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        invitedBy: invite.invitedBy,
        inviteUrl: buildInviteUrl(tenantSlug, invite.token),
      },
    };
  } catch (error) {
    logger.error({ tenantSlug, inviteId, error }, 'Failed to get invitation');
    return { success: false, error: 'Failed to get invitation' };
  }
}

/**
 * Revoke an invitation
 */
export async function revokeInvite(tenantSlug: string, inviteId: string): Promise<AdminActionResult> {
  const session = await requireTenantAdmin(tenantSlug);
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, tenantSlug),
    });

    if (!tenant) {
      return { success: false, error: 'Tenant not found' };
    }

    const result = await db
      .update(schema.tenantInvitations)
      .set({ status: 'revoked' })
      .where(and(eq(schema.tenantInvitations.id, inviteId), eq(schema.tenantInvitations.tenantId, tenant.id)))
      .returning({ id: schema.tenantInvitations.id });

    if (result.length === 0) {
      return { success: false, error: 'Invitation not found' };
    }

    revalidatePath(`/t/${tenantSlug}/admin/invites`);
    return { success: true };
  } catch (error) {
    logger.error({ tenantSlug, inviteId, error }, 'Failed to revoke invitation');
    return { success: false, error: 'Failed to revoke invitation' };
  }
}

/**
 * Resend an invitation (generates new token and extends expiry)
 */
export async function resendInvite(tenantSlug: string, inviteId: string): Promise<AdminActionResult<InviteWithDetails>> {
  const session = await requireTenantAdmin(tenantSlug);
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(schema.tenants.slug, tenantSlug),
    });

    if (!tenant) {
      return { success: false, error: 'Tenant not found' };
    }

    const existingInvite = await db.query.tenantInvitations.findFirst({
      where: and(eq(schema.tenantInvitations.id, inviteId), eq(schema.tenantInvitations.tenantId, tenant.id)),
    });

    if (!existingInvite) {
      return { success: false, error: 'Invitation not found' };
    }

    if (existingInvite.status !== 'pending') {
      return { success: false, error: 'Only pending invitations can be resent' };
    }

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [updatedInvite] = await db
      .update(schema.tenantInvitations)
      .set({ token, expiresAt })
      .where(and(eq(schema.tenantInvitations.id, inviteId), eq(schema.tenantInvitations.tenantId, tenant.id)))
      .returning();

    const inviter = await db.query.users.findFirst({
      where: eq(schema.users.id, updatedInvite.invitedById!),
      columns: { id: true, name: true, email: true },
    });

    revalidatePath(`/t/${tenantSlug}/admin/invites`);

    return {
      success: true,
      data: {
        ...updatedInvite,
        roleId: updatedInvite.roleId ?? null,
        roleName: null,
        invitedBy: inviter ?? null,
        inviteUrl: buildInviteUrl(tenantSlug, token),
      },
    };
  } catch (error) {
    logger.error({ tenantSlug, inviteId, error }, 'Failed to resend invitation');
    return { success: false, error: 'Failed to resend invitation' };
  }
}

/**
 * Validate an invitation token (public - no auth required)
 */
export async function validateInviteToken(token: string): Promise<
  AdminActionResult<{
    tenantSlug: string;
    tenantName: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    message: string | null;
    role: TenantRole;
  }>
> {
  try {
    const invite = await db.query.tenantInvitations.findFirst({
      where: eq(schema.tenantInvitations.token, token),
      with: {
        tenant: {
          columns: { slug: true, name: true },
        },
      },
    });

    if (!invite) {
      return { success: false, error: 'Invalid invitation' };
    }

    if (invite.status !== 'pending') {
      return { success: false, error: 'This invitation is no longer valid' };
    }

    if (invite.expiresAt < new Date()) {
      return { success: false, error: 'This invitation has expired' };
    }

    return {
      success: true,
      data: {
        tenantSlug: invite.tenant.slug,
        tenantName: invite.tenant.name,
        email: invite.email,
        firstName: invite.firstName,
        lastName: invite.lastName,
        message: invite.message,
        role: invite.role,
      },
    };
  } catch (error) {
    logger.error({ error }, 'Failed to validate invite token');
    return { success: false, error: 'Failed to validate invitation' };
  }
}

/**
 * Accept an invitation
 */
export async function acceptInvite(token: string): Promise<AdminActionResult<{ tenantSlug: string }>> {
  // Get current user
  const session = await (await import('@/shared/lib/auth')).auth();
  if (!session?.user?.id || !session?.user?.email) {
    return { success: false, error: 'You must be logged in to accept this invitation' };
  }

  try {
    const invite = await db.query.tenantInvitations.findFirst({
      where: eq(schema.tenantInvitations.token, token),
      with: {
        tenant: {
          columns: { slug: true, name: true },
        },
      },
    });

    if (!invite) {
      return { success: false, error: 'Invalid invitation' };
    }

    if (invite.status !== 'pending') {
      return { success: false, error: 'This invitation is no longer valid' };
    }

    if (invite.expiresAt < new Date()) {
      await db
        .update(schema.tenantInvitations)
        .set({ status: 'expired' })
        .where(eq(schema.tenantInvitations.id, invite.id));
      return { success: false, error: 'This invitation has expired' };
    }

    // Verify email matches
    if (session.user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return {
        success: false,
        error: `This invitation was sent to ${invite.email}. Please sign in with that email address.`,
      };
    }

    // Check if already a member
    const existingMembership = await db.query.tenantMemberships.findFirst({
      where: and(
        eq(schema.tenantMemberships.tenantId, invite.tenantId),
        eq(schema.tenantMemberships.userId, session.user.id),
      ),
    });

    if (existingMembership) {
      // Mark invite as accepted anyway
      await db
        .update(schema.tenantInvitations)
        .set({ status: 'accepted', acceptedAt: new Date() })
        .where(eq(schema.tenantInvitations.id, invite.id));
      return { success: true, data: { tenantSlug: invite.tenant.slug } };
    }

    // Create membership and assign initial role (prefer roleId; fallback to role name for backward compatibility)
    await db.transaction(async (tx) => {
      const [membership] = await tx
        .insert(schema.tenantMemberships)
        .values({
          tenantId: invite.tenantId,
          userId: session.user.id,
          role: invite.role,
        })
        .returning({ id: schema.tenantMemberships.id });

      let roleId = invite.roleId ?? null;
      if (!roleId) {
        const role = await tx.query.roles.findFirst({
          where: and(eq(schema.roles.tenantId, invite.tenantId), eq(schema.roles.name, invite.role)),
          columns: { id: true },
        });
        roleId = role?.id ?? null;
      }
      if (roleId) {
        await tx.insert(schema.tenantMembershipRoles).values({ membershipId: membership.id, roleId }).onConflictDoNothing();
      }

      await tx
        .update(schema.tenantInvitations)
        .set({ status: 'accepted', acceptedAt: new Date() })
        .where(eq(schema.tenantInvitations.id, invite.id));
    });

    logger.info({ tenantSlug: invite.tenant.slug, userId: session.user.id }, 'Tenant invite accepted');

    revalidatePath(`/t/${invite.tenant.slug}`);

    return { success: true, data: { tenantSlug: invite.tenant.slug } };
  } catch (error) {
    logger.error({ error }, 'Failed to accept invitation');
    return { success: false, error: 'Failed to accept invitation' };
  }
}

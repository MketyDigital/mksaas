import { redirect } from 'next/navigation';

import type { TenantRole } from '@/shared/db/schema/auth';
import { auth } from '@/shared/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Workspace/team entry point.
 *
 * A user with one workspace goes directly to that workspace's team manager.
 * A user with multiple workspaces chooses the workspace first.
 * Unauthenticated visitors stay on the public app instead of being sent to
 * a standalone /login page.
 */
export default async function TeamEntryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/');
  }

  const roles = (session.user.roles ?? {}) as Record<string, TenantRole>;
  const tenantSlugs = Object.keys(roles);

  if (tenantSlugs.length === 0) {
    redirect('/create-workspace');
  }

  if (tenantSlugs.length > 1) {
    redirect('/select-tenant');
  }

  redirect(`/t/${tenantSlugs[0]}/admin/members`);
}

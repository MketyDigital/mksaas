import { redirect } from 'next/navigation';

import type { TenantRole } from '@/shared/db/schema/auth';
import { auth } from '@/shared/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AppEntryPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const roles = (session.user.roles ?? {}) as Record<string, TenantRole>;
  const tenants = Object.keys(roles);

  if (tenants.length === 0) redirect('/create-workspace');
  if (tenants.length === 1) redirect(`/t/${tenants[0]}`);
  redirect('/select-tenant');
}

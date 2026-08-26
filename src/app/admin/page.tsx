import { redirect } from 'next/navigation';

import type { TenantRole } from '@/shared/db/schema/auth';
import { auth } from '@/shared/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminEntryPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const roles = (session.user.roles ?? {}) as Record<string, TenantRole>;
  const adminTenant = Object.entries(roles).find(([, role]) => role === 'admin')?.[0];

  if (adminTenant) redirect(`/t/${adminTenant}/admin`);
  if (Object.keys(roles).length === 1) redirect(`/t/${Object.keys(roles)[0]}`);
  redirect('/select-tenant');
}

import { redirect } from 'next/navigation';

import { isPlatformControlTenant, isPlatformOperatorEmail } from '@/features/platform-content/server/authorization';
import type { TenantRole } from '@/shared/db/schema/auth';
import { auth } from '@/shared/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminEntryPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const roles = (session.user.roles ?? {}) as Record<string, TenantRole>;
  const platformTenant = session.user.email && isPlatformOperatorEmail(session.user.email)
    ? Object.keys(roles).find((slug) => isPlatformControlTenant(slug) && roles[slug] === 'admin')
    : undefined;
  const adminTenant = platformTenant ?? Object.entries(roles).find(([, role]) => role === 'admin')?.[0];

  if (adminTenant) redirect(`/app/${adminTenant}/admin`);
  if (Object.keys(roles).length === 1) redirect(`/app/${Object.keys(roles)[0]}`);
  redirect('/select-tenant');
}

import { redirect } from 'next/navigation';

import { auth } from '@/shared/lib/auth';

export const dynamic = 'force-dynamic';

export default async function TeamEntryPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const roles = session.user.roles ?? {};
  const tenantSlugs = Object.keys(roles);
  if (tenantSlugs.length === 0) redirect('/create-workspace');
  if (tenantSlugs.length > 1) redirect('/select-tenant');
  redirect(`/t/${tenantSlugs[0]}/admin/members`);
}

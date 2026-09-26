import { notFound, redirect } from 'next/navigation';

export const metadata = {
  title: 'Mkety Ops',
  robots: { index: false, follow: false, nocache: true },
};

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export default function MketyOpsEntryPage() {
  const tenant = process.env.MKETY_PLATFORM_CONTROL_TENANT_SLUG?.trim().toLowerCase();
  if (!tenant || !SLUG_PATTERN.test(tenant)) notFound();

  redirect(`/t/${tenant}/admin/platform-control`);
}

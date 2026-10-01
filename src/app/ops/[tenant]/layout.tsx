import Link from 'next/link';
import type { ReactNode } from 'react';

import { requirePlatformControlAccess } from '@/features/platform-content/server/authorization';
import { withRequestDatabase } from '@/shared/db/request';

export const dynamic = 'force-dynamic';

interface OpsTenantLayoutProps {
  children: ReactNode;
  params: Promise<{ tenant: string }>;
}

export default async function OpsTenantLayout({ children, params }: OpsTenantLayoutProps) {
  const { tenant } = await params;

  await withRequestDatabase(() => requirePlatformControlAccess(tenant));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Mkety Internal Ops</p>
            <p className="text-sm text-muted-foreground">Isolated Platform Control surface</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link className="font-medium text-primary hover:underline" href={`/ops/${tenant}/platform-control`}>
              Control Center
            </Link>
            <Link className="text-muted-foreground hover:text-foreground" href={`/t/${tenant}`}>
              Workspace
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
    </main>
  );
}
